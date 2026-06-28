// Client-side image preparation.
//
// Phone photos are large (often 12MP+) and carry EXIF orientation. Opus 4.8
// supports high-resolution vision up to a 2576px long edge — and card defects
// (corner whitening, edge chipping, surface scratches) live in exactly that
// detail, so we keep it rather than throwing it away at 1568px. We:
//   1. decode with EXIF orientation already applied (createImageBitmap +
//      imageOrientation: "from-image"), avoiding sideways/upside-down cards,
//   2. scale the long edge down to MAX_EDGE,
//   3. re-encode as JPEG to keep the upload small (latency + token cost).
//
// 2576 matches Opus 4.8's vision ceiling. If MODEL is set to sonnet (which
// downsamples to ~1568), these uploads are slightly larger than needed but
// still work — the server model is the source of truth for actual analysis.

export const MAX_EDGE = 2576;
export const JPEG_QUALITY = 0.85;

export type PreparedImage = {
  /** base64 WITHOUT the data: prefix — ready for the Anthropic image block */
  base64: string;
  /** always image/jpeg after re-encoding */
  mediaType: "image/jpeg";
  /** data URL for showing a thumbnail in the UI */
  dataUrl: string;
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
 * this can HANG for HEIC — never resolving or rejecting — so it's wrapped in a
 * timeout. Returns null if unavailable/failed/timed out so the caller falls
 * back to the <img> decoder, which Safari uses to read HEIC natively.
 */
async function decodeBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    // Short timeout: on iOS this can hang for HEIC. Bail fast to the <img>
    // fallback (which Safari decodes HEIC with, applying EXIF on draw).
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
 * Resize + re-encode a user-selected file for upload. Throws a friendly Error
 * (DECODE_ERROR) if the file can't be decoded. Never hangs.
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

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1] ?? "";
    if (!base64) throw new Error(DECODE_ERROR);

    return { base64, mediaType: "image/jpeg", dataUrl, width, height };
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
