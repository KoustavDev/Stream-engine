import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import { deleteVideo, getVideoById, publishVideo, updateVideo } from "../controllers/video.controller.js";
import upload from "../middlewares/multer.middleware.js";


const videoRoute = Router();

videoRoute.use(verifyUser); // Apply verifyJWT middleware to all routes in this file

videoRoute.route("/").post(
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  publishVideo
);

videoRoute
  .route("/:videoId")
  .get(getVideoById)
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), updateVideo);

export default videoRoute;