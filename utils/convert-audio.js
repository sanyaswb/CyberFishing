"use strict";

// Radio audio conversion (spec 157 R8, owner Q6/Q6-b): re-encodes the VOLIA 77.2 recordings with the ffmpeg binary of
// the ffmpeg-static devDependency (the tool's only; nothing of it is released). Masters live in asset-sources/.
//   node utils/convert-audio.js --input <dir|file> --output <dir> [--bitrate 48] [--sample-rate 32000] [--stereo]
//     [--format m4a|mp3]
//       every audio file of --input (one level) becomes <output>/<name>.<format>: mono unless --stereo, AAC (m4a) or
//       MP3 at the bitrate in kbit/s; prints each file's size before and after.
//   node utils/convert-audio.js --samples --input <dir|file> --output <dir> [--bitrates 32,48,64] [--start 60]
//     [--seconds 60] [...the options above]
//       listening samples for the owner: an excerpt of each file at each bitrate, <name>--<bitrate>k.<format>.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const AUDIO = /\.(?:mp3|m4a|aac|ogg|wav)$/iu;
const CODECS = Object.freeze({ m4a: ["-c:a", "aac"], mp3: ["-c:a", "libmp3lame"] });

function readOptions(argv) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index < 0 ? fallback : argv[index + 1];
  };
  const options = {
    samples: argv.includes("--samples"),
    input: value("--input", ""),
    output: value("--output", ""),
    bitrate: Number(value("--bitrate", "48")),
    bitrates: String(value("--bitrates", "32,48,64")).split(",").map(Number),
    sampleRate: Number(value("--sample-rate", "32000")),
    mono: !argv.includes("--stereo"),
    format: value("--format", "m4a"),
    start: Number(value("--start", "60")),
    seconds: Number(value("--seconds", "60")),
  };
  const kbits = options.samples ? options.bitrates : [options.bitrate];
  if (!options.input || !options.output || !CODECS[options.format]
    || !kbits.every((rate) => Number.isInteger(rate) && rate >= 16 && rate <= 320)
    || ![16000, 22050, 24000, 32000, 44100, 48000].includes(options.sampleRate)
    || !(options.start >= 0) || !(options.seconds > 0)) {
    throw new Error("Usage: node utils/convert-audio.js [--samples] --input <dir|file> --output <dir> [--bitrate 48 | "
      + "--bitrates 32,48,64] [--sample-rate 32000] [--stereo] [--format m4a|mp3] [--start 60 --seconds 60]");
  }
  return options;
}

function inputFiles(input) {
  const absolute = path.resolve(ROOT, input);
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs.readdirSync(absolute).filter((name) => AUDIO.test(name)).sort().map((name) => path.join(absolute, name));
}

function encode(ffmpeg, source, target, { bitrate, sampleRate, mono, format }, excerpt = null) {
  const args = ["-hide_banner", "-loglevel", "error", "-y",
    ...(excerpt ? ["-ss", String(excerpt.start), "-t", String(excerpt.seconds)] : []),
    "-i", source, "-vn", "-map_metadata", "-1", ...(mono ? ["-ac", "1"] : []), "-ar", String(sampleRate),
    ...CODECS[format], "-b:a", `${bitrate}k`, ...(format === "m4a" ? ["-movflags", "+faststart"] : []), target];
  const result = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${path.relative(ROOT, source)}: ${result.stderr.trim()}`);
}

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

function main() {
  const options = readOptions(process.argv.slice(2));
  const ffmpeg = require("ffmpeg-static");
  if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error("ffmpeg-static has no binary for this platform (npm install)");
  const output = path.resolve(ROOT, options.output);
  if (path.relative(ROOT, output).startsWith("..")) throw new Error("--output must be inside the repository");
  fs.mkdirSync(output, { recursive: true });
  let before = 0;
  let after = 0;
  for (const source of inputFiles(options.input)) {
    const name = path.basename(source).replace(/\.[^.]+$/u, "");
    for (const bitrate of options.samples ? options.bitrates : [options.bitrate]) {
      const target = path.join(output, options.samples ? `${name}--${bitrate}k.${options.format}` : `${name}.${options.format}`);
      if (path.resolve(source) === path.resolve(target)) throw new Error(`${target} would overwrite its source`);
      encode(ffmpeg, source, target, { ...options, bitrate },
        options.samples ? { start: options.start, seconds: options.seconds } : null);
      const sourceBytes = fs.statSync(source).size;
      const targetBytes = fs.statSync(target).size;
      before += sourceBytes;
      after += targetBytes;
      console.log(`${path.relative(ROOT, target)}: ${options.samples ? "" : `${megabytes(sourceBytes)} -> `}${megabytes(targetBytes)}`);
    }
  }
  if (!options.samples) console.log(`Total ${megabytes(before)} -> ${megabytes(after)}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
