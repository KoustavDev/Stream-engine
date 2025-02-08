import jwt from "jsonwebtoken";
import apiErrors from "../utils/apiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";

// This middleware verify that the user verifyed to goto some routes or not.
// It a shield to prevent unauthorized user to goto some protected routes.
// Also provide user info from the DB.
const verifyUser = asyncHandler(async (req, _, next) => {
   try {
    // Get the JWT token from cookies or Authorization header.
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) throw new apiErrors(401, "Unauthorized request");

    // Verify the JWT token.
    const verifyedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Find the user associated with the token.
    const user = await User.findById(verifyedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) throw new apiErrors(401, "Invalid Access Token");

    // Add the authenticated user to the request object.
    req.user = user;
    
    next();
  } catch (error) {
    throw new apiErrors(401, error?.message || "Invalid Access Token");
  }
});

export default verifyUser;
