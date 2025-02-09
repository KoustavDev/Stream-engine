import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  renewTokens,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
} from "../controllers/user.controller.js";
import upload from "../middlewares/multer.middleware.js";
import verifyUser from "../middlewares/auth.middleware.js"

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

userRoute.route("/login").post(loginUser);
userRoute.route("/renew-tokens").post(renewTokens);

// Secured routes
// This routes are protected by my middleware shield.

userRoute.route("/logout").post(verifyUser, logoutUser);
userRoute.route("/change-password").post(verifyUser, changeCurrentPassword);
userRoute.route("/current-user").get(verifyUser, getCurrentUser);
userRoute.route("/update-account").patch(verifyUser, updateAccountDetails);
userRoute
  .route("/update-avatar")
  .patch(verifyUser, upload.single("avatar"), updateAvatar);
export default userRoute;