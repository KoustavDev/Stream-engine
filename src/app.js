import http from "http";
import { Server } from "socket.io";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

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

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Import routers
import userRoute from "./routes/user.routes.js";
import videoRoute from "./routes/video.routes.js";
import likeRoute from "./routes/likes.routes.js";
import commentRoute from "./routes/comments.routes.js";
import subscriptionRoute from "./routes/subscription.routes.js";
import playlistRoute from "./routes/playlist.routes.js";
import dashboardRoute from "./routes/dashboard.routes.js";

app.use("/api/v1/users", userRoute);
app.use("/api/v1/videos", videoRoute);
app.use("/api/v1/likes", likeRoute);
app.use("/api/v1/comments", commentRoute);
app.use("/api/v1/subscriptions", subscriptionRoute);
app.use("/api/v1/playlist", playlistRoute);
app.use("/api/v1/dashboard", dashboardRoute);

export default server;
// http://localhost:8000/api/v1/users/register
// http://localhost:8000/api/v1/videos
// http://localhost:8000/api/v1/likes
// http://localhost:8000/api/v1/comments
// http://localhost:8000/api/v1/subscriptions
// http://localhost:8000/api/v1/playlist
// http://localhost:8000/api/v1/dashboard