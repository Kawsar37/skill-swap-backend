const dns = require("node:dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);

require("dotenv").config();

const taskRoutes = require("./routes/taskRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI;
const app = express();
const PORT = process.env.PORT || 8000;

app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function initDB() {
  if (global.db) return;
  try {
    await client.connect();
    global.db = client.db("skill-swap");
    console.log("✅ Successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

app.use(async (req, res, next) => {
  try {
    await initDB();
    next();
  } catch (error) {
    res.status(500).json({
      error: "Database connection failed on Vercel.",
      details: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.use("/api/tasks", taskRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
