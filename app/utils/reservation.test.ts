// app/utils/reservation.test.ts
import { describe, it, expect } from "vitest";
import { computeAvailability } from "@/app/utils/reservation";

describe("computeAvailability", () => {
  it("exact fit", () => {
    expect(computeAvailability(5, 3, 2)).toEqual({ available: 2, fits: true });
  });

  it("over by one -> does not fit", () => {
    expect(computeAvailability(5, 3, 3)).toEqual({ available: 2, fits: false });
  });

  it("holds already exceed inventory -> available floored at 0, nothing fits", () => {
    expect(computeAvailability(2, 5, 1)).toEqual({ available: 0, fits: false });
  });

  it("zero inventory", () => {
    expect(computeAvailability(0, 0, 1)).toEqual({ available: 0, fits: false });
    expect(computeAvailability(0, 0, 0)).toEqual({ available: 0, fits: true });
  });

  it("no holds -> available == inventory", () => {
    expect(computeAvailability(10, 0, 4)).toEqual({ available: 10, fits: true });
  });

  it("coerces nullish / string inputs", () => {
    // @ts-expect-error - exercising the runtime guard
    expect(computeAvailability(null, undefined, "2")).toEqual({ available: 0, fits: false });
    // @ts-expect-error - exercising the runtime guard
    expect(computeAvailability("7", "2", null)).toEqual({ available: 5, fits: true });
  });
});
