import { describe, expect, it } from "vitest";
import {
  getAverageSessionsToSendByGrade,
  getDisciplineCounts,
  getGradeDistribution,
  getMaxOverTime,
  getSuccessByGrade,
} from "./chart-data";
import type { Discipline } from "./grades";
import type { LogbookRow, StyleBucket } from "./logbook-parser";

function row(overrides: Partial<LogbookRow> & Pick<LogbookRow, "grade" | "rank">): LogbookRow {
  return {
    name: overrides.name ?? overrides.grade,
    grade: overrides.grade,
    style: overrides.style ?? "Lead O/S",
    date: overrides.date ?? new Date(Date.UTC(2026, 0, 1)),
    dateLabel: overrides.dateLabel ?? "01/Jan/26",
    crag: overrides.crag ?? "Crag",
    pitches: overrides.pitches ?? 1,
    type: overrides.type ?? "Sport",
    rank: overrides.rank,
    bucket: overrides.bucket ?? "onsight",
    isEligibleAttempt: overrides.isEligibleAttempt ?? true,
    isSuccessfulSend: overrides.isSuccessfulSend ?? true,
  };
}

function dated(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

describe("getMaxOverTime", () => {
  it("keeps only the greatest grade when multiple progression grades happen on the same date", () => {
    const data = getMaxOverTime(
      [
        row({ grade: "6a", rank: 15, date: dated(2023, 6, 4) }),
        row({ grade: "6b", rank: 17, date: dated(2023, 9, 23) }),
        row({ grade: "6b+", rank: 18, date: dated(2023, 9, 23) }),
        row({ grade: "7a", rank: 21, date: dated(2024, 5, 16) }),
      ],
      "Sport",
    );

    expect(data).toEqual([
      { date: dated(2023, 6, 4).getTime(), dateLabel: "04 Jun 2023", rank: 15, grade: "6a" },
      { date: dated(2023, 9, 23).getTime(), dateLabel: "23 Sept 2023", rank: 18, grade: "6b+" },
      { date: dated(2024, 5, 16).getTime(), dateLabel: "16 May 2024", rank: 21, grade: "7a" },
    ]);
  });

  it("uses numeric timestamps for x values and formatted date labels only for display", () => {
    const date = dated(2026, 8, 23);
    const data = getMaxOverTime([row({ grade: "7a", rank: 21, date })], "Sport");

    expect(data[0].date).toBe(date.getTime());
    expect(data[0].dateLabel).toBe("23 Aug 2026");
  });

  it("excludes failed high-grade attempts from progression", () => {
    const data = getMaxOverTime(
      [
        row({ name: "Sent", grade: "f6C", rank: 19, type: "Bouldering", bucket: "redpointSent" }),
        row({
          name: "DNF",
          grade: "f7B",
          rank: 23,
          type: "Bouldering",
          bucket: "failed",
          isSuccessfulSend: false,
        }),
      ],
      "Bouldering",
    );

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ grade: "f6C", rank: 19 });
  });

  it("formats trad progression grades as adjectival grades", () => {
    const data = getMaxOverTime(
      [
        row({ grade: "VS 4c", rank: 4, type: "Trad" }),
        row({ grade: "E1 5a", rank: 6, type: "Trad", date: dated(2026, 8, 19) }),
      ],
      "Trad",
    );

    expect(data.map((point) => point.grade)).toEqual(["VS", "E1"]);
  });

  it("excludes seconded trad climbs from max-grade progression", () => {
    const data = getMaxOverTime(
      [
        row({ grade: "HVS 5a", rank: 5, type: "Trad", style: "Lead O/S" }),
        row({
          grade: "E2 5b",
          rank: 7,
          type: "Trad",
          style: "2nd O/S",
          isSuccessfulSend: true,
          date: dated(2026, 8, 19),
        }),
      ],
      "Trad",
    );

    expect(data.map((point) => point.grade)).toEqual(["HVS"]);
  });

  it("excludes non-lead sport climbs from max-grade progression", () => {
    const data = getMaxOverTime(
      [
        row({ grade: "6c", rank: 19, type: "Sport", style: "Lead O/S" }),
        row({
          grade: "7a",
          rank: 21,
          type: "Sport",
          style: "TR O/S",
          isSuccessfulSend: true,
          date: dated(2026, 8, 19),
        }),
      ],
      "Sport",
    );

    expect(data.map((point) => point.grade)).toEqual(["6c"]);
  });
});

describe("getSuccessByGrade", () => {
  it("calculates onsight success rate by grade from first-try attempts", () => {
    const rows: LogbookRow[] = [
      row({ grade: "7a", rank: 21, bucket: "onsight" }),
      row({ grade: "7a", rank: 21, bucket: "failed", isSuccessfulSend: false }),
      row({ grade: "7b", rank: 23, bucket: "failed", isSuccessfulSend: false }),
    ];

    expect(getSuccessByGrade(rows, "Sport")).toEqual([
      { grade: "7a", rank: 21, attempts: 2, successes: 1, rate: 50, label: "1/2" },
      { grade: "7b", rank: 23, attempts: 1, successes: 0, rate: 0, label: "0/1" },
    ]);
  });

  it("excludes flash, redpoint, and repeat rows from first-try onsight attempts", () => {
    const buckets: StyleBucket[] = ["flash", "redpointSent", "repeat"];
    const rows = buckets.map((bucket, index) =>
      row({ grade: "7a", rank: 21, bucket, name: `${bucket}-${index}`, isSuccessfulSend: true }),
    );

    expect(getSuccessByGrade(rows, "Sport")).toEqual([]);
  });

  it("ignores rows from other disciplines and ineligible attempts", () => {
    const rows = [
      row({ grade: "7a", rank: 21, type: "Sport", bucket: "onsight" }),
      row({ grade: "7a", rank: 21, type: "Sport", bucket: "onsight", isEligibleAttempt: false }),
      row({ grade: "f6A", rank: 15, type: "Bouldering" as Discipline, bucket: "onsight" }),
    ];

    expect(getSuccessByGrade(rows, "Sport")).toEqual([
      { grade: "7a", rank: 21, attempts: 1, successes: 1, rate: 100, label: "1/1" },
    ]);
  });
});

describe("getAverageSessionsToSendByGrade", () => {
  it("averages sessions up to the first send for sent climbs by grade", () => {
    const rows: LogbookRow[] = [
      row({ name: "Project one", crag: "A", grade: "7a", rank: 21, bucket: "failed", isSuccessfulSend: false }),
      row({ name: "Project one", crag: "A", grade: "7a", rank: 21, bucket: "redpointSent" }),
      row({ name: "Project two", crag: "A", grade: "7a", rank: 21, bucket: "onsight" }),
      row({ name: "Another grade", crag: "A", grade: "7b", rank: 23, bucket: "flash" }),
    ];

    expect(getAverageSessionsToSendByGrade(rows, "Sport")).toEqual([
      { grade: "7a", rank: 21, climbs: 2, totalSessions: 3, averageSessions: 1.5, label: "3/2" },
      { grade: "7b", rank: 23, climbs: 1, totalSessions: 1, averageSessions: 1, label: "1/1" },
    ]);
  });

  it("ignores climbs that were never sent", () => {
    const rows: LogbookRow[] = [
      row({ name: "Project", grade: "7a", rank: 21, bucket: "failed", isSuccessfulSend: false }),
      row({ name: "Sent", grade: "7a", rank: 21, bucket: "onsight" }),
    ];

    expect(getAverageSessionsToSendByGrade(rows, "Sport")).toEqual([
      { grade: "7a", rank: 21, climbs: 1, totalSessions: 1, averageSessions: 1, label: "1/1" },
    ]);
  });

  it("does not count repeat logs after the first send as extra sessions to send", () => {
    const rows: LogbookRow[] = [
      row({
        name: "Project",
        grade: "7a",
        rank: 21,
        bucket: "failed",
        isSuccessfulSend: false,
        date: dated(2026, 1, 1),
      }),
      row({ name: "Project", grade: "7a", rank: 21, bucket: "redpointSent", date: dated(2026, 1, 2) }),
      row({ name: "Project", grade: "7a", rank: 21, bucket: "repeat", date: dated(2026, 1, 3) }),
    ];

    expect(getAverageSessionsToSendByGrade(rows, "Sport")[0]).toMatchObject({
      climbs: 1,
      totalSessions: 2,
      averageSessions: 2,
    });
  });

  it("formats trad averages by adjectival grade", () => {
    const rows: LogbookRow[] = [
      row({ name: "Trad one", grade: "E1 5a", rank: 6, type: "Trad", bucket: "onsight" }),
      row({ name: "Trad two", grade: "E1 5b", rank: 6, type: "Trad", bucket: "flash" }),
    ];

    expect(getAverageSessionsToSendByGrade(rows, "Trad")).toEqual([
      { grade: "E1", rank: 6, climbs: 2, totalSessions: 2, averageSessions: 1, label: "2/2" },
    ]);
  });
});

describe("getGradeDistribution", () => {
  it("counts successfully ascended climbs by grade for the requested discipline", () => {
    const rows: LogbookRow[] = [
      row({ grade: "6b", rank: 17, bucket: "onsight" }),
      row({ grade: "6b", rank: 17, bucket: "redpointSent" }),
      row({ grade: "6c", rank: 19, bucket: "flash" }),
      row({ grade: "6c", rank: 19, bucket: "failed", isSuccessfulSend: false }),
      row({ grade: "f6A", rank: 15, type: "Bouldering", bucket: "onsight" }),
    ];

    expect(getGradeDistribution(rows, "Sport")).toEqual([
      { grade: "6b", rank: 17, climbs: 2, label: "2 climbs" },
      { grade: "6c", rank: 19, climbs: 1, label: "1 climb" },
    ]);
  });

  it("ignores rows without parseable grades", () => {
    const rows = [
      row({ grade: "7a", rank: 21 }),
      row({ grade: "Project grade", rank: null }),
    ];

    expect(getGradeDistribution(rows, "Sport")).toEqual([{ grade: "7a", rank: 21, climbs: 1, label: "1 climb" }]);
  });

  it("groups trad climbs by adjectival grade", () => {
    const rows: LogbookRow[] = [
      row({ grade: "E1 5a", rank: 6, type: "Trad", bucket: "onsight" }),
      row({ grade: "E1 5b", rank: 6, type: "Trad", bucket: "redpointSent" }),
      row({ grade: "HVS 5a", rank: 5, type: "Trad", bucket: "flash" }),
    ];

    expect(getGradeDistribution(rows, "Trad")).toEqual([
      { grade: "HVS", rank: 5, climbs: 1, label: "1 climb" },
      { grade: "E1", rank: 6, climbs: 2, label: "2 climbs" },
    ]);
  });
});

describe("getDisciplineCounts", () => {
  it("returns positive discipline counts in the requested order", () => {
    const rows = [
      row({ grade: "7a", rank: 21, type: "Sport" }),
      row({ grade: "VS 4c", rank: 4, type: "Trad" }),
      row({ grade: "HVS 5a", rank: 5, type: "Trad" }),
    ];

    expect(getDisciplineCounts(rows, ["Sport", "Trad", "Bouldering"])).toEqual([
      { discipline: "Sport", count: 1 },
      { discipline: "Trad", count: 2 },
    ]);
  });
});
