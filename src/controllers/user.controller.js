import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import { deleteOnCloud, uploadOnCloud } from "../utils/fileUploader.js";
import jwt from "jsonwebtoken";
import extractPublicId from "../utils/fileRemover.js";

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
async function generateAccessAndRefreshToken(userId) {
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
  const deletedAvatar = await deleteOnCloud(publicId);
  if (deletedAvatar?.result !== "ok")
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
