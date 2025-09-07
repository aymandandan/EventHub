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

userSchema.methods.verifyRefreshToken = async function (refreshToken) {
	return bcrypt.compare(refreshToken, this.refreshTokenHash);
};

userSchema.statics.hashPassword = async function (password) {
	const saltRounds = 12;
	return bcrypt.hash(password, saltRounds);
};

userSchema.pre("save", async function (next) {
	if (this.isModified("passwordHash")) {
		this.passwordHash = await this.constructor.hashPassword(this.password);
	}
	next();
});

userSchema.pre("remove", async function (next) {
	await this.model("Event").deleteMany({ user: this._id });
	await this.model("RSVP").deleteMany({ user: this._id });
	await this.model("Comment").deleteMany({ user: this._id });
	await this.model("Notification").deleteMany({ user: this._id });
	next();
});

module.exports = mongoose.model("User", userSchema);
