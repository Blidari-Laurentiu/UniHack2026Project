// Turns a photo the user picked into the small square we upload: centre crop, 256 px, WebP
// (JPEG where the browser cannot write WebP). Done in the browser so a 6 MB phone photo
// becomes about 20 kB, and so the file we send has no location or camera data in it.

export const PICTURE_TYPES = 'image/jpeg,image/png,image/webp';
const SIDE = 256;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      // from-image: a phone photo taken sideways comes out upright.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const encode = (canvas, type) =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, type, 0.86);
  });

/** An error to show the user; `key` picks its text in pages/account/strings.js (picture.<key>). */
function pictureError(key) {
  const error = new Error(`picture.${key}`);
  error.pictureKey = key;
  return error;
}

/** file: what the user picked. Returns a Blob to upload; throws pictureError(key) when it cannot. */
export async function squarePicture(file) {
  if (!PICTURE_TYPES.split(',').includes(file.type)) {
    throw pictureError('type');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw pictureError('big');
  }

  let source;
  try {
    source = await decode(file);
  } catch {
    throw pictureError('unreadable');
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const side = Math.min(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = SIDE;
  canvas.height = SIDE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // a see-through PNG gets a white background, in both themes
  ctx.fillRect(0, 0, SIDE, SIDE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  source.close?.();

  let blob = await encode(canvas, 'image/webp');
  // A browser that cannot write WebP hands back a PNG instead: ask for JPEG then.
  if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg');
  if (!blob) throw pictureError('prepare');
  return blob;
}
