const express = require("express");
const router = express.Router();

router.post("/suggest-reply", async (req, res) => {
  try {
    const { tone = "professional", includeContext = true } = req.body;

    const email = await elasticService.getEmailById(req.params.id);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: "Email not found",
      });
    }

    const suggestions = await ragService.generateReplysuggestions(email, {
      tone,
      includeContext,
    });

    res.json({
      success: true,
      data: {
        originalEmail: email,
        suggestions: suggestions,
        metadata: {
          tone,
          includeContext,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error generating reply suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate reply suggestions",
    });
  }
});

module.exports = router;
