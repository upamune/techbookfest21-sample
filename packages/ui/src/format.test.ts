import { describe, expect, it } from "vite-plus/test";
import { formatRelativeTime } from "./format";

const now = Date.parse("2026-11-08T12:00:00.000Z");

describe("relative time", () => {
  it.each([
    ["2026-11-08T11:59:30.000Z", "たった今"],
    ["2026-11-08T11:55:00.000Z", "5 分前"],
    ["2026-11-08T09:00:00.000Z", "3 時間前"],
    ["2026-11-07T12:00:00.000Z", "昨日"],
  ])("formats %s", (date, expected) => {
    expect(formatRelativeTime(date, now)).toBe(expected);
  });
});
