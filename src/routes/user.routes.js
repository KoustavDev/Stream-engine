import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import upload from "../middlewares/multer.middleware.js";

const userRoute = Router();

userRoute.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

export default userRoute;