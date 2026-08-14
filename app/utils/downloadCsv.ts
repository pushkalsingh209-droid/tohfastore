// app/utils/downloadCsv.ts
// Shared client-side CSV export used by every admin stats table/chart --
// formats rows into a CSV string and triggers a browser download via a
// Blob + temporary <a download> link. No server round trip: the data
// behind every admin stats panel is already loaded client-side.
function escapeCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Low-level: turns any set of rows (not necessarily uniform column count --
// useful for a multi-section export like FinanceInsightsPanel's, with a
// blank-row separator between sections) into one CSV string.
export function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

export function triggerCsvDownload(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Convenience wrapper for the common single-table case (header row + data
// rows, all the same width).
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  triggerCsvDownload(filename, rowsToCsv([headers, ...rows]));
}
