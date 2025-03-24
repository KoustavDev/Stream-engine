import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import { uploadOnCloudGoogle } from "./fileUploader.js";
import { generateAccessAndRefreshToken } from "../controllers/user.controller.js";

const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI,
      },
      googleAuthCallback
    )
  );
};

const googleAuthCallback = async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists in the database
    const userExist = await User.findOne({ email: profile.emails[0].value });
    if (userExist) {
      // User exists, cook tokens and return user
      const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        userExist._id
      );

      // Update the refresh token in the database
      userExist.refreshToken = refreshToken;
      await userExist.save();

      // Return the existing user with new tokens
      return done(null, {
        user: userExist,
        accessTokenJWT: accessToken,
        refreshTokenJWT: refreshToken,
        isNewUser: false,
      });
    }

    // User doesn't exist, prepare for creation

    // 1. Upload avatar to Cloudinary
    let avatarUrl = "";
    if (profile.photos && profile.photos[0].value) {
      const avatar = await uploadOnCloudGoogle(profile.photos[0].value);
      avatarUrl = avatar.url;
    }

    // 2. Create new user
    const newUser = await User.create({
      username:
        profile.displayName.toLowerCase().replace(/\s+/g, "_") +
        "_" +
        Math.floor(Math.random() * 10000), // Generate a unique username
      email: profile.emails[0].value,
      fullName: profile.displayName,
      avatar: avatarUrl,
      coverImage: "",
      password:
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8), // Generate a random password
      googleLogin: true, // It is a google login user
    });

    // 3. Create JWT Tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      newUser._id
    );

    // 4. Store refresh token in user document
    newUser.refreshToken = refreshToken;
    await newUser.save();

    // 5. Find user without password and refresh token for response
    const finalUser = await User.findById(newUser._id).select(
      "-password -refreshToken"
    );

    return done(null, {
      user: finalUser,
      accessTokenJWT: accessToken,
      refreshTokenJWT: refreshToken,
      isNewUser: true,
    });
  } catch (error) {
    return done(error, null);
  }
};

export default configurePassport;
