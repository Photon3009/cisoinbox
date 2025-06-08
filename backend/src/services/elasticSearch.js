const { Client } = require("@elastic/elasticsearch");
const { v4: uuidv4 } = require("uuid");

class ElasticsearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
    });
    this.index = process.env.ELASTICSEARCH_INDEX || "emails";
  }

  async initialize() {
    try {
      // Check if Elasticsearch is running
      await this.client.ping();
      console.log("✅ Elasticsearch connection established");

      // Create index if it doesn't exist
      await this.createIndex();
      console.log("✅ Elasticsearch index ready");
    } catch (error) {
      console.error("❌ Elasticsearch initialization failed:", error);
      throw error;
    }
  }

  async createIndex() {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.index,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.index,
          body: {
            mappings: {
              properties: {
                uid: { type: "keyword" },
                account: { type: "keyword" },
                accountEmail: { type: "keyword" },
                subject: {
                  type: "text",
                  analyzer: "standard",
                  fields: {
                    keyword: { type: "keyword" },
                  },
                },
                from: {
                  type: "text",
                  analyzer: "standard",
                  fields: {
                    keyword: { type: "keyword" },
                  },
                },
                to: {
                  type: "text",
                  analyzer: "standard",
                  fields: {
                    keyword: { type: "keyword" },
                  },
                },
                body: {
                  type: "text",
                  analyzer: "standard",
                },
                date: { type: "date" },
                folder: { type: "keyword" },
                category: { type: "keyword" },
                messageId: { type: "keyword" },
                processed: { type: "boolean" },
                createdAt: { type: "date" },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: "custom",
                    tokenizer: "standard",
                    filter: ["lowercase", "stop"],
                  },
                },
              },
            },
          },
        });
        console.log(`✅ Created index: ${this.index}`);
      } else {
        console.log(`✅ Index already exists: ${this.index}`);
      }
    } catch (error) {
      if (
        error.meta?.body?.error?.type !== "resource_already_exists_exception"
      ) {
        throw error;
      }
    }
  }

  async indexEmail(emailData) {
    try {
      const docId = uuidv4();
      const document = {
        ...emailData,
        processed: false,
        createdAt: new Date().toISOString(),
      };

      await this.client.index({
        index: this.index,
        id: docId,
        body: document,
      });

      console.log(`📑 Indexed email: ${docId}`);
      return docId;
    } catch (error) {
      console.error("❌ Error indexing email:", error);
      throw error;
    }
  }

  async updateEmailCategory(docId, category) {
    try {
      await this.client.update({
        index: this.index,
        id: docId,
        body: {
          doc: {
            category: category,
            processed: true,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error("❌ Error updating email category:", error);
      throw error;
    }
  }

  // In your elasticSearch.js file, update the searchEmails method:

  async searchEmails(query, filters = {}) {
    try {
      const searchBody = {
        query: {
          bool: {
            must: [],
            filter: [],
          },
        },
        from: filters.from || 0,
        size: filters.size || 20,
        sort: [{ date: { order: "desc" } }],
      };

      // Add text search if query provided
      if (query && query.trim()) {
        searchBody.query.bool.must.push({
          multi_match: {
            query: query,
            fields: ["subject^2", "body", "from.name", "from.email"],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        });
      } else {
        // If no query, match all documents
        searchBody.query.bool.must.push({
          match_all: {},
        });
      }

      // Add filters
      if (filters.account) {
        searchBody.query.bool.filter.push({
          term: { "account.keyword": filters.account },
        });
      }

      if (filters.folder) {
        searchBody.query.bool.filter.push({
          term: { "folder.keyword": filters.folder },
        });
      }

      if (filters.category) {
        searchBody.query.bool.filter.push({
          term: { "category.keyword": filters.category },
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        const dateRange = {};
        if (filters.dateFrom) dateRange.gte = filters.dateFrom;
        if (filters.dateTo) dateRange.lte = filters.dateTo;

        searchBody.query.bool.filter.push({
          range: { date: dateRange },
        });
      }

      console.log(
        "Elasticsearch search body:",
        JSON.stringify(searchBody, null, 2)
      );

      // Perform the search
      const response = await this.client.search({
        index: this.emailIndex, // Make sure this.emailIndex is defined
        body: searchBody,
      });

      console.log("Elasticsearch response:", JSON.stringify(response, null, 2));

      // Check if response has the expected structure
      if (!response || !response.hits) {
        console.error("Invalid Elasticsearch response structure:", response);
        throw new Error("Invalid Elasticsearch response structure");
      }

      // Extract emails from hits
      const emails = response.hits.hits.map((hit) => ({
        id: hit._id,
        ...hit._source,
        score: hit._score,
      }));

      return {
        emails,
        total: response.hits.total.value || response.hits.total || 0,
      };
    } catch (error) {
      console.error("Error searching emails:", error);

      // If it's a connection error, provide more specific info
      if (error.name === "ConnectionError" || error.code === "ECONNREFUSED") {
        throw new Error(
          "Unable to connect to Elasticsearch. Please ensure Elasticsearch is running."
        );
      }

      // If it's an index error
      if (
        error.body &&
        error.body.error &&
        error.body.error.type === "index_not_found_exception"
      ) {
        throw new Error(
          `Elasticsearch index '${this.emailIndex}' not found. Please create the index first.`
        );
      }

      throw error;
    }
  }

  async getEmailById(id) {
    try {
      const response = await this.client.get({
        index: this.index,
        id: id,
      });

      return {
        id: response.body._id,
        ...response.body._source,
      };
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      console.error("❌ Error getting email by ID:", error);
      throw error;
    }
  }

  async getEmailStats() {
    try {
      const response = await this.client.search({
        index: this.index,
        body: {
          size: 0,
          aggs: {
            by_category: {
              terms: { field: "category" },
            },
            by_account: {
              terms: { field: "account" },
            },
            by_date: {
              date_histogram: {
                field: "date",
                calendar_interval: "day",
                min_doc_count: 1,
              },
            },
            total_emails: {
              value_count: { field: "_id" },
            },
          },
        },
      });

      return {
        totalEmails: response.body.aggregations.total_emails.value,
        byCategory: response.body.aggregations.by_category.buckets,
        byAccount: response.body.aggregations.by_account.buckets,
        byDate: response.body.aggregations.by_date.buckets,
      };
    } catch (error) {
      console.error("❌ Error getting email stats:", error);
      throw error;
    }
  }

  async deleteEmail(id) {
    try {
      await this.client.delete({
        index: this.index,
        id: id,
      });
      return true;
    } catch (error) {
      console.error("❌ Error deleting email:", error);
      throw error;
    }
  }

  async bulkIndex(emails) {
    if (!emails || emails.length === 0) return [];

    try {
      const body = [];
      const ids = [];

      emails.forEach((email) => {
        const docId = uuidv4();
        ids.push(docId);

        body.push({
          index: {
            _index: this.index,
            _id: docId,
          },
        });

        body.push({
          ...email,
          processed: false,
          createdAt: new Date().toISOString(),
        });
      });

      const response = await this.client.bulk({ body });

      if (response.body.errors) {
        console.error("❌ Bulk indexing errors:", response.body.items);
      }

      console.log(`📑 Bulk indexed ${emails.length} emails`);
      return ids;
    } catch (error) {
      console.error("❌ Error in bulk indexing:", error);
      throw error;
    }
  }
}

module.exports = new ElasticsearchService();
