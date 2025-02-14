import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import { deleteOnCloud, uploadOnCloud } from "../utils/fileUploader.js";

export const publishVideo = asyncHandler(async (req, res) => {
  // get the video details
  const { title, description } = req.body;
  if (!title || !description)
    throw new apiErrors(400, "All fields are required");

  // get the video & thumbnail
  const videoPath = req.files?.videoFile[0]?.path;
  const thumbnailPath = req.files?.thumbnail[0]?.path;
  if (!videoPath || !thumbnailPath)
    throw new apiErrors(400, "Video and thumbnail is required!");

  // Uploade on cloud
  const video = await uploadOnCloud(videoPath);
  const thumbnail = await uploadOnCloud(thumbnailPath);

  if (!video || !thumbnail) throw new apiErrors(500, "Failed to upload files.");

  // Uploade to the DB
  const newVideo = await Video.create({
    videoFile: video.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: video.duration,
    views: 0,
    isPublished: true,
    owner: req.user,
  });
  if (!newVideo) {
    // Delete files on cloud in case of DB failour.
    await deleteOnCloud(video.public_id);
    await deleteOnCloud(thumbnail.public_id);
    throw new apiErrors(500, "Failed to uploade on database.");
  }

  // Send it to frontend
  return res
    .status(200)
    .json(new apiSuccess(200, newVideo, "Video uploaded successfully!"));
});

export const getVideoById = asyncHandler(async (req, res) => {
  // Get the video id
  const { videoId } = req.params;
  if (!videoId) throw new apiErrors(400, "Video id is required!");

  // get the video from DB
  const video = await Video.findById(videoId);
  if (!video) throw new apiErrors(404, "Failed to fetch video.");

  // Update the watch history of the user
  const updateWatchHistory = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $push: { watchHistory: video._id },
    },
    { new: true }
  );
  if (!updateWatchHistory)
    throw new apiErrors(500, "Failed to update watch histroy.");

  return res
    .status(200)
    .json(new apiSuccess(200, video, "Video is fetched successfully."));
});
