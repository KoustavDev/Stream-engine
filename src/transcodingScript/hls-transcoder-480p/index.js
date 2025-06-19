import {
  GetObjectCommand,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFile, readFile } from "fs/promises";
import fs from "node:fs";
import path from "path";
import { execSync } from "child_process";
import { glob } from "glob";

// Create S3 client with proper configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Add endpoint configuration if using custom S3 endpoint
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  }),
});

const bucketName = process.env.BUCKET_NAME || "temp-raw.video.koustav.test";
const filename = process.env.KEY;
const productionBucket =
  process.env.PRODUCTION_BUCKET || "production-videos.koustav.test";

// Function to get the production base folder path for S3
function getProductionBasePath(filename) {
  const { dir, name } = path.parse(filename);
  return path.join(dir, name);
}

// Upload a file to S3
async function uploadToS3(localPath, s3Key) {
  try {
    const fileContent = await readFile(localPath);

    // Determine content type based on file extension
    const extension = path.extname(localPath).toLowerCase();
    let contentType = "application/octet-stream";

    if (extension === ".m3u8") {
      contentType = "application/x-mpegURL";
    } else if (extension === ".ts") {
      contentType = "video/MP2T";
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: productionBucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
      })
    );

    console.log(`Uploaded ${localPath} to s3://${productionBucket}/${s3Key}`);
    return true;
  } catch (error) {
    console.error(`Failed to upload ${localPath} to S3:`, error);
    return false;
  }
}

// Upload a directory to S3
async function uploadDirectoryToS3(localDir, s3Prefix) {
  console.log(`Uploading directory ${localDir} to S3 prefix ${s3Prefix}`);

  try {
    // Get all files in the directory and subdirectories
    const files = await glob("**/*", { cwd: localDir, nodir: true });

    // Upload each file
    for (const file of files) {
      const localPath = path.join(localDir, file);
      const s3Key = path.join(s3Prefix, file).replace(/\\/g, "/");

      await uploadToS3(localPath, s3Key);
    }

    console.log(`Successfully uploaded directory ${localDir} to S3`);
    return true;
  } catch (error) {
    console.error(`Failed to upload directory ${localDir} to S3:`, error);
    return false;
  }
}

async function init() {
  try {
    if (!filename) {
      throw new Error("KEY environment variable is not set");
    }

    console.log(`Starting 480p transcoding process for ${filename}`);
    console.log(`Source bucket: ${bucketName}`);
    console.log(`Destination bucket: ${productionBucket}`);

    // Download the original video
    console.log(`Downloading video from ${bucketName}/${filename}`);
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: filename,
    });

    const response = await s3Client.send(command);

    // Convert the ReadableStream to a Buffer
    let chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const originalVideoPath = "/tmp/original-vid-480p.mp4";

    // Use writeFile from fs/promises to save the buffer to disk
    await writeFile(originalVideoPath, buffer);
    console.log(`Downloaded original video to ${originalVideoPath}`);

    const filePath = path.resolve(originalVideoPath);
    const basePath = getProductionBasePath(filename);

    // Create local output directory structure
    const outputDir = `/tmp/output-480p/${basePath}`;
    fs.mkdirSync(`${outputDir}/stream_2`, { recursive: true });

    // Use FFmpeg to create HLS segments for 480p only
    const ffmpegCommand = `ffmpeg -y -i "${filePath}" \
-map 0:v -filter:v:0 scale=854:480 \
-c:v:0 libx264 -b:v:0 1400k -maxrate:v:0 1498k -bufsize:v:0 2100k \
-map 0:a -c:a aac -b:a:0 96k -ac 2 \
-f hls \
-hls_time 10 \
-hls_playlist_type vod \
-hls_flags independent_segments \
-hls_segment_filename "${outputDir}/stream_2/segment_%03d.ts" \
${outputDir}/stream_2/index.m3u8`;

    console.log(
      "Executing FFmpeg command to create 480p HLS segments locally..."
    );
    console.log(ffmpegCommand);

    // Execute the command with increased buffer size for larger outputs
    execSync(ffmpegCommand, {
      stdio: "inherit",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    console.log("480p FFmpeg transcoding completed successfully");

    // Upload the directory structure to S3
    console.log("Uploading 480p HLS content to S3...");
    await uploadDirectoryToS3(`${outputDir}/stream_2`, `${basePath}/stream_2`);

    console.log("480p HLS segments and playlist have been uploaded to S3");
    console.log(
      `480p content available at: s3://${productionBucket}/${basePath}/stream_2/index.m3u8`
    );

    // Clean up local files
    if (fs.existsSync(originalVideoPath)) {
      fs.unlinkSync(originalVideoPath);
      console.log(`Cleaned up original video: ${originalVideoPath}`);
    }
  } catch (error) {
    console.error("Error during 480p transcoding:", error);
    process.exit(1);
  }
}

init();
