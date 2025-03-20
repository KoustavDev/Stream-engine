import apiSuccess from "../utils/apiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";

export const checkHealth = asyncHandler(async (req, res) => {
  res.status(200).json(new apiSuccess(200, "Health check passed"));
});
