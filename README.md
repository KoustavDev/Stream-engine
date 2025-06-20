# 🎬 Stream Engine – Scalable Backend for Video Streaming

**Stream Engine** is a production-ready, scalable backend server for a video streaming platform—akin to YouTube. It’s designed to handle everything from secure video uploads to adaptive bitrate streaming, with built-in support for rate limiting, real-time updates, user authentication, and more.

This project leverages **Cloudinary**, **AWS (S3, Lambda, ECS, CloudFront, Step Functions)**, **HLS streaming**, and **Redis** to deliver a modern backend infrastructure for smooth video playback and efficient system performance.



## 📖 Live API Documentation

> 🔗 Visit: [https://doc-stream-engine.netlify.app](https://doc-stream-engine.netlify.app)

A complete interactive Swagger/OpenAPI 3.0 specification of all backend endpoints is available here. This includes authentication, upload, video streaming, and admin operations—with real request/response examples.



## 🚀 Features

* 🎥 **HLS Adaptive Bitrate Streaming** (Cloudinary & Custom AWS Pipeline)
* 🔁 **Video Transcoding Pipeline** (FFmpeg, AWS ECS, Step Functions)
* 🌐 **CDN Integration** via AWS CloudFront
* 📦 **Chunked Video Uploads** with Signed URLs
* 🔐 **Auth System** (Google Login, Email Verification)
* 💬 **WebSocket Support** for real-time communication
* ⚖️ **Rate Limiting** using Token Bucket Algorithm (Redis + Lua)
* 🧪 **Version 2** with full AWS-powered streaming pipeline & CDN



## 📦 Version 2: Custom AWS-Based HLS Pipeline

Unlike the initial Cloudinary implementation, **Version 2** introduces a completely self-managed pipeline for adaptive HLS video streaming using AWS. Here's how it works:

### 🗂️ Architecture Overview

1. **Two S3 Buckets:**

   * `Raw.video`: Temporary bucket for raw uploads.
   * `Production.video`: Stores processed HLS content.

2. **Upload Flow:**

   * Server generates **signed S3 URL** for `Raw.video`.
   * Client uploads video to this URL.

3. **Lambda Trigger:**

   * Upload event triggers **Lambda**, which fetches metadata and starts a **Step Function**.

4. **Step Function Pipeline:**

   * Runs **3 ECS tasks in parallel**, each transcoding to:

     * 1080p HLS
     * 720p HLS
     * 480p HLS
   * A **4th ECS task** builds `master.m3u8`.

5. **Final Notification:**

   * A post-processing **Lambda** notifies the server of job completion.

6. **CDN Delivery:**

   * AWS **CloudFront** serves HLS playlists and chunks to clients globally.

📊 **Detailed explanation with diagram includes** – See the [`/src/docs`](https://github.com/KoustavDev/Stream-engine/blob/main/src/doc/transcoding.md) folder for the AWS Step Function architecture image .



## 🛡️ Why We Use the Token Bucket Algorithm

To ensure backend stability and fair API usage, we implemented **Token Bucket-based rate limiting** with Redis and Lua scripting.

### 🎯 Project Goals

| Requirement          | Why Token Bucket Helps                                                            |
| -------------------- | --------------------------------------------------------------------------------- |
| Prevent abuse        | Per-IP limits throttle aggressive clients                                         |
| Allow request bursts | Stored tokens handle short spikes (e.g., resolution change or jumping timestamps) |
| Fairness             | Each IP has an isolated token bucket                                              |
| Protect AWS limits   | Global token cap keeps overall traffic in check                                   |
| Fast enforcement     | Redis + Lua ensures atomic, low-latency decisions                                 |

### 🔍 Layers of Rate Limiting

* **Global Bucket**: Max 5 requests/sec across all clients.
* **Per-IP Bucket**: Max 2 requests/sec per user/IP.



## 💡 Technologies Used

| Area               | Tools/Services                                  |
| ------------------ | ----------------------------------------------- |
| Video Processing   | AWS ECS + FFmpeg + Step Functions + Lambda      |
| Streaming Format   | HLS (HTTP Live Streaming)                       |
| Storage            | AWS S3                                          |
| Delivery Network   | AWS CloudFront                                  |
| Authentication     | Google OAuth, Email Verification (custom logic) |
| Realtime Messaging | WebSocket                                       |
| Rate Limiting      | Redis + Lua-based Token Bucket                  |
| CDN (Initial Ver.) | Cloudinary                                      |
| Backend Framework  | Node.js + Express                               |



## 📁 Folder Structure (Important Folders Only)

```
├── /src
│   ├── /routes           # Express routes (upload, auth, etc.)
│   ├── /controllers      # Business logic for routes
│   ├── /middlewares      # Token Bucket, Auth, etc.
│   ├── /utils            # HLS helpers, FFmpeg jobs, signed URL gen
│   ├── /services         # Cloudinary, AWS S3, Redis services
|   └── /transcodingScript# FFmpeg transcoding & playlist generator
├── /docs
│   └── pipeline-diagram.png  # Visual diagram of V2 architecture
├── .env.example
└── README.md
```



## 🧪 How to Run Locally

```bash
git clone https://github.com/KoustavDev/Stream-engine
cd Stream-engine
cp .env.example .env # Fill in AWS, Redis, and Cloudinary credentials
npm install
npm run dev
```

> ⚠️ Make sure Redis, AWS IAM roles, Lambda permissions, AWS architecture and Cloudinary setup (if used) are configured.



## 🧠 Inspiration & Learnings

This project was built not just to mimic existing platforms like YouTube, but to **learn and implement real-world system design**: rate limiting, CDN, video processing pipelines, and scalable server patterns.



## 🤝 Contributing

Pull requests and discussions are welcome! Please make sure to lint your code and document new APIs/features.



## 📜 License

MIT © [Koustav Majhi](https://github.com/KoustavDev)

