import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadPhotoBytes, PhotoRejectedError } from "./photo-input";

const fetchUrl = (url: string) => loadPhotoBytes({ kind: "url", url });

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (next === undefined) throw new Error("Unexpected fetch.");
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("loading a remote photo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "http://example.com/a.jpg",
    "https://localhost/a.jpg",
    "https://localhost./a.jpg",
    "https://nas.local/a.jpg",
    "https://metadata.internal/a.jpg",
    "https://intranet/a.jpg",
    "https://127.0.0.1/a.jpg",
    "https://2130706433/a.jpg",
    "https://[::1]/a.jpg",
    "https://user:secret@example.com/a.jpg",
    "https://example.com:8443/a.jpg",
  ])("refuses %s without fetching it", async (url) => {
    const fetchMock = stubFetch();
    await expect(fetchUrl(url)).rejects.toBeInstanceOf(PhotoRejectedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows a redirect to another public host", async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 302, headers: { location: "https://cdn.example.com/a.jpg" } }),
      new Response(new Uint8Array([1, 2, 3])),
    );
    expect(await fetchUrl("https://example.com/a.jpg")).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a redirect to an internal host", async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 302, headers: { location: "https://127.0.0.1/a.jpg" } }),
    );
    await expect(fetchUrl("https://example.com/a.jpg")).rejects.toBeInstanceOf(PhotoRejectedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    const redirect = () =>
      new Response(null, { status: 302, headers: { location: "https://example.com/next" } });
    stubFetch(redirect(), redirect(), redirect(), redirect(), redirect());
    await expect(fetchUrl("https://example.com/a.jpg")).rejects.toBeInstanceOf(PhotoRejectedError);
  });

  it("refuses an error response and a body over the limit", async () => {
    stubFetch(new Response("missing", { status: 404 }));
    await expect(fetchUrl("https://example.com/a.jpg")).rejects.toBeInstanceOf(PhotoRejectedError);
    stubFetch(new Response(new Uint8Array(10_000_001)));
    await expect(fetchUrl("https://example.com/a.jpg")).rejects.toBeInstanceOf(PhotoRejectedError);
  });

  it("turns a network failure into a rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    await expect(fetchUrl("https://example.com/a.jpg")).rejects.toBeInstanceOf(PhotoRejectedError);
  });

  it("decodes base64 without touching the network", async () => {
    const fetchMock = stubFetch();
    expect(await loadPhotoBytes({ kind: "base64", data: "AQID" })).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
