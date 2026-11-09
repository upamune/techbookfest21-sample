import { ToolRejectedError } from "@pocket/tools/define-tool";
import { z } from "zod";
import { photoLimits, photoRendering, type PhotoSource } from "./contracts";

export class PhotoRejectedError extends ToolRejectedError {
  override readonly name = "PhotoRejectedError";
}

const fetchFailed = "画像を取得できませんでした。";
const fetchTimeoutMs = 10_000;
const maxRedirects = 3;
const internalHostSuffixes = [".localhost", ".local", ".internal"];
const imagesQuotaExceeded = 9422;
const imagesFailure = z.object({ code: z.number() });

function assertPublicHttps(url: URL) {
  const host = url.hostname.replace(/\.$/u, "");
  const internal =
    !host.includes(".") ||
    host.startsWith("[") ||
    /^[\d.]+$/u.test(host) ||
    internalHostSuffixes.some((suffix) => host.endsWith(suffix));
  const plainHttps =
    url.protocol === "https:" && url.port === "" && url.username === "" && url.password === "";
  if (internal || !plainHttps)
    throw new PhotoRejectedError("公開されているhttpsのURLを指定してください。");
}

async function fetchFollowingRedirects(start: URL) {
  let url = start;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    assertPublicHttps(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(fetchTimeoutMs),
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || location === null) return response;
    url = new URL(location, url);
  }
  throw new PhotoRejectedError(fetchFailed);
}

async function readLimited(body: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > photoLimits.remoteBytes)
      throw new PhotoRejectedError("画像のサイズが上限を超えています。");
    chunks.push(new Uint8Array(chunk));
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

async function download(url: string) {
  try {
    const response = await fetchFollowingRedirects(new URL(url));
    if (!response.ok || response.body === null) throw new PhotoRejectedError(fetchFailed);
    return await readLimited(response.body);
  } catch (cause) {
    if (cause instanceof PhotoRejectedError) throw cause;
    throw new PhotoRejectedError(fetchFailed, { cause });
  }
}

export async function loadPhotoBytes(source: PhotoSource) {
  if (source.kind === "url") return download(source.url);
  return Uint8Array.from(atob(source.data), (character) => character.charCodeAt(0));
}

function streamOf(bytes: Uint8Array<ArrayBuffer>) {
  return new Blob([bytes]).stream();
}

async function rasterSize(images: ImagesBinding, bytes: Uint8Array<ArrayBuffer>) {
  const info = await images.info(streamOf(bytes));
  if (!("width" in info)) throw new PhotoRejectedError("SVG形式の画像は保存できません。");
  return { width: info.width, height: info.height };
}

async function renderJpeg(
  images: ImagesBinding,
  bytes: Uint8Array<ArrayBuffer>,
  { max, quality }: { max: number; quality: number },
) {
  const result = await images
    .input(streamOf(bytes))
    .transform({ width: max, height: max, fit: "scale-down" })
    .output({ format: "image/jpeg", quality: Math.round(quality * 100) });
  return new Uint8Array(await result.response().arrayBuffer());
}

async function renderVariants(images: ImagesBinding, bytes: Uint8Array<ArrayBuffer>) {
  await rasterSize(images, bytes);
  const first = await renderJpeg(images, bytes, photoRendering.full);
  const full =
    first.byteLength <= photoLimits.fullTargetBytes
      ? first
      : await renderJpeg(images, bytes, photoRendering.smallerFull);
  const thumb = await renderJpeg(images, bytes, photoRendering.thumb);
  if (full.byteLength > photoLimits.fullBytes || thumb.byteLength > photoLimits.thumbBytes)
    throw new PhotoRejectedError("写真のサイズが上限を超えています。");
  return { full, thumb, ...(await rasterSize(images, full)) };
}

export async function convertPhoto(
  images: ImagesBinding | undefined,
  bytes: Uint8Array<ArrayBuffer>,
) {
  if (images === undefined) throw new PhotoRejectedError("この環境では画像を変換できません。");
  try {
    return await renderVariants(images, bytes);
  } catch (cause) {
    const failure = imagesFailure.safeParse(cause);
    if (!failure.success) throw cause;
    console.warn(
      JSON.stringify({ event: "things.photo_conversion_failed", code: failure.data.code }),
    );
    throw new PhotoRejectedError(
      failure.data.code === imagesQuotaExceeded
        ? "今月の画像変換の上限に達しました。"
        : "この画像は読み込めませんでした。",
    );
  }
}
