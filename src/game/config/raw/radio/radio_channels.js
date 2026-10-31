// Spec 144: Channel and playlist configuration for dedicated station VOLIA 77.2, custom player MP3 playlist,
// and world radio (Radio Browser). Auto-scanned via utils/scan-radio-tracks.js.
export const RADIO_CHANNELS = {
  volia: {
    id: "volia",
    name: "VOLIA 77.2",
    frequency: "77.2 FM",
    description: "Військово-польове радіо",
    tracks: [
      {
            "id": "volia-radio_volia",
            "title": "Ефір ВОЛЯ 77.2",
            "asset": "audio.radio.volia.RADIO_VOLIA"
      },
      {
            "id": "volia-chomu_z_kupola_tikayut_na_irzhavyi_shelf",
            "title": "Чому з Купола тікають на Іржавий Шельф",
            "asset": "audio.radio.volia.Chomu_z_Kupola_tikayut_na_Irzhavyi_Shelf"
      },
      {
            "id": "volia-radio_volya_shelf",
            "title": "Ефір ВОЛЯ (Іржавий Шельф)",
            "asset": "audio.radio.volia.RADIO_VOLYA_SHELF"
      }
],
  },
  custom: {
    id: "custom",
    name: "Свій канал",
    frequency: "MP3",
    description: "Власний плейлист (assets/audio/radio/custom/)",
    tracks: [],
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
