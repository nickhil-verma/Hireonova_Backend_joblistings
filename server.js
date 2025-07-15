require("dotenv").config();
const { app } = require("./api/list");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 8080;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Local API running at http://localhost:${PORT}/api/jobs`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
