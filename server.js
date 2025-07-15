require("dotenv").config();
const app = require("./api/list.js").app;
const mongoose = require("mongoose");

const PORT = process.env.PORT || 8080;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`✅ API running locally at http://localhost:${PORT}/api/jobs`)
    );
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
