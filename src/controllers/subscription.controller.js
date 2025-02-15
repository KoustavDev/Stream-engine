import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";

const isSubscribed = async (channelId, userId) => {
  try {
    const sub = await Subscription.findOne({
      channel: channelId,
      subscriber: userId,
    });
    return sub;
  } catch (error) {
    throw new apiErrors(500, "Failed to check subscriber");
  }
};

export const toggleSubscription = asyncHandler(async (req, res) => {
  // Get details
  const { channelId } = req.params;
  if (!channelId) throw new apiErrors(400, "Provide a channel id!");

  // Check user is already subscribed or not
  const sub = await isSubscribed(channelId, req.user._id);

  if (sub) {
    // If channel is subscribed, unsubscribed it (toggle off)
    await Subscription.findByIdAndDelete(sub._id);
  } else {
    // If not subscribed, create a new subscription (toggle on)
    await Subscription.create({
      channel: channelId,
      subscriber: req.user._id,
    });
  }

  return res
    .status(200)
    .json(new apiSuccess(200, {}, "Subscription is toggeled"));
});
