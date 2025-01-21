import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import ffmpeg from "fluent-ffmpeg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 8000;

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads", "temp");
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const processVideo = async (inputPath, outputPath, resolution) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v",
        "h264_nvenc",
        "-preset",
        "fast",
        "-c:a",
        "aac",
        "-b:v",
        "800k",
        "-b:a",
        "64k",
        "-f",
        "hls",
        "-hls_time",
        "6",
        "-hls_list_size",
        "0",
        "-hls_playlist_type",
        "vod",
      ])
      .size(resolution)
      .autopad()
      .on("start", (cmdline) => {
        console.log("Started FFmpeg with command:", cmdline);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error:", err);
        console.error("FFmpeg stdout:", stdout);
        console.error("FFmpeg stderr:", stderr);
        reject(err);
      })
      .on("end", () => {
        console.log(`Finished processing ${resolution}`);
        resolve();
      })
      .save(outputPath);
  });
};

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const videoId = uuidv4();
  const videoPath = req.file.path;
  const outputBasePath = path.join(__dirname, "uploads", "videos", videoId);

  try {
    // Create output directories
    const resolutions = {
      "1080p": "1920x1080",
      "720p": "1280x720",
      "480p": "854x480",
    };

    // Create base directory
    fs.mkdirSync(outputBasePath, { recursive: true });

    // Process each resolution sequentially
    for (const [folder, resolution] of Object.entries(resolutions)) {
      const resolutionPath = path.join(outputBasePath, folder);
      fs.mkdirSync(resolutionPath, { recursive: true });

      console.log(`Processing ${resolution}...`);
      await processVideo(
        videoPath,
        path.join(resolutionPath, "playlist.m3u8"),
        resolution
      );
    }

    // Create master playlist
    const masterPlaylist =
      "#EXTM3U\n#EXT-X-VERSION:3\n\n" +
      Object.entries(resolutions)
        .map(([folder, resolution]) => {
          const [width] = resolution.split("x");
          return `#EXT-X-STREAM-INF:BANDWIDTH=${
            width * 1000
          },RESOLUTION=${resolution}\n${folder}/playlist.m3u8`;
        })
        .join("\n\n");

    fs.writeFileSync(path.join(outputBasePath, "master.m3u8"), masterPlaylist);

    // Clean up temp file
    fs.unlinkSync(videoPath);

    const videoUrl = `http://localhost:${PORT}/uploads/videos/${videoId}/master.m3u8`;
    res.json({
      message: "Video converted successfully",
      videoUrl,
      videoId,
    });
  } catch (error) {
    console.error("Error details:", error);

    // Cleanup on error
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (fs.existsSync(outputBasePath)) {
      fs.rmSync(outputBasePath, { recursive: true, force: true });
    }

    res.status(500).json({
      message: "Video processing failed",
      error: error.message,
      details: error.stack,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
