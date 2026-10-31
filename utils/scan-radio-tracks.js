"use strict";

// The radio's playlists from the asset registry (spec 157 R16, TK-178): every registered audio file under
// assets/audio/radio/<channel>/ becomes a track named by its asset id (run npm run assets:sync first for new files).
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY_FILE = path.join(ROOT, "src", "game", "config", "generated", "asset_registry.js");
const TARGET_FILE = path.join(ROOT, "src", "game", "config", "raw", "radio", "radio_channels.js");

const AUDIO_EXTS = new Set([".mp3", ".ogg", ".wav", ".aac", ".m4a"]);

const KNOWN_TITLES = {
  "chomu_z_kupola_tikayut_na_irzhavyi_shelf": "Чому з Купола тікають на Іржавий Шельф",
  "radio_volia": "Ефір ВОЛЯ 77.2",
  "radio_volya_shelf": "Ефір ВОЛЯ (Іржавий Шельф)",
};

const VOLIA_TRACK_ORDER = [
  "radio_volia",
  "chomu_z_kupola_tikayut_na_irzhavyi_shelf",
  "radio_volya_shelf",
];

// registry: ASSET_REGISTRY; prefix: the channel folder under assets/audio/radio/.
function scanChannel(registry, prefix) {
  const folder = `assets/audio/radio/${prefix}/`;
  const tracks = [];
  for (const [assetId, entry] of Object.entries(registry)) {
    if (entry.kind !== "audio" || !entry.path.startsWith(folder) || entry.path.slice(folder.length).includes("/")) continue;
    const fileName = entry.path.slice(folder.length);
    const ext = path.extname(fileName).toLowerCase();
    if (!AUDIO_EXTS.has(ext)) continue;
    const baseName = path.basename(fileName, ext);
    const lookupKey = baseName.toLowerCase();
    const title = KNOWN_TITLES[lookupKey] || baseName.replace(/[_-]+/gu, " ").trim();
    tracks.push({
      id: `${prefix}-${baseName.toLowerCase().replace(/[^a-z0-9_-]/gu, "-")}`,
      title,
      asset: assetId,
    });
  }
  if (prefix === "volia") {
    tracks.sort((a, b) => {
      const getRank = (track) => {
        const id = track.id.replace(/^volia-/u, "");
        const idx = VOLIA_TRACK_ORDER.indexOf(id);
        return idx !== -1 ? idx : 999;
      };
      return getRank(a) - getRank(b);
    });
  }
  return tracks;
}

async function generate() {
  const { ASSET_REGISTRY } = await import(pathToFileURL(REGISTRY_FILE).href);
  const voliaTracks = scanChannel(ASSET_REGISTRY, "volia");
  const customTracks = scanChannel(ASSET_REGISTRY, "custom");

  const content = `// Spec 144: Channel and playlist configuration for dedicated station VOLIA 77.2, custom player MP3 playlist,
// and world radio (Radio Browser). Auto-scanned via utils/scan-radio-tracks.js.
export const RADIO_CHANNELS = {
  volia: {
    id: "volia",
    name: "VOLIA 77.2",
    frequency: "77.2 FM",
    description: "Військово-польове радіо",
    tracks: ${JSON.stringify(voliaTracks, null, 6).replace(/\n\s{4}/gu, "\n    ")},
  },
  custom: {
    id: "custom",
    name: "Свій канал",
    frequency: "MP3",
    description: "Власний плейлист (assets/audio/radio/custom/)",
    tracks: ${JSON.stringify(customTracks, null, 6).replace(/\n\s{4}/gu, "\n    ")},
    intermission: {
      minSeconds: 15,
      maxSeconds: 45,
    },
  },
  world: {
    id: "world",
    name: "Світове радіо",
    frequency: "Online",
    description: "Radio Browser",
  },
};
`;

  fs.writeFileSync(TARGET_FILE, content, "utf8");
  console.log(`Updated ${TARGET_FILE}: volia=${voliaTracks.length} tracks, custom=${customTracks.length} tracks.`);
}

if (require.main === module) {
  generate().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { scanChannel, generate };
