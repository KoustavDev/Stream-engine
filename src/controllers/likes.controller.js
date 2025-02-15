import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import { Like } from "../models/likes.model.js";

export const isVideoLiked = async (videoId, userId) => {
  try {
    const like = await Like.findOne({
      video: videoId,
      likedBy: userId,
    });
    return like;
  } catch (error) {
    throw new apiErrors(500, "Failed to check like");
  }
};

export const toggleVideoLike = asyncHandler(async (req, res) => {
  // get the video id
  const { videoId } = req.params;
  if (!videoId) throw new apiErrors(400, "Provide a video id!");

  // Check user is already liked or not
  const isLiked = await isVideoLiked(videoId, req.user._id);

  if (isLiked) {
    // If user liked it, remove it (toggle off)
    await Like.findByIdAndDelete(isLiked._id);
  } else {
    // If user not liked it, create one (toggle on)
    await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });
  }

  return res.status(200).json(new apiSuccess(200, {}, "Like is toggeled"));
});

export const getLikedVideos = asyncHandler(async (req, res) => {
  const likedVideos = await Like.find({ likedBy: req.user._id }).populate(
    "video"
  );

  return res
    .status(200)
    .json(
      new apiSuccess(200, likedVideos, "Successfully fetched liked videos.")
    );
});
