import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import Video from "../models/video.model.js";
import mongoose from "mongoose";

export const getChannelVideos = asyncHandler(async (req, res) => {
  // Get user id
  const { userId } = req.params;
  if (!userId) throw new apiErrors(400, "User id is required!");

  // Fetch videos from DB
  const videos = await Video.find({ owner: userId });
  if (!videos) throw new apiErrors(500, "Failed to fetch videos");

  return res
    .status(200)
    .json(new apiSuccess(200, videos, "Videos are fetched"));
});

export const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Video.aggregate([
    // Stage 1: Match videos for the given user.
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },
    // Stage 2: Lookup likes (with empty comment field).
    {
      $lookup: {
        from: "likes",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$video", "$$videoId"] },
                  { $eq: [{ $ifNull: ["$comment", ""] }, ""] },
                ],
              },
            },
          },
        ],
        as: "likes",
      },
    },
    // Stage 3: Lookup subscribers from the subscriptions collection.
    {
      $lookup: {
        from: "subscriptions",
        foreignField: "channel",
        localField: "owner",
        as: "subscribers",
      },
    },
    // Stage 4: Add computed fields for likesCount and subscribers.
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        subscribers: { $size: "$subscribers" },
      },
    },
    // Group all documents to get summary totals.
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalViews: { $sum: "$views" },
        totalLikes: { $sum: "$likesCount" },
        totalSubscribers: { $sum: "$subscribers" },
      },
    },
    // Remove _id from the final output.
    {
      $project: { _id: 0 },
    },
  ]);
  if (!stats) throw new apiErrors(500, "Failed to fetch status");

  return res
    .status(200)
    .json(new apiSuccess(200, stats, "successfully fetched channel status"));
});
