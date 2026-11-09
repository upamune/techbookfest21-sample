import { photoLimits, photoRendering } from "./contracts";

const unreadableImage = "この画像は読み込めませんでした。JPEGかPNGの写真を選んでください。";

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

function fitSize({ width, height, max }: { width: number; height: number; max: number }) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeWithImageElement(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(unreadableImage);
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    return decodeWithImageElement(file);
  }
}

function renderJpeg({ decoded, max, quality }: { decoded: Decoded; max: number; quality: number }) {
  const size = fitSize({ width: decoded.width, height: decoded.height, max });
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(decoded.source, 0, 0, size.width, size.height);
  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(new Error(unreadableImage));
        else resolve({ blob, ...size });
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function prepareImage(file: Blob) {
  const decoded = await decode(file);
  try {
    const first = await renderJpeg({ decoded, ...photoRendering.full });
    const full =
      first.blob.size <= photoLimits.fullTargetBytes
        ? first
        : await renderJpeg({ decoded, ...photoRendering.smallerFull });
    const thumb = await renderJpeg({ decoded, ...photoRendering.thumb });
    return { full, thumb: thumb.blob };
  } finally {
    decoded.release();
  }
}
