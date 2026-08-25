import { formatGradeForDiscipline, type Discipline } from "./grades";
import type { LogbookRow } from "./logbook-parser";

export type SuccessByGradePoint = {
  grade: string;
  rank: number;
  attempts: number;
  successes: number;
  rate: number;
  label: string;
};

export type MaxOverTimePoint = {
  date: number;
  dateLabel: string;
  rank: number;
  grade: string;
};

export type DisciplineCountPoint = {
  discipline: Discipline;
  count: number;
};

export type AverageSessionsByGradePoint = {
  grade: string;
  rank: number;
  climbs: number;
  totalSessions: number;
  averageSessions: number;
  label: string;
};

export type GradeDistributionPoint = {
  grade: string;
  rank: number;
  climbs: number;
  label: string;
};

export function formatDate(date: Date | null) {
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getSuccessByGrade(rows: LogbookRow[], type: Discipline): SuccessByGradePoint[] {
  const gradeMap = new Map<string, { grade: string; rank: number; attempts: number; successes: number }>();

  for (const row of rows) {
    if (row.type !== type || row.rank === null || !isOnsightAttempt(row)) continue;
    const current = gradeMap.get(row.grade) ?? {
      grade: row.grade,
      rank: row.rank,
      attempts: 0,
      successes: 0,
    };

    current.attempts += 1;
    if (row.bucket === "onsight") current.successes += 1;
    gradeMap.set(row.grade, current);
  }

  return [...gradeMap.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((item) => ({
      ...item,
      rate: Math.round((item.successes / item.attempts) * 100),
      label: `${item.successes}/${item.attempts}`,
    }));
}

export function getDisciplineCounts(rows: LogbookRow[], disciplines: Discipline[]): DisciplineCountPoint[] {
  const counts = new Map<Discipline, number>();

  for (const row of rows) {
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  }

  return disciplines
    .map((discipline) => ({
      discipline,
      count: counts.get(discipline) ?? 0,
    }))
    .filter((point) => point.count > 0);
}

export function getAverageSessionsToSendByGrade(rows: LogbookRow[], type: Discipline): AverageSessionsByGradePoint[] {
  const climbs = new Map<string, Array<LogbookRow & { inputIndex: number }>>();

  rows.forEach((row, inputIndex) => {
    if (row.type !== type || row.rank === null) return;

    const key = [row.type, row.grade.toLowerCase(), row.crag.toLowerCase(), row.name.toLowerCase()].join("\u001f");
    climbs.set(key, [...(climbs.get(key) ?? []), { ...row, inputIndex }]);
  });

  const gradeMap = new Map<string, { grade: string; rank: number; climbs: number; totalSessions: number }>();

  for (const sessions of climbs.values()) {
    const orderedSessions = [...sessions].sort((a, b) => {
      const dateA = a.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dateB = b.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dateA - dateB || a.inputIndex - b.inputIndex;
    });
    const firstSendIndex = orderedSessions.findIndex((row) => row.isSuccessfulSend);
    if (firstSendIndex < 0) continue;

    const sentRow = orderedSessions[firstSendIndex];
    const grade = formatGradeForDiscipline(type, sentRow.grade);
    const current = gradeMap.get(grade) ?? {
      grade,
      rank: sentRow.rank ?? 0,
      climbs: 0,
      totalSessions: 0,
    };

    current.climbs += 1;
    current.totalSessions += firstSendIndex + 1;
    gradeMap.set(grade, current);
  }

  return [...gradeMap.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((item) => ({
      ...item,
      averageSessions: Math.round((item.totalSessions / item.climbs) * 10) / 10,
      label: `${item.totalSessions}/${item.climbs}`,
    }));
}

export function getGradeDistribution(rows: LogbookRow[], type: Discipline): GradeDistributionPoint[] {
  const gradeMap = new Map<string, { grade: string; rank: number; climbs: number }>();

  for (const row of rows) {
    if (row.type !== type || row.rank === null || !row.isSuccessfulSend) continue;

    const grade = formatGradeForDiscipline(type, row.grade);
    const current = gradeMap.get(grade) ?? {
      grade,
      rank: row.rank,
      climbs: 0,
    };

    current.climbs += 1;
    gradeMap.set(grade, current);
  }

  return [...gradeMap.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((item) => ({
      ...item,
      label: `${item.climbs} ${item.climbs === 1 ? "climb" : "climbs"}`,
    }));
}

function isOnsightAttempt(row: LogbookRow) {
  return row.isEligibleAttempt && (row.bucket === "onsight" || row.bucket === "failed");
}

export function getMaxOverTime(rows: LogbookRow[], type: Discipline): MaxOverTimePoint[] {
  const ascentsByDate = new Map<number, LogbookRow>();

  for (const row of rows) {
    if (
      row.type !== type ||
      !row.date ||
      row.rank === null ||
      !row.isSuccessfulSend ||
      !isEligibleForMaxOverTime(row, type)
    ) {
      continue;
    }

    const timestamp = row.date.getTime();
    const current = ascentsByDate.get(timestamp);
    if (!current || (row.rank ?? -1) > (current.rank ?? -1)) {
      ascentsByDate.set(timestamp, row);
    }
  }

  const ascents = [...ascentsByDate.values()].sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  let bestRank = -1;
  let bestGrade = "";

  return ascents
    .map((row) => {
      if ((row.rank ?? -1) > bestRank) {
        bestRank = row.rank ?? bestRank;
        bestGrade = formatGradeForDiscipline(type, row.grade);
      }

      return {
        date: row.date?.getTime() ?? 0,
        dateLabel: formatDate(row.date),
        rank: bestRank,
        grade: bestGrade,
      };
    })
    .filter((point, index, points) => index === 0 || point.rank !== points[index - 1].rank);
}

function isEligibleForMaxOverTime(row: LogbookRow, type: Discipline) {
  if (type !== "Trad") {
    return true;
  }

  return !/\b(2nd|tr)\b/i.test(row.style);
}
