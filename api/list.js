const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const serverless = require("serverless-http");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

const jobSchema = new mongoose.Schema(
  {
    job_title: { type: String, required: true },
    job_description: { type: String },
    apply_url: { type: String, required: true, unique: true },
    company_image: String,
    date_posted: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

jobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });

const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);

// Connect to DB only once
let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
  }
}

// Just for test
app.get("/api/ping", (req, res) => {
  res.send("pong from vercel");
});

app.get("/api/jobs", async (req, res) => {
  try {
    await connectDB();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;

    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Job.countDocuments();

    res.json({
      jobs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    await connectDB();

    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const urls = payload.map((j) => j.apply_url);

    const existing = await Job.find({ apply_url: { $in: urls } }).select("apply_url");
    const existingUrls = new Set(existing.map((j) => j.apply_url));

    const docsToInsert = payload.filter((j) => !existingUrls.has(j.apply_url));

    if (docsToInsert.length) {
      await Job.insertMany(docsToInsert, { ordered: false });
    }

    res.json({
      added: docsToInsert.length,
      skipped: payload.length - docsToInsert.length,
    });
  } catch (err) {
    console.error("POST error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Export both
module.exports = {
  handler: serverless(app), // For Vercel
  app,                      // For local use
};
