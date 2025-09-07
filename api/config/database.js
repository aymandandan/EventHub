const mongoose = require("mongoose");
const logger = require("../utils/logger");

// mongodb connection config
const dbConfig = {
	uri: process.env.MONGODB_URI || "mongodb://localhost:27017/eventhub",
	options: null,
};

// database connection function
const connectDB = async () => {
	try {
		await mongoose.connect(dbConfig.uri, dbConfig.options);
		logger.info("MongoDB connected");
	} catch (error) {
		logger.error("MongoDB connection error:", error);
	}
};

module.exports = { connectDB };
