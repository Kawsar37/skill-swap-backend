# ⚙️ SkillSwap Backend API - Freelance Micro-Task Marketplace

The backend RESTful API powering the **SkillSwap** platform. Built with **Node.js**, **Express.js**, and **MongoDB**, this server handles complex relational data, secure Stripe payment processing, role-based access control, and real-time analytics aggregation.

Designed to run seamlessly in both local environments and **Serverless** production environments (Vercel/Render) using custom database connection middleware.

---

## 📑 Table of Contents

1. [Core API Features](#-core-api-features)
2. [Tech Stack](#-tech-stack)
3. [Database Schema & Relations](#-database-schema--relations)
4. [Installation & Setup](#-installation--setup)
5. [Environment Variables](#-environment-variables)
6. [Security & Serverless Architecture](#-security--serverless-architecture)
7. [Deployment](#-deployment)

---

## 🌟 Core API Features

### 🛡️ Authentication & Authorization

- Integrated with **BetterAuth** for secure, HTTP-only cookie-based JWT sessions.
- Role-based data segregation (Client, Freelancer, Admin).
- User moderation endpoints (Block/Unblock) that instantly invalidate sessions.

### 📋 Task & Proposal Management

- **Clients:** CRUD operations for tasks, with strict state-machine logic (e.g., cannot delete a task if a freelancer is already hired; cannot edit if in progress).
- **Freelancers:** Submit proposals, track acceptance status, and submit final deliverable URLs.
- **Public:** Advanced regex search, category filtering, and server-side pagination (Limit 9).

### 💳 Stripe Payment Integration

- **Checkout Sessions:** Generates secure Stripe Hosted Checkout sessions tied to specific Task and Proposal IDs.
- **Session Verification:** Confirms payment success via Stripe API and updates MongoDB `payments` and `proposals` collections atomically.

### 📊 Admin Analytics & Aggregation

- MongoDB Aggregation Pipelines to calculate platform-wide metrics.
- Data visualization endpoints for Task Creation Trends (Time-series), Category Distribution, and Global Transaction Volume.

### ⭐ Review System

- Verified review submission (only allowed if task status is `completed`).
- Duplicate review prevention and dynamic average rating calculations for Freelancer profiles.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Native Node.js Driver)
- **Payments:** Stripe API
- **Security:** CORS, dotenv, HTTP-only Cookies (via BetterAuth)
- **Deployment:** Vercel (Serverless) / Render

---

## 🗄️ Database Schema & Relations

The MongoDB database (`skill-swap`) utilizes the following core collections:

- `user`: Stores profiles, roles, skills (array), hourly rates, and block status.
- `tasks`: Stores client requests, budgets, deadlines, and state (`open`, `in_progress`, `completed`).
- `proposals`: Relational mapping between Freelancers and Tasks with bid amounts and status.
- `payments`: Immutable ledger of Stripe transactions, linking `client_email`, `freelancer_email`, and `task_id`.
- `reviews`: Star ratings and comments tied to completed tasks.

---

## ⚙️ Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas Cluster (or local MongoDB instance)
- Stripe Account (for API keys)

### Step 1: Clone and Install

```bash
git clone https://github.com/Kawsar37/skill-swap-backend.git
cd skill-swap-backend
npm install
```

### Step 2: Configure Environment Variables

Create a .env file in the root directory:

```bash
# Server
PORT=8000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0...

# CORS
FRONTEND_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 3: Run the Server

```bash
# Development (with nodemon)
nodemon index.js

# Production
node index.js
```
