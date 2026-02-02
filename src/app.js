const express = require("express");
const pollRoutes = require("./routes/poll.routes");
const cookieParser = require("cookie-parser");
// const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cookieParser());

console.log("ENV ORIGIN:", process.env.FRONTEND_ORIGIN);

app.use("/api/poll", pollRoutes);

module.exports = app;