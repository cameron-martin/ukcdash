import { rankGrade, type Discipline } from "./grades";

export type { Discipline } from "./grades";
export type StyleBucket = "onsight" | "flash" | "redpointSent" | "repeat" | "failed" | "other";

export type LogbookRow = {
  name: string;
  grade: string;
  style: string;
  date: Date | null;
  dateLabel: string;
  crag: string;
  pitches: number;
  type: Discipline;
  rank: number | null;
  bucket: StyleBucket;
  isEligibleAttempt: boolean;
  isSuccessfulSend: boolean;
};

export type ParseResult = {
  rows: LogbookRow[];
  errors: string[];
};

type CsvCellMap = Record<string, string>;

const requiredColumns = ["Name", "Grade", "Style", "Date", "Crag", "Pitches", "Type"];

export function parseLogbook(text: string): ParseResult {
  const csvRows = parseCsv(text);
  if (csvRows.length < 2) {
    return { rows: [], errors: ["The CSV does not contain any logbook entries."] };
  }

  const headers = csvRows[0].map((header) => header.trim());
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [`Missing required column${missingColumns.length > 1 ? "s" : ""}: ${missingColumns.join(", ")}.`],
    };
  }

  const rows: LogbookRow[] = [];
  const errors: string[] = [];

  for (const [rowIndex, csvRow] of csvRows.slice(1).entries()) {
    if (csvRow.length !== headers.length) {
      errors.push(`Row ${rowIndex + 2} has ${csvRow.length} cells; expected ${headers.length}.`);
      continue;
    }

    const record = Object.fromEntries(headers.map((header, index) => [header, csvRow[index]?.trim() ?? ""])) as CsvCellMap;
    const type = normalizeDiscipline(record.Type);
    if (!type) {
      continue;
    }

    const grade = record.Grade;
    const style = record.Style;
    const bucket = normalizeStyle(style);
    const rank = rankGrade(type, grade);
    const isSecondOrTopRope = /\b(2nd|tr)\b/i.test(style);
    const isEligibleAttempt = !isSecondOrTopRope && bucket !== "other";
    const isSuccessfulSend =
      !isSecondOrTopRope &&
      (bucket === "onsight" || bucket === "flash" || bucket === "redpointSent" || bucket === "repeat");

    rows.push({
      name: record.Name,
      grade,
      style,
      date: parseUkcDate(record.Date),
      dateLabel: record.Date,
      crag: record.Crag,
      pitches: Number.parseInt(record.Pitches, 10) || 1,
      type,
      rank,
      bucket,
      isEligibleAttempt,
      isSuccessfulSend,
    });
  }

  return { rows, errors };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value.trim().length > 0));
}

function normalizeDiscipline(value: string): Discipline | null {
  const type = value.trim().toLowerCase();
  if (type === "sport") return "Sport";
  if (type === "trad") return "Trad";
  if (type === "bouldering") return "Bouldering";
  return null;
}

function normalizeStyle(style: string): StyleBucket {
  const value = style.toLowerCase();
  if (value.includes("dnf")) return "failed";
  if (value.includes("o/s")) return "onsight";
  if (value.includes("β") || value.includes("&beta;")) return "flash";
  if (/\brp\b/.test(value) || /\bsent\b/.test(value)) return "redpointSent";
  if (/\brpt\b/.test(value)) return "repeat";
  if (value.includes("dog")) return "failed";
  return "other";
}

function parseUkcDate(value: string) {
  const match = value.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})$/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
    monthText.toLowerCase(),
  );
  if (month < 0) return null;

  const yearNumber = Number.parseInt(yearText, 10);
  const year = yearText.length === 2 ? 2000 + yearNumber : yearNumber;
  return new Date(Date.UTC(year, month, Number.parseInt(dayText, 10)));
}
