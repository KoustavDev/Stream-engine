import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import {
  addVideoToPlaylist,
  createPlayList,
  deletePlayList,
  getPlaylistById,
  getUserPlayLists,
  removeVideoFromPlaylist,
  updatePlaylist,
} from "../controllers/playlist.controller.js";

const playlistRoute = Router();

playlistRoute.use(verifyUser);

playlistRoute.route("/").post(createPlayList);
playlistRoute.route("/user/:userId").get(getUserPlayLists);
playlistRoute
  .route("/:playlistId")
  .get(getPlaylistById)
  .delete(deletePlayList)
  .patch(updatePlaylist);
playlistRoute.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
playlistRoute
  .route("/remove/:videoId/:playlistId")
  .patch(removeVideoFromPlaylist);

export default playlistRoute;