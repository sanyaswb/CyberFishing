// Browser loads for AssetLoadQueue jobs (spec 099; the browser transport of spec 083 step 2): text, JSON and decoded
// images. Images are decoded HTMLImageElements so WebGL upload flags (premultiplied alpha) apply and a lost context
// can re-upload from the retained image. A job whose token is cancelled discards its result.
export class BrowserAssetTransport {
  #fetch;
  #createImage;

  constructor({
    fetchResource = (url) => fetch(url),
    createImage = () => new Image(),
  } = {}) {
    if (typeof fetchResource !== "function" || typeof createImage !== "function") {
      throw new TypeError("BrowserAssetTransport requires fetchResource and createImage functions");
    }
    this.#fetch = fetchResource;
    this.#createImage = createImage;
  }

  async loadText(url, token = null) {
    const response = await this.#fetch(url);
    if (!response?.ok) throw new Error(`BrowserAssetTransport: HTTP ${response?.status ?? "error"} for ${url}`);
    const text = await response.text();
    return token?.cancelled ? null : text;
  }

  async loadJson(url, token = null) {
    const text = await this.loadText(url, token);
    return text === null ? null : JSON.parse(text);
  }

  async loadImage(url, token = null) {
    const image = this.#createImage();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (token?.cancelled) {
      image.src = "";
      return null;
    }
    return image;
  }
}
