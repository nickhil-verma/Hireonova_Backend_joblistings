// server.js -------------------------------------------------------
require("dotenv").config();             
const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");

const app = express();

/* ------------------------------------------------------------ */
/*  MIDDLEWARE                                                  */
/* ------------------------------------------------------------ */
app.use(
  cors({
    origin: true,          // ⚠️ tighten before prod!
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" })); // large bulk‑inserts supported

/* ------------------------------------------------------------ */
/*  MONGOOSE MODEL + TTL INDEX                                  */
/* ------------------------------------------------------------ */
const jobSchema = new mongoose.Schema(
  {
    job_title:      { type: String, required: true },
    job_description:{ type: String },
    apply_url:      { type: String, required: true, unique: true },
    company_image:  String,
    date_posted:    { type: Date, default: Date.now },          // optional
  },
  { timestamps: true }                                          // adds createdAt / updatedAt
);

// Auto‑delete after ~60 days (60 × 24 × 60 × 60  =  5 184 000 s)
jobSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 }
);

const Job = mongoose.model("Job", jobSchema);

/* ------------------------------------------------------------ */
/*  ROUTES                                                      */
/* ------------------------------------------------------------ */

// GET /jobs  — newest first
app.get("/jobs", async (req, res) => {
  try {
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /jobs  — add ONE job or an ARRAY of jobs
// Skips entries whose apply_url already exists
app.post("/jobs", async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    // find duplicates already in DB
    const urls = payload.map((j) => j.apply_url);
    const existing = await Job.find({ apply_url: { $in: urls } }).select(
      "apply_url"
    );
    const existingUrls = new Set(existing.map((j) => j.apply_url));

    const docsToInsert = payload.filter((j) => !existingUrls.has(j.apply_url));

    if (docsToInsert.length) {
      // ordered:false ensures the bulk insert continues past any dup errors
      await Job.insertMany(docsToInsert, { ordered: false });
    }

    res.json({
      added: docsToInsert.length,
      skipped: payload.length - docsToInsert.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------ */
/*  DB + SERVER STARTUP                                         */
/* ------------------------------------------------------------ */
const PORT = process.env.PORT || 8080;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`✅  API running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("MongoDB connection error", err);
    process.exit(1);
  });

/* ------------------------------------------------------------
   QUICK START

   1. Create a .env next to server.js:
        MONGO_URI=mongodb://localhost:27017/jobboard
        PORT=8080        # optional
   2. npm i express cors mongoose dotenv
   3. node server.js
------------------------------------------------------------ */
