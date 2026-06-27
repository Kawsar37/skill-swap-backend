const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

router.post("/", async (req, res) => {
  try {
    const { task_id, reviewer_email, reviewee_email, rating, comment } =
      req.body;
    const reviewsCollection = global.db.collection("reviews");
    const tasksCollection = global.db.collection("tasks");

    if (!ObjectId.isValid(task_id))
      return res.status(400).json({ error: "Invalid Task ID" });
    const task = await tasksCollection.findOne({ _id: new ObjectId(task_id) });

    if (!task || task.status !== "completed") {
      return res
        .status(400)
        .json({ error: "You can only review completed tasks." });
    }

    const existing = await reviewsCollection.findOne({
      task_id,
      reviewer_email,
    });
    if (existing) {
      return res
        .status(400)
        .json({ error: "You have already reviewed this task." });
    }

    const newReview = {
      task_id,
      reviewer_email,
      reviewee_email,
      rating: parseInt(rating),
      comment: comment || "",
      created_at: new Date(),
    };

    await reviewsCollection.insertOne(newReview);
    res.status(201).json({ message: "Review submitted successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const reviewsCollection = global.db.collection("reviews");

    const reviews = await reviewsCollection
      .find({ reviewee_email: email })
      .sort({ created_at: -1 })
      .toArray();

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
