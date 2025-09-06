const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		passwordHash: { type: String, required: true, select: false },
		name: { type: String, required: true, trim: true },
		avatarUrl: { type: String },
		roles: {
			type: [String],
			enum: ["attendee", "organizer", "admin"],
			default: ["attendee"],
			index: true,
		},
		bio: { type: String, maxlength: 280 },
		refreshTokenHash: { type: String, select: false },
	},
	{ timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ name: "text" });

userSchema.methods.verifyPassword = async function (password) {
	return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = async function (password) {
	const saltRounds = 12;
	return bcrypt.hash(password, saltRounds);
};

module.exports = mongoose.model("User", userSchema);
