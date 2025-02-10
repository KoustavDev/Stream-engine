import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloud = async (filePath) => {
    try {
        if(!filePath) return null;
        const response = await cloudinary.uploader.upload(filePath, {resource_type: "auto"});
        // After uploading the file delete the file from server.
        fs.unlinkSync(filePath); // unlink means delete.
        return response;
    } catch (error) {
      // If uploading is failed delete the file from server.
      fs.unlinkSync(filePath);
      return null;
    }
}

export const deleteOnCloud = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    return null;
  }
}