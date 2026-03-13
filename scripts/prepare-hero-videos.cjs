const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ffmpegPath = require("ffmpeg-static");

const rootDir = path.resolve(__dirname, "..");
const heroDir = path.join(rootDir, "public", "hero_videos");
const manifestPath = path.join(heroDir, "manifest.json");

if (!fs.existsSync(heroDir)) {
  fs.mkdirSync(heroDir, { recursive: true });
}

const videoExtensions = new Set([".mov", ".mp4", ".m4v", ".webm"]);

const entries = fs.readdirSync(heroDir, { withFileTypes: true });
const inputFiles = entries
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .filter((name) => videoExtensions.has(path.extname(name).toLowerCase()))
  .filter((name) => !name.toLowerCase().endsWith(".mp4") || fs.existsSync(path.join(heroDir, name)));

for (const file of inputFiles) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== ".mov" && ext !== ".m4v" && ext !== ".webm") continue;

  const inputPath = path.join(heroDir, file);
  const outputName = `${path.parse(file).name}.mp4`;
  const outputPath = path.join(heroDir, outputName);

  if (fs.existsSync(outputPath)) {
    const inputStat = fs.statSync(inputPath);
    const outputStat = fs.statSync(outputPath);
    if (outputStat.mtimeMs >= inputStat.mtimeMs) continue;
  }

  const args = [
    "-y",
    "-i",
    inputPath,
    "-an",
    "-vf",
    "scale=1280:-2,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-profile:v",
    "baseline",
    "-level",
    "3.1",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  const result = spawnSync(ffmpegPath, args, { stdio: "inherit" });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

const finalEntries = fs.readdirSync(heroDir, { withFileTypes: true });
const mp4Files = finalEntries
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .filter((name) => path.extname(name).toLowerCase() === ".mp4")
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

const manifest = {
  videos: mp4Files.map((name) => `/hero_videos/${encodeURIComponent(name).replace(/%2F/g, "/")}`),
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
