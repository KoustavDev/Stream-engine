import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import { Comment } from "../models/comments.model.js";

export const addComment = asyncHandler(async (req, res) => {
  // Get the details
  const { videoId } = req.params;
  const { content } = req.body;
  if (!content) throw new apiErrors(400, "Content is required!");

  // Save in to DB
  const comment = await Comment.create({
    content,
    owner: req.user._id,
    video: videoId,
  });
  if (!comment) throw new apiErrors(500, "Failed to create comment");

  return res
    .status(200)
    .json(new apiSuccess(200, comment, "Comment is created successfully"));
});

export const updateComment = asyncHandler(async (req, res) => {
  // Get the details
  const { commentId } = req.params;
  const { content } = req.body;
  if (!content) throw new apiErrors(400, "Content is required!");

  // Update on DB
  const newComment = await Comment.findByIdAndUpdate(
    commentId,
    { content },
    { new: true }
  );
  if (!newComment) throw new apiErrors(500, "Failed to update comment");

  return res
    .status(200)
    .json(new apiSuccess(200, newComment, "Comment is updated successfully"));
});
export const deleteComment = asyncHandler(async (req, res) => {
  // Get the details
  const { commentId } = req.params;
  if (!commentId) throw new apiErrors(400, "Comment id is required!");

  // Update on DB
  const newComment = await Comment.findByIdAndDelete(commentId);
  if (!newComment) throw new apiErrors(500, "Failed to delete comment");

  return res
    .status(200)
    .json(new apiSuccess(200, {}, "Comment is deleted successfully"));
});

export const getVideoComments = asyncHandler(async (req, res) => {
    // Get the details
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    if (!videoId) throw new apiErrors(400, "Video id is required!");

    const options = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Fetch paginated result
    const comments = await Comment.paginate({}, options);
    if(!comments) throw new apiErrors(500, "No more comments left!");

    return res
      .status(200)
      .json(new apiSuccess(200, comments, "Comments is fetched"));
})
