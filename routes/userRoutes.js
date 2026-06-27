const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb"); // 🚨 CRITICAL: Added ObjectId import

// 🚨 CRITICAL: SPECIFIC ROUTES MUST COME BEFORE DYNAMIC /:email ROUTES

// ==========================================
// 1. GET /api/users/freelancers - Browse All Freelancers with Stats
// ==========================================
router.get("/freelancers", async (req, res) => {
  try {
    const { search, skill, sort } = req.query;
    const usersCollection = global.db.collection("user");
    const tasksCollection = global.db.collection("tasks");
    const proposalsCollection = global.db.collection("proposals");
    const reviewsCollection = global.db.collection("reviews");

    let query = { role: "freelancer", isBlocked: { $ne: true } };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { skills: { $regex: search, $options: "i" } },
      ];
    }

    if (skill && skill !== "All") {
      query.skills = { $regex: skill, $options: "i" };
    }

    const freelancers = await usersCollection.find(query).toArray();

    const enrichedFreelancers = await Promise.all(
      freelancers.map(async (freelancer) => {
        const acceptedProposals = await proposalsCollection
          .find({ freelancer_email: freelancer.email, status: "accepted" })
          .toArray();

        const taskIds = acceptedProposals.map((p) => p.task_id);
        let completedJobs = 0;
        if (taskIds.length > 0) {
          completedJobs = await tasksCollection.countDocuments({
            _id: { $in: taskIds.map((id) => new ObjectId(id)) },
            status: "completed",
          });
        }

        const reviews = await reviewsCollection
          .find({ reviewee_email: freelancer.email })
          .toArray();

        const avgRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        const successRate =
          acceptedProposals.length > 0
            ? Math.round((completedJobs / acceptedProposals.length) * 100)
            : 0;

        return {
          _id: freelancer._id,
          name: freelancer.name,
          email: freelancer.email,
          image: freelancer.image,
          bio: freelancer.bio,
          skills: freelancer.skills || [],
          hourly_rate: freelancer.hourly_rate || 0,
          createdAt: freelancer.createdAt,
          stats: {
            jobsCompleted: completedJobs,
            totalReviews: reviews.length,
            avgRating: Math.round(avgRating * 10) / 10,
            successRate: successRate,
          },
        };
      }),
    );

    let sorted = enrichedFreelancers;
    if (sort === "rating") {
      sorted.sort((a, b) => b.stats.avgRating - a.stats.avgRating);
    } else if (sort === "jobs") {
      sorted.sort((a, b) => b.stats.jobsCompleted - a.stats.jobsCompleted);
    } else if (sort === "rate_low") {
      sorted.sort((a, b) => a.hourly_rate - b.hourly_rate);
    } else if (sort === "rate_high") {
      sorted.sort((a, b) => b.hourly_rate - a.hourly_rate);
    }

    res.json(sorted);
  } catch (error) {
    console.error("❌ Error fetching freelancers:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. GET /api/users/:email/full-profile - Get Complete Freelancer Profile
// ==========================================
router.get("/:email/full-profile", async (req, res) => {
  try {
    const { email } = req.params;
    const usersCollection = global.db.collection("user");
    const tasksCollection = global.db.collection("tasks");
    const proposalsCollection = global.db.collection("proposals");
    const reviewsCollection = global.db.collection("reviews");

    const user = await usersCollection.findOne({ email });
    if (!user || user.role !== "freelancer") {
      return res.status(404).json({ error: "Freelancer not found" });
    }

    const acceptedProposals = await proposalsCollection
      .find({ freelancer_email: email, status: "accepted" })
      .toArray();

    const taskIds = acceptedProposals.map((p) => p.task_id);
    let completedTasks = [];
    let inProgressTasks = [];

    if (taskIds.length > 0) {
      const allTasks = await tasksCollection
        .find({ _id: { $in: taskIds.map((id) => new ObjectId(id)) } })
        .toArray();

      completedTasks = allTasks.filter((t) => t.status === "completed");
      inProgressTasks = allTasks.filter((t) => t.status === "in_progress");
    }

    const reviews = await reviewsCollection
      .find({ reviewee_email: email })
      .sort({ created_at: -1 })
      .toArray();

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    const paymentsCollection = global.db.collection("payments");
    const payments = await paymentsCollection
      .find({ freelancer_email: email, payment_status: "paid" })
      .toArray();

    const totalEarnings = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        bio: user.bio,
        skills: user.skills || [],
        hourly_rate: user.hourly_rate || 0,
        createdAt: user.createdAt,
      },
      stats: {
        jobsCompleted: completedTasks.length,
        jobsInProgress: inProgressTasks.length,
        totalReviews: reviews.length,
        avgRating: Math.round(avgRating * 10) / 10,
        totalEarnings: totalEarnings,
        memberSince: user.createdAt,
      },
      reviews,
      recentJobs: completedTasks.slice(0, 5).map((t) => ({
        title: t.title,
        completedAt: t.updatedAt || t.createdAt,
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching full profile:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. GET /api/users/:email - Get User Profile (DYNAMIC ROUTE LAST)
// ==========================================
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const usersCollection = global.db.collection("user");

    const user = await usersCollection.findOne({ email: email });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. PATCH /api/users/:email - Update Freelancer Profile
// ==========================================
router.patch("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { name, image, bio, skills, hourly_rate } = req.body;
    const usersCollection = global.db.collection("user");

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

// ==========================================
// GET /api/freelancers/top - Top Freelancers for Homepage
// ==========================================
router.get("/freelancers/top", async (req, res) => {
  try {
    const usersCollection = global.db.collection("user");
    const proposalsCollection = global.db.collection("proposals");
    const reviewsCollection = global.db.collection("reviews");
    const tasksCollection = global.db.collection("tasks");

    const allFreelancers = await usersCollection
      .find({ role: "freelancer", isBlocked: { $ne: true } })
      .toArray();

    const enriched = await Promise.all(
      allFreelancers.map(async (f) => {
        const acceptedProposals = await proposalsCollection
          .find({ freelancer_email: f.email, status: "accepted" })
          .toArray();

        const taskIds = acceptedProposals.map((p) => p.task_id);
        let completedJobs = 0;
        if (taskIds.length > 0) {
          completedJobs = await tasksCollection.countDocuments({
            _id: { $in: taskIds.map((id) => new ObjectId(id)) },
            status: "completed",
          });
        }

        const reviews = await reviewsCollection
          .find({ reviewee_email: f.email })
          .toArray();
        const avgRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        // Safely parse skills
        const skillsArray = Array.isArray(f.skills)
          ? f.skills
          : typeof f.skills === "string"
            ? f.skills
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s)
            : [];

        return {
          _id: f._id,
          id: f._id.toString(),
          email: f.email, // Needed for frontend routing
          name: f.name,
          fullName: f.name,
          profileImage: f.image,
          avatar: f.image,
          skills: skillsArray,
          averageRating: Math.round(avgRating * 10) / 10,
          rating: Math.round(avgRating * 10) / 10,
          completedJobs: completedJobs,
          jobsCompleted: completedJobs,
          isOnline: Math.random() > 0.5, // Randomly assign online status for UI demo
        };
      }),
    );

    // Sort by completed jobs desc, then rating desc
    enriched.sort((a, b) => {
      if (b.completedJobs !== a.completedJobs)
        return b.completedJobs - a.completedJobs;
      return b.averageRating - a.averageRating;
    });

    // Return top 8
    res.json({ freelancers: enriched.slice(0, 8) });
  } catch (error) {
    console.error("❌ Error fetching top freelancers:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
