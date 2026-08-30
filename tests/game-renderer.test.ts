import { describe, expect, it } from "vitest";

import { calculateCanvasMetrics } from "../src/game-renderer";

describe("calculateCanvasMetrics", () => {
  it("sizes a high-DPR mobile backing store from the visible canvas", () => {
    expect(calculateCanvasMetrics(430, 932, 3, 2)).toEqual({
      backingWidth: 860,
      backingHeight: 1864,
      scaleX: 860 / 390,
      scaleY: 1864 / 844,
    });
  });

  it("honors lower quality DPR caps", () => {
    expect(calculateCanvasMetrics(360, 640, 3, 1)).toEqual({
      backingWidth: 360,
      backingHeight: 640,
      scaleX: 360 / 390,
      scaleY: 640 / 844,
    });
  });

  it("falls back safely while a browser surface is temporarily unavailable", () => {
    expect(calculateCanvasMetrics(0, Number.NaN, 0, 2)).toEqual({
      backingWidth: 390,
      backingHeight: 844,
      scaleX: 1,
      scaleY: 1,
    });
  });
});
