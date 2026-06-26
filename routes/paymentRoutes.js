const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// ==========================================
// POST /api/payments/create-checkout-session
// ==========================================
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { proposal_id, task_id, amount } = req.body;

    const tasksCollection = global.db.collection("tasks");
    const proposalsCollection = global.db.collection("proposals");

    const task = await tasksCollection.findOne({ _id: new ObjectId(task_id) });
    const proposal = await proposalsCollection.findOne({
      _id: new ObjectId(proposal_id),
    });

    if (!task || !proposal) {
      return res.status(404).json({ error: "Task or Proposal not found" });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: task.title,
              description: `Payment for task: ${task.title}`,
            },
            unit_amount: Math.round(parseFloat(amount) * 100), // Stripe requires amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&task_id=${task_id}&proposal_id=${proposal_id}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/client/proposals`,
      metadata: {
        task_id,
        proposal_id,
        client_email: task.client_email,
        freelancer_email: proposal.freelancer_email,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe Session Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// POST /api/payments/confirm-session (Assignment Requirement)
// Double-checks transaction before database saves
// ==========================================
router.post("/confirm-session", async (req, res) => {
  try {
    const { session_id, task_id, proposal_id } = req.body;

    // 1. Retrieve session from Stripe to verify it was actually paid
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      const tasksCollection = global.db.collection("tasks");
      const proposalsCollection = global.db.collection("proposals");
      const paymentsCollection = global.db.collection("payments");

      // 2. Update Task status to "in_progress"
      await tasksCollection.updateOne(
        { _id: new ObjectId(task_id) },
        { $set: { status: "in_progress" } },
      );

      // 3. Update Proposal status to "accepted"
      await proposalsCollection.updateOne(
        { _id: new ObjectId(proposal_id) },
        { $set: { status: "accepted" } },
      );

      // 4. Save to Payments Collection (Matches Assignment DB Architecture)
      await paymentsCollection.insertOne({
        client_email: session.metadata.client_email,
        freelancer_email: session.metadata.freelancer_email,
        task_id: task_id,
        amount: session.amount_total / 100, // Convert cents back to dollars
        transaction_id: session.payment_intent,
        payment_status: "paid",
        paid_at: new Date(),
      });

      return res.json({
        success: true,
        message: "Payment confirmed and database updated.",
        task_title: session.line_items.data[0]?.description || "Task",
      });
    }

    res
      .status(400)
      .json({ success: false, message: "Payment was not completed." });
  } catch (error) {
    console.error("❌ Confirm Session Error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
