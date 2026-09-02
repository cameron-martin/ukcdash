export type TimeFilter = {
  from: string;
  to: string;
};

export type DateBounds = {
  from: string;
  to: string;
};

type TimePreset = {
  label: string;
  getFilter: (today: Date, bounds: DateBounds) => TimeFilter;
};

export const emptyTimeFilter: TimeFilter = { from: "", to: "" };

const timePresets: TimePreset[] = [
  {
    label: "All time",
    getFilter: (_today, bounds) => bounds,
  },
  {
    label: "This year",
    getFilter: (today, bounds) => {
      const year = today.getUTCFullYear();
      return clampTimeFilter({ from: `${year}-01-01`, to: `${year}-12-31` }, bounds);
    },
  },
  {
    label: "Last year",
    getFilter: (today, bounds) => {
      const year = today.getUTCFullYear() - 1;
      return clampTimeFilter({ from: `${year}-01-01`, to: `${year}-12-31` }, bounds);
    },
  },
  {
    label: "Last 12 months",
    getFilter: (today, bounds) => {
      const to = formatDateInputValue(today);
      const fromDate = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()));
      return clampTimeFilter({ from: formatDateInputValue(fromDate), to }, bounds);
    },
  },
  {
    label: "Last 90 days",
    getFilter: (today, bounds) => {
      const to = formatDateInputValue(today);
      const fromDate = new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000);
      return clampTimeFilter({ from: formatDateInputValue(fromDate), to }, bounds);
    },
  },
];

export function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clampTimeFilter(filter: TimeFilter, bounds: DateBounds): TimeFilter {
  if (filter.to < bounds.from) {
    return { from: bounds.from, to: bounds.from };
  }

  if (filter.from > bounds.to) {
    return { from: bounds.to, to: bounds.to };
  }

  return {
    from: filter.from < bounds.from ? bounds.from : filter.from,
    to: filter.to > bounds.to ? bounds.to : filter.to,
  };
}

export function TimeFilterPanel({
  bounds,
  defaultFilter,
  filter,
  filteredRows,
  isChanged,
  totalRows,
  onChange,
}: {
  bounds: DateBounds | null;
  defaultFilter: TimeFilter;
  filter: TimeFilter;
  filteredRows: number;
  isChanged: boolean;
  totalRows: number;
  onChange: (filter: TimeFilter) => void;
}) {
  return (
    <section className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Time filter</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isChanged
              ? `Showing ${filteredRows.toLocaleString("en-GB")} of ${totalRows.toLocaleString("en-GB")} entries.`
              : `Showing all ${totalRows.toLocaleString("en-GB")} imported entries.`}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {timePresets.map((preset) => {
              const presetFilter = bounds ? preset.getFilter(new Date(), bounds) : emptyTimeFilter;
              const isSelected = filter.from === presetFilter.from && filter.to === presetFilter.to;

              return (
                <button
                  className={
                    isSelected
                      ? "inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                      : "inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  }
                  type="button"
                  disabled={!bounds}
                  key={preset.label}
                  onClick={() => onChange(presetFilter)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,11rem)_auto] sm:items-end">
            <DateField
              label="From"
              value={filter.from}
              min={bounds?.from}
              max={filter.to || bounds?.to}
              onChange={(from) => onChange({ ...filter, from })}
            />
            <DateField
              label="To"
              value={filter.to}
              min={filter.from || bounds?.from}
              max={bounds?.to}
              onChange={(to) => onChange({ ...filter, to })}
            />
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!isChanged}
              onClick={() => onChange(defaultFilter)}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
