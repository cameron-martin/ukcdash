import type { Route } from "./+types/home";
import { useMemo, useState } from "react";
import {
  formatDate,
  getAverageSessionsToSendByGrade,
  getDisciplineCounts,
  getGradeDistribution,
  getMaxOverTime,
  getSuccessByGrade,
  type AverageSessionsByGradePoint,
  type DisciplineCountPoint,
  type GradeDistributionPoint,
  type MaxOverTimePoint,
  type SuccessByGradePoint,
} from "../chart-data";
import { formatGradeForDiscipline, getGradeScale } from "../grades";
import {
  parseLogbook,
  type Discipline,
  type LogbookRow,
  type ParseResult,
  type StyleBucket,
} from "../logbook-parser";
import {
  emptyTimeFilter,
  formatDateInputValue,
  TimeFilterPanel,
  type TimeFilter,
} from "../time-filter-panel";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "UKC Logbook Dashboard" },
    {
      name: "description",
      content: "Client-side UKC CSV logbook analyser",
    },
  ];
}

const disciplines: Discipline[] = ["Sport", "Trad", "Bouldering"];
const disciplineColors: Record<Discipline, string> = {
  Sport: "#0f766e",
  Trad: "#b45309",
  Bouldering: "#7c3aed",
};
const styleLabels: Record<StyleBucket, string> = {
  onsight: "Onsight",
  flash: "Flash",
  redpointSent: "Redpoint / sent",
  repeat: "Repeat",
  failed: "Worked / failed",
  other: "Other",
};
const maxStyleOrder: StyleBucket[] = ["onsight", "flash", "redpointSent"];

function summarizeRows(rows: LogbookRow[]) {
  const datedRows = rows.filter((row) => row.date);
  const dates = datedRows.map((row) => row.date?.getTime() ?? 0);

  return {
    total: rows.length,
    pitches: rows.reduce((sum, row) => sum + row.pitches, 0),
    dateRange:
      dates.length > 0
        ? `${formatDate(new Date(Math.min(...dates)))} - ${formatDate(new Date(Math.max(...dates)))}`
        : "Unknown",
  };
}

function getMaxGrade(rows: LogbookRow[], type: Discipline, bucket?: StyleBucket) {
  const candidates = rows.filter(
    (row) =>
      row.type === type &&
      row.rank !== null &&
      row.isSuccessfulSend &&
      (bucket ? row.bucket === bucket : true),
  );
  const maxGrade = candidates.sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1))[0]?.grade;
  return maxGrade ? formatGradeForDiscipline(type, maxGrade) : "-";
}

function getDateBounds(rows: LogbookRow[]) {
  const timestamps = rows.flatMap((row) => (row.date ? [row.date.getTime()] : []));
  if (timestamps.length === 0) return null;

  return {
    from: formatDateInputValue(new Date(Math.min(...timestamps))),
    to: formatDateInputValue(new Date(Math.max(...timestamps))),
  };
}

function getDefaultTimeFilter(rows: LogbookRow[]): TimeFilter {
  return getDateBounds(rows) ?? emptyTimeFilter;
}

function parseDateInputValue(value: string, boundary: "start" | "end") {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const hour = boundary === "start" ? 0 : 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;

  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
}

function filterRowsByTime(rows: LogbookRow[], filter: TimeFilter) {
  const from = parseDateInputValue(filter.from, "start");
  const to = parseDateInputValue(filter.to, "end");

  if (from === null && to === null) return rows;

  return rows.filter((row) => {
    if (!row.date) return false;

    const timestamp = row.date.getTime();
    return (from === null || timestamp >= from) && (to === null || timestamp <= to);
  });
}

export default function Home() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(emptyTimeFilter);

  const rows = parseResult?.rows ?? [];
  const dateBounds = useMemo(() => getDateBounds(rows), [rows]);
  const defaultTimeFilter = useMemo(() => getDefaultTimeFilter(rows), [rows]);
  const filteredRows = useMemo(() => filterRowsByTime(rows, timeFilter), [rows, timeFilter]);
  const summary = useMemo(() => summarizeRows(filteredRows), [filteredRows]);
  const disciplineCounts = useMemo(() => getDisciplineCounts(filteredRows, disciplines), [filteredRows]);
  const isTimeFilterChanged = timeFilter.from !== defaultTimeFilter.from || timeFilter.to !== defaultTimeFilter.to;

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;

    setIsReading(true);
    setFileName(file.name);

    try {
      const text = await file.text();
      const result = parseLogbook(text);
      setParseResult(result);
      setTimeFilter(getDefaultTimeFilter(result.rows));
    } catch {
      setParseResult({
        rows: [],
        errors: ["The selected file could not be read. Try exporting the UKC logbook again as CSV."],
      });
      setTimeFilter(emptyTimeFilter);
    } finally {
      setIsReading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-teal-700">UKC logbook analyser</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
              Climbing dashboard from a local CSV
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600">
              Upload a UKC logbook export to calculate grades, success rates, and progression entirely in your browser.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleFileUpload(event.target.files?.[0])}
            />
            {isReading ? "Reading..." : "Upload CSV"}
          </label>
        </header>

        {!parseResult && (
          <section className="grid gap-4 border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Start with a UKC logbook CSV</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
                Required columns are Name, Grade, Style, Date, Crag, Pitches, and Type. The file stays on this device.
              </p>
            </div>
          </section>
        )}

        {parseResult && parseResult.errors.length > 0 && (
          <section className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <h2 className="font-semibold">Import warnings for {fileName || "CSV"}</h2>
            <ul className="mt-2 list-inside list-disc">
              {parseResult.errors.slice(0, 6).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </section>
        )}

        {rows.length > 0 && (
          <>
            <TimeFilterPanel
              bounds={dateBounds}
              defaultFilter={defaultTimeFilter}
              filter={timeFilter}
              filteredRows={filteredRows.length}
              isChanged={isTimeFilterChanged}
              totalRows={rows.length}
              onChange={setTimeFilter}
            />

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Entries" value={summary.total.toLocaleString("en-GB")} />
              <MetricCard label="Pitches" value={summary.pitches.toLocaleString("en-GB")} />
              <DisciplinePieCard data={disciplineCounts} />
            </section>

            {filteredRows.length === 0 && (
              <section className="border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">No entries in this date range</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
                  Adjust or reset the time filter to bring climbs back into the dashboard.
                </p>
              </section>
            )}

            {filteredRows.length > 0 && (
              <>
                <section>
                  <div className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">Max grade by discipline</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      This table shows the hardest successful ascent recorded for each discipline and style bucket. It separates
                      onsights, flashes, and redpoints or sends so a one-try result is not mixed with a worked climb. Trad grades
                      are compared by adjectival grade only, so technical sub-grades do not change the maximum shown here.
                    </p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="py-3 pr-4">Discipline</th>
                            {maxStyleOrder.map((bucket) => (
                              <th className="py-3 pr-4" key={bucket}>
                                {styleLabels[bucket]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {disciplines.map((discipline) => (
                            <tr key={discipline}>
                              <th className="py-3 pr-4 font-semibold text-slate-900">{discipline}</th>
                              {maxStyleOrder.map((bucket) => (
                                <td className="py-3 pr-4 font-mono text-slate-700" key={bucket}>
                                  {getMaxGrade(filteredRows, discipline, bucket)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-slate-950">Grade distribution of successful ascents</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    These charts count successful ascents at each grade, split by Sport, Trad, and Bouldering. Taller bars mean
                    more completed climbs at that grade, which helps show where most of your volume sits and whether your logbook
                    is concentrated at easier grades, spread evenly, or weighted toward your current limit.
                  </p>
                  <div className="mt-4 grid gap-6 lg:grid-cols-3">
                    {disciplines.map((discipline) => (
                      <ChartPanel key={discipline} title={discipline}>
                        <GradeDistributionChart
                          data={getGradeDistribution(filteredRows, discipline)}
                          color={disciplineColors[discipline]}
                        />
                      </ChartPanel>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-slate-950">Onsight success rate by grade</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    These charts estimate how often first-try attempts turn into onsights at each grade. The percentage is
                    onsights divided by eligible first-try attempts, where worked or failed attempts are counted against the rate
                    and flashes, redpoints, repeats, seconds, top-ropes, and other styles are excluded. A high bar means that
                    grade has usually been comfortable to onsight; a lower bar suggests it has been closer to your limit or has
                    fewer successful first-try outcomes.
                  </p>
                  <div className="mt-4 grid gap-6 lg:grid-cols-3">
                    {disciplines.map((discipline) => (
                      <ChartPanel key={discipline} title={discipline}>
                        <SuccessRateChart data={getSuccessByGrade(filteredRows, discipline)} color={disciplineColors[discipline]} />
                      </ChartPanel>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-slate-950">Average sessions to send by grade</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    These charts show how many logged sessions it has taken, on average, to record the first successful send of a
                    climb at each grade. Climbs are matched by discipline, grade, crag, and route name, then ordered by date so
                    the first send can be found. Higher bars usually indicate grades or individual climbs that needed more
                    projecting, while bars close to one session indicate quick sends.
                  </p>
                  <div className="mt-4 grid gap-6 lg:grid-cols-3">
                    {disciplines.map((discipline) => (
                      <ChartPanel key={discipline} title={discipline}>
                        <AverageSessionsChart
                          data={getAverageSessionsToSendByGrade(filteredRows, discipline)}
                          color={disciplineColors[discipline]}
                        />
                      </ChartPanel>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-slate-950">Max grade over time</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    These progression charts track the highest successful grade you had logged by each date. The line only moves
                    when a new personal best appears for that discipline, and if multiple improvements happen on the same day the
                    chart keeps the hardest one. For Sport and Trad, only led climbs are included, so seconded and top-rope
                    entries do not inflate the progression line.
                  </p>
                  <div className="mt-4 grid gap-6 lg:grid-cols-3">
                    {disciplines.map((discipline) => (
                      <ChartPanel key={discipline} title={discipline}>
                        <ProgressionChart
                          data={getMaxOverTime(filteredRows, discipline)}
                          discipline={discipline}
                          color={disciplineColors[discipline]}
                        />
                      </ChartPanel>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DisciplinePieCard({ data }: { data: DisciplineCountPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const chartData = data.map((point) => ({
    ...point,
    fill: disciplineColors[point.discipline],
  }));

  return (
    <div className="border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Disciplines</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">
        This split shows how your imported logbook entries are divided across climbing disciplines.
      </p>
      <div className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="count" nameKey="discipline" innerRadius={24} outerRadius={42} paddingAngle={2} />
              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString("en-GB")} (${Math.round((Number(value) / total) * 100)}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 text-sm">
          {data.map((point) => (
            <div className="flex items-center justify-between gap-3" key={point.discipline}>
              <span className="flex min-w-0 items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: disciplineColors[point.discipline] }} />
                <span className="truncate">{point.discipline}</span>
              </span>
              <span className="font-mono font-semibold text-slate-950">{point.count.toLocaleString("en-GB")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[340px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 h-72">{children}</div>
    </div>
  );
}

function GradeDistributionChart({
  data,
  color,
}: {
  data: GradeDistributionPoint[];
  color: string;
}) {
  if (data.length === 0) {
    return <EmptyChartText>No successful climbs with parseable grades found.</EmptyChartText>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 32 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="grade" angle={-35} textAnchor="end" interval={0} tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: "#475569", fontSize: 12 }} />
        <Tooltip
          formatter={(_, __, item) => [item.payload.label, "Successful ascents"]}
          labelFormatter={(label) => `Grade ${label}`}
        />
        <Bar dataKey="climbs" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SuccessRateChart({
  data,
  color,
}: {
  data: SuccessByGradePoint[];
  color: string;
}) {
  if (data.length === 0) {
    return <EmptyChartText>No eligible attempts found.</EmptyChartText>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 32 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="grade" angle={-35} textAnchor="end" interval={0} tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#475569", fontSize: 12 }} />
        <Tooltip
          formatter={(value, name, item) => [`${value}% (${item.payload.label})`, "Onsight rate"]}
          labelFormatter={(label) => `Grade ${label}`}
        />
        <Bar dataKey="rate" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AverageSessionsChart({
  data,
  color,
}: {
  data: AverageSessionsByGradePoint[];
  color: string;
}) {
  if (data.length === 0) {
    return <EmptyChartText>No sent climbs with parseable grades found.</EmptyChartText>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 32 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="grade" angle={-35} textAnchor="end" interval={0} tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis allowDecimals tick={{ fill: "#475569", fontSize: 12 }} />
        <Tooltip
          formatter={(value, name, item) => [
            `${Number(value).toLocaleString("en-GB", { maximumFractionDigits: 1 })} sessions (${item.payload.label})`,
            "Average",
          ]}
          labelFormatter={(label) => `Grade ${label}`}
        />
        <Bar dataKey="averageSessions" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProgressionChart({
  data,
  discipline,
  color,
}: {
  data: MaxOverTimePoint[];
  discipline: Discipline;
  color: string;
}) {
  if (data.length === 0) {
    return <EmptyChartText>No sent climbs with parseable grades found.</EmptyChartText>;
  }

  const ranks = data.map((point) => point.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const dates = data.map((point) => point.date);
  const gradeScale = getGradeScale(discipline, minRank, maxRank);
  const gradeByRank = new Map(gradeScale.map((entry) => [entry.rank, entry.grade]));
  const yTicks = gradeScale.map((entry) => entry.rank);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 16, right: 12, left: 8, bottom: 56 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          type="number"
          domain={[Math.min(...dates), Math.max(...dates)]}
          angle={-35}
          textAnchor="end"
          minTickGap={18}
          tickFormatter={(value) => formatDate(new Date(Number(value)))}
          tick={{ fill: "#475569", fontSize: 12 }}
          tickMargin={12}
        />
        <YAxis
          allowDecimals={false}
          ticks={yTicks}
          tickFormatter={(value) => gradeByRank.get(Number(value)) ?? String(value)}
          tick={{ fill: "#475569", fontSize: 12 }}
          width={44}
        />
        <Tooltip
          formatter={(_, __, item) => [item.payload.grade, "Max grade"]}
          labelFormatter={(_, payload) => payload[0]?.payload.dateLabel ?? ""}
        />
        <Line
          type="monotone"
          dataKey="rank"
          name="Max grade"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChartText({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">{children}</div>;
}
