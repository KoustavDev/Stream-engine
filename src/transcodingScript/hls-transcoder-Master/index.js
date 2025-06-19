import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import path from "path";

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

async function deleteRawFile(bucketName, filename) {
  console.log("Deleting raw video from S3...");
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filename,
    });
    await s3Client.send(deleteCommand);
    console.log(`Deleted raw video: ${filename} from ${bucketName}`);
  } catch (error) {
    console.error(`Failed to delete raw video: ${error}`);
  }
}

async function generateMasterPlaylist() {
  try {
    if (!filename) {
      throw new Error("KEY environment variable is not set");
    }

    console.log(`Generating master playlist for ${filename}`);
    const basePath = getProductionBasePath(filename);

    // Generate master playlist content
    const masterPlaylistContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5192000,RESOLUTION=1920x1080
stream_0/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720 
stream_1/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1496000,RESOLUTION=854x480
stream_2/index.m3u8`;

    // Upload master playlist to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: productionBucket,
        Key: `${basePath}/master.m3u8`,
        Body: masterPlaylistContent,
        ContentType: "application/x-mpegURL",
      })
    );

    console.log(
      `Master playlist uploaded to s3://${productionBucket}/${basePath}/master.m3u8`
    );

    // Delete the raw file from S3 after all processing is complete
    await deleteRawFile(bucketName, filename);

    console.log(
      "Master playlist generation and raw file cleanup completed successfully"
    );
  } catch (error) {
    console.error("Error generating master playlist:", error);
    process.exit(1);
  }
}

generateMasterPlaylist();
