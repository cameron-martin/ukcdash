import { describe, expect, it } from "vitest";
import { parseLogbook } from "./logbook-parser";

const header = "Name,Grade,Style,Partner(empty),Notes,Date,Crag,County,Region,Country,Pitches,Type";

function csv(rows: string[]) {
  return [header, ...rows].join("\n");
}

describe("parseLogbook", () => {
  it("parses valid UKC rows with quoted comma-containing fields", () => {
    const result = parseLogbook(
      csv([
        '"Mawr, Mawr, Mawr",7a,"Lead O/S",,"Moved well, felt steady",23/Aug/26,Sirhowy,Gwent,"South Wales",Wales,1,Sport',
      ]),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Mawr, Mawr, Mawr",
      grade: "7a",
      style: "Lead O/S",
      crag: "Sirhowy",
      pitches: 1,
      type: "Sport",
      bucket: "onsight",
      isEligibleAttempt: true,
      isSuccessfulSend: true,
    });
  });

  it("validates required columns", () => {
    const result = parseLogbook("Name,Grade,Style\nRoute,7a,Lead O/S");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["Missing required columns: Date, Crag, Pitches, Type."]);
  });

  it("returns an empty-logbook error for empty or header-only CSV input", () => {
    expect(parseLogbook("").errors).toEqual(["The CSV does not contain any logbook entries."]);
    expect(parseLogbook(header).errors).toEqual(["The CSV does not contain any logbook entries."]);
  });

  it("normalizes supported disciplines", () => {
    const result = parseLogbook(
      csv([
        "Sport Route,7a,Lead RP,,,23/Aug/26,Sirhowy,Gwent,South Wales,Wales,1,Sport",
        "Trad Route,VS 4c,Lead O/S,,,24/Aug/26,Avon,Avon,The West Country,England,2,Trad",
        "Boulder Problem,f6A,Sent O/S,,,25/Aug/26,Forest,,Fontainebleau,France,1,Bouldering",
      ]),
    );

    expect(result.rows.map((row) => row.type)).toEqual(["Sport", "Trad", "Bouldering"]);
  });

  it("normalizes style buckets", () => {
    const result = parseLogbook(
      csv([
        "Onsight,6c,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Flash,6c,Lead β,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Redpoint,7a,Lead RP,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Sent,7a,Sent x,,,23/Aug/26,Crag,County,Region,Country,1,Bouldering",
        "Repeat,7a,Lead rpt,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Dog,7b,Lead dog,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "DNF,7b,Lead dnf,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Sent DNF,f6A,Sent dnf,,,23/Aug/26,Crag,County,Region,Country,1,Bouldering",
        "Not UKC Flash,6c,Lead flash,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
      ]),
    );

    expect(result.rows.map((row) => row.bucket)).toEqual([
      "onsight",
      "flash",
      "redpointSent",
      "redpointSent",
      "repeat",
      "failed",
      "failed",
      "failed",
      "other",
    ]);
  });

  it("marks seconding and top-rope styles as ineligible attempts", () => {
    const result = parseLogbook(
      csv([
        "Second,HS 4b,2nd O/S,,,23/Aug/26,Crag,County,Region,Country,1,Trad",
        "Top Rope,6b,TR dog,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
      ]),
    );

    expect(result.rows.map((row) => row.isEligibleAttempt)).toEqual([false, false]);
    expect(result.rows.map((row) => row.isSuccessfulSend)).toEqual([false, false]);
  });

  it("only marks positive style buckets as successful sends", () => {
    const result = parseLogbook(
      csv([
        "Boulder Send,f6A,Sent x,,,23/Aug/26,Crag,County,Region,Country,1,Bouldering",
        "Boulder DNF,f7B,Sent dnf,,,23/Aug/26,Crag,County,Region,Country,1,Bouldering",
        "Route DNF,7b,Lead dnf,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Route Dog,7b,Lead dog,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Route Flash,7a,Lead β,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
      ]),
    );

    expect(result.rows.map((row) => [row.name, row.bucket, row.isSuccessfulSend])).toEqual([
      ["Boulder Send", "redpointSent", true],
      ["Boulder DNF", "failed", false],
      ["Route DNF", "failed", false],
      ["Route Dog", "failed", false],
      ["Route Flash", "flash", true],
    ]);
  });

  it("parses UKC dates as UTC dates", () => {
    const result = parseLogbook(csv(["Route,7a,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Sport"]));

    expect(result.rows[0].date?.toISOString()).toBe("2026-08-23T00:00:00.000Z");
  });

  it("includes ranks for representative sport, bouldering, and trad grades", () => {
    const result = parseLogbook(
      csv([
        "Sport,7a,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Boulder,f6A+,Sent O/S,,,23/Aug/26,Crag,County,Region,Country,1,Bouldering",
        "Trad,HVS 5a,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Trad",
      ]),
    );

    expect(result.rows.map((row) => row.rank)).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
  });

  it("skips unsupported types without failing the import", () => {
    const result = parseLogbook(
      csv([
        "Kept,7a,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Skipped,7a,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Ice",
      ]),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.name)).toEqual(["Kept"]);
  });

  it("reports malformed row widths while keeping valid rows", () => {
    const result = parseLogbook(
      csv([
        "Kept,7a,Lead O/S,,,23/Aug/26,Crag,County,Region,Country,1,Sport",
        "Broken,7a,Lead O/S",
      ]),
    );

    expect(result.rows.map((row) => row.name)).toEqual(["Kept"]);
    expect(result.errors).toEqual(["Row 3 has 3 cells; expected 12."]);
  });
});
