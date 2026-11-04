import { useRef, useState } from "react";
import {
  History as HistoryIcon,
  Check,
  Target,
  Fingerprint,
} from "lucide-react";
import type { Recording, Baseline, Action } from "../types";
import { post, date, title, number } from "../api";
import { Badge, Card, Empty, Note, Stat } from "../ui";
import { ReportDownloads } from "../ReportDownloads";
import "./baselines.css";

const bandDescriptions = [
  { key: "delta", label: "Delta", range: "0.5–4 Hz", description: "The slowest activity measured here. Slow activity can also include movement or eye artifacts." },
  { key: "theta", label: "Theta", range: "4–8 Hz", description: "Slow activity studied during drowsiness and memory tasks. This value alone does not establish either state." },
  { key: "alpha", label: "Alpha", range: "8–13 Hz", description: "Activity often more prominent during eyes-closed rest. Recording conditions affect its strength." },
  { key: "beta", label: "Beta", range: "13–29.5 Hz", description: "Faster activity that can include both brain signals and muscle activity." },
];

function BaselineSummary({ baseline }: { baseline: Baseline }) {
  const bands = bandDescriptions.filter(band => baseline.statistics[`relative_${band.key}`]);
  const leading = [...bands].sort((a, b) => baseline.statistics[`relative_${b.key}`].mean - baseline.statistics[`relative_${a.key}`].mean)[0];
  const ratio = baseline.statistics.theta_beta?.mean;
  return <div className="baseline-summary">
    <div className="baseline-explanation">
      <h3>Your results at a glance</h3>
      <p>This baseline combines <strong>{baseline.session_ids.length} recordings</strong>. Each recording contributes equally to the averages.</p>
      {leading && <p><strong>{leading.label} has the largest average share ({number(baseline.statistics[`relative_${leading.key}`].mean * 100, 1)}%).</strong> This describes the signal’s frequency mix, not a diagnosis or a score of brain health.</p>}
      {baseline.config.source === "demo" && <p>These demo recordings include different activities and eye conditions. Use this comparison to explain the calculations; it is not a personal reference from measured recordings.</p>}
    </div>
    <div className="baseline-band-grid">{bands.map(band => {
      const stats = baseline.statistics[`relative_${band.key}`];
      return <article className="baseline-band" key={band.key}>
        <div><strong>{band.label}</strong><span>{band.range}</span></div>
        <strong className="baseline-percentage">{number(stats.mean * 100, 1)}%</strong>
        <span>Average share of measured band power</span>
        <div className="baseline-power-track"><div style={{ width: `${Math.min(100, Math.max(0, stats.mean * 100))}%` }} /></div>
        <p>{band.description}</p>
        <small>Variation between recordings: {number(stats.std * 100, 1)} percentage points (standard deviation).</small>
      </article>;
    })}</div>
    {ratio != null && <p className="baseline-ratio"><strong>Theta compared with beta: {number(ratio, 2)}×.</strong> This is the average of each recording’s theta-to-beta power ratio. It is an exploratory measure, not an attention or stress score.</p>}
    <p className="muted">Average = mean across recordings. Median = middle recording value. Standard deviation = how much recording values vary. Larger variation means less consistent values.</p>
  </div>;
}

export function BaselinesPage({
  sessions,
  baselines,
  busy,
  action,
  refresh,
  notify,
}: {
  sessions: Recording[];
  baselines: Baseline[];
  busy: boolean;
  action: Action;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [calculationError, setCalculationError] = useState("");
  const [calculatedId, setCalculatedId] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const eligible = sessions.filter(
    (s) => s.state === "completed" && s.valid_windows >= 3,
  );
  const current = baselines[0];
  const demoCases = sessions.filter((session) => session.config.source === "demo");
  const percent = (value: number | undefined) =>
    value == null ? "—" : `${number(value * 100, 1)}%`;
  return (
    <>
      <Card
        title="EEG cases and calculated results"
        subtitle="Past-week demo recordings · calculated from stored signals using the EEG processing pipeline"
      >
        {demoCases.length ? <>
          <div className="stats-grid three">
            <Stat label="Cases" value={String(demoCases.length)} detail="Different activities and signal conditions" icon={<HistoryIcon size={17} />} />
            <Stat label="Usable windows" value={String(demoCases.reduce((sum, session) => sum + session.valid_windows, 0))} detail="Eight-second windows included in calculations" icon={<Check size={17} />} />
            <Stat label="Excluded windows" value={String(demoCases.reduce((sum, session) => sum + session.invalid_windows, 0))} detail="Artifacts excluded from band and ratio means" icon={<Target size={17} />} />
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Case / recorded</th><th>Duration</th><th>Delta</th><th>Theta</th><th>Alpha</th><th>Beta</th><th>Theta / Beta</th><th>Alpha / Theta</th><th>Quality</th></tr></thead>
              <tbody>{demoCases.map((session) => {
                const total = session.valid_windows + session.invalid_windows;
                return <tr key={session.id}>
                  <td><strong>{session.context.task}</strong><small>{date(session.started_at)} · eyes {session.context.eyes}</small></td>
                  <td>{number(session.sample_count / session.config.sampling_hz, 0)} s<small>{number(session.sample_count, 0)} samples</small></td>
                  {(["delta", "theta", "alpha", "beta"] as const).map(band => <td key={band}>{percent(session.features[`relative_${band}`])}</td>)}
                  <td>{number(session.features.theta_beta, 3)}</td>
                  <td>{number(session.features.alpha_theta, 3)}</td>
                  <td><Badge tone={session.invalid_windows ? "amber" : "green"}>{session.invalid_windows ? "Artifacts excluded" : "Usable"}</Badge><small>{session.valid_windows}/{total} usable · {percent(total ? session.valid_windows / total : undefined)}</small></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {demoCases.map((session) => <details key={session.id} className="ref-card" style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer" }}><strong>{session.context.task}</strong> · all calculated features</summary>
            <ReportDownloads kind="sessions" id={session.id} />
            <p className="muted">{date(session.started_at)} · {session.context.montage} · {session.config.sampling_hz} Hz · {session.valid_windows} usable / {session.invalid_windows} excluded windows</p>
            <div className="table-scroll"><table>
              <thead><tr><th>Feature</th><th>Calculated value</th><th>Unit</th></tr></thead>
              <tbody>{Object.entries(session.features).map(([key, value]) => <tr key={key}>
                <td>{title(key)}</td>
                <td>{key.startsWith("relative_") ? percent(value) : number(value, 4)}</td>
                <td>{key.startsWith("relative_") ? "%" : key.startsWith("power_") ? "ADC count²" : "Ratio"}</td>
              </tr>)}</tbody>
            </table></div>
          </details>)}
          <Note>Demo signals illustrate the calculation pipeline. Band percentages and ratios describe signal content, not diagnoses. Personal baselines require matching recording conditions.</Note>
        </> : <Empty title="No demo cases available" text="Sign in to the account containing the past-week demo recordings to see calculated results." />}
      </Card>
      <div className="stats-grid three">
        <Stat
          label="Baseline versions"
          value={String(baselines.length)}
          detail="Frozen cohorts preserve provenance"
          icon={<HistoryIcon size={17} />}
        />
        <Stat
          label="Eligible sessions"
          value={String(eligible.length)}
          detail="Completed · at least 3 usable windows"
          icon={<Check size={17} />}
        />
        <Stat
          label="Current cohort"
          value={
            current
              ? `${current.session_ids.length} sessions`
              : "Not established"
          }
          detail={
            current
              ? `Created ${date(current.created_at)}`
              : "Select 3 or more comparable recordings"
          }
          icon={<Target size={17} />}
        />
      </div>
      <Card
        title={
          current
            ? "Create a new baseline version"
            : "Establish your personal baseline"
        }
        subtitle="Same eyes, task, electrode montage, and acquisition configuration"
      >
        {eligible.length ? (
          <>
            <div className="baseline-select">
              {eligible.map((s) => (
                <label className="checkbox-row" key={s.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(s.id)}
                    onChange={(e) =>
                      setIds(
                        e.target.checked
                          ? [...ids, s.id]
                          : ids.filter((id) => id !== s.id),
                      )
                    }
                  />
                  <span>
                    <strong>
                      {date(s.started_at)} · {s.context.task}
                    </strong>
                    <small>
                      Eyes {s.context.eyes} · {s.context.montage} ·{" "}
                      {s.valid_windows} usable windows
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="card-actions">
              <span className="muted">{ids.length} selected · minimum 3</span>
              <button
                className="primary"
                disabled={busy || ids.length < 3}
                onClick={() =>
                  void action(async () => {
                    setCalculationError("");
                    try {
                      const result = await post<Baseline>("/baselines", { session_ids: ids });
                      setCalculatedId(result.id);
                      setIds([]);
                      await refresh();
                      notify("Baseline calculated and saved.");
                      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                    } catch (error) {
                      setCalculationError((error as Error).message);
                    }
                  })
                }
              >
                <Fingerprint size={16} />
                {busy ? "Calculating…" : "Calculate baseline"}
              </button>
            </div>
            {calculationError && <div className="error" role="alert">{calculationError}</div>}
          </>
        ) : (
          <Empty
            title="A baseline needs your recordings"
            text="Collect at least three completed sessions, each with three usable eight-second windows. Keep recording conditions consistent."
          />
        )}
        <Note>
          Each session contributes one mean per feature. Three sessions is an
          engineering minimum, not validated clinical sufficiency.
          Demo cases with different conditions produce a demo comparison, not a personal reference for measured recordings.
        </Note>
      </Card>
      <div ref={resultRef}>
      {calculatedId && <p role="status">Baseline calculated successfully. Results are shown below.</p>}
      {baselines.map((b) => (
        <Card
          key={b.id}
          title={`${b.config.source === "demo" ? "Demo baseline" : "Baseline"} · ${date(b.created_at)}`}
          subtitle={`${b.session_ids.length} sessions · ${b.context.task} · eyes ${b.context.eyes} · ${b.context.montage}`}
        >
          <BaselineSummary baseline={b} />
          <details className="baseline-technical">
            <summary>View exact values and technical statistics</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Mean</th>
                  <th>Median</th>
                  <th>Sample SD</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(b.statistics).map(([key, s]) => (
                  <tr key={key}>
                    <td>{title(key)}</td>
                    <td>{number(s.mean, 4)}</td>
                    <td>{number(s.median, 4)}</td>
                    <td>{number(s.std, 4)}</td>
                    <td>{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </details>
        </Card>
      ))}
      </div>
    </>
  );
}
