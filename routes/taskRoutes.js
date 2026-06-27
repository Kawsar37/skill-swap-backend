const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

// ==========================================
// 1. POST /api/tasks - Create a new task (Client)
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
      status: "open",
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
// 2. GET /api/tasks - Browse Tasks (Public / Freelancer)
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { search, category, page = 1, limit = 9 } = req.query;
    const tasksCollection = global.db.collection("tasks");
    const query = {};

    if (search) query.title = { $regex: search, $options: "i" };
    if (category && category !== "All" && category !== "")
      query.category = category;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const totalTasks = await tasksCollection.countDocuments(query);
    const tasks = await tasksCollection
      .find(query)
      .sort({ createdAt: -1 })
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

// 🚨 CRITICAL: SPECIFIC ROUTES MUST COME BEFORE /:id 🚨

// ==========================================
// 3. GET /api/tasks/client/:email - Get Client's Tasks
// ==========================================
router.get("/client/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const tasksCollection = global.db.collection("tasks");
    const tasks = await tasksCollection
      .find({ client_email: email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. GET /api/tasks/freelancer-projects/:email - Get Active & Completed Projects
// ==========================================
router.get("/freelancer-projects/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const proposalsCollection = global.db.collection("proposals");
    const tasksCollection = global.db.collection("tasks");

    const acceptedProposals = await proposalsCollection
      .find({ freelancer_email: email, status: "accepted" })
      .toArray();
    if (acceptedProposals.length === 0) return res.json([]);

    const taskIds = acceptedProposals.map((p) => new ObjectId(p.task_id));
    const tasks = await tasksCollection
      .find({ _id: { $in: taskIds } })
      .toArray();
    res.json(tasks);
  } catch (error) {
    console.error("❌ Error fetching freelancer projects:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. PATCH /api/tasks/:id/submit-deliverable - Freelancer Submits Work
// ==========================================
router.patch("/:id/submit-deliverable", async (req, res) => {
  try {
    const { id } = req.params;
    const { deliverable_url } = req.body;
    const tasksCollection = global.db.collection("tasks");

    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid Task ID" });

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "completed", deliverable_url: deliverable_url } },
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Task not found" });
    res.json({
      message: "Deliverable submitted and task marked as completed!",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. PATCH /api/tasks/:id - Edit a Task (Client)
// ==========================================
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, description, budget, deadline } = req.body;
    const tasksCollection = global.db.collection("tasks");

    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid ID" });

    const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (task.status !== "open") {
      return res
        .status(400)
        .json({
          error: "Cannot edit a task that is already in progress or completed.",
        });
    }

    await tasksCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          category,
          description,
          budget: parseFloat(budget),
          deadline: new Date(deadline),
        },
      },
    );

    res.json({ message: "Task updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. DELETE /api/tasks/:id - Delete a Task (Client)
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tasksCollection = global.db.collection("tasks");
    const proposalsCollection = global.db.collection("proposals");

    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid ID" });

    const acceptedProposal = await proposalsCollection.findOne({
      task_id: id,
      status: "accepted",
    });
    if (acceptedProposal) {
      return res
        .status(400)
        .json({
          error:
            "Cannot delete this task because a freelancer has already been hired.",
        });
    }

    await tasksCollection.deleteOne({ _id: new ObjectId(id) });
    await proposalsCollection.deleteMany({ task_id: id }); // Clean up pending proposals

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. GET /api/tasks/:id - Get Single Task Details (MUST BE LAST AMONG GETs)
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const tasksCollection = global.db.collection("tasks");
    const id = req.params.id;

    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid Task ID format" });

    const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
    if (!task) return res.status(404).json({ error: "Task not found" });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
