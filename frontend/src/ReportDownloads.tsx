import { Download } from "lucide-react";

export function ReportDownloads({ kind, id }: { kind: "sessions" | "mri"; id: string }) {
  return <div className="report-links" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {(["pdf", "docx"] as const).map(format => <a
      key={format}
      className="secondary"
      href={`/api/${kind}/${id}/report?format=${format}`}
      download={`cortia-${kind === "mri" ? "mri" : "eeg"}-${id}-analysis.${format}`}
      title={`Download ${format === "pdf" ? "PDF" : "Word"} analysis with CORTIA watermark`}
    ><Download size={15} />{format === "pdf" ? "Download PDF" : "Download Word"}</a>)}
  </div>;
}
