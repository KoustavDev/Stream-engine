import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import { deleteOnCloud, uploadOnCloud } from "../utils/fileUploader.js";
import jwt from "jsonwebtoken";
import extractPublicId from "../utils/fileRemover.js";
import mongoose from "mongoose";
import { generateOTP, storeOTP, verifyOTP } from "../utils/redisActions.js";
import sendEmail from "../utils/email.js";

export const registerUser = asyncHandler(async (req, res) => {
  //1. get the credentials
  const { username, email, fullName, password } = req.body;

  //2. Verify it
  if (!username || !email || !fullName || !password)
    throw new apiErrors(400, "All fields are required");

  //3. check the user is already register or not
  const userExist = await User.findOne({ $or: [{ username }, { email }] });
  if (userExist)
    throw new apiErrors(409, "User with email or username already exists");

  //4. get the files
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath = "";
  if (req.files.coverImage)
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avatarLocalPath) throw new apiErrors(400, "Avatar file is required!");

  //5. Upload it to cloud
  const avatar = await uploadOnCloud(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloud(coverImageLocalPath)
    : "";
  if (!avatar)
    throw new apiErrors(500, "Failed to uploade avatar file in cloud");

  //6.  Make a user obj in DB
  const newUser = await User.create({
    username,
    email,
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage ? coverImage.url : "",
  });

  //7. remove the password and refresh token
  const finalUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );
  if (!finalUser) throw new apiErrors(500, "Failed to create user!");

  //8. Send it to the frontend
  return res
    .status(201)
    .json(new apiSuccess(200, finalUser, "User is registered successfully!"));
});

// it generate a access and refresh token and save it to teh user DB.
export async function generateAccessAndRefreshToken(userId) {
  try {
    // Get the user from DB
    const user = await User.findById(userId);

    // Generate generate a access and refresh token
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    // Update in DB
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiErrors(500, "Failed to generate referesh and access token !");
  }
}

export const loginUser = asyncHandler(async (req, res) => {
  // Get the credentials
  const { username, email, password } = req.body;

  // verify it
  if (!username && !email)
    throw new apiErrors(400, "username or email is required");

  // find user in DB bases on username or email
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) throw new apiErrors(404, "User does not exist");

  // Check password
  const passwordCheck = await user.isPasswordCorrect(password);
  if (!passwordCheck) throw new apiErrors(401, "Invalid user password");

  // generate access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // Modify the output for sending (exclude sensitive fields)
  const finalUser = user.toObject();
  delete finalUser.password;
  delete finalUser.refreshToken;

  // send cookies to frontend
  const cookieConfig = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieConfig)
    .cookie("refreshToken", refreshToken, cookieConfig)
    .json(
      new apiSuccess(
        200,
        { finalUser, accessToken, refreshToken },
        "User logged In Successfully"
      )
    );
});

export const handleGoogleCallback = asyncHandler(async (req, res) => {
  // Configure the cookies
  const cookieConfig = {
    httpOnly: true,
    secure: true,
  };

  // Send response
  return res
    .status(200)
    .cookie("accessToken", req.user.accessTokenJWT, cookieConfig)
    .cookie("refreshToken", req.user.refreshTokenJWT, cookieConfig)
    .json(
      new apiSuccess(
        200,
        {
          user: req.user.user,
          accessToken: req.user.accessTokenJWT,
          refreshToken: req.user.refreshTokenJWT,
        },
        "User logged In Successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  // extract user ud
  const userId = req.user._id;

  // Update refresh token in DB
  await User.findByIdAndUpdate(userId, { refreshToken: "" });

  // Send result to frontend
  const cookieConfig = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", cookieConfig)
    .clearCookie("refreshToken", cookieConfig)
    .json(new apiSuccess(200, {}, "User logged Out"));
});

export const renewTokens = asyncHandler(async (req, res) => {
  // collect refresh token from user
  const userToken = req.cookies.refreshToken || req.body.refreshToken;

  // Verification
  if (!userToken) throw new apiErrors(401, "unauthorized request");

  // Decodeing
  const verifyedToken = jwt.verify(userToken, process.env.REFRESH_TOKEN_SECRET);
  if (!verifyedToken) throw new apiErrors(401, "Invalid refresh token");

  // check its presence in DB
  const user = await User.findById(verifyedToken._id);
  if (!user) throw new apiErrors(401, "Invalid refresh token");

  // Match the tokens
  if (user.refreshToken !== userToken)
    throw new apiErrors(401, "Refresh token is expired or used");

  // generate new access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // Modify the output for sending (exclude sensitive fields)
  const finalUser = user.toObject();
  delete finalUser.password;
  delete finalUser.refreshToken;

  // send cookies to frontend
  const cookieConfig = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieConfig)
    .cookie("refreshToken", refreshToken, cookieConfig)
    .json(
      new apiSuccess(
        200,
        { finalUser, accessToken, refreshToken },
        "User token renew successfull"
      )
    );
});

export const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Get the current password and new password from user. //
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    throw new apiErrors(400, "Both password is required!");

  // get the user from db
  const user = await User.findById(req.user?._id);

  // Check password
  const passwordCheck = await user.isPasswordCorrect(currentPassword);
  if (!passwordCheck) throw new apiErrors(401, "Invalid password !");

  // save it to DB
  user.password = newPassword;
  const newUser = await user.save({ validateBeforeSave: false }); // Use this save method to trigger the pre-save (password hashing) middleward
  if (!newUser) throw new apiErrors(500, "Failed to change password");

  // Send response
  return res
    .status(200)
    .json(new apiSuccess(200, {}, "Password changed successfully!"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new apiSuccess(200, req.user, "User fetched successfully"));
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
  // Get user details
  const { fullName, email } = req.body;

  // Verify it
  if (!fullName || !email) throw new apiErrors(400, "All fields are required");

  //check the user is already register or not
  const userExist = await User.findOne({ email });
  if (userExist) throw new apiErrors(409, "User with email already exists");

  // update the user details
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");
  if (!user) throw new apiErrors(500, "Failed to update account details");

  // Send it to frontend
  return res
    .status(200)
    .json(new apiSuccess(200, user, "Account details updated successfully"));
});

export const updateAvatar = asyncHandler(async (req, res) => {
  // get file path
  const path = req.file?.path;

  // verify it
  if (!path) throw new apiErrors(400, "Avatar file is missing");

  // Uploade to new avatar
  const avatar = await uploadOnCloud(path);
  if (!avatar) throw new apiErrors(500, "failed to upload avatar file");

  // delete file on cloud
  const publicId = extractPublicId(req.user.avatar);
  const deletedCoverImage = await deleteOnCloud(publicId);
  if (deletedCoverImage?.result !== "ok")
    throw new apiErrors(500, "failed to delete avatar file");

  // Update to DB
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new apiSuccess(200, user, "Avatar image updated successfully"));
});

export const updateCoverImage = asyncHandler(async (req, res) => {
  // get file path
  const path = req.file?.path;

  // verify it
  if (!path) throw new apiErrors(400, "Cover Image file is missing");

  // Uploade to new Cover Image
  const coverImage = await uploadOnCloud(path);
  if (!coverImage)
    throw new apiErrors(500, "failed to upload Cover Image file");

  // delete file on cloud
  const publicId = extractPublicId(req.user.coverImage);
  const deletedCoverImage = await deleteOnCloud(publicId);
  if (deletedCoverImage?.result !== "ok")
    throw new apiErrors(500, "failed to delete Cover Image file");

  // Update to DB
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new apiSuccess(200, user, "Cover image updated successfully"));
});

export const channelDetails = asyncHandler(async (req, res) => {
  // get the channel username
  const { username } = req.params;
  if (!username) throw new apiErrors(400, "username is missing");

  // Aggregation pipelines
  const channel = await User.aggregate([
    { $match: { username: username } }, // Find the channel (user)
    {
      $lookup: {
        // make an user[] where the user._id from the channel === _id get from match part
        from: "subscriptions", // the name of collection
        foreignField: "channel", // jaa doc aar channel aa jaa user._id acha
        localField: "_id", // main channel aar user._id , tokobar match hoocha
        as: "subscribers", // taka store koro subscribers field aa as a user[]
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        foreignField: "subscriber",
        localField: "_id",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" }, // subscribers array size
        subscribedToCount: { $size: "$subscribedTo" }, // subscribedTo array size
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] }, //User id joodi channel aar subscribers list aa thaka
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        // Channel var aa aai field gulo thakba
        username: 1,
        email: 1,
        fullName: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);

  if (!channel?.length) throw new apiErrors(404, "channel does not exist");

  return res
    .status(200)
    .json(new apiSuccess(200, channel[0], "User channel fetched successfully"));
});

export const watchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.user._id) } }, // Use this syntax to get the '67a64deb559aaf49093646d9' from new ObjectId('67a64deb559aaf49093646d9')
    {
      $lookup: {
        from: "videos",
        foreignField: "_id", // match _id from user
        localField: "watchHistory", // match watchHistory from videos
        as: "watchHistory", // store in this field
        pipeline: [
          {
            // we are in videos collection
            $lookup: {
              from: "users",
              foreignField: "_id", // match _id from videos
              localField: "owner", // match owner from videos
              as: "owner", // store in this field
              pipeline: [
                {
                  // we are in users collection
                  $project: { fullName: 1, username: 1, avatar: 1 }, // only add these fields from users collection
                },
              ],
            },
          },
          { $addFields: { owner: { $first: "$owner" } } }, // Dont know. test it !
        ],
      },
    },
  ]);

  if (!user?.length) throw new apiErrors(500, "failed to fetch videos!");

  return res
    .status(200)
    .json(
      new apiSuccess(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export const sendEmailVerification = asyncHandler(async (req, res) => {
  // Extract the user email
  const { email } = req.body;

  // Check the email
  if (!email) throw new apiErrors(400, "Email is missing");

  // Generate OTP
  const otp = generateOTP();

  // Store OTP in Redis
  await storeOTP(email, otp);

  // Send email
  sendEmail(email, otp);

  return res
    .status(200)
    .json(new apiSuccess(200, {}, "Email verification sent successfully"));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  // Get the otp from user
  const { email, otp } = req.body;

  // Check the otp
  if (!otp || !email) throw new apiErrors(400, "OTP or email is missing");

  // Verify OTP
  const isVerified = await verifyOTP(email, otp);
  if (!isVerified) throw new apiErrors(400, "Invalid OTP");

  return res
    .status(200)
    .json(new apiSuccess(200, {}, "Email verified successfully"));
});