import { describe, expect, it } from "vitest";
import { getGradeScale, rankGrade } from "./grades";

describe("rankGrade", () => {
  it("ranks representative sport, bouldering, and trad grades with harder grades higher", () => {
    expect(rankGrade("Sport", "7a")).toBeGreaterThan(rankGrade("Sport", "6c") ?? -1);
    expect(rankGrade("Bouldering", "f6A+")).toBeGreaterThan(rankGrade("Bouldering", "f6A") ?? -1);
    expect(rankGrade("Trad", "HVS 5a")).toBeGreaterThan(rankGrade("Trad", "VS 4c") ?? -1);
  });

  it("ranks trad climbs by adjectival grade only", () => {
    expect(rankGrade("Trad", "VS 5a")).toBe(rankGrade("Trad", "VS 4b"));
    expect(rankGrade("Trad", "HVS 4c")).toBeGreaterThan(rankGrade("Trad", "VS 5a") ?? -1);
  });
});

describe("getGradeScale", () => {
  it("returns full sport grade ladders for a rank range", () => {
    expect(getGradeScale("Sport", 16, 21).map((entry) => entry.grade)).toEqual([
      "6a+",
      "6b",
      "6b+",
      "6c",
      "6c+",
      "7a",
    ]);
  });

  it("returns full bouldering grade ladders for a rank range", () => {
    expect(getGradeScale("Bouldering", 15, 20).map((entry) => entry.grade)).toEqual([
      "f6A",
      "f6A+",
      "f6B",
      "f6B+",
      "f6C",
      "f6C+",
    ]);
  });

  it("returns trad adjectival grade ladders including E grades", () => {
    expect(getGradeScale("Trad", 1, 6).map((entry) => entry.grade)).toEqual(["VD", "S", "HS", "VS", "HVS", "E1"]);
  });
});
