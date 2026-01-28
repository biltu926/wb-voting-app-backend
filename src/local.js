require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/mongo");

(async () => {
  await connectDB(process.env.MONGO_URI);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Local server running on http://localhost:${PORT}`);
  });
})();
