const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

// ==========================================
// POST /api/tasks - Create a new task (Client)
// ==========================================
router.post("/", async (req, res) => {
  try {
    const { title, category, description, budget, deadline, client_email } =
      req.body;

    if (!title || !category || !budget || !deadline || !client_email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tasksCollection = global.db.collection("tasks");

    const newTask = {
      title,
      category,
      description: description || "",
      budget: parseFloat(budget),
      deadline: new Date(deadline),
      client_email,
      status: "open", // Default state per assignment
      deliverable_url: "",
      createdAt: new Date(),
    };

    const result = await tasksCollection.insertOne(newTask);
    res
      .status(201)
      .json({ message: "Task posted successfully", taskId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /api/tasks - Browse Tasks (Public / Freelancer)
// Challenge 1: Search & Category Filter
// Challenge 3: Pagination (Limit 9)
// ==========================================
router.get("/", async (req, res) => {
  try {
    // Extract query parameters from the URL (e.g., ?search=logo&category=Design&page=1)
    const { search, category, page = 1, limit = 9 } = req.query;
    const tasksCollection = global.db.collection("tasks");

    const query = {};

    // 1. Challenge 1: Basic Title Search (Case-insensitive regex)
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // 2. Challenge 1: Simple Category Filtering
    if (category && category !== "All" && category !== "") {
      query.category = category;
    }

    // 3. Challenge 3: Pagination Calculation
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count of matching tasks (needed for the Pagination UI on the frontend)
    const totalTasks = await tasksCollection.countDocuments(query);

    // Get the actual paginated tasks
    const tasks = await tasksCollection
      .find(query)
      .sort({ createdAt: -1 }) // Show newest tasks first
      .skip(skip)
      .limit(limitNumber)
      .toArray();

    res.json({
      tasks,
      totalPages: Math.ceil(totalTasks / limitNumber),
      currentPage: pageNumber,
      totalTasks,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /api/tasks/:id - Get Single Task Details
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const tasksCollection = global.db.collection("tasks");
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Task ID format" });
    }

    const task = await tasksCollection.findOne({ _id: new ObjectId(id) });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
