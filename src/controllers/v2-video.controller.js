import mongoose from "mongoose";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import { redisClient, s3Client } from "../app.js";
import asyncHandler from "../utils/asyncHandler.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { uploadOnCloud } from "../utils/fileUploader.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

export const uploadVideo = asyncHandler(async (req, res) => {
  // Extract details
  const { title, description, videoName, duration } = req.body;

  // Validate details
  if (!title || !description || !videoName || !duration) {
    throw new apiErrors(400, "All fields are required");
  }

  // Get new thumbnail
  const thumbnailPath = req.file?.path;
  if (!thumbnailPath) throw new apiErrors(400, "Thumbnail is required!");

  // Uploade thumbnail on cloud
  const newThumbnail = await uploadOnCloud(thumbnailPath);
  if (!newThumbnail) throw new apiErrors(500, "Failed to upload thumbnail.");

  // Make a new video instance
  const newVideo = new Video({
    videoFile: videoName,
    thumbnail: newThumbnail.url,
    title,
    description,
    duration: duration,
    views: 0,
    isPublished: false,
    owner: req.user,
  });

  // get video id
  const videoId = newVideo._id;

  if (!videoId) throw new apiErrors(500, "Failed to generate video ID");

  newVideo.videoFile = `${req.user._id}/${videoId}/master.m3u8`;

  // Save the video to the database
  const uploadedVideo = await newVideo.save();
  if (!uploadedVideo) throw new apiErrors(500, "Failed to save video.");

  // Get Upload URL
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_RAW_BUCKET_NAME,
    Key: `${req.user._id}/${videoId}.mp4`,
    ContentType: "video/mp4",
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 600 });

  return res
    .status(200)
    .json(
      new apiSuccess(200, { uploadUrl: url }, "Video uploaded successfully!")
    );
});

export const processCompleteNotification = asyncHandler(async (req, res) => {
  const { key } = req.body;

  if (!key) throw new apiErrors(400, "Video key is required");

  // Split the key into parts
  const parts = key.split("/");

  // Validate key structure
  if (parts.length < 3 || !parts[0] || !parts[1]) {
    throw new apiErrors(400, "Invalid key format");
  }

  const ownerId = parts[0];
  const videoId = parts[1];

  // Validate IDs format
  if (!isValidObjectId(ownerId) || !isValidObjectId(videoId)) {
    throw new apiErrors(400, "Invalid ID format");
  }

  // Update video status
  const updatedVideo = await Video.findOneAndUpdate(
    { _id: videoId, owner: ownerId },
    { isPublished: true },
    { new: true }
  );

  if (!updatedVideo) {
    throw new apiErrors(404, "Video not found or update failed");
  }

  // Notify user
  try {
    const socketId = await redisClient.get(`socket:${ownerId}`);
    if (socketId) {
      io.to(socketId).emit("video-uploaded", {
        videoId: updatedVideo._id,
        status: "published",
      });
    }
  } catch (redisError) {
    console.error("Redis notification failed:", redisError);
  }

  return res.status(200).json(new apiSuccess(200, updatedVideo));
});

export const resigneCookie = asyncHandler(async (req, res) => {
  // Get the video id and user id
  const { key } = req.params;

  if (!key) throw new apiErrors(400, "Video key is required!");

  // Generate signed cookies
  const signedCookies = getSignedCookies({
    url: `https://${process.env.CLOUDFRONT_DOMAIN}/${key}/*`,
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
    dateLessThan: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
  });

  if (!signedCookies)
    throw new apiErrors(500, "Failed to generate signed cookies.");

  // Set secure cookies with additional protections
  const cookieOptions = {
    Domain: process.env.CLOUDFRONT_DOMAIN,
    httpOnly: true,
    secure: true,
  };

  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN); // Frontend URL
  res.header("Access-Control-Allow-Credentials", "true");
  res.cookie(
    "CloudFront-Policy",
    signedCookies["CloudFront-Policy"],
    cookieOptions
  );
  res.cookie(
    "CloudFront-Signature",
    signedCookies["CloudFront-Signature"],
    cookieOptions
  );
  res.cookie(
    "CloudFront-Key-Pair-Id",
    signedCookies["CloudFront-Key-Pair-Id"],
    cookieOptions
  );

  res
    .status(200)
    .json(new apiSuccess(200, "Signed cookies generated successfully."));
});

export const getPublicVideoById = asyncHandler(async (req, res) => {
  console.log("got video by id request");
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
        openUrl: {
          $concat: [
            process.env.AWS_S3_PRODUCTION_BUCKET_NAME,
            "/",
            "$videoFile",
          ],
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
