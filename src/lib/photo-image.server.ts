import { imageSize } from "image-size";
import { MAX_PHOTO_BYTES, uploadError } from "./photo-reading";

export function validatePhoto(dataURL: string) {
  if (dataURL.length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 100)
    throw new Error("Photograph exceeds 5 MB.");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataURL);
  if (!match?.[1] || !match[2]) throw new Error("Choose a valid JPEG, PNG or WebP photograph.");
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const error = uploadError(match[1], bytes.length);
  if (error) throw new Error(error);
  let dimensions;
  try {
    dimensions = imageSize(bytes);
  } catch {
    throw new Error("The image is damaged or unreadable.");
  }
  const expected = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[match[1]];
  if (dimensions.type !== expected)
    throw new Error("The image content does not match its file type.");
  const { width, height } = dimensions;
  if (
    !width ||
    !height ||
    width < 100 ||
    height < 100 ||
    width > 6000 ||
    height > 6000 ||
    width * height > 12_000_000
  ) {
    throw new Error(
      "Use an image at least 100 × 100 pixels, at most 6000 pixels per side and 12 megapixels.",
    );
  }
  return { bytes, mime: match[1], width, height };
}
