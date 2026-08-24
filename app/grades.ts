export type Discipline = "Sport" | "Trad" | "Bouldering";

export type GradeScaleEntry = {
  grade: string;
  rank: number;
};

const sportGradeScale = buildFrenchGradeScale("", "lower");
const boulderGradeScale = buildFrenchGradeScale("f", "upper");
const sportGradeOrder = buildGradeOrder(sportGradeScale);
const boulderGradeOrder = buildGradeOrder(boulderGradeScale);
const tradAdjectivalOrder = ["D", "VD", "S", "HS", "VS", "HVS"];

export function rankGrade(type: Discipline, grade: string) {
  if (type === "Sport") {
    return sportGradeOrder.get(grade.toLowerCase()) ?? null;
  }

  if (type === "Bouldering") {
    return boulderGradeOrder.get(grade.toLowerCase()) ?? null;
  }

  const [adjectival] = grade.split(/\s+/);
  const eGrade = adjectival.match(/^E(\d+)$/i);
  const adjectivalRank = eGrade
    ? tradAdjectivalOrder.length + Number.parseInt(eGrade[1], 10) - 1
    : tradAdjectivalOrder.indexOf(adjectival.toUpperCase());

  if (adjectivalRank < 0) return null;

  return adjectivalRank;
}

export function getGradeScale(type: Discipline, minRank: number, maxRank: number): GradeScaleEntry[] {
  if (type === "Sport") {
    return sportGradeScale.filter((entry) => entry.rank >= minRank && entry.rank <= maxRank);
  }

  if (type === "Bouldering") {
    return boulderGradeScale.filter((entry) => entry.rank >= minRank && entry.rank <= maxRank);
  }

  return buildTradGradeScale(maxRank).filter((entry) => entry.rank >= minRank && entry.rank <= maxRank);
}

export function formatGradeForDiscipline(type: Discipline, grade: string) {
  return type === "Trad" ? grade.split(/\s+/)[0] : grade;
}

function buildFrenchGradeScale(prefix: string, letterCase: "lower" | "upper"): GradeScaleEntry[] {
  const grades: string[] = [];
  for (let number = 1; number <= 9; number += 1) {
    if (number <= 3) {
      grades.push(`${prefix}${number}`);
      continue;
    }

    for (const letter of ["a", "b", "c"]) {
      const gradeLetter = letterCase === "upper" ? letter.toUpperCase() : letter;
      grades.push(`${prefix}${number}${gradeLetter}`);
      grades.push(`${prefix}${number}${gradeLetter}+`);
    }
  }

  return grades.map((grade, index) => ({ grade, rank: index }));
}

function buildGradeOrder(scale: GradeScaleEntry[]) {
  return new Map(scale.map((entry) => [entry.grade.toLowerCase(), entry.rank]));
}

function buildTradGradeScale(maxRank: number) {
  const grades = tradAdjectivalOrder.map((grade, rank) => ({ grade, rank }));
  for (let rank = tradAdjectivalOrder.length; rank <= maxRank; rank += 1) {
    grades.push({ grade: `E${rank - tradAdjectivalOrder.length + 1}`, rank });
  }

  return grades;
}
