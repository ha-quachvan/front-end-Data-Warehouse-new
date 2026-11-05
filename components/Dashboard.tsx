import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CircleAlert,
  Database,
  Info,
  LoaderCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: [string, string];
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          {eyebrow[0]} <span>/</span> {eyebrow[1]}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function SectionHeading({
  icon: Icon,
  title,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <Icon size={19} aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      {aside && <span className="section-note">{aside}</span>}
    </div>
  );
}
export function PanelHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {aside}
    </div>
  );
}
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "error" : "info"}`}
      role={error ? "alert" : "status"}
    >
      <Info size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
export function DataState({
  status,
  title,
  description,
  retry,
}: {
  status: "loading" | "empty" | "error";
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  const Icon =
    status === "loading"
      ? LoaderCircle
      : status === "error"
        ? CircleAlert
        : Database;
  return (
    <div
      className={`data-state data-${status}`}
      role={status === "error" ? "alert" : "status"}
    >
      <span className="state-icon">
        <Icon size={24} className={status === "loading" ? "spin" : ""} />
      </span>
      <h3>
        {title ??
          (status === "loading"
            ? "Loading data…"
            : status === "empty"
              ? "No data to display"
              : "Unable to load data")}
      </h3>
      {description && <p>{description}</p>}
      {retry && (
        <button className="button secondary" onClick={retry}>
          <RotateCcw size={14} />
          Try again
        </button>
      )}
    </div>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <span className="select-wrap">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
}
export type Column<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  numeric?: boolean;
  sortable?: boolean;
};
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  label,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  label: string;
  rowClassName?: (row: T) => string;
}) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(
    null,
  );
  const col = columns.find((c) => c.key === sort?.key);
  const sorted =
    sort && col
      ? [...rows].sort((a, b) => {
          const x = col.value(a),
            y = col.value(b);
          if (x === null) return y === null ? 0 : 1;
          if (y === null) return -1;
          return (
            (typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y))) * sort.direction
          );
        })
      : rows;
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.numeric ? "numeric" : ""}
                aria-sort={
                  sort?.key === c.key
                    ? sort.direction === 1
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                {c.sortable === false ? (
                  c.label
                ) : (
                  <button
                    onClick={() =>
                      setSort({
                        key: c.key,
                        direction:
                          sort?.key === c.key && sort.direction === 1 ? -1 : 1,
                      })
                    }
                  >
                    {c.label}
                    {sort?.key === c.key ? (
                      sort.direction === 1 ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : (
                      <ArrowUpDown size={12} />
                    )}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? "numeric" : ""}>
                  {c.render ? c.render(row) : (c.value(row) ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function RecordId({ value }: { value: string }) {
  return (
    <span className="product-id" title={value} tabIndex={0}>
      {value.length > 18 ? (
        <>
          {value.slice(0, 8)}
          <span>…</span>
          {value.slice(-4)}
        </>
      ) : (
        value
      )}
    </span>
  );
}
export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`risk-badge risk-${level.toLowerCase()}`}>
      <i />
      {level}
    </span>
  );
}
export function TableFootnote({ children }: { children: ReactNode }) {
  return (
    <div className="table-footer">
      <Info size={13} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
