import { io } from "../app.js";
import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import {
  deleteOnCloud,
  deleteOnCloudVideo,
  uploadFileWithProgress,
  uploadOnCloud,
} from "../utils/fileUploader.js";
import extractPublicId from "../utils/fileRemover.js";
import mongoose from "mongoose";

export const publishVideo = asyncHandler(async (req, res) => {
  // Get socket Id
  const { socketId, title, description } = req.body;
  if (!socketId) return res.status(400).send("Socket ID is required.");

  // Validate fields
  if (!title || !description)
    throw new apiErrors(400, "All fields are required");

  // Check if files exist
  if (!req.files?.videoFile || !req.files?.thumbnail) {
    io.to(socketId).emit("uploadError", {
      message: "Video and thumbnail are required",
    });
    throw new apiErrors(400, "Video and thumbnail are required!");
  }

  const videoFile = req.files.videoFile[0];
  const thumbnail = req.files.thumbnail[0];

  try {
    // Report 0% progress at start
    io.to(socketId).emit("uploadProgress", {
      percent: 0,
      bytesUploaded: 0,
      totalBytes: videoFile.size,
      stage: "video",
    });

    // Upload video with progress tracking
    const videoResult = await uploadFileWithProgress(
      videoFile,
      socketId,
      "video"
    );

    // // Report thumbnail upload starting
    // io.to(socketId).emit("uploadProgress", {
    //   percent: 0,
    //   bytesUploaded: 0,
    //   totalBytes: thumbnail.size,
    //   stage: "thumbnail",
    // });

    // Upload thumbnail
    const thumbnailResult = await uploadOnCloud(thumbnail?.path);

    // Check if uploads were successful
    if (!videoResult || !thumbnailResult) {
      io.to(socketId).emit("uploadError", {
        message: "Failed to upload files",
      });
      throw new apiErrors(500, "Failed to upload files.");
    }

    // Upload to the DB
    const newVideo = await Video.create({
      videoFile: videoResult.url,
      thumbnail: thumbnailResult.url,
      title,
      description,
      duration: videoResult.duration,
      views: 0,
      isPublished: true,
      owner: req.user,
    });

    if (!newVideo) {
      // Delete files on cloud in case of DB failure
      await deleteOnCloud(videoResult.public_id);
      await deleteOnCloud(thumbnailResult.public_id);
      io.to(socketId).emit("uploadError", {
        message: "Failed to upload to database",
      });
      throw new apiErrors(500, "Failed to upload to database.");
    }

    // Send completion event
    io.to(socketId).emit("uploadComplete", {
      videoUrl: videoResult.url,
      thumbnailUrl: thumbnailResult.url,
      videoId: newVideo._id,
    });

    // Send it to frontend
    return res
      .status(200)
      .json(new apiSuccess(200, newVideo, "Video uploaded successfully!"));
  } catch (error) {
    console.error("Error during upload:", error);
    io.to(socketId).emit("uploadError", {
      message: error.message || "Error during upload",
    });
    return res.status(500).send(error.message || "Server error during upload");
  }
});

export const getVideoById = asyncHandler(async (req, res) => {
  // Get the video id
  const { videoId } = req.params;
  if (!videoId) throw new apiErrors(400, "Video id is required!");

  // ensure this is an ObjectId, or cast it
  const userId = req.user._id;

  // Update the views
  await Video.updateOne(
    { _id: new mongoose.Types.ObjectId(videoId) },
    { $inc: { views: 1 } }
  );

  const video = await Video.aggregate([
    // Stage 1: Match the video document with the specified _id.
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId) },
    },
    // Stage 2: Lookup likes for the video where the 'comment' field is empty (or missing).
    {
      $lookup: {
        from: "likes", // Collection to join.
        let: { videoId: "$_id" }, // Define a variable to hold the video's _id.
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$video", "$$videoId"] }, // Match likes where 'video' equals the video's _id.
                  { $eq: [{ $ifNull: ["$comment", ""] }, ""] }, // Ensure 'comment' is either null/missing or an empty string.
                ],
              },
            },
          },
        ],
        as: "likes", // Output the matching documents as the 'likes' array.
      },
    },
    // Stage 3: Lookup owner details from the 'users' collection for the video owner.
    {
      $lookup: {
        from: "users", // Collection to join.
        foreignField: "_id", // Field in the users collection.
        localField: "owner", // Field in the video document.
        as: "owner", // Output the matching owner details.
        pipeline: [
          { $project: { fullName: 1, username: 1, avatar: 1 } }, // Project only necessary fields.
        ],
      },
    },
    // Stage 4: Lookup comments for the video.
    {
      $lookup: {
        from: "comments", // Collection to join for comments.
        foreignField: "video", // Field in comments that matches the video's _id.
        localField: "_id", // Video's _id.
        as: "comments", // Output the comments array.
        pipeline: [
          // Project only the content and owner of each comment.
          { $project: { content: 1, owner: 1 } },
          // For each comment, lookup the owner's details.
          {
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "owner",
              as: "owner",
              pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
            },
          },
          // Lookup likes for each comment.
          {
            $lookup: {
              from: "likes",
              foreignField: "comment", // Match likes where the 'comment' field equals the comment's _id.
              localField: "_id",
              as: "like", // Temporarily store these likes in the 'like' array.
            },
          },
          // Add computed fields: likesCount and isLiked for each comment.
          {
            $addFields: {
              likesCount: { $size: "$like" }, // Count the number of likes for the comment.
              isLiked: {
                $cond: {
                  if: {
                    // Check if the current user's id exists in the 'likedBy' fields of the likes.
                    $in: [
                      new mongoose.Types.ObjectId(userId),
                      { $map: { input: "$like", as: "l", in: "$$l.likedBy" } },
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          // Remove the temporary 'like' array from each comment.
          { $project: { like: 0 } },
        ],
      },
    },
    // Stage 5: Add top-level fields for overall video likes.
    {
      $addFields: {
        likesCount: { $size: "$likes" }, // Count total likes for the video.
        isLiked: {
          $cond: {
            if: {
              // Check if the current user's id exists in any 'likedBy' field of the likes.
              $in: [
                new mongoose.Types.ObjectId(userId),
                { $map: { input: "$likes", as: "l", in: "$$l.likedBy" } },
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    // Stage 6: Remove the temporary 'likes' array from the final output.
    {
      $project: {
        likes: 0,
      },
    },
  ]);

  if (!video) throw new apiErrors(404, "Failed to fetch video.");

  // Update the watch history of the user
  const updateWatchHistory = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $push: { watchHistory: videoId },
    },
    { new: true }
  );
  if (!updateWatchHistory)
    throw new apiErrors(500, "Failed to update watch histroy.");

  return res
    .status(200)
    .json(new apiSuccess(200, video, "Video is fetched successfully."));
});

export const updateVideo = asyncHandler(async (req, res) => {
  // Get data from client
  const { videoId } = req.params;
  const { title, description } = req.body;
  if (!title || !description || !videoId)
    throw new apiErrors(400, "All fields are required");

  // Get new thumbnail
  const thumbnailPath = req.file?.path;
  if (!thumbnailPath) throw new apiErrors(400, "Thumbnail is required!");

  // get the video from DB
  const video = await Video.findById(videoId);
  if (!video) throw new apiErrors(404, "Failed to fetch video.");

  // Uploade thumbnail on cloud
  const newThumbnail = await uploadOnCloud(thumbnailPath);
  if (!newThumbnail) throw new apiErrors(500, "Failed to upload thumbnail.");

  // delete old thumbnail on cloud
  const publicId = extractPublicId(video.thumbnail);
  const deletedThumbnail = await deleteOnCloud(publicId);
  if (deletedThumbnail?.result !== "ok")
    throw new apiErrors(500, "failed to delete thumbnail");

  // Update data
  video.title = title;
  video.description = description;
  video.thumbnail = newThumbnail.url;

  // Update in DB
  const newVideo = await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new apiSuccess(200, newVideo, "Video details is updated successfully.")
    );
});

export const deleteVideo = asyncHandler(async (req, res) => {
  // Get the video id
  const { videoId } = req.params;
  if (!videoId) throw new apiErrors(400, "invalid video id!");

  // get the video from DB
  const video = await Video.findById(videoId);
  if (!video) throw new apiErrors(404, "Video not found!.");

  // Delete it from DB
  const deletedVideo = await Video.findByIdAndDelete(videoId);
  if (!deletedVideo) throw new apiErrors(500, "Failed to delete video");

  // Delete it from cloud
  const publicIdThumbnail = extractPublicId(video.thumbnail);
  const publicIdVideo = extractPublicId(video.videoFile);

  const deletedVideoFile = await deleteOnCloudVideo(publicIdVideo);
  const deletedThumbnail = await deleteOnCloud(publicIdThumbnail);
  if (deletedThumbnail?.result !== "ok" || deletedVideoFile?.result !== "ok")
    throw new apiErrors(500, "failed to delete video and thumbnail");

  return res
    .status(200)
    .json(new apiSuccess(200, deletedVideo, "Video is deleted"));
});

export const getAllVideos = asyncHandler(async (req, res) => {
  // Get the details
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const filter = {};

  // Search query filter
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  // Filter by userId if provided
  if (userId) filter.userId = userId;

  // Sorting
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { [sortBy]: sortType === "asc" ? 1 : -1 },
  };

  // Fetch paginated results
  const result = await Video.paginate(filter, options);
  if (!result) throw new apiErrors(500, "No more videos left!");

  return res.status(200).json(new apiSuccess(200, result, "Video is fetched"));
});
