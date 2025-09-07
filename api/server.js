// server.js index file
const dotenv = require("dotenv");
dotenv.config();
const { connectDB } = require("./config/database");
const corsConfig = require("./config/cors");
const express = require("express");
const app = express();
const morgan = require("morgan");
const port = process.env.PORT || 3001;
const errorHandler = require("./middleware/errorHandler");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

// connect to database
connectDB();

// middleware
app.use(cors(corsConfig));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// cookie parser
app.use(cookieParser());
// helmet
app.use(helmet());

// routes
app.use("/api", require("./routes/index"));

// error handler
app.use(errorHandler);

// start server
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
