const express = require("express");
const pollRoutes = require("./routes/poll.routes");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:1989', // Adjust as needed
    credentials: true
}));

app.use("/api/poll", pollRoutes);

module.exports = app;
