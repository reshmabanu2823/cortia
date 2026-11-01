import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  BarChart2,
  Calendar,
  Bell,
  Sparkles,
  Layers,
  ScanLine,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { Recording, Baseline, Live, Point, User } from "../types";
import { Waveform } from "../charts";

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
}: OverviewProps) {
  const timerSeconds = 156; // 00:02:36 default display

  // Calculate real or baseline frequency band percentages
  const bandValues = useMemo(() => {
    if (live.latest && live.latest.relative_power) {
      const rp = live.latest.relative_power;
      return {
        alpha: Math.round((rp.alpha || 0.42) * 100),
        beta: Math.round((rp.beta || 0.24) * 100),
        theta: Math.round((rp.theta || 0.18) * 100),
        delta: Math.round((rp.delta || 0.16) * 100),
      };
    }
    return { alpha: 42, beta: 24, theta: 18, delta: 16 };
  }, [live.latest]);

  const handleOpenLast = () => {
    if (last) {
      void choose(last.id);
      navigate("Brainwaves");
    } else {
      navigate("History & reports");
    }
  };

  // Formatted timer mm:ss
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `00:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

        <div className="ref-hero-center-art" aria-hidden="true">
          <div className="art-orbit-ring" />
          <img
            src="/cortia/cortia-brain.webp"
            alt="CORTIA Brain"
            className="ref-hero-floating-brain"
          />
        </div>

        <div className="ref-hero-right-actions">
          <button className="ref-bell-btn" title="Notifications" aria-label="Notifications">
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
              Available
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
            <strong className="ref-metric-num">{sessions.length || 12}</strong>
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
              {last ? "Today" : "Today"}
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
                <span className="pulse-mini" /> {liveAvailable ? "Streaming" : "Recording"}
              </span>
            </div>
            <div className="ref-timer-badge">
              <span className="timer-rec-dot" /> {formatTimer(timerSeconds)}
            </div>
          </div>

          <div className="ref-eeg-waveform-container">
            {liveAvailable && points.length ? (
              <Waveform points={points} />
            ) : (
              <div className="ref-live-wave-mock">
                <svg viewBox="0 0 500 110" className="ref-eeg-svg" preserveAspectRatio="none">
                  <path
                    d="M 0 55 Q 15 35, 30 55 T 60 55 Q 75 18, 90 82 T 120 55 Q 140 40, 160 70 T 190 30 Q 210 92, 230 45 T 260 55 Q 280 22, 300 80 T 330 40 Q 360 75, 390 35 T 430 65 Q 460 30, 480 60 L 500 55"
                    fill="none"
                    stroke="#D45B6B"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="ref-waiting-text">Waiting for your signal</div>
              </div>
            )}
          </div>

          <div className="ref-eeg-bands-strip">
            <div className="band-stat">
              <span className="greek-alpha">α</span> <strong>{bandValues.alpha}%</strong>
            </div>
            <span className="stat-divider" />
            <div className="band-stat">
              <span className="greek-beta">β</span> <strong>{bandValues.beta}%</strong>
            </div>
            <span className="stat-divider" />
            <div className="band-stat">
              <span className="greek-theta">θ</span> <strong>{bandValues.theta}%</strong>
            </div>
            <span className="stat-divider" />
            <div className="band-stat">
              <span className="greek-delta">δ</span> <strong>{bandValues.delta}%</strong>
            </div>
          </div>
        </div>

        {/* Right: MRI Analysis */}
        <div className="ref-card">
          <div className="ref-card-header">
            <h3>MRI Analysis</h3>
          </div>

          <div className="ref-mri-content">
            <div className="ref-mri-thumb-box">
              <svg viewBox="0 0 140 140" className="ref-mri-svg" preserveAspectRatio="none">
                <rect width="140" height="140" rx="14" fill="#0C0A09" />
                <ellipse cx="70" cy="70" rx="52" ry="58" fill="#1C1917" stroke="#332E2B" strokeWidth="1.5" />
                <path d="M 50 45 Q 60 70, 52 95 Q 65 85, 70 70 Q 75 85, 88 95 Q 80 70, 90 45 Z" fill="#292524" />
                <ellipse cx="60" cy="68" rx="8" ry="16" fill="#000000" opacity="0.85" />
                <ellipse cx="80" cy="68" rx="8" ry="16" fill="#000000" opacity="0.85" />
                <ellipse cx="70" cy="72" rx="4" ry="8" fill="#44403C" />
                <path d="M 35 50 Q 50 55, 45 75 Q 35 90, 55 105" fill="none" stroke="#57534E" strokeWidth="1.2" opacity="0.6" />
                <path d="M 105 50 Q 90 55, 95 75 Q 105 90, 85 105" fill="none" stroke="#57534E" strokeWidth="1.2" opacity="0.6" />
              </svg>
            </div>

            <div className="ref-mri-info-pane">
              <span className="ref-pill-badge green">
                <Check size={12} /> Processed
              </span>
              <h4 className="ref-mri-scan-title">Brain Scan</h4>
              <span className="ref-mri-scan-sub">Report Ready</span>
              <button
                className="ref-outline-btn"
                onClick={() => navigate("MRI Analysis")}
              >
                View Analysis <ArrowRight size={13} />
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
            <h3>Brainwave Summary</h3>
          </div>

          <div className="ref-brainwave-body">
            <div className="ref-donut-wrap">
              <svg viewBox="0 0 130 130" className="ref-donut-svg">
                {/* Circumference = 2 * PI * 48 = 301.59 */}
                {/* Alpha 42% */}
                <circle
                  cx="65"
                  cy="65"
                  r="48"
                  fill="none"
                  stroke="#E26D7D"
                  strokeWidth="14"
                  strokeDasharray="126.6 301.6"
                  strokeDashoffset="0"
                />
                {/* Beta 24% */}
                <circle
                  cx="65"
                  cy="65"
                  r="48"
                  fill="none"
                  stroke="#5A9BE6"
                  strokeWidth="14"
                  strokeDasharray="72.3 301.6"
                  strokeDashoffset="-126.6"
                />
                {/* Theta 18% */}
                <circle
                  cx="65"
                  cy="65"
                  r="48"
                  fill="none"
                  stroke="#9B6EE6"
                  strokeWidth="14"
                  strokeDasharray="54.2 301.6"
                  strokeDashoffset="-198.9"
                />
                {/* Delta 16% */}
                <circle
                  cx="65"
                  cy="65"
                  r="48"
                  fill="none"
                  stroke="#48BB78"
                  strokeWidth="14"
                  strokeDasharray="48.2 301.6"
                  strokeDashoffset="-253.1"
                />
              </svg>
              <div className="ref-donut-center">
                <strong>{bandValues.alpha}%</strong>
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
                    style={{ width: `${bandValues.alpha}%` }}
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
                    style={{ width: `${bandValues.beta}%` }}
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
                    style={{ width: `${bandValues.theta}%` }}
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
                    style={{ width: `${bandValues.delta}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Mental State */}
        <div className="ref-card">
          <div className="ref-card-header">
            <h3>Mental State</h3>
          </div>

          <div className="ref-mental-state-banner">
            <div className="ref-lotus-icon-wrap">
              <Sparkles size={24} className="icon-lotus" />
            </div>
            <strong className="ref-mental-state-text">Calm & Focused</strong>
          </div>
        </div>
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
