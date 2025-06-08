const express = require("express");
const router = express.Router();
const elasticService = require("../services/elasticSearch");
const ragService = require("../services/rag");

// Get all emails with pagination and filters
router.get("/", async (req, res) => {
  try {
    const {
      q = "",
      account,
      folder,
      category,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = {
      account,
      folder,
      category,
      dateFrom,
      dateTo,
      from: (page - 1) * limit,
      size: parseInt(limit),
    };

    const result = await elasticService.searchEmails(q, filters);

    res.json({
      success: true,
      data: result.emails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / limit),
      },
      filters: {
        query: q,
        account,
        folder,
        category,
        dateFrom,
        dateTo,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching emails:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch emails",
    });
  }
});

// Get email by ID
router.get("/:id", async (req, res) => {
  try {
    const email = await elasticService.getEmailById(req.params.id);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: "Email not found",
      });
    }

    res.json({
      success: true,
      data: email,
    });
  } catch (error) {
    console.error("❌ Error fetching email:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch email",
    });
  }
});

// Semantic search using RAG
router.post("/search/semantic", async (req, res) => {
  try {
    const { query, limit = 10, minScore = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Search query is required",
      });
    }

    const results = await ragService.semanticSearch(query, {
      limit: parseInt(limit),
      minScore: parseFloat(minScore),
    });

    res.json({
      success: true,
      data: results,
      metadata: {
        query,
        resultCount: results.length,
        searchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error performing semantic search:", error);
    res.status(500).json({
      success: false,
      error: "Failed to perform semantic search",
    });
  }
});

module.exports = router;
