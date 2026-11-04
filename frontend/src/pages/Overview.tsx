import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  BarChart2,
  Calendar,
  Bell,
  Layers,
  ScanLine,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { Recording, Baseline, Live, Point, User } from "../types";
import { Waveform } from "../charts";
import { date } from "../api";
import "./overview.css";

interface OverviewProps {
  liveAvailable: boolean;
  live: Live;
  points: Point[];
  sessions: Recording[];
  baselines: Baseline[];
  last?: Recording;
  navigate: (page: any) => void;
  choose: (id: string) => Promise<void>;
  user?: User;
  mriAvailable: boolean;
}

export function OverviewPage({
  liveAvailable,
  live,
  points,
  sessions,
  baselines,
  last,
  navigate,
  choose,
  mriAvailable,
}: OverviewProps) {
  const hasBands = Boolean(live.latest?.relative_power || last?.features.relative_alpha != null);

  // Calculate real or baseline frequency band percentages
  const bandValues = useMemo(() => {
    if (live.latest && live.latest.relative_power) {
      const rp = live.latest.relative_power;
      return {
        alpha: Math.round((rp.alpha ?? 0) * 100),
        beta: Math.round((rp.beta ?? 0) * 100),
        theta: Math.round((rp.theta ?? 0) * 100),
        delta: Math.round((rp.delta ?? 0) * 100),
      };
    }
    return Object.fromEntries(["alpha", "beta", "theta", "delta"].map(band => [band, Math.round((last?.features[`relative_${band}`] ?? 0) * 100)])) as Record<"alpha" | "beta" | "theta" | "delta", number>;
  }, [live.latest, last]);

  const handleOpenLast = () => {
    if (last) {
      void choose(last.id);
      navigate("Brainwaves");
    } else {
      navigate("History & reports");
    }
  };

  return (
    <div className="ref-overview-root">
      {/* 1. TOP HERO SECTION */}
      <section className="ref-hero-section">
        <div className="ref-hero-left">
          <span className="ref-hero-eyebrow">BRAIN HEALTH MONITORING</span>
          <h1 className="ref-hero-title">
            Your <span className="wine-text">brain,</span>
            <br />
            in perspective.
          </h1>
          <p className="ref-hero-sub">Real-time insights from EEG and MRI.</p>
        </div>

        <div className="ref-hero-right-actions">
          <button className="ref-bell-btn" title="Notifications" aria-label="Notifications" onClick={() => navigate("Notifications")}>
            <Bell size={18} />
            <span className="bell-dot" />
          </button>
          <button
            className="ref-new-recording-btn"
            onClick={() => navigate("Live EEG")}
          >
            <Activity size={16} />
            <span>New Recording</span>
          </button>
        </div>
      </section>

      {/* 2. FOUR STATUS METRIC PILLS */}
      <div className="ref-metrics-bar">
        {/* Card 1: EEG Status */}
        <div className="ref-metric-card">
          <div className="ref-metric-icon-wrap mint">
            <Activity size={20} className="icon-mint" />
          </div>
          <div className="ref-metric-data">
            <span className="ref-metric-label">EEG Status</span>
            <strong className="ref-metric-val">
              <span className={`status-dot ${liveAvailable ? "live" : "ready"}`} />
              {liveAvailable ? "Streaming" : "Ready"}
            </strong>
          </div>
        </div>

        {/* Card 2: MRI Analysis */}
        <div
          className="ref-metric-card clickable"
          onClick={() => navigate("MRI Analysis")}
          role="button"
          tabIndex={0}
        >
          <div className="ref-metric-icon-wrap mauve">
            <Brain size={20} className="icon-mauve" />
          </div>
          <div className="ref-metric-data">
            <span className="ref-metric-label">MRI Analysis</span>
            <strong className="ref-metric-val">
              <span className="status-dot ready" />
              {mriAvailable ? "Available" : "No scans"}
            </strong>
          </div>
        </div>

        {/* Card 3: Sessions */}
        <div
          className="ref-metric-card clickable"
          onClick={() => navigate("History & reports")}
          role="button"
          tabIndex={0}
        >
          <div className="ref-metric-icon-wrap amber">
            <BarChart2 size={20} className="icon-amber" />
          </div>
          <div className="ref-metric-data">
            <span className="ref-metric-label">Sessions</span>
            <strong className="ref-metric-num">{sessions.length}</strong>
          </div>
        </div>

        {/* Card 4: Last Recording */}
        <div
          className="ref-metric-card clickable"
          onClick={handleOpenLast}
          role="button"
          tabIndex={0}
        >
          <div className="ref-metric-icon-wrap blush">
            <Calendar size={20} className="icon-blush" />
          </div>
          <div className="ref-metric-data">
            <span className="ref-metric-label">Last Recording</span>
            <strong className="ref-metric-date">
              {last ? date(last.started_at) : "No recordings"}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. MIDDLE ROW: LIVE EEG & MRI ANALYSIS */}
      <div className="ref-two-col-grid">
        {/* Left: Live EEG */}
        <div className="ref-card">
          <div className="ref-card-header">
            <div className="ref-card-title-group">
              <h3>Live EEG</h3>
              <span className="ref-pill-badge green">
                <span className="pulse-mini" /> {liveAvailable ? "Streaming" : "Offline"}
              </span>
            </div>
            <div className="ref-timer-badge">
              {liveAvailable ? "Live signal" : "Device disconnected"}
            </div>
          </div>

          <div className="ref-eeg-waveform-container">
            {liveAvailable && points.length ? (
              <Waveform points={points} />
            ) : (
              <div className="overview-signal-empty">
                <Activity size={28} strokeWidth={1.5} />
                <strong>Connect an EEG device</strong>
                <span>Your live signal will appear here.</span>
              </div>
            )}
          </div>

          <div className="ref-eeg-bands-strip">
            <div className="band-stat">
              <span className="greek-alpha">α</span> <strong>{hasBands ? `${bandValues.alpha}%` : "—"}</strong>
            </div>
            <span className="stat-divider" />
            <div className="band-stat">
              <span className="greek-beta">β</span> <strong>{hasBands ? `${bandValues.beta}%` : "—"}</strong>
            </div>
            <span className="stat-divider" />
            <div className="band-stat">
              <span className="greek-theta">θ</span> <strong>{hasBands ? `${bandValues.theta}%` : "—"}</strong>
            </div>
            <span className="stat-divider" />
            <div className="band-stat">
              <span className="greek-delta">δ</span> <strong>{hasBands ? `${bandValues.delta}%` : "—"}</strong>
            </div>
          </div>
        </div>

        {/* Right: MRI Analysis */}
        <div className="ref-card">
          <div className="ref-card-header">
            <h3>MRI Analysis</h3>
          </div>

          <div className="ref-mri-content">
            <div className="overview-scan-placeholder"><ScanLine size={44} strokeWidth={1.25} /></div>

            <div className="ref-mri-info-pane">
              <span className="ref-pill-badge green">
                <ScanLine size={12} /> {mriAvailable ? "Analysis available" : "Ready for upload"}
              </span>
              <h4 className="ref-mri-scan-title">Brain Scan</h4>
              <span className="ref-mri-scan-sub">{mriAvailable ? "Review your uploaded scans" : "Upload a scan to begin"}</span>
              <button
                className="ref-outline-btn"
                onClick={() => navigate("MRI Analysis")}
              >
                {mriAvailable ? "View Analysis" : "Upload MRI"} <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. THIRD ROW: BRAINWAVE SUMMARY & MENTAL STATE */}
      <div className="ref-two-col-grid">
        {/* Left: Brainwave Summary */}
        <div className="ref-card">
          <div className="ref-card-header">
            <h3>Band power distribution</h3>
          </div>

          <div className="ref-brainwave-body">
            <div className="ref-donut-wrap">
              <svg viewBox="0 0 130 130" className="ref-donut-svg">
                <circle cx="65" cy="65" r="48" fill="none" stroke="#F0EBE6" strokeWidth="12" />
                {(["alpha", "beta", "theta", "delta"] as const).map((band, index, bands) => <circle
                  key={band} cx="65" cy="65" r="48" fill="none"
                  stroke={["#B96073", "#6D91B1", "#9180AC", "#719B85"][index]} strokeWidth="12"
                  strokeDasharray={`${bandValues[band] / 100 * 301.59} 301.59`}
                  strokeDashoffset={-bands.slice(0, index).reduce((sum, previous) => sum + bandValues[previous] / 100 * 301.59, 0)}
                />)}
              </svg>
              <div className="ref-donut-center">
                <strong>{hasBands ? `${bandValues.alpha}%` : "—"}</strong>
                <span>Alpha</span>
              </div>
            </div>

            <div className="ref-bands-progress-list">
              <div className="ref-progress-row">
                <div className="ref-prog-label">
                  <span className="color-dot coral" /> Alpha
                </div>
                <div className="ref-prog-track">
                  <div
                    className="ref-prog-fill coral"
                    style={{ width: `${hasBands ? `${bandValues.alpha}%` : "—"}` }}
                  />
                </div>
              </div>
              <div className="ref-progress-row">
                <div className="ref-prog-label">
                  <span className="color-dot blue" /> Beta
                </div>
                <div className="ref-prog-track">
                  <div
                    className="ref-prog-fill blue"
                    style={{ width: `${hasBands ? `${bandValues.beta}%` : "—"}` }}
                  />
                </div>
              </div>
              <div className="ref-progress-row">
                <div className="ref-prog-label">
                  <span className="color-dot purple" /> Theta
                </div>
                <div className="ref-prog-track">
                  <div
                    className="ref-prog-fill purple"
                    style={{ width: `${hasBands ? `${bandValues.theta}%` : "—"}` }}
                  />
                </div>
              </div>
              <div className="ref-progress-row">
                <div className="ref-prog-label">
                  <span className="color-dot mint" /> Delta
                </div>
                <div className="ref-prog-track">
                  <div
                    className="ref-prog-fill mint"
                    style={{ width: `${hasBands ? `${bandValues.delta}%` : "—"}` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Mental State */}
        <div className="ref-card">
          <div className="ref-card-header">
            <h3>Recording quality</h3>
          </div>

          <div className="ref-mental-state-banner">
            <div className="ref-lotus-icon-wrap">
              <Activity size={24} className="icon-lotus" />
            </div>
            <strong className="ref-mental-state-text">{last ? `${last.valid_windows} usable windows` : "No recording selected"}</strong>
          </div>
        </div>
      </div>

      <div className="ref-card">
        <div className="ref-card-header">
          <h3>Recent recordings</h3>
          <button className="ref-outline-btn" onClick={() => navigate("History & reports")}>View all <ArrowRight size={13} /></button>
        </div>
        {sessions.length ? <div className="table-scroll"><table>
          <thead><tr><th>Recorded</th><th>Activity</th><th>Alpha</th><th>Beta</th><th>Usable windows</th><th /></tr></thead>
          <tbody>{sessions.slice(0, 7).map(session => <tr key={session.id}>
            <td>{date(session.started_at)}</td>
            <td>{session.context.task}{session.config.source === "demo" && <small>Demo</small>}</td>
            <td>{session.features.relative_alpha == null ? "—" : `${Math.round(session.features.relative_alpha * 100)}%`}</td>
            <td>{session.features.relative_beta == null ? "—" : `${Math.round(session.features.relative_beta * 100)}%`}</td>
            <td>{session.valid_windows} / {session.valid_windows + session.invalid_windows}</td>
            <td><button className="table-link" onClick={() => { void choose(session.id); navigate("Brainwaves"); }}>View analysis</button></td>
          </tr>)}</tbody>
        </table></div> : <p>No recordings yet.</p>}
      </div>

      {/* 5. FOURTH ROW: QUICK TOOLS */}
      <div className="ref-quick-tools-section">
        <h3 className="ref-section-title">Quick Tools</h3>
        <div className="ref-tools-grid">
          <div
            className="ref-tool-card"
            onClick={() => navigate("Live EEG")}
            role="button"
            tabIndex={0}
          >
            <div className="ref-tool-icon">
              <BarChart2 size={24} />
            </div>
            <span>Run EEG</span>
          </div>

          <div
            className="ref-tool-card"
            onClick={() => navigate("MRI Analysis")}
            role="button"
            tabIndex={0}
          >
            <div className="ref-tool-icon">
              <ScanLine size={24} />
            </div>
            <span>Analyze MRI</span>
          </div>

          <div
            className="ref-tool-card"
            onClick={() => navigate("Baselines")}
            role="button"
            tabIndex={0}
          >
            <div className="ref-tool-icon">
              <Layers size={24} />
            </div>
            <span>Compare</span>
          </div>

          <div
            className="ref-tool-card"
            onClick={() => navigate("History & reports")}
            role="button"
            tabIndex={0}
          >
            <div className="ref-tool-icon">
              <FileText size={24} />
            </div>
            <span>View Reports</span>
          </div>
        </div>
      </div>

      {/* 6. FIFTH ROW: YOUR MONITORING JOURNEY */}
      <div className="ref-journey-card">
        <div className="ref-journey-info">
          <div className="ref-journey-icon">
            <TrendingUp size={20} />
          </div>
          <div>
            <h4>Your Monitoring Journey</h4>
            <p>Track your brain health over time.</p>
          </div>
        </div>

        <div className="ref-journey-stepper">
          <div className="ref-stepper-line" />
          <div className="ref-step-node completed">
            <div className="node-circle">
              <Check size={13} strokeWidth={2.5} />
            </div>
            <span>Record</span>
          </div>
          <div className="ref-step-node">
            <div className="node-circle" />
            <span>Analyze</span>
          </div>
          <div className={`ref-step-node ${baselines.length > 0 ? "completed" : ""}`}>
            <div className="node-circle">
              {baselines.length > 0 ? <Check size={13} strokeWidth={2.5} /> : null}
            </div>
            <span>Compare</span>
          </div>
          <div className="ref-step-node">
            <div className="node-circle" />
            <span>Track</span>
          </div>
        </div>
      </div>
    </div>
  );
}
