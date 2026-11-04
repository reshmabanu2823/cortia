import { Check } from "lucide-react";
import type { Baseline, MRI, Recording } from "../types";
import { date } from "../api";
import { Card, Empty } from "../ui";

export function NotificationsPage({ sessions, mris, baselines }: {
  sessions: Recording[]; mris: MRI[]; baselines: Baseline[];
}) {
  const activity = [
    ...sessions.map(s => ({ id: `eeg-${s.id}`, title: `EEG recording ${s.state}`, detail: `${s.context.task} · ${s.valid_windows} usable windows${s.config.source === "demo" ? " · Demo" : ""}`, at: s.ended_at || s.started_at })),
    ...mris.map(m => ({ id: `mri-${m.id}`, title: "MRI analysis completed", detail: m.filename, at: m.created_at })),
    ...baselines.map(b => ({ id: `baseline-${b.id}`, title: "Baseline calculated", detail: `${b.session_ids.length} recordings · ${b.config.source === "demo" ? "Demo comparison" : b.context.task}`, at: b.created_at })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return <>
    <Card title="Recent activity" subtitle="Recording and analysis tasks, newest first">
      {activity.length ? <div>{activity.map(item => <div key={item.id} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
        <Check size={18} style={{ color: "#9e2a4b", marginTop: 3 }} />
        <div style={{ flex: 1 }}><strong>{item.title}</strong><p className="muted" style={{ marginTop: 5 }}>{item.detail}</p></div>
        <time dateTime={item.at} style={{ fontSize: 12, color: "#5d5853" }}>{date(item.at)}</time>
      </div>)}</div> : <Empty title="No recent activity" text="Your recordings, MRI analyses, and calculated baselines will appear here with their times." />}
    </Card>
  </>;
}
