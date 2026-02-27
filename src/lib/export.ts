export type ExportFormat = "png" | "svg" | "zip";

/**
 * Builds an export filename from the diagram title and current timestamp.
 *
 * Format: `<SanitisedTitle>_<YYYY-MM-DD>_<HHmm>.<format>`
 *
 * @param title   - Raw diagram title (will be sanitised)
 * @param format  - "png" or "svg"
 * @param now     - Optional date override for deterministic tests
 */
export function generateExportFilename(
  title: string,
  format: ExportFormat,
  now: Date = new Date(),
): string {
  const sanitised = title
    .replace(/[^a-zA-Z0-9 ]/g, "_")
    .replace(/ /g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const name = sanitised || "diagram";

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return `${name}_${yyyy}-${mm}-${dd}_${hh}${min}.${format}`;
}

/**
 * Triggers a browser file download from a data-URL.
 */
export function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
