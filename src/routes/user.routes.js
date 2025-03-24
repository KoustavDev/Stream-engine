import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  renewTokens,
  changeCurrentPassword,
  sendEmailVerification,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  channelDetails,
  watchHistory,
  verifyEmail,
  handleGoogleCallback,
} from "../controllers/user.controller.js";
import upload from "../middlewares/multer.middleware.js";
import verifyUser from "../middlewares/auth.middleware.js"
import passport from "passport";

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
userRoute.route("/send-email").post(sendEmailVerification);
userRoute.route("/verify-email").post(verifyEmail);
userRoute.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
userRoute.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false }),
  handleGoogleCallback
);

// Secured routes
// This routes are protected by my middleware shield.

userRoute.route("/logout").post(verifyUser, logoutUser);
userRoute.route("/change-password").post(verifyUser, changeCurrentPassword);
userRoute.route("/current-user").get(verifyUser, getCurrentUser);
userRoute.route("/update-account").patch(verifyUser, updateAccountDetails);
userRoute
  .route("/update-avatar")
  .patch(verifyUser, upload.single("avatar"), updateAvatar);
userRoute
  .route("/update-coverImage")
  .patch(verifyUser, upload.single("coverImage"), updateCoverImage);
userRoute.route("/channel/:username").get(verifyUser, channelDetails);
userRoute.route("/watch-history").get(verifyUser, watchHistory);

export default userRoute;