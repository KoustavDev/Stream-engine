import http from "http";
import { Server } from "socket.io";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Redis from "ioredis";
import rateLimit from "./middlewares/rateLimit.middleware.js";
import configurePassport from "./utils/passport.js";
import { S3Client } from "@aws-sdk/client-s3";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(rateLimit);

// Configure passport
configurePassport();

// Redis Client Connection
export const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
redisClient.on("connect", () => console.log("Connected to Redis"));
redisClient.on("error", (err) => console.error("Redis Error:", err));

// Create HTTP & WebSocket Server
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Handle Socket Connections
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("register", async (userId) => {
    if (!userId) return;
    // Store socket ID in Redis with a 1-hour expiration
    await redisClient.set(`socket:${userId}`, socket.id, "EX", 3600);
    console.log(`Mapped user ${userId} to socket ${socket.id}`);

    socket.userId = userId;
  });

  socket.on("disconnect", async () => {
    if (socket.userId) {
      // Remove socket ID from Redis when the user disconnects
      await redisClient.del(`socket:${socket.userId}`);
      console.log(`Unmapped user ${socket.userId} from socket ${socket.id}`);
    }
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// S3 Client Connection
export const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Import routers
import userRoute from "./routes/user.routes.js";
import videoRoute from "./routes/video.routes.js";
import likeRoute from "./routes/likes.routes.js";
import commentRoute from "./routes/comments.routes.js";
import subscriptionRoute from "./routes/subscription.routes.js";
import playlistRoute from "./routes/playlist.routes.js";
import dashboardRoute from "./routes/dashboard.routes.js";
import healthCheckRoute from "./routes/healthCheck.routes.js";

app.use("/api/v1/users", userRoute);
app.use("/api/v1/videos", videoRoute);
app.use("/api/v1/likes", likeRoute);
app.use("/api/v1/comments", commentRoute);
app.use("/api/v1/subscriptions", subscriptionRoute);
app.use("/api/v1/playlist", playlistRoute);
app.use("/api/v1/dashboard", dashboardRoute);
app.use("/api/v1/healthCheck", healthCheckRoute);

// V2 Routes
import videoRoute_v2 from "./routes/v2-video.routes.js";

app.use("/api/v2/videos", videoRoute_v2);

export default server;
// http://localhost:8000/api/v1/users/register
// http://localhost:8000/api/v1/videos
// http://localhost:8000/api/v1/likes
// http://localhost:8000/api/v1/comments
// http://localhost:8000/api/v1/subscriptions
// http://localhost:8000/api/v1/playlist
// http://localhost:8000/api/v1/dashboard
// http://localhost:8000/api/v1/healthCheck
// http://localhost:8000/api/v1/users/auth/google  -> google auth route

// V2

// http://localhost:8000/api/v2/videos