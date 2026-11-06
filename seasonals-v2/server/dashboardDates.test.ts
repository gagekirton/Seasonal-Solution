import { describe, expect, it } from "vitest";
import { winnipegDayStart } from "./dashboardDates";

describe("Winnipeg dashboard day boundaries", () => {
  it.each([
    ["2026-01-20", "2026-01-20T06:00:00.000Z"],
    ["2026-07-20", "2026-07-20T05:00:00.000Z"],
    ["2026-03-08", "2026-03-08T06:00:00.000Z"],
    ["2026-03-09", "2026-03-09T05:00:00.000Z"],
    ["2025-11-02", "2025-11-02T05:00:00.000Z"],
    ["2025-11-03", "2025-11-03T06:00:00.000Z"],
  ])("resolves local midnight on %s", (day, expected) => {
    expect(winnipegDayStart(day).toISOString()).toBe(expected);
  });
});
