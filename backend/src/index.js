const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const emailSyncService = require("./services/emailSync");
const elasticService = require("./services/elasticSearch");
const aiService = require("./services/categorization");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Store socket instance globally
global.io = io;

// Routes
app.use("/api/emails", require("./routes/email"));
app.use("/api", require("./routes/aiSuggestion"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Initialize services
async function initializeServices() {
  try {
    console.log("🔧 Initializing services...");

    // Initialize Elasticsearch
    await elasticService.initialize();
    console.log("✅ Elasticsearch initialized");

    // Initialize AI services
    await aiService.initialize();
    console.log("✅ AI categorization service initialized");

    // Start email synchronization
    await emailSyncService.startSync();
    console.log("✅ Email sync service started");

    console.log("🚀 All services initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize services:", error);
    process.exit(1);
  }
}

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("📱 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("📱 Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`🌟 Server running on port ${PORT}`);
  await initializeServices();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 Shutting down gracefully...");
  await emailSyncService.stopSync();
  server.close(() => {
    console.log("👋 Server shut down");
    process.exit(0);
  });
});
