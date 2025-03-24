import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { ProgressStream } from "./customStream.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloud = async (filePath) => {
  try {
    if (!filePath) return null;
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    // After uploading the file delete the file from server.
    fs.unlinkSync(filePath); // unlink means delete.
    return response;
  } catch (error) {
    // If uploading is failed delete the file from server.
    fs.unlinkSync(filePath);
    return null;
  }
};

export const uploadOnCloudGoogle = async (filePath) => {
  try {
    if (!filePath) return null;
    // Upload the file url to cloud.
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    return response;
  } catch (error) {
    return null;
  }
};

export const deleteOnCloud = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    return null;
  }
};
export const deleteOnCloudVideo = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
    });
    return result;
  } catch (error) {
    return null;
  }
};

// Helper function to upload files with progress tracking
export const uploadFileWithProgress = async (file, socketId, fileType) => {
  const fileSize = file.size;

  // Create a Promise that resolves when Cloudinary upload is complete
  return new Promise((resolve, reject) => {
    // Create a controlled progress stream
    const progressStream = new ProgressStream(
      file.buffer || fs.readFileSync(file.path),
      {
        length: fileSize,
        socketId,
        fileType,
        chunkSize: 65536, // 64KB chunks
      }
    );

    // Create Cloudinary upload stream
    const cloudinaryUpload = cloudinary.uploader.upload_stream(
      {
        resource_type: fileType === "video" ? "video" : "image",
        chunk_size: 6000000, // 6MB chunks
      },
      (error, result) => {
        if (error) {
          progressStream.cleanup();
          reject(error);
          return;
        }

        // For video files, add duration from cloudinary response
        if (fileType === "video" && result) {
          result.duration = result.duration || 0;
        }

        // Clean up the temporary file if it exists on the filesystem
        if (file.path) {
          fs.unlink(file.path, (unlinkError) => {
            if (unlinkError) {
              console.error(
                `Error deleting temporary file ${file.path}:`,
                unlinkError
              );
            } else {
              console.log(`Successfully deleted temporary file: ${file.path}`);
            }
          });
        }

        resolve(result);
      }
    );

    // Handle errors in the pipeline
    progressStream.on("error", (error) => {
      progressStream.cleanup();

      // Also clean up the temporary file in case of error
      if (file.path) {
        fs.unlink(file.path, () => {});
      }

      reject(error);
    });

    cloudinaryUpload.on("error", (error) => {
      progressStream.cleanup();

      // Also clean up the temporary file in case of error
      if (file.path) {
        fs.unlink(file.path, () => {});
      }

      reject(error);
    });

    // Pipe the progress stream to Cloudinary
    progressStream.pipe(cloudinaryUpload);
  });
};
