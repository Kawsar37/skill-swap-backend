const dns = require("node:dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);

require("dotenv").config();

const taskRoutes = require("./routes/taskRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    credentials: true,
    origin: [process.env.FRONTEND_URL],
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

async function run() {
  try {
    await client.connect();

    // 🚨 CRITICAL: It MUST be "global.db", NOT "const db"
    global.db = client.db("skill-swap");

    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB (skill-swap)!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.use("/api/tasks", taskRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
