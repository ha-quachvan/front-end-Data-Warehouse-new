import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// Công cụ dùng chung cho các danh sách: chọn số dòng hiển thị và tải các dòng đang hiển thị về máy

// Ô "Hiển thị [n] / total dòng": chỉ áp dụng khi rời ô hoặc nhấn Enter để không gọi API theo từng phím gõ
export function RowLimit({
  limit,
  total,
  onChange,
}: {
  limit: number;
  total: number | null;
  onChange: (limit: number) => void;
}) {
  const shown = total === null ? limit : Math.min(limit, total);
  const [draft, setDraft] = useState(String(shown));
  useEffect(() => setDraft(String(shown)), [shown]);

  const commit = () => {
    const value = Math.trunc(Number(draft));
    if (draft.trim() === "" || !Number.isFinite(value) || value < 1) {
      setDraft(String(shown));
      return;
    }
    const next = total === null ? value : Math.min(value, Math.max(total, 1));
    setDraft(String(Math.min(next, total ?? next)));
    if (next !== limit) onChange(next);
  };

  return (
    <label className="row-limit">
      <span>Rows</span>
      <span className="row-limit-control">
        <input
          type="number"
          min={1}
          disabled={total === 0}
          max={total ?? undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          style={{ width: 72 }}
        />{" "}
        / {total ?? "…"}
      </span>
    </label>
  );
}

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null;
};
type ExportFormat = "csv" | "xlsx";

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  // Tên campaign do người dùng nhập: chặn Excel hiểu ô là công thức
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
) {
  const lines = [
    columns.map((c) => csvCell(c.header)),
    ...rows.map((r) => columns.map((c) => csvCell(c.value(r)))),
  ];
  // BOM để Excel đọc đúng tiếng Việt
  saveBlob(
    new Blob(["﻿" + lines.map((l) => l.join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    `${fileName}.csv`,
  );
}

async function downloadXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
) {
  const { default: ExcelJS } = await import("exceljs"); // thư viện lớn: chỉ tải khi người dùng cần
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("List");
  sheet.columns = columns.map((c) => ({
    header: c.header,
    width: Math.max(14, c.header.length + 2),
  }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(columns.map((c) => c.value(r))));
  saveBlob(
    new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${fileName}.xlsx`,
  );
}

export function DownloadList<T>({
  rows,
  columns,
  fileName,
}: {
  rows: T[];
  columns: ExportColumn<T>[];
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = (format: ExportFormat) => {
    setBusy(true);
    setError(null);
    (format === "csv"
      ? Promise.resolve(downloadCsv(rows, columns, fileName))
      : downloadXlsx(rows, columns, fileName)
    )
      .catch((e) => setError(`Unable to download file: ${e}`))
      .finally(() => setBusy(false));
  };

  return (
    <div className="download-list">
      <span>Download</span>
      <div className="download-buttons">
        {(["csv", "xlsx"] as ExportFormat[]).map((format) => (
          <button
            className="button secondary"
            key={format}
            disabled={busy || rows.length === 0}
            title={`Download ${rows.length} visible rows as ${format.toUpperCase()}`}
            onClick={() => download(format)}
          >
            <Download size={14} />
            {busy ? "Preparing…" : format.toUpperCase()}
          </button>
        ))}
      </div>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
