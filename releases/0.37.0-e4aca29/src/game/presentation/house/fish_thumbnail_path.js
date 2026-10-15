export function fishThumbnailPath(imagePath) {
  return typeof imagePath === "string" && imagePath.startsWith("assets/fish/")
    ? imagePath.replace("assets/fish/", "assets/fish-thumbnails/").replace(/\.[^.]+$/, ".webp") : imagePath || "";
}
