// Client-side image preparation.
//
// The converged engine wants the ORIGINAL file bytes (raw pixels + EXIF) for
// deterministic centering and capture validation, not a re-encoded canvas blob.
// So we keep the original File for upload and only generate a small,
// EXIF-correct THUMBNAIL for display. Decoding applies EXIF orientation
// (createImageBitmap imageOrientation:"from-image", or <img> draw fallback) so
// thumbnails never show sideways/upside-down cards.

export const THUMB_EDGE = 640;
export const JPEG_QUALITY = 0.85;

export type PreparedImage = {
  /** the original user-selected file — sent to the engine unmodified */
  file: File;
  /** small data URL for showing a thumbnail in the UI */
  thumb: string;
  width: number;
  height: number;
};

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function isImageFile(file: File): boolean {
  // Some phones report HEIC with an empty or odd type; fall back to extension.
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

const DECODE_ERROR =
  "Couldn't read that photo. On iPhone, set Settings → Camera → Formats → Most Compatible, or pick a JPEG/PNG.";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

/**
 * Try createImageBitmap first (it applies EXIF orientation in one step). On iOS
 * this can HANG for HEIC, so it's wrapped in a timeout. Returns null on
 * unavailable/failed/timeout so the caller falls back to the <img> decoder.
 */
async function decodeBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    return await withTimeout(
      createImageBitmap(file, { imageOrientation: "from-image" }),
      3500,
    );
  } catch {
    return null;
  }
}

/** Decode via a hidden <img>. Handles HEIC on iOS; current Safari/Chrome apply
 * EXIF orientation when such an image is drawn to canvas. Caller revokes the URL. */
async function decodeImg(
  file: File,
): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = url;
      }),
      20000,
    );
    if (typeof img.decode === "function") {
      try {
        await img.decode();
      } catch {
        /* onload already fired; decode() is best-effort */
      }
    }
    return { img, url };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * Validate + decode a user-selected file and build a display thumbnail, keeping
 * the original File for upload. Throws a friendly Error (DECODE_ERROR) if the
 * file can't be decoded. Never hangs.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | null = null;

  const bitmap = await decodeBitmap(file);
  if (bitmap) {
    source = bitmap;
  } else {
    try {
      const r = await decodeImg(file);
      source = r.img;
      objectUrl = r.url;
    } catch {
      throw new Error(DECODE_ERROR);
    }
  }

  const srcW = source.width;
  const srcH = source.height;
  if (!srcW || !srcH) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error(DECODE_ERROR);
  }

  const scale = Math.min(1, THUMB_EDGE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

    const thumb = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!thumb || thumb.length < 32) throw new Error(DECODE_ERROR);

    return { file, thumb, width: srcW, height: srcH };
  } finally {
    if ("close" in source && typeof source.close === "function") source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Shrink a data URL to a small thumbnail for localStorage history. */
export async function shrinkDataUrl(
  dataUrl: string,
  maxEdge = 256,
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("thumb decode failed"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.7);
}
