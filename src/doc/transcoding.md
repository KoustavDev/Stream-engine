# 🧰 Video Transcoding Logic (ECS Containers)

Stream Engine’s video processing pipeline uses **AWS ECS**, **S3**, and **FFmpeg** to convert uploaded videos into adaptive bitrate HLS streams. This document explains how the ECS containers work, the FFmpeg commands used, and how the final master playlist is generated and uploaded to S3.

---

## 🧱 Overview of the Transcoding Architecture

1. **Client Upload**

   * A video is uploaded to the `Raw.video` S3 bucket using a **signed URL**.

2. **Lambda Trigger**

   * Once uploaded, an AWS Lambda function is triggered, which starts a **Step Function**.

3. **Step Function Transcoding Pipeline**

   * Runs **3 parallel ECS tasks** (for 1080p, 720p, and 480p).
   * Each ECS task:

     * Downloads the raw video from S3
     * Transcodes it into HLS format using FFmpeg
     * Uploads HLS segments and playlist to the `Production.video` S3 bucket

4. **Master Playlist Builder**

   * A 4th ECS task generates a `master.m3u8` playlist linking all three variants.
   * It deletes the raw video from `Raw.video` bucket to save space.

---

## ⚙️ ECS Transcoding Task – 1080p

### ✅ Responsibilities

* Download original video from S3
* Transcode into HLS format (1920x1080)
* Upload HLS segments and playlist to `Production.video` bucket

### 🧾 FFmpeg Command

```bash
ffmpeg -y -i "input.mp4" \
-map 0:v -filter:v:0 scale=1920:1080 \
-c:v:0 libx264 -b:v:0 5000k -maxrate:v:0 7500k -bufsize:v:0 10000k \
-map 0:a -c:a aac -b:a:0 192k -ac 2 \
-f hls \
-hls_time 10 \
-hls_playlist_type vod \
-hls_flags independent_segments \
-hls_segment_filename "segment_%03d.ts" \
index.m3u8
```

### 📝 Node.js Logic (Summarized)

* Uses `@aws-sdk/client-s3` to:

  * Download original video from `Raw.video`
  * Upload output files to `Production.video`
* Uses `fs`, `glob`, and `execSync` to:

  * Save the input video
  * Run the FFmpeg command
  * Upload the full output directory to S3

> 🔁 This logic is **replicated** across separate containers for 720p and 480p, with just different FFmpeg scale and bitrate values.

---

## 📂 Output Directory Structure

Example structure for 1080p (same for other resolutions):

```
/tmp/output-1080p/video-id/
├── stream_0/
│   ├── index.m3u8
│   ├── segment_000.ts
│   ├── segment_001.ts
│   └── ...
```

It gets uploaded to:

```
s3://production-videos.koustav/video-id/stream_0/
```

---

## 🧠 Master Playlist Generator

Once all resolutions are processed, a **dedicated ECS task** generates the `master.m3u8` file.

### 🎯 Responsibilities

* Create a playlist that references all three resolutions
* Upload it to the `Production.video` bucket
* Delete the original video from `Raw.video` bucket

### 📄 Example master.m3u8

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5192000,RESOLUTION=1920x1080
stream_0/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720 
stream_1/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1496000,RESOLUTION=854x480
stream_2/index.m3u8
```

### 🔄 Final Output Location

```
s3://production-videos.koustav/video-id/master.m3u8
```

---

## 🧹 Cleanup Logic

Once the master playlist is uploaded, the raw input video is no longer needed.

The task:

* Deletes the raw `.mp4` file from `Raw.video`
* Ensures only production-ready, optimized files are retained

---

## 🔐 Security & Optimization Notes

* All S3 uploads/downloads use IAM-based access.
* HLS segments are served via **AWS CloudFront**.
* Segments are short (`hls_time = 10s`) and aligned (`hls_flags = independent_segments`) for better streaming experience.
* All tasks are isolated and stateless—making it highly scalable.

---

## 🧪 Testing & Simulation

You can locally simulate this behavior by setting the following env vars:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export BUCKET_NAME=temp-raw.video.koustav.test
export PRODUCTION_BUCKET=production-videos.koustav.test
export KEY=uploads/sample.mp4
```

Then run:

```bash
node ecs-transcode-1080p.js
node generate-master-playlist.js
```

---

## ✅ Summary

The ECS transcoding logic in Stream Engine ensures:

| Goal                | How It's Achieved                          |
| ------------------- | ------------------------------------------ |
| Efficient Streaming | Adaptive bitrate HLS via FFmpeg            |
| Scalable Compute    | Parallel ECS container execution           |
| Optimized Delivery  | CloudFront + segmented `.ts`               |
| Clean Lifecycle     | Raw file cleanup after processing          |
| Easy Integration    | Final output is ready-to-use `master.m3u8` |

