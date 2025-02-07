import asyncHandler from "../utils/asyncHandler.js";
import apiErrors from "../utils/apiErrors.js";
import apiSuccess from "../utils/apiSuccess.js";
import User from "../models/user.model.js";
import uploadOnCloud from "../utils/fileUploader.js";

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
  if (req.files.coverImage) coverImageLocalPath = req.files?.coverImage[0]?.path;
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
