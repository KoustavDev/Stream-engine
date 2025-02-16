import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import Playlist from "../models/playlist.model.js";

export const createPlayList = asyncHandler(async (req, res) => {
  // Get the details
  const { name, description, videos } = req.body;

  if (!name || !description || !videos || !Array.isArray(videos))
    throw new apiErrors(400, "Invalid credientials!");

  // Create a new playlist in DB
  const newPlayList = await Playlist.create({
    name,
    description,
    videos,
    owner : req.user._id,
  });
  if(!newPlayList) throw new apiErrors(500, "Failed to create playlist");

  return res.status(200).json(new apiSuccess(200,newPlayList,"New palylist is created"));
});