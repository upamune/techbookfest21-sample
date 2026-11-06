import { describe, expect, it } from "vite-plus/test";
import { localAccessError } from "./local-access";

describe("local development boundary", () => {
  it("denies production even with a loopback host", () => {
    expect(localAccessError(new Request("http://localhost/api/tasks"), false)).not.toBeNull();
  });
  it.each(["localhost", "127.0.0.1", "[::1]"])("permits local clients at %s", (host) => {
    expect(localAccessError(new Request(`http://${host}/api/tasks`), true)).toBeNull();
  });
  it.each(["example.com", "localhost.example.com", "127.0.0.1.example.com"])(
    "denies non-loopback host %s",
    (host) => {
      expect(localAccessError(new Request(`http://${host}/api/tasks`), true)).not.toBeNull();
    },
  );
  it.each(["https://attacker.example", "null", "http://localhost:4000"])(
    "denies origin %s",
    (origin) => {
      expect(
        localAccessError(
          new Request("http://localhost:5173/api/tasks", { headers: { origin } }),
          true,
        ),
      ).not.toBeNull();
    },
  );
  it("permits exact same origin", () => {
    expect(
      localAccessError(
        new Request("http://localhost:5173/api/tasks", {
          headers: { origin: "http://localhost:5173" },
        }),
        true,
      ),
    ).toBeNull();
  });
  it("denies cross-site metadata even without Origin", () => {
    expect(
      localAccessError(
        new Request("http://localhost/api/tasks", { headers: { "sec-fetch-site": "cross-site" } }),
        true,
      ),
    ).not.toBeNull();
  });
});
