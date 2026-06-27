const express = require("express");
const router = express.Router();

// ==========================================
// GET /api/users/:email - Get User Profile
// ==========================================
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const usersCollection = global.db.collection("user"); // Better Auth default collection

    const user = await usersCollection.findOne({ email: email });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PATCH /api/users/:email - Update Freelancer Profile
// ==========================================
router.patch("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { name, image, bio, skills, hourly_rate } = req.body;
    const usersCollection = global.db.collection("user");

    // Convert comma-separated skills string into an array
    const skillsArray = skills
      ? skills
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    const result = await usersCollection.updateOne(
      { email: email },
      {
        $set: {
          name: name,
          image: image || "",
          bio: bio || "",
          skills: skillsArray,
          hourly_rate: hourly_rate ? parseFloat(hourly_rate) : 0,
        },
      },
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "User not found" });

    res.json({ message: "Profile updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
