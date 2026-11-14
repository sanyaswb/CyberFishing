// Spec 142: which Radio Browser stations the receiver can play. The stream is `url_resolved` (the `url` is often a
// playlist); HLS and unlisted codecs do not play in <audio> everywhere; an https page plays https streams only (mixed
// content), a local http page plays both. Returns plain station records in the source order, without duplicates.
export class RadioStationFilter {
  filter(stations, { codecs = [], secureOnly = true } = {}) {
    const allowed = new Set((codecs || []).map((codec) => String(codec).toUpperCase()));
    const seen = new Set();
    const result = [];
    for (const station of Array.isArray(stations) ? stations : []) {
      const url = String(station?.url_resolved || "").trim();
      if (!/^https?:\/\//iu.test(url)) continue;
      if (secureOnly && !/^https:\/\//iu.test(url)) continue;
      if (Number(station?.hls) === 1 || /\.m3u8(\?|$)/iu.test(url)) continue;
      if (allowed.size > 0 && !allowed.has(String(station?.codec || "").toUpperCase())) continue;
      const id = String(station?.stationuuid || url);
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(Object.freeze({
        id,
        name: String(station?.name || "").trim() || url,
        url,
        countryCode: String(station?.countrycode || "").toUpperCase(),
        codec: String(station?.codec || "").toUpperCase(),
        bitrate: Math.max(0, Number(station?.bitrate) || 0),
      }));
    }
    return result;
  }
}
