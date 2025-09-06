// cors config
const corsOrigins = process.env.CORS_ORIGINS || "http://localhost:3000";

const corsConfig = {
    origin: corsOrigins.split(","),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};

module.exports = corsConfig;
