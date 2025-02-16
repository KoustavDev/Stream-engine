import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import { getChannelStats, getChannelVideos } from "../controllers/dashboard.controller.js";

const dashboardRoute = Router();

dashboardRoute.use(verifyUser);

dashboardRoute.route("/videos/:userId").get(getChannelVideos);
dashboardRoute.route("/stats").get(getChannelStats);

export default dashboardRoute