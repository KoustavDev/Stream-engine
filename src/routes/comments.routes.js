import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import { addComment, deleteComment, getVideoComments, updateComment } from "../controllers/comment.controller.js";

const commentRoute = Router();

commentRoute.use(verifyUser);

commentRoute.route("/:videoId").post(addComment).get(getVideoComments);
commentRoute.route("/c/:commentId").patch(updateComment).delete(deleteComment);

export default commentRoute;