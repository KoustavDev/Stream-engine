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
    owner: req.user._id,
  });
  if (!newPlayList) throw new apiErrors(500, "Failed to create playlist");

  return res
    .status(200)
    .json(new apiSuccess(200, newPlayList, "New palylist is created"));
});

export const getUserPlayLists = asyncHandler(async (req, res) => {
  // Get the user details
  const { userId } = req.params;
  if (!userId) throw new apiErrors(400, "User id is required!");

  // Get playlist from DB
  const playlists = await Playlist.find({ owner: userId });
  if (!playlists) throw new apiErrors(500, "Failed to fetch users playlist");

  return res
    .status(200)
    .json(new apiSuccess(200, playlists, "Users playlist is fetched"));
});

export const getPlaylistById = asyncHandler(async (req, res) => {
  // Get the user details
  const { playlistId } = req.params;
  if (!playlistId) throw new apiErrors(400, "Playlist id is required!");

  // Get playlist from DB
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new apiErrors(500, "Failed to fetch playlist");

  return res
    .status(200)
    .json(new apiSuccess(200, playlist, "Playlist is fetched"));
});

export const addVideoToPlaylist = asyncHandler(async (req, res) => {
  // Get the user details
  const { playlistId, videoId } = req.params;
  if (!playlistId || !videoId) throw new apiErrors(400, "Invalid credential!");

  // Update the playlist
  const updatedPlayList = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $push: { videos: videoId },
    },
    { new: true }
  );
  if (!updatedPlayList)
    throw new apiErrors(500, "Failed to update update playlist");

  return res
    .status(200)
    .json(new apiSuccess(200, updatedPlayList, "New updated playlist"));
});

export const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  // Get the user details
  const { playlistId, videoId } = req.params;
  if (!playlistId || !videoId) throw new apiErrors(400, "Invalid credential!");

  // Update the playlist
  const updatedPlayList = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: videoId },
    },
    { new: true }
  );
  if (!updatedPlayList)
    throw new apiErrors(500, "Failed to update update playlist");

  return res
    .status(200)
    .json(new apiSuccess(200, updatedPlayList, "New updated playlist"));
});

export const deletePlayList = asyncHandler(async (req, res) => {
  // Get the details
  const { playlistId } = req.params;
  if (!playlistId) throw new apiErrors(400, "Invalid credential!");

  // delete from DB
  const deletedList = await Playlist.findByIdAndDelete(playlistId, {
    new: true,
  });
  if (!deletedList) throw new apiErrors(500, "Failed to dedlete playlist");

  return res.status(200).json(new apiSuccess(200, {}, "Playlist is deleted"));
});

export const updatePlaylist = asyncHandler(async (req, res) => {
  // Get the details
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!playlistId || !name || !description)
    throw new apiErrors(400, "Invalid credential!");

  // update in DB
  const updatedPlayList = await Playlist.findByIdAndUpdate(
    playlistId,
    { name, description },
    { new: true }
  );
  if (!updatedPlayList)
    throw new apiErrors(500, "Failed to update update playlist");

  return res
    .status(200)
    .json(new apiSuccess(200, updatedPlayList, "New updated playlist"));
});