const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

// ==========================================
// POST /api/proposals - Submit a Proposal (Freelancer)
// ==========================================
router.post("/", async (req, res) => {
  try {
    const {
      task_id,
      freelancer_email,
      proposed_budget,
      estimated_days,
      cover_note,
    } = req.body;

    // 1. Validate required fields
    if (!task_id || !freelancer_email || !proposed_budget || !estimated_days) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const proposalsCollection = global.db.collection("proposals");
    const tasksCollection = global.db.collection("tasks");

    // 2. Check if task exists and is still open
    let task;
    try {
      task = await tasksCollection.findOne({ _id: new ObjectId(task_id) });
    } catch (e) {
      return res.status(400).json({ error: "Invalid Task ID format" });
    }

    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.status !== "open")
      return res
        .status(400)
        .json({ error: "Task is no longer open for proposals" });

    // 3. ASSIGNMENT RULE: Freelancer can only submit ONE proposal per task
    const existingProposal = await proposalsCollection.findOne({
      task_id: task_id,
      freelancer_email: freelancer_email,
    });

    if (existingProposal) {
      return res.status(400).json({
        error: "You have already submitted a proposal for this task.",
      });
    }

    // 4. Save the new proposal
    const newProposal = {
      task_id,
      freelancer_email,
      proposed_budget: parseFloat(proposed_budget),
      estimated_days: parseInt(estimated_days),
      cover_note: cover_note || "",
      status: "pending", // Default state per assignment
      submitted_at: new Date(),
    };

    const result = await proposalsCollection.insertOne(newProposal);
    res.status(201).json({
      message: "Proposal submitted successfully!",
      proposalId: result.insertedId,
    });
  } catch (error) {
    console.error("❌ Error submitting proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /api/proposals - Get proposals (Enriched with Task Title)
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { task_id, freelancer_email } = req.query;
    const proposalsCollection = global.db.collection("proposals");
    const tasksCollection = global.db.collection("tasks");

    const query = {};
    if (task_id) query.task_id = task_id;
    if (freelancer_email) query.freelancer_email = freelancer_email;

    const proposals = await proposalsCollection
      .find(query)
      .sort({ submitted_at: -1 })
      .toArray();

    // 🚨 ENRICHMENT: Fetch the Task Title and Client Email for each proposal
    const enrichedProposals = await Promise.all(
      proposals.map(async (proposal) => {
        const task = await tasksCollection.findOne(
          { _id: new ObjectId(proposal.task_id) },
          { projection: { title: 1, status: 1, client_email: 1, budget: 1 } }, // Added client_email and budget
        );
        return {
          ...proposal,
          task_title: task ? task.title : "Deleted Task",
          task_status: task ? task.status : "unknown",
          client_email: task ? task.client_email : "unknown",
          client_budget: task ? task.budget : 0,
        };
      }),
    );

    res.json(enrichedProposals);
  } catch (error) {
    console.error("❌ Error fetching proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /api/proposals - (UPDATED to support client_email)
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { task_id, freelancer_email, client_email } = req.query;
    const proposalsCollection = global.db.collection("proposals");
    const tasksCollection = global.db.collection("tasks");

    const query = {};
    if (task_id) query.task_id = task_id;
    if (freelancer_email) query.freelancer_email = freelancer_email;

    // 🚨 NEW: If client_email is passed, find all their tasks, then find proposals for those tasks
    if (client_email) {
      const clientTasks = await tasksCollection
        .find({ client_email })
        .toArray();
      const taskIds = clientTasks.map((t) => t._id.toString());
      query.task_id = { $in: taskIds };
    }

    const proposals = await proposalsCollection
      .find(query)
      .sort({ submitted_at: -1 })
      .toArray();

    const enrichedProposals = await Promise.all(
      proposals.map(async (proposal) => {
        const task = await tasksCollection.findOne(
          { _id: new ObjectId(proposal.task_id) },
          { projection: { title: 1, status: 1, client_email: 1, budget: 1 } },
        );
        return {
          ...proposal,
          task_title: task ? task.title : "Deleted Task",
          task_status: task ? task.status : "unknown",
          client_email: task ? task.client_email : "unknown",
          client_budget: task ? task.budget : 0,
        };
      }),
    );

    res.json(enrichedProposals);
  } catch (error) {
    console.error("❌ Error fetching proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PATCH /api/proposals/:id/reject - Reject a Proposal (Client)
// ==========================================
router.patch("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const proposalsCollection = global.db.collection("proposals");

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Proposal ID" });
    }

    const result = await proposalsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "rejected" } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    res.json({ message: "Proposal rejected successfully." });
  } catch (error) {
    console.error("❌ Error rejecting proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
