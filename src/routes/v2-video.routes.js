import { Router } from "express";
import {
  processCompleteNotification,
  resigneCookie,
  uploadVideo,
  getPublicVideoById,
} from "../controllers/v2-video.controller.js";
import verifyUser from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";

const videoRoute_v2 = Router();

videoRoute_v2
  .route("/")
  .post(verifyUser, upload.single("thumbnail"), uploadVideo);
videoRoute_v2
  .route("/processCompleteNotification")
  .patch(processCompleteNotification);

videoRoute_v2.route("/:videoId").get(verifyUser, resigneCookie);
videoRoute_v2.route("/public/:videoId").get(verifyUser, getPublicVideoById);

export default videoRoute_v2;
