import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import { toggleSubscription } from "../controllers/subscription.controller.js";

const subscriptionRoute = Router();

subscriptionRoute.use(verifyUser);

subscriptionRoute.route("/c/:channelId").post(toggleSubscription);

export default subscriptionRoute;