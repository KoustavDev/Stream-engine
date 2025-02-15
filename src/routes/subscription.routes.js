import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import {
    getChannelSubscriberList,
  getSubscribedChannels,
  toggleSubscription,
} from "../controllers/subscription.controller.js";

const subscriptionRoute = Router();

subscriptionRoute.use(verifyUser);

subscriptionRoute
  .route("/c/:channelId")
  .post(toggleSubscription)
  .get(getChannelSubscriberList);
subscriptionRoute.route("/c/:subscriberId").get(getSubscribedChannels);

export default subscriptionRoute;