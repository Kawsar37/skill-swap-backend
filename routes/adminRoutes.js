const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

router.get("/stats", async (req, res) => {
  try {
    const usersCollection = global.db.collection("user");
    const tasksCollection = global.db.collection("tasks");
    const paymentsCollection = global.db.collection("payments");

    const totalUsers = await usersCollection.countDocuments();
    const totalTasks = await tasksCollection.countDocuments();
    const activeTasks = await tasksCollection.countDocuments({
      status: "in_progress",
    });

    const revenueAggregation = await paymentsCollection
      .aggregate([
        { $match: { payment_status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray();

    const totalRevenue =
      revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

    res.json({
      totalUsers,
      totalTasks,
      activeTasks,
      totalRevenue,
    });
  } catch (error) {
    console.error("❌ Error fetching admin stats:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const usersCollection = global.db.collection("user");

    const users = await usersCollection
      .find({})
      .project({
        name: 1,
        email: 1,
        role: 1,
        isBlocked: 1,
        image: 1,
        createdAt: 1,
      })
      .toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/users/:id/toggle-block", async (req, res) => {
  try {
    const { id } = req.params;
    const usersCollection = global.db.collection("user");

    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid ID" });

    const user = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "admin") {
      return res.status(403).json({ error: "Cannot block an admin account." });
    }

    const newStatus = !user.isBlocked;

    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isBlocked: newStatus } },
    );

    res.json({
      message: `User ${newStatus ? "blocked" : "unblocked"} successfully.`,
      isBlocked: newStatus,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
      return res.status(400).json({
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
      return res.status(400).json({
        error:
          "Cannot delete this task because a freelancer has already been hired and paid.",
      });
    }

    await tasksCollection.deleteOne({ _id: new ObjectId(id) });

    await proposalsCollection.deleteMany({ task_id: id });

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

router.get("/tasks", async (req, res) => {
  try {
    const tasksCollection = global.db.collection("tasks");
    const tasks = await tasksCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tasksCollection = global.db.collection("tasks");
    const proposalsCollection = global.db.collection("proposals");

    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid ID" });

    await tasksCollection.deleteOne({ _id: new ObjectId(id) });

    await proposalsCollection.deleteMany({ task_id: id });

    res.json({ message: "Task deleted by Admin successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const tasksCollection = global.db.collection("tasks");
    const paymentsCollection = global.db.collection("payments");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTasks = await tasksCollection
      .find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: 1 })
      .toArray();

    const tasksByDate = {};
    recentTasks.forEach((task) => {
      const date = new Date(task.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      tasksByDate[date] = (tasksByDate[date] || 0) + 1;
    });

    const taskCreationChart = Object.entries(tasksByDate).map(
      ([date, count]) => ({
        date,
        tasks: count,
      }),
    );

    const categoryDistribution = await tasksCollection
      .aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const categoryChart = categoryDistribution.map((cat) => ({
      name: cat._id || "Unknown",
      value: cat.count,
    }));

    const statusDistribution = await tasksCollection
      .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray();

    const statusChart = statusDistribution.map((status) => ({
      name: status._id || "Unknown",
      value: status.count,
    }));

    const recentPayments = await paymentsCollection
      .find({})
      .sort({ paid_at: -1 })
      .limit(10)
      .toArray();

    const enrichedPayments = await Promise.all(
      recentPayments.map(async (payment) => {
        let task_title = "Unknown Task";
        if (payment.task_id && ObjectId.isValid(payment.task_id)) {
          const task = await tasksCollection.findOne({
            _id: new ObjectId(payment.task_id),
          });
          if (task) task_title = task.title;
        }
        return { ...payment, task_title };
      }),
    );

    res.json({
      taskCreationChart,
      categoryChart,
      statusChart,
      recentPayments: enrichedPayments,
    });
  } catch (error) {
    console.error("❌ Error fetching admin analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
