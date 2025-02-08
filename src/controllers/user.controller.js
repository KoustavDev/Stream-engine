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
  delete user.password;
  delete user.refreshToken;

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
        { user, accessToken, refreshToken },
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
