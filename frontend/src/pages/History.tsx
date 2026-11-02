import { useState } from "react";
import { Download, FileText, FileDown } from "lucide-react";
import type { Recording } from "../types";
import { date, number, title } from "../api";
import { Trends } from "../charts";
import { Card, Empty, Badge, Note } from "../ui";

export function HistoryPage({
  sessions,
  choose,
}: {
  sessions: Recording[];
  choose: (id: string) => Promise<void>;
}) {
  const [left, setLeft] = useState(""),
    [right, setRight] = useState("");
  const a = sessions.find((s) => s.id === left),
    b = sessions.find((s) => s.id === right);
  const valid = sessions.filter((s) => s.valid_windows > 0);
  return (
    <>
      {/* Brain Health Monitoring Report Action Hub */}
      <div
        style={{
          background: "linear-gradient(135deg, #FAF7F5 0%, #F5EBEB 100%)",
          border: "1px solid #E8DFDC",
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px rgba(158, 42, 75, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  background: "rgba(158, 42, 75, 0.1)",
                  color: "#9E2A4B",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                }}
              >
                PRIVATE • RESEARCH USE ONLY
              </span>
              <span style={{ fontSize: "12px", color: "#8A8580" }}>
                Multi-Modal Diagnostic Research Report
              </span>
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#24201D",
                margin: "0 0 6px 0",
                fontFamily: "Playfair Display, serif, system-ui",
              }}
            >
              Brain Health Monitoring Reports
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#6E6964",
                maxWidth: "620px",
                lineHeight: "1.5",
              }}
            >
              Generate structured, publication-grade research reports uniting focal
              EEG spectral distribution, baseline z-scores, deep learning cranial
              MRI classifications, Grad-CAM attention heatmaps, and longitudinal trend analysis.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <a
              href="/api/reports/brain-health?format=pdf"
              download="cortia-brain-health-report.pdf"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#9E2A4B",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: "13px",
                padding: "10px 16px",
                borderRadius: "8px",
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(158, 42, 75, 0.25)",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={16} />
              <span>Download PDF Report</span>
            </a>

            <a
              href="/api/reports/brain-health?format=docx"
              download="cortia-brain-health-report.docx"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#FFFFFF",
                color: "#24201D",
                border: "1px solid #D6CBC7",
                fontWeight: 600,
                fontSize: "13px",
                padding: "9px 15px",
                borderRadius: "8px",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <FileDown size={16} />
              <span>Download Word (.docx)</span>
            </a>

            <a
              href="/api/reports/brain-health?format=json"
              download="cortia-brain-health-report.json"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                color: "#6E6964",
                fontSize: "12px",
                fontWeight: 500,
                padding: "8px 12px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              <Download size={14} />
              <span>JSON Data</span>
            </a>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            paddingTop: "14px",
            borderTop: "1px solid rgba(229, 223, 217, 0.7)",
            fontSize: "12px",
            color: "#5C5652",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#9E2A4B", fontSize: "14px" }}>•</span>
            <span>
              Faint <b>CORTIA</b> diagonal watermark across all pages
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#9E2A4B", fontSize: "14px" }}>•</span>
            <span>Delta, Theta, Alpha, Beta PSD & TBR ratios</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#9E2A4B", fontSize: "14px" }}>•</span>
            <span>Embedded MRI scans & Grad-CAM attention saliency</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#9E2A4B", fontSize: "14px" }}>•</span>
            <span>Native editable Word formatting & tables</span>
          </div>
        </div>
      </div>

      <Card
        title="Recording history"
        subtitle="Raw samples, quality decisions, and calculated features remain linked"
      >
        {sessions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Recording</th>
                  <th>Context</th>
                  <th>Samples</th>
                  <th>Quality windows</th>
                  <th>Status</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => void choose(s.id)}
                      >
                        {date(s.started_at)}
                      </button>
                    </td>
                    <td>
                      {s.context.task} · {s.context.eyes}
                      <small>{s.context.montage}</small>
                    </td>
                    <td>
                      {number(s.sample_count, 0)}
                      <small>{s.missing_samples} missing</small>
                    </td>
                    <td>
                      {s.valid_windows} usable
                      <small>{s.invalid_windows} excluded</small>
                    </td>
                    <td>
                      <Badge tone={s.state === "completed" ? "green" : "amber"}>
                        {title(s.state)}
                      </Badge>
                    </td>
                    <td>
                      <div
                        className="report-links"
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <a
                          href={`/api/sessions/${s.id}/report?format=pdf`}
                          download={`cortia-${s.id}-report.pdf`}
                          title="Download PDF report for this session"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "3px 7px",
                            borderRadius: "4px",
                            background: "rgba(158, 42, 75, 0.08)",
                            color: "#9E2A4B",
                            fontWeight: 600,
                            fontSize: "10px",
                            textDecoration: "none",
                          }}
                        >
                          PDF <Download size={10} />
                        </a>
                        <a
                          href={`/api/sessions/${s.id}/report?format=docx`}
                          download={`cortia-${s.id}-report.docx`}
                          title="Download Word (.docx) report for this session"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "3px 7px",
                            borderRadius: "4px",
                            background: "#F5F2EE",
                            color: "#4A4540",
                            fontWeight: 600,
                            fontSize: "10px",
                            textDecoration: "none",
                          }}
                        >
                          DOCX <Download size={10} />
                        </a>
                        <a
                          href={`/api/sessions/${s.id}/report?format=json`}
                          download={`cortia-${s.id}.json`}
                          title="Download raw JSON report"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: "3px 5px",
                            color: "#8A8580",
                            fontSize: "10px",
                            textDecoration: "none",
                          }}
                        >
                          JSON
                        </a>
                        {s.state !== "recording" && (
                          <a
                            href={`/api/sessions/${s.id}/raw`}
                            download={`cortia-${s.id}-raw.csv`}
                            title="Download raw CSV samples"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: "3px 5px",
                              color: "#8A8580",
                              fontSize: "10px",
                              textDecoration: "none",
                            }}
                          >
                            CSV
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No recordings yet"
            text="Recordings appear here after hardware acquisition starts. Exports contain actual stored data."
          />
        )}
      </Card>
      <Card
        title="Band power over time"
        subtitle="Session mean relative power · comparison requires matched recording conditions"
      >
        {valid.length >= 2 ? (
          <Trends sessions={valid} />
        ) : (
          <Empty
            title="Trends need more recordings"
            text="At least two sessions with usable windows are needed to display change over time."
          />
        )}
      </Card>
      <Card
        title="Compare two sessions"
        subtitle="Descriptive differences only; context and hardware affect interpretation"
      >
        {valid.length >= 2 ? (
          <>
            <div className="two-fields">
              <label>
                Reference session
                <select value={left} onChange={(e) => setLeft(e.target.value)}>
                  <option value="">Select reference</option>
                  {valid.map((s) => (
                    <option key={s.id} value={s.id}>
                      {date(s.started_at)} · {s.context.task}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Comparison session
                <select
                  value={right}
                  onChange={(e) => setRight(e.target.value)}
                >
                  <option value="">Select comparison</option>
                  {valid
                    .filter((s) => s.id !== left)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {date(s.started_at)} · {s.context.task}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {a && b && (
              <>
                <Note>
                  {JSON.stringify({ ...a.context, notes: "" }) !==
                    JSON.stringify({ ...b.context, notes: "" }) ||
                  JSON.stringify(a.config) !== JSON.stringify(b.config)
                    ? "Recording conditions differ. Changes may reflect acquisition or task differences."
                    : "Recording context matches. Differences remain descriptive, not clinical findings."}
                </Note>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Reference</th>
                        <th>Comparison</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(a.features)
                        .filter(([k]) => k in b.features)
                        .map(([k, v]) => (
                          <tr key={k}>
                            <td>{title(k)}</td>
                            <td>{number(v, 4)}</td>
                            <td>{number(b.features[k], 4)}</td>
                            <td>{number(b.features[k] - v, 4)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : (
          <Empty
            title="Comparison not available"
            text="Record two usable sessions to compare measured features."
          />
        )}
      </Card>
    </>
  );
}
