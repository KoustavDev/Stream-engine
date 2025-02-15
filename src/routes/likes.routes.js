import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import { getLikedVideos, toggleCommentLike, toggleVideoLike } from "../controllers/likes.controller.js";

const likeRoute = Router();

likeRoute.use(verifyUser);

likeRoute.route("/toggle/v/:videoId").post(toggleVideoLike);
likeRoute.route("/toggle/c/:commentId").post(toggleCommentLike);
likeRoute.route("/videos").get(getLikedVideos);

export default likeRoute;