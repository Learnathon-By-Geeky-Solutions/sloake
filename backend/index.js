import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { exec } from "child_process";

const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + uuidv4() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({ mesage: "Hello World" });
});

app.post("/upload", upload.single("file"), (req, res) => {
  console.log("HERE2");
  const videoId = uuidv4();
  const videoPath = req.file.path;
  const outputPath = `./uploads/videos/${videoId}`;
  const hlsPath = `${outputPath}/index.m3u8`;

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  const ffmpegCommand = `ffmpeg -i ${videoPath} -vf "scale=854:480" -c:v libx264 -preset ultrafast -b:v 1500k -c:a aac -b:a 128k ${outputPath}/output_480p.mp4 -vf "scale=1280:720" -c:v libx264 -preset ultrafast -b:v 3000k -c:a aac -b:a 128k ${outputPath}/output_720p.mp4 -vf "scale=1920:1080" -c:v libx264 -preset ultrafast -b:v 5000k -c:a aac -b:a 192k ${outputPath}/output_1080p.mp4`;

  const packagerCommand = `packager 'in=${outputPath}/output_480p.mp4,stream=audio,segment_template=${outputPath}/audio/$Number$.aac,playlist_name=${outputPath}/audio/main.m3u8,hls_group_id=audio,hls_name=ENGLISH' 'in=${outputPath}/output_480p.mp4,stream=video,segment_template=${outputPath}/h264_480p/$Number$.ts,playlist_name=${outputPath}/h264_480p/main.m3u8,iframe_playlist_name=${outputPath}/h264_480p/iframe.m3u8' 'in=${outputPath}/output_720p.mp4,stream=video,segment_template=${outputPath}/h264_720p/$Number$.ts,playlist_name=${outputPath}/h264_720p/main.m3u8,iframe_playlist_name=${outputPath}/h264_720p/iframe.m3u8' 'in=${outputPath}/output_1080p.mp4,stream=video,segment_template=${outputPath}/h264_1080p/$Number$.ts,playlist_name=${outputPath}/h264_1080p/main.m3u8,iframe_playlist_name=${outputPath}/h264_1080p/iframe.m3u8' --hls_master_playlist_output ${outputPath}/h264_master.m3u8`;
  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
    const videoUrl = `http://localhost:8000/uploads/videos/${videoId}/h264_master.m3u8`;
    res.json({
      message: "Video converted to HLS format",
      videoUrl: videoUrl,
      videoId: videoId,
    });
    exec(
      packagerCommand,
      { shell: "powershell.exe" },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
      }
    );
  });
});

app.listen(8000, () => {
  console.log("Listening on port", 8000);
});
