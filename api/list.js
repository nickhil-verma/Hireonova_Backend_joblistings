// api/list.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const serverless = require("serverless-http");

const app = express();

/* --------------------------- MIDDLEWARE --------------------------- */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

/* ------------------------ MONGOOSE SETUP -------------------------- */
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

let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
  }
}

/* --------------------------- ROUTES ------------------------------- */
app.get("/ping", (req, res) => {
  res.send("pong from vercel");
});

app.get("/jobs", async (req, res) => {
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
    console.error("GET /jobs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/jobs", async (req, res) => {
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
    console.error("POST /jobs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------ EXPORT FOR VERCEL ----------------------- */
module.exports = serverless(app);
