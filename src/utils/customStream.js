import { Readable } from "stream";
import { io } from "../app.js";

export class ProgressStream extends Readable {
  constructor(source, options = {}) {
    super();
    this.source = source;
    this.bytesRead = 0;
    this.totalBytes = options.length || source.length || 0;
    this.socketId = options.socketId;
    this.lastReportedProgress = 0;
    this.throttleInterval = 250; // ms
    this.lastReportTime = Date.now();
    this.chunkSize = options.chunkSize || 16384; // 16KB chunks
    this.position = 0;
    this.paused = false;
    this.manualPauseInterval = null;

    // Setup throttled progress reporting
    this.setupProgressReporting();
  }

  setupProgressReporting() {
    // Start slow upload simulation (first 10%)
    this.manualPauseInterval = setInterval(() => {
      if (this.bytesRead > 0 && this.bytesRead < this.totalBytes) {
        const progress = Math.round((this.bytesRead / this.totalBytes) * 100);

        // Only report progress if it has changed or enough time has passed
        const now = Date.now();
        if (
          (progress !== this.lastReportedProgress &&
            now - this.lastReportTime >= this.throttleInterval) ||
          progress === 0 ||
          progress === 100
        ) {
          io.to(this.socketId).emit("uploadProgress", {
            percent: progress,
            bytesUploaded: this.bytesRead,
            totalBytes: this.totalBytes,
          });

          this.lastReportedProgress = progress;
          this.lastReportTime = now;
        }
      }
    }, this.throttleInterval);
  }

  _read() {
    if (this.paused) {
      return;
    }

    // If we've read all the data, end the stream
    if (this.position >= this.source.length) {
      clearInterval(this.manualPauseInterval);

      // Ensure 100% progress is reported at the end
      io.to(this.socketId).emit("uploadProgress", {
        percent: 100,
        bytesUploaded: this.totalBytes,
        totalBytes: this.totalBytes,
      });

      this.push(null);
      return;
    }

    // Calculate bytes to read this time (either chunk size or remaining bytes)
    const bytesToRead = Math.min(
      this.chunkSize,
      this.source.length - this.position
    );

    // Create a slice of the buffer and push it
    const chunk = this.source.slice(this.position, this.position + bytesToRead);
    this.push(chunk);

    // Update position and bytesRead counters
    this.position += bytesToRead;
    this.bytesRead = this.position;

    // Simulate slower upload by occasionally pausing
    // This is to avoid the jump to 100% before Cloudinary completes
    // In a real scenario, network bandwidth would naturally limit this
    if (Math.random() < 0.3) {
      // 30% chance of pausing briefly
      this.paused = true;
      setTimeout(
        () => {
          this.paused = false;
          this._read();
        },
        50 + Math.random() * 100
      ); // Random pause between 50-150ms
    }
  }

  cleanup() {
    if (this.manualPauseInterval) {
      clearInterval(this.manualPauseInterval);
    }
  }
}
