const { GoogleGenerativeAI } = require('@google/generative-ai');

class AICategorization {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    this.categories = {
      INTERESTED: 'Interested',
      MEETING_BOOKED: 'Meeting Booked',
      NOT_INTERESTED: 'Not Interested',
      SPAM: 'Spam',
      OUT_OF_OFFICE: 'Out of Office'
    };

    this.systemPrompt = `You are an AI assistant that categorizes emails based on their content. 
    
You must categorize emails into exactly one of these categories:
- "Interested": Emails showing positive interest, engagement, or potential for business/opportunities
- "Meeting Booked": Emails about scheduling, confirming, or booking meetings/calls/interviews
- "Not Interested": Emails showing disinterest, rejection, or declining offers
- "Spam": Promotional emails, advertisements, automated marketing emails, or irrelevant content
- "Out of Office": Auto-reply messages indicating the person is away or unavailable

Analyze the email content including subject and body, then respond with only the category name (exact match required).

Examples:
- "Thanks for reaching out, this looks interesting" → Interested
- "Let's schedule a call for next week" → Meeting Booked  
- "Not interested at this time" → Not Interested
- "I'm currently out of office until..." → Out of Office
- "Buy now! Limited time offer!" → Spam`;

    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50,
      }
    });
  }

  async initialize() {
    try {
      // Test the Gemini API connection with a simple request
      const testPrompt = "Test connection";
      await this.model.generateContent(testPrompt);
      console.log('✅ Google Gemini API connection established');
    } catch (error) {
      console.error('❌ Google Gemini API initialization failed:', error);
      throw error;
    }
  }

  async categorizeEmail(emailData) {
    try {
      const emailContent = this.prepareEmailContent(emailData);
      
      const prompt = `${this.systemPrompt}\n\nEmail to categorize:\n${emailContent}`;
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const category = response.text().trim();
      
      // Validate category
      const validCategories = Object.values(this.categories);
      if (validCategories.includes(category)) {
        return category;
      } else {
        console.warn(`⚠️ Invalid category returned: ${category}, defaulting to Spam`);
        return this.categories.SPAM;
      }
    } catch (error) {
      console.error('❌ Error categorizing email:', error);
      // Fallback categorization based on keywords
      return this.fallbackCategorization(emailData);
    }
  }

  prepareEmailContent(emailData) {
    const subject = emailData.subject || '';
    const body = emailData.body || '';
    const from = emailData.from || '';
    
    // Truncate body to avoid token limits
    const truncatedBody = body.length > 2000 ? body.substring(0, 2000) + '...' : body;
    
    return `From: ${from}
Subject: ${subject}
Body: ${truncatedBody}`;
  }

  fallbackCategorization(emailData) {
    const content = `${emailData.subject} ${emailData.body}`.toLowerCase();
    
    // Out of Office patterns
    const outOfOfficeKeywords = [
      'out of office', 'away from office', 'currently unavailable',
      'automatic reply', 'auto reply', 'vacation', 'holiday',
      'will be back', 'returning on', 'away until'
    ];
    
    if (outOfOfficeKeywords.some(keyword => content.includes(keyword))) {
      return this.categories.OUT_OF_OFFICE;
    }
    
    // Meeting/Schedule patterns
    const meetingKeywords = [
      'schedule', 'meeting', 'call', 'appointment', 'interview',
      'book', 'available', 'calendar', 'time slot', 'zoom',
      'teams meeting', 'conference call'
    ];
    
    if (meetingKeywords.some(keyword => content.includes(keyword))) {
      return this.categories.MEETING_BOOKED;
    }
    
    // Interest patterns
    const interestedKeywords = [
      'interested', 'looks good', 'sounds great', 'tell me more',
      'learn more', 'discuss', 'explore', 'potential', 'opportunity',
      'impressed', 'exciting', 'perfect timing', 'exactly what'
    ];
    
    if (interestedKeywords.some(keyword => content.includes(keyword))) {
      return this.categories.INTERESTED;
    }
    
    // Not interested patterns
    const notInterestedKeywords = [
      'not interested', 'no thanks', 'not right now', 'pass',
      'decline', 'reject', 'not suitable', 'not looking',
      'remove me', 'unsubscribe', 'stop sending'
    ];
    
    if (notInterestedKeywords.some(keyword => content.includes(keyword))) {
      return this.categories.NOT_INTERESTED;
    }
    
    // Spam patterns
    const spamKeywords = [
      'buy now', 'limited time', 'free', 'offer expires',
      'click here', 'act now', 'special deal', 'discount',
      'winner', 'congratulations', 'claim your', 'urgent'
    ];
    
    if (spamKeywords.some(keyword => content.includes(keyword))) {
      return this.categories.SPAM;
    }
    
    // Default to Spam if no clear category
    return this.categories.SPAM;
  }

  async categorizeBatch(emails) {
    const results = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => this.categorizeEmail(email));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add delay between batches
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('❌ Error in batch categorization:', error);
        // Add fallback results for failed batch
        results.push(...batch.map(email => this.fallbackCategorization(email)));
      }
    }
    
    return results;
  }

  async categorizeWithContext(emailData, previousEmails = []) {
    try {
      const emailContent = this.prepareEmailContent(emailData);
      
      // Add context from previous emails in the thread
      let contextContent = '';
      if (previousEmails.length > 0) {
        contextContent = '\n\nPrevious emails in thread:\n';
        previousEmails.slice(-3).forEach((email, index) => {
          contextContent += `${index + 1}. Subject: ${email.subject}\nBody: ${email.body.substring(0, 200)}...\n\n`;
        });
      }
      
      const prompt = `${this.systemPrompt}\n\nEmail to categorize:\n${emailContent}${contextContent}`;
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const category = response.text().trim();
      
      // Validate category
      const validCategories = Object.values(this.categories);
      if (validCategories.includes(category)) {
        return category;
      } else {
        console.warn(`⚠️ Invalid category returned: ${category}, defaulting to Spam`);
        return this.categories.SPAM;
      }
    } catch (error) {
      console.error('❌ Error categorizing email with context:', error);
      return this.fallbackCategorization(emailData);
    }
  }

  async categorizeWithSentiment(emailData) {
    try {
      const emailContent = this.prepareEmailContent(emailData);
      
      const sentimentPrompt = `${this.systemPrompt}

Additionally, provide a sentiment score from 1-10 where:
1-3 = Negative sentiment
4-6 = Neutral sentiment  
7-10 = Positive sentiment

Respond in this exact format:
Category: [CATEGORY_NAME]
Sentiment: [NUMBER]`;
      
      const prompt = `${sentimentPrompt}\n\nEmail to categorize:\n${emailContent}`;
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // Parse the response
      const categoryMatch = text.match(/Category:\s*(.+)/);
      const sentimentMatch = text.match(/Sentiment:\s*(\d+)/);
      
      const category = categoryMatch ? categoryMatch[1].trim() : this.categories.SPAM;
      const sentiment = sentimentMatch ? parseInt(sentimentMatch[1]) : 5;
      
      // Validate category
      const validCategories = Object.values(this.categories);
      const finalCategory = validCategories.includes(category) ? category : this.categories.SPAM;
      
      return {
        category: finalCategory,
        sentiment: Math.max(1, Math.min(10, sentiment)) // Ensure sentiment is between 1-10
      };
    } catch (error) {
      console.error('❌ Error categorizing email with sentiment:', error);
      return {
        category: this.fallbackCategorization(emailData),
        sentiment: 5
      };
    }
  }

  getCategories() {
    return Object.values(this.categories);
  }

  getCategoryStats(emails) {
    const stats = {};
    Object.values(this.categories).forEach(category => {
      stats[category] = 0;
    });

    emails.forEach(email => {
      if (email.category && stats.hasOwnProperty(email.category)) {
        stats[email.category]++;
      }
    });

    return stats;
  }

  getCategoryWithConfidence(emailData) {
    // Simple confidence scoring based on keyword matches
    const content = `${emailData.subject} ${emailData.body}`.toLowerCase();
    const categories = {
      [this.categories.OUT_OF_OFFICE]: [
        'out of office', 'away from office', 'currently unavailable',
        'automatic reply', 'auto reply', 'vacation', 'holiday'
      ],
      [this.categories.MEETING_BOOKED]: [
        'schedule', 'meeting', 'call', 'appointment', 'interview',
        'book', 'available', 'calendar', 'time slot'
      ],
      [this.categories.INTERESTED]: [
        'interested', 'looks good', 'sounds great', 'tell me more',
        'learn more', 'discuss', 'explore', 'potential'
      ],
      [this.categories.NOT_INTERESTED]: [
        'not interested', 'no thanks', 'not right now', 'pass',
        'decline', 'reject', 'not suitable'
      ],
      [this.categories.SPAM]: [
        'buy now', 'limited time', 'free', 'offer expires',
        'click here', 'act now', 'special deal'
      ]
    };

    let bestMatch = { category: this.categories.SPAM, confidence: 0 };
    
    Object.entries(categories).forEach(([category, keywords]) => {
      const matches = keywords.filter(keyword => content.includes(keyword)).length;
      const confidence = matches / keywords.length;
      
      if (confidence > bestMatch.confidence) {
        bestMatch = { category, confidence };
      }
    });

    return bestMatch;
  }
}

module.exports = new AICategorization();