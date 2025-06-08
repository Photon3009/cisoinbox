const fs = require("fs").promises;
const path = require("path");
const { HNSWLib } = require("hnswlib-node");
const { GoogleGenerativeAI } = require("@google/generative-ai");

class RAGService {
  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    this.model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

    this.vectorStore = null;
    this.embeddings = [];
    this.documents = [];
    this.vectorDbPath = process.env.VECTOR_DB_PATH || "./vector_db";
    this.meetingLink = process.env.MEETING_LINK || "https://cal.com/example";
    this.productDescription =
      process.env.PRODUCT_DESCRIPTION || "Our product/service";

    this.trainingData = [
      {
        id: "interested_response_1",
        context: "Job application - interested response",
        email:
          "Hi, Your resume has been shortlisted. When will be a good time for you to attend the technical interview?",
        reply: `Thank you for shortlisting my profile! I'm available for a technical interview. You can book a slot here: ${this.meetingLink}`,
      },
      {
        id: "interested_response_2",
        context: "Meeting request - positive response",
        email:
          "We would like to schedule a call to discuss the opportunity further.",
        reply: `I'd be happy to discuss the opportunity! Please feel free to book a convenient time slot: ${this.meetingLink}`,
      },
      {
        id: "interested_response_3",
        context: "Follow-up - interested",
        email:
          "Thanks for your application. We are interested in learning more about your background.",
        reply: `Thank you for your interest! I'd be glad to share more about my background. You can schedule a call at your convenience: ${this.meetingLink}`,
      },
      {
        id: "interested_response_4",
        context: "Business opportunity - interested",
        email:
          "Your profile looks interesting for our project. Can we set up a time to chat?",
        reply: `I'm excited about the opportunity to contribute to your project! Please book a suitable time for our conversation: ${this.meetingLink}`,
      },
      {
        id: "interested_response_5",
        context: "Interview invitation",
        email: "We would like to invite you for an interview next week.",
        reply: `Thank you for the interview invitation! I'm available next week. You can choose a convenient time slot: ${this.meetingLink}`,
      },
    ];
  }

  async initialize() {
    try {
      await this.ensureVectorDbDirectory();
      await this.loadOrCreateVectorStore();
      console.log("✅ RAG service initialized");
    } catch (error) {
      console.error("❌ RAG service initialization failed:", error);
      throw error;
    }
  }

  async ensureVectorDbDirectory() {
    try {
      await fs.mkdir(this.vectorDbPath, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  async loadOrCreateVectorStore() {
    const indexPath = path.join(this.vectorDbPath, "index.bin");
    const dataPath = path.join(this.vectorDbPath, "data.json");

    try {
      // Try to load existing vector store
      const data = await fs.readFile(dataPath, "utf8");
      this.documents = JSON.parse(data);

      // Initialize vector store with existing data
      this.vectorStore = new HNSWLib("cosine", 1536); // OpenAI embeddings dimension
      this.vectorStore.readIndex(indexPath, this.documents.length);

      console.log(
        `✅ Loaded existing vector store with ${this.documents.length} documents`
      );
    } catch (error) {
      // Create new vector store
      console.log("📝 Creating new vector store...");
      await this.createVectorStore();
    }
  }

  async createVectorStore() {
    try {
      // Generate embeddings for training data
      const embeddings = await this.generateEmbeddings(
        this.trainingData.map((item) => `${item.context}: ${item.email}`)
      );

      // Initialize vector store
      this.vectorStore = new HNSWLib("cosine", 1536);
      this.vectorStore.initIndex(this.trainingData.length);

      // Add embeddings to vector store
      for (let i = 0; i < embeddings.length; i++) {
        this.vectorStore.addPoint(embeddings[i], i);
      }

      this.documents = this.trainingData;
      this.embeddings = embeddings;

      // Save to disk
      await this.saveVectorStore();

      console.log(
        `✅ Created vector store with ${this.documents.length} documents`
      );
    } catch (error) {
      console.error("❌ Error creating vector store:", error);
      throw error;
    }
  }

  async saveVectorStore() {
    try {
      const indexPath = path.join(this.vectorDbPath, "index.bin");
      const dataPath = path.join(this.vectorDbPath, "data.json");

      this.vectorStore.writeIndex(indexPath);
      await fs.writeFile(dataPath, JSON.stringify(this.documents, null, 2));

      console.log("💾 Vector store saved to disk");
    } catch (error) {
      console.error("❌ Error saving vector store:", error);
      throw error;
    }
  }

  async generateEmbeddings(texts) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: texts,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error("❌ Error generating embeddings:", error);
      throw error;
    }
  }

  async suggestReply(emailData) {
    try {
      const emailContent = `${emailData.subject || ""} ${
        emailData.body || ""
      }`.trim();

      if (!emailContent) {
        return {
          success: false,
          error: "No email content provided",
        };
      }

      // Generate embedding for the input email
      const queryEmbedding = await this.generateEmbeddings([emailContent]);

      // Find similar emails in vector store
      const results = this.vectorStore.searchKnn(queryEmbedding[0], 3);

      // Get relevant documents
      const relevantDocs = results.neighbors.map((idx) => this.documents[idx]);

      // Generate reply using GPT with RAG context
      const reply = await this.generateReplyWithContext(
        emailData,
        relevantDocs
      );

      return {
        success: true,
        suggestedReply: reply,
        confidence: this.calculateConfidence(results.distances),
        relevantExamples: relevantDocs.map((doc) => ({
          context: doc.context,
          email: doc.email,
          reply: doc.reply,
        })),
      };
    } catch (error) {
      console.error("❌ Error suggesting reply:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async generateReplyWithContext(emailData, relevantDocs) {
    const systemPrompt = `You are an AI assistant that helps generate professional email replies based on similar examples.

Your role:
- Generate professional, concise replies for interested emails
- Always include the meeting booking link when appropriate: ${this.meetingLink}
- Match the tone and style of the provided examples
- Keep replies short and actionable

Product/Service Context: ${this.productDescription}

Here are some similar examples for reference:
${relevantDocs
  .map(
    (doc) =>
      `Example Context: ${doc.context}\nOriginal Email: "${doc.email}"\nReply: "${doc.reply}"`
  )
  .join("\n\n")}
`;

    const userPrompt = `Please generate a professional reply for this email:

From: ${emailData.from || "Unknown"}
Subject: ${emailData.subject || "No Subject"}
Body: ${emailData.body || "No content"}

Generate a positive, professional response that includes the meeting booking link when appropriate.`;

    try {
      const result = await this.model.generateContent([
        { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
      ]);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("❌ Error generating reply with Gemini:", error);
      throw error;
    }
  }

  //   calculateConfidence(distances) {
  //     if (!distances || distances.length === 0) return 0;

  //     // Convert cosine distance to similarity (0-1)
  //     const similarities = distances.map((d) => 1 - d);
  //     const avgSimilarity =
  //       similarities.reduce((a, b) => a + b, 0) / similarities.length;

  //     return Math.round(avgSimilarity * 100);
  //   }

  //   async addTrainingExample(context, email, reply) {
  //     try {
  //       const newDoc = {
  //         id: `custom_${Date.now()}`,
  //         context,
  //         email,
  //         reply,
  //       };

  //       // Generate embedding for new document
  //       const embedding = await this.generateEmbeddings([`${context}: ${email}`]);

  //       // Add to vector store
  //       const newIndex = this.documents.length;
  //       this.vectorStore.addPoint(embedding[0], newIndex);

  //       // Add to documents array
  //       this.documents.push(newDoc);
  //       this.embeddings.push(embedding[0]);

  //       // Save updated vector store
  //       await this.saveVectorStore();

  //       console.log("✅ Added new training example");
  //       return newDoc;
  //     } catch (error) {
  //       console.error("❌ Error adding training example:", error);
  //       throw error;
  //     }
  //   }

  //   async getTrainingData() {
  //     return this.documents;
  //   }

  //   async updateMeetingLink(newLink) {
  //     this.meetingLink = newLink;

  //     // Update existing training data
  //     this.documents = this.documents.map((doc) => ({
  //       ...doc,
  //       reply: doc.reply.replace(/https:\/\/cal\.com\/\w+/g, newLink),
  //     }));

  //     await this.saveVectorStore();
  //     console.log("✅ Updated meeting link in training data");
  //   }

  //   getStats() {
  //     return {
  //       totalDocuments: this.documents.length,
  //       meetingLink: this.meetingLink,
  //       productDescription: this.productDescription,
  //       vectorStoreInitialized: !!this.vectorStore,
  //     };
  //   }
}

module.exports = new RAGService();
