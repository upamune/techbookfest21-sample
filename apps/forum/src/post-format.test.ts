import { describe, expect, it } from "vite-plus/test";
import { splitAnchors } from "./post-format";

describe("splitAnchors", () => {
  it("separates half and full width anchors from text", () => {
    expect(splitAnchors("前>>12後＞＞3")).toEqual([
      { kind: "text", start: 0, text: "前" },
      { kind: "anchor", start: 1, text: ">>12", number: 12 },
      { kind: "text", start: 5, text: "後" },
      { kind: "anchor", start: 6, text: "＞＞3", number: 3 },
    ]);
  });

  it("leaves text without an anchor untouched", () => {
    expect(splitAnchors("> 引用 >>")).toEqual([{ kind: "text", start: 0, text: "> 引用 >>" }]);
  });
});
