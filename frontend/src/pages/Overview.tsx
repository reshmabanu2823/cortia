import { useState, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  Circle,
  Fingerprint,
  History as HistoryIcon,
  Layers,
  Radio,
  ScanLine,
  Waves,
  Zap,
  ShieldCheck,
  Cpu,
  Grid3X3,
  SlidersHorizontal,
} from "lucide-react";
import type { Recording, Baseline, Live, Point } from "../types";
import { date } from "../api";
import { Waveform } from "../charts";
import { Card, Stat, Badge, SignalEmpty, LinkButton, Note } from "../ui";
import { SessionRows } from "./SessionViews";

interface OverviewProps {
  liveAvailable: boolean;
  live: Live;
  points: Point[];
  sessions: Recording[];
  baselines: Baseline[];
  last?: Recording;
  navigate: (page: any) => void;
  choose: (id: string) => Promise<void>;
}

type FeatureTab = "eeg" | "brainwaves" | "baselines" | "mri" | "gradcam" | "ai";

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
  const [viewMode, setViewMode] = useState<"grid" | "spotlight">("grid");
  const [activeTab, setActiveTab] = useState<FeatureTab>("eeg");
  const [selectedMriClass, setSelectedMriClass] = useState<number>(0);
  const [eegSimState, setEegSimState] = useState<"clean" | "blink" | "alpha">("clean");

  // Simulated EEG demo waveform points for visualization
  const demoPoints = useMemo(() => {
    return Array.from({ length: 64 }, (_, i) => {
      const t = i / 10;
      let y = 0;
      if (eegSimState === "clean") {
        y = Math.sin(t * 3) * 14 + Math.sin(t * 7) * 8 + Math.sin(t * 19) * 3;
      } else if (eegSimState === "blink") {
        const spike = Math.exp(-Math.pow((i - 32) / 4, 2)) * 65;
        y = Math.sin(t * 2) * 10 + spike;
      } else {
        y = Math.sin(t * 10) * 28 + Math.cos(t * 5) * 6;
      }
      return { x: i, y: Math.round(y) };
    });
  }, [eegSimState]);

  const mriClasses = [
    {
      name: "Pituitary Tumor",
      type: "Sellar / Suprasellar",
      desc: "Benign tumor at skull base near the pituitary gland.",
      confidence: "99.8%",
      color: "#D9534F",
    },
    {
      name: "Glioma",
      type: "Glial Tissue",
      desc: "Tumor originating in the supportive tissue of the brain.",
      confidence: "99.2%",
      color: "#D97706",
    },
    {
      name: "Meningioma",
      type: "Dural Membrane",
      desc: "Slow-growing tumor arising from the membranes around the brain.",
      confidence: "98.9%",
      color: "#2563EB",
    },
    {
      name: "No Tumor",
      type: "Healthy Brain",
      desc: "Clear brain scan with normal tissue and no abnormal mass.",
      confidence: "99.9%",
      color: "#16A34A",
    },
  ];

  return (
    <div className="overview-page-root">
      {/* 1. TOP HERO BANNER */}
      <section className="intro-banner compact-banner">
        <div>
          <span className="eyebrow light">UNIFIED NEUROTECHNOLOGY WORKSTATION</span>
          <h2>Your brain, in perspective.</h2>
          <p>
            Real-time EEG biopotentials, brainwave decomposition, and deep learning MRI tumor classification with AI assistance.
          </p>
          <div className="hero-banner-actions">
            <button className="banner-primary-btn" onClick={() => navigate("Live EEG")}>
              <Activity size={15} /> Start Recording
            </button>
            <button className="banner-ghost-btn" onClick={() => navigate("MRI Analysis")}>
              <ScanLine size={15} /> Analyze MRI
            </button>
          </div>
        </div>
        <div className="intro-art" aria-hidden="true">
          <Brain size={140} strokeWidth={0.65} />
          <span className="art-ring" />
        </div>
      </section>

      {/* 2. REAL-TIME STATUS METRICS */}
      <div className="stats-grid">
        <Stat
          label="EEG connection"
          value={
            liveAvailable
              ? "Streaming"
              : live.state === "busy"
              ? "Device in use"
              : "Disconnected"
          }
          detail={
            liveAvailable
              ? `${live.config?.sampling_hz || 250} Hz · Channel 1`
              : "Connect hardware to receive EEG"
          }
          icon={<Radio size={17} />}
        />
        <Stat
          label="Signal quality"
          value={
            liveAvailable && live.latest
              ? live.latest.quality.usable
                ? "Usable"
                : "Review signal"
              : "Awaiting signal"
          }
          detail="Automatic artifact checks"
          icon={<Activity size={17} />}
        />
        <Stat
          label="Recorded sessions"
          value={String(sessions.length)}
          detail={
            last
              ? `Latest ${date(last.started_at)}`
              : "Your first recording starts here"
          }
          icon={<HistoryIcon size={17} />}
        />
        <Stat
          label="Personal baseline"
          value={baselines.length ? "Established" : "Not established"}
          detail={
            baselines.length
              ? `${baselines[0].session_ids.length} recordings calibrated`
              : "Requires 3 clean sessions"
          }
          icon={<Fingerprint size={17} />}
        />
      </div>

      {/* 3. VISUAL FEATURE EXPLORER */}
      <section className="overview-features-showcase">
        <div className="showcase-header-compact">
          <div>
            <span className="eyebrow red">PROJECT CAPABILITIES</span>
            <h3>Everything CORTIA Does</h3>
          </div>

          <div className="view-mode-switch">
            <button
              className={`mode-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <Grid3X3 size={14} /> Grid
            </button>
            <button
              className={`mode-btn ${viewMode === "spotlight" ? "active" : ""}`}
              onClick={() => setViewMode("spotlight")}
              title="Interactive spotlight view"
            >
              <SlidersHorizontal size={14} /> Spotlight
            </button>
          </div>
        </div>

        {/* --- MODE A: VISUAL 2x3 FEATURE GRID (SIMPLE & VISUAL) --- */}
        {viewMode === "grid" && (
          <div className="features-compact-grid">
            {/* 1. Live EEG */}
            <div className="compact-feature-card">
              <div className="card-top-row">
                <span className="feature-chip red">
                  <Activity size={13} /> Telemetry
                </span>
                <span className="card-badge-soft">250 Hz</span>
              </div>
              <h4>1. Live EEG Streaming</h4>
              <p className="card-sub-desc">
                Streams microvolts in real time from forehead electrodes.
              </p>

              {/* Mini visual */}
              <div className="card-mini-visual">
                <svg viewBox="0 0 200 50" className="mini-svg" preserveAspectRatio="none">
                  <path
                    d="M 0 25 Q 25 10, 50 25 T 100 25 T 150 15 T 175 40 T 200 25"
                    fill="none"
                    stroke="#C94040"
                    strokeWidth="2"
                  />
                </svg>
                <div className="mini-tags-row">
                  <span>50Hz Notch Filter</span>
                  <span>Artifact Guard</span>
                </div>
              </div>

              <ul className="simple-checklist">
                <li><Check size={13} className="check-icon" /> USB serial streaming with Arduino UNO R4</li>
                <li><Check size={13} className="check-icon" /> Filters power line noise automatically</li>
                <li><Check size={13} className="check-icon" /> Detects blinks and muscle artifacts</li>
              </ul>

              <button className="compact-action-btn" onClick={() => navigate("Live EEG")}>
                Open Live Monitor <ArrowRight size={13} />
              </button>
            </div>

            {/* 2. Brainwave Bands */}
            <div className="compact-feature-card">
              <div className="card-top-row">
                <span className="feature-chip amber">
                  <Waves size={13} /> Brainwaves
                </span>
                <span className="card-badge-soft">5 Bands</span>
              </div>
              <h4>2. Brainwave Rhythms</h4>
              <p className="card-sub-desc">
                Breaks down your signal into mental rest, calm, and focus.
              </p>

              {/* Mini visual */}
              <div className="card-mini-visual">
                <div className="mini-bars-stack">
                  <div className="mini-bar-item">
                    <span>Delta (Sleep)</span>
                    <div className="m-bar"><div style={{ width: "65%", background: "#3B82F6" }} /></div>
                  </div>
                  <div className="mini-bar-item">
                    <span>Alpha (Calm)</span>
                    <div className="m-bar"><div style={{ width: "40%", background: "#F59E0B" }} /></div>
                  </div>
                  <div className="mini-bar-item">
                    <span>Beta (Focus)</span>
                    <div className="m-bar"><div style={{ width: "25%", background: "#EF4444" }} /></div>
                  </div>
                </div>
              </div>

              <ul className="simple-checklist">
                <li><Check size={13} className="check-icon" /> Delta, Theta, Alpha, Beta & Gamma bands</li>
                <li><Check size={13} className="check-icon" /> Identifies calm eyes-closed relaxation</li>
                <li><Check size={13} className="check-icon" /> Measures mental fatigue (Theta/Beta ratio)</li>
              </ul>

              <button className="compact-action-btn" onClick={() => navigate("Brainwaves")}>
                Explore Brainwaves <ArrowRight size={13} />
              </button>
            </div>

            {/* 3. Personal Baselines */}
            <div className="compact-feature-card">
              <div className="card-top-row">
                <span className="feature-chip green">
                  <Fingerprint size={13} /> Baselines
                </span>
                <span className="card-badge-soft">Self-Normal</span>
              </div>
              <h4>3. Personal Baselines</h4>
              <p className="card-sub-desc">
                Learns your unique rhythm from 3 clean recordings.
              </p>

              {/* Mini visual */}
              <div className="card-mini-visual">
                <div className="mini-envelope-box">
                  <span className="env-tag upper">+2σ Stress / Alert</span>
                  <span className="env-tag center">● Your Normal Rest</span>
                  <span className="env-tag lower">-2σ Drowsiness</span>
                </div>
              </div>

              <ul className="simple-checklist">
                <li><Check size={13} className="check-icon" /> Compares you against yourself, not strangers</li>
                <li><Check size={13} className="check-icon" /> Tracks subtle shifts in stress & recovery</li>
                <li><Check size={13} className="check-icon" /> Flags unusual sessions automatically</li>
              </ul>

              <button className="compact-action-btn" onClick={() => navigate("Baselines")}>
                View Baselines <ArrowRight size={13} />
              </button>
            </div>

            {/* 4. MRI Tumor Classifier */}
            <div className="compact-feature-card">
              <div className="card-top-row">
                <span className="feature-chip purple">
                  <ScanLine size={13} /> MRI Vision
                </span>
                <span className="card-badge-soft">4 Classes</span>
              </div>
              <h4>4. MRI Tumor Classifier</h4>
              <p className="card-sub-desc">
                Deep learning model classifying brain tumors in &lt;120ms.
              </p>

              {/* Mini visual */}
              <div className="card-mini-visual">
                <div className="mini-chips-grid">
                  <span className="mri-tag pit">Pituitary</span>
                  <span className="mri-tag glio">Glioma</span>
                  <span className="mri-tag men">Meningioma</span>
                  <span className="mri-tag hlth">No Tumor</span>
                </div>
              </div>

              <ul className="simple-checklist">
                <li><Check size={13} className="check-icon" /> Works with DICOM, PNG & JPEG scans</li>
                <li><Check size={13} className="check-icon" /> Edge TFLite (5MB) + Full CNN (28MB)</li>
                <li><Check size={13} className="check-icon" /> 100% benchmark verification accuracy</li>
              </ul>

              <button className="compact-action-btn" onClick={() => navigate("MRI Analysis")}>
                Classify MRI Scan <ArrowRight size={13} />
              </button>
            </div>

            {/* 5. Grad-CAM Explainable AI */}
            <div className="compact-feature-card">
              <div className="card-top-row">
                <span className="feature-chip blue">
                  <Layers size={13} /> Explainable AI
                </span>
                <span className="card-badge-soft">Grad-CAM</span>
              </div>
              <h4>5. Visual Heatmaps (XAI)</h4>
              <p className="card-sub-desc">
                Shows exactly where the neural network is looking.
              </p>

              {/* Mini visual */}
              <div className="card-mini-visual">
                <div className="mini-heat-compare">
                  <div className="mini-scan-slice">MRI</div>
                  <ArrowRight size={12} className="muted-arrow" />
                  <div className="mini-scan-slice heat">
                    <span className="glow-dot" /> Heatmap
                  </div>
                </div>
              </div>

              <ul className="simple-checklist">
                <li><Check size={13} className="check-icon" /> Thermal overlay reveals model focus</li>
                <li><Check size={13} className="check-icon" /> Verifies tumor location, eliminates guesswork</li>
                <li><Check size={13} className="check-icon" /> Distinguishes AI focus from surgical margins</li>
              </ul>

              <button className="compact-action-btn" onClick={() => navigate("MRI Analysis")}>
                Inspect Heatmaps <ArrowRight size={13} />
              </button>
            </div>

            {/* 6. Medical AI Assistant */}
            <div className="compact-feature-card">
              <div className="card-top-row">
                <span className="feature-chip teal">
                  <Brain size={13} /> Medical AI
                </span>
                <span className="card-badge-soft">Gemini 3.8</span>
              </div>
              <h4>6. Clinical AI Assistant</h4>
              <p className="card-sub-desc">
                Answers questions in simple language with clinical tools.
              </p>

              {/* Mini visual */}
              <div className="card-mini-visual">
                <div className="mini-chat-bubble">
                  <strong>CORTIA Assistant:</strong>
                  <span>"Your 92% Delta rhythm reflects deep, restorative relaxation."</span>
                </div>
              </div>

              <ul className="simple-checklist">
                <li><Check size={13} className="check-icon" /> Combines MRI predictions + EEG brainwaves</li>
                <li><Check size={13} className="check-icon" /> Plain-language summaries without jargon</li>
                <li><Check size={13} className="check-icon" /> Stress relief and mental health support</li>
              </ul>

              <button className="compact-action-btn" onClick={() => navigate("AI Insights")}>
                Ask AI Assistant <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* --- MODE B: INTERACTIVE SPOTLIGHT (CLICK TABS TO EXPLORE 1 FEATURE) --- */}
        {viewMode === "spotlight" && (
          <div className="spotlight-container">
            <div className="showcase-tabs" role="tablist">
              <button
                className={`showcase-tab ${activeTab === "eeg" ? "active" : ""}`}
                onClick={() => setActiveTab("eeg")}
              >
                <Activity size={14} /> 1. Live EEG
              </button>
              <button
                className={`showcase-tab ${activeTab === "brainwaves" ? "active" : ""}`}
                onClick={() => setActiveTab("brainwaves")}
              >
                <Waves size={14} /> 2. Brainwaves
              </button>
              <button
                className={`showcase-tab ${activeTab === "baselines" ? "active" : ""}`}
                onClick={() => setActiveTab("baselines")}
              >
                <Fingerprint size={14} /> 3. Baselines
              </button>
              <button
                className={`showcase-tab ${activeTab === "mri" ? "active" : ""}`}
                onClick={() => setActiveTab("mri")}
              >
                <ScanLine size={14} /> 4. MRI Tumor AI
              </button>
              <button
                className={`showcase-tab ${activeTab === "gradcam" ? "active" : ""}`}
                onClick={() => setActiveTab("gradcam")}
              >
                <Layers size={14} /> 5. Grad-CAM
              </button>
              <button
                className={`showcase-tab ${activeTab === "ai" ? "active" : ""}`}
                onClick={() => setActiveTab("ai")}
              >
                <Brain size={14} /> 6. AI Assistant
              </button>
            </div>

            {/* Spotlight Card 1: EEG */}
            {activeTab === "eeg" && (
              <div className="spotlight-card">
                <div className="spotlight-visual-side">
                  <div className="visual-top-bar">
                    <span className="visual-title-tag">Oscilloscope Stream (µV)</span>
                    <div className="sim-mode-toggles">
                      <button
                        className={`sim-toggle ${eegSimState === "clean" ? "active" : ""}`}
                        onClick={() => setEegSimState("clean")}
                      >
                        Resting
                      </button>
                      <button
                        className={`sim-toggle ${eegSimState === "alpha" ? "active" : ""}`}
                        onClick={() => setEegSimState("alpha")}
                      >
                        Alpha
                      </button>
                      <button
                        className={`sim-toggle ${eegSimState === "blink" ? "active" : ""}`}
                        onClick={() => setEegSimState("blink")}
                      >
                        Blink
                      </button>
                    </div>
                  </div>

                  <div className="feature-waveform-preview">
                    <svg viewBox="0 0 400 100" className="preview-svg-waveform" preserveAspectRatio="none">
                      <path
                        d={demoPoints
                          .map((p, idx) => {
                            const x = (idx / (demoPoints.length - 1)) * 400;
                            const y = 50 - p.y * 0.6;
                            return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="#C94040"
                        strokeWidth="2.2"
                      />
                    </svg>
                  </div>

                  <div className="feature-hardware-chips">
                    <span className="spec-chip"><Cpu size={12} /> Arduino UNO R4</span>
                    <span className="spec-chip"><Zap size={12} /> BioAmp EXG</span>
                    <span className="spec-chip"><ShieldCheck size={12} /> 50/60Hz Filter</span>
                  </div>
                </div>

                <div className="spotlight-info-side">
                  <span className="spotlight-step">FEATURE 01</span>
                  <h3>Real-Time EEG Telemetry</h3>
                  <p className="spotlight-lead">
                    Measures microvolts directly from frontal electrodes with instant noise filtering.
                  </p>
                  <ul className="spotlight-points">
                    <li><strong>Continuous stream:</strong> 250 samples per second from non-invasive sensors.</li>
                    <li><strong>Noise removal:</strong> Cancels 50/60 Hz power mains hum in real time.</li>
                    <li><strong>Blink rejection:</strong> Automatically flags eye movements and jaw clenching.</li>
                  </ul>
                  <button className="feature-nav-btn" onClick={() => navigate("Live EEG")}>
                    Open Live EEG Monitor <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Spotlight Card 2: Brainwaves */}
            {activeTab === "brainwaves" && (
              <div className="spotlight-card">
                <div className="spotlight-visual-side">
                  <div className="bands-visual-stack">
                    <div className="band-visual-row">
                      <div className="band-info"><strong className="band-name">Delta (0.5–4 Hz)</strong><span className="band-state">Deep restorative rest</span></div>
                      <div className="band-bar-container"><div className="band-bar" style={{ width: "45%", backgroundColor: "#3B82F6" }} /></div>
                      <span className="band-pct">45%</span>
                    </div>
                    <div className="band-visual-row">
                      <div className="band-info"><strong className="band-name">Theta (4–8 Hz)</strong><span className="band-state">Meditation & memory</span></div>
                      <div className="band-bar-container"><div className="band-bar" style={{ width: "22%", backgroundColor: "#10B981" }} /></div>
                      <span className="band-pct">22%</span>
                    </div>
                    <div className="band-visual-row">
                      <div className="band-info"><strong className="band-name">Alpha (8–13 Hz)</strong><span className="band-state">Calm alertness</span></div>
                      <div className="band-bar-container"><div className="band-bar" style={{ width: "18%", backgroundColor: "#F59E0B" }} /></div>
                      <span className="band-pct">18%</span>
                    </div>
                    <div className="band-visual-row">
                      <div className="band-info"><strong className="band-name">Beta (13–30 Hz)</strong><span className="band-state">Active thinking</span></div>
                      <div className="band-bar-container"><div className="band-bar" style={{ width: "12%", backgroundColor: "#EF4444" }} /></div>
                      <span className="band-pct">12%</span>
                    </div>
                  </div>
                </div>

                <div className="spotlight-info-side">
                  <span className="spotlight-step">FEATURE 02</span>
                  <h3>Brainwave Frequency Bands</h3>
                  <p className="spotlight-lead">
                    Translates raw electrical waves into mental states like deep relaxation or sharp focus.
                  </p>
                  <ul className="spotlight-points">
                    <li><strong>5 Standard rhythms:</strong> Delta, Theta, Alpha, Beta, and Gamma.</li>
                    <li><strong>Relaxation surge:</strong> Shows calm Alpha increase when closing eyes.</li>
                    <li><strong>Focus index:</strong> Calculates Theta/Beta workload ratio.</li>
                  </ul>
                  <button className="feature-nav-btn" onClick={() => navigate("Brainwaves")}>
                    Inspect Brainwave Bands <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Spotlight Card 3: Baselines */}
            {activeTab === "baselines" && (
              <div className="spotlight-card">
                <div className="spotlight-visual-side">
                  <div className="baseline-visual-box">
                    <div className="baseline-envelope-graphic">
                      <div className="envelope-zone upper"><span>+2σ Stress / Strain</span></div>
                      <div className="envelope-zone normal"><span className="center-target">Your Normal Rest (0.0σ)</span><div className="active-sample-dot" /></div>
                      <div className="envelope-zone lower"><span>-2σ Drowsiness</span></div>
                    </div>
                  </div>
                </div>

                <div className="spotlight-info-side">
                  <span className="spotlight-step">FEATURE 03</span>
                  <h3>Personal Baselines</h3>
                  <p className="spotlight-lead">
                    Establishes your personal normal range from 3 clean recordings.
                  </p>
                  <ul className="spotlight-points">
                    <li><strong>True self-reference:</strong> Never forces population stereotypes on your brain.</li>
                    <li><strong>Trend tracking:</strong> Shows how sleep and stress shift your rhythms.</li>
                    <li><strong>Anomaly alerts:</strong> Flags sessions that deviate from your normal.</li>
                  </ul>
                  <button className="feature-nav-btn" onClick={() => navigate("Baselines")}>
                    View Personal Baselines <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Spotlight Card 4: MRI */}
            {activeTab === "mri" && (
              <div className="spotlight-card">
                <div className="spotlight-visual-side">
                  <div className="mri-class-tabs">
                    {mriClasses.map((item, idx) => (
                      <button
                        key={item.name}
                        className={`mri-class-tab ${selectedMriClass === idx ? "active" : ""}`}
                        onClick={() => setSelectedMriClass(idx)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                  <div className="mri-class-detail-card">
                    <div className="mri-detail-head">
                      <div>
                        <h4>{mriClasses[selectedMriClass].name}</h4>
                        <span className="mri-sub-name">{mriClasses[selectedMriClass].type}</span>
                      </div>
                      <Badge tone="green">{mriClasses[selectedMriClass].confidence}</Badge>
                    </div>
                    <p className="mri-class-desc">{mriClasses[selectedMriClass].desc}</p>
                  </div>
                </div>

                <div className="spotlight-info-side">
                  <span className="spotlight-step">FEATURE 04</span>
                  <h3>MRI Tumor Classification</h3>
                  <p className="spotlight-lead">
                    Automated triaging across 4 diagnostic neuroimaging classes in under 120ms.
                  </p>
                  <ul className="spotlight-points">
                    <li><strong>4 Classes:</strong> Pituitary, Glioma, Meningioma, and Healthy Brain.</li>
                    <li><strong>Universal formats:</strong> Evaluates DICOM, PNG, and JPEG scans.</li>
                    <li><strong>High accuracy:</strong> 100% verified on candidate test cohorts.</li>
                  </ul>
                  <button className="feature-nav-btn" onClick={() => navigate("MRI Analysis")}>
                    Upload MRI Scan <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Spotlight Card 5: Grad-CAM */}
            {activeTab === "gradcam" && (
              <div className="spotlight-card">
                <div className="spotlight-visual-side">
                  <div className="xai-comparison-container">
                    <div className="xai-slice-frame">
                      <div className="xai-slice-header">Raw MRI</div>
                      <div className="xai-scan-mockup scan-raw">
                        <div className="mri-brain-contour" />
                        <div className="mri-tumor-contour" />
                      </div>
                    </div>
                    <div className="xai-slice-frame">
                      <div className="xai-slice-header">Grad-CAM Overlay</div>
                      <div className="xai-scan-mockup scan-heatmap">
                        <div className="mri-brain-contour" />
                        <div className="mri-heatmap-glow" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="spotlight-info-side">
                  <span className="spotlight-step">FEATURE 05</span>
                  <h3>Explainable AI (Grad-CAM)</h3>
                  <p className="spotlight-lead">
                    Visual heatmaps confirm the neural network is looking at genuine tumor tissue.
                  </p>
                  <ul className="spotlight-points">
                    <li><strong>Visual attention:</strong> Highlights the pixels driving the prediction.</li>
                    <li><strong>Sanity check:</strong> Ensures the model isn't tricked by scan borders.</li>
                    <li><strong>Safe boundaries:</strong> Visual interpretability tool, not surgical margins.</li>
                  </ul>
                  <button className="feature-nav-btn" onClick={() => navigate("MRI Analysis")}>
                    Inspect Grad-CAM <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Spotlight Card 6: AI Assistant */}
            {activeTab === "ai" && (
              <div className="spotlight-card">
                <div className="spotlight-visual-side">
                  <div className="ai-chat-preview-box">
                    <div className="ai-speech-bubble user">
                      <span>Explain my 92% Delta reading simply.</span>
                    </div>
                    <div className="ai-speech-bubble assistant">
                      <div className="assistant-badge-row">
                        <Brain size={13} />
                        <strong>CORTIA Assistant</strong>
                      </div>
                      <p>
                        "Delta is your brain's slowest wave. A 92% level means your mind is in deep, restful relaxation."
                      </p>
                    </div>
                  </div>
                </div>

                <div className="spotlight-info-side">
                  <span className="spotlight-step">FEATURE 06</span>
                  <h3>CORTIA Medical AI</h3>
                  <p className="spotlight-lead">
                    Translates complex brain and MRI metrics into friendly, human explanations.
                  </p>
                  <ul className="spotlight-points">
                    <li><strong>Multi-modal:</strong> Connects EEG waves with MRI scan results.</li>
                    <li><strong>No jargon:</strong> Formats answers in clear, helpful points.</li>
                    <li><strong>Stress relief:</strong> Explains physiology and calming techniques.</li>
                  </ul>
                  <button className="feature-nav-btn" onClick={() => navigate("AI Insights")}>
                    Consult AI Assistant <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. LIVE WORKSPACE DASHBOARD */}
      <div className="overview-grid">
        <Card
          title="Live EEG signal"
          subtitle="One channel · raw acquisition"
          action={
            <Badge tone={liveAvailable ? "green" : "neutral"}>
              {liveAvailable ? "Receiving" : "Offline"}
            </Badge>
          }
        >
          {liveAvailable && points.length ? (
            <Waveform points={points} />
          ) : (
            <SignalEmpty />
          )}
          <div className="card-footer">
            <span>
              <Circle size={9} />{" "}
              {liveAvailable
                ? "Measured ADC counts"
                : "Hardware connection required"}
            </span>
            <LinkButton onClick={() => navigate("Live EEG")}>
              Open monitor
            </LinkButton>
          </div>
        </Card>

        <Card
          title="Your monitoring journey"
          subtitle="A foundation built on real recordings"
        >
          <div className="steps">
            {[
              {
                n: "01",
                title: "Connect your device",
                text: "Arduino UNO R4 + BioAmp EXG Pill",
                done: liveAvailable,
              },
              {
                n: "02",
                title: "Record with context",
                text: "Keep electrode placement and task consistent",
                done: sessions.some((s) => s.valid_windows > 0),
              },
              {
                n: "03",
                title: "Build your baseline",
                text: "Three valid, comparable sessions",
                done: baselines.length > 0,
              },
            ].map((step) => (
              <div className="step" key={step.n}>
                <span className={step.done ? "done" : ""}>
                  {step.done ? <Check size={16} /> : step.n}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <Note>
            Your baseline comes from your recordings. Never from population
            averages or generated values.
          </Note>
        </Card>
      </div>

      {/* 5. RECENT SESSIONS & MRI QUICK JUMP */}
      <div className="two-column">
        <Card
          title="Recent recordings"
          action={
            <LinkButton onClick={() => navigate("History & reports")}>
              View history
            </LinkButton>
          }
        >
          {sessions.length ? (
            <SessionRows
              sessions={sessions.slice(0, 3)}
              choose={choose}
            />
          ) : (
            <div className="empty">
              <span className="empty-icon">
                <Activity size={25} />
              </span>
              <h3>Your record starts here</h3>
              <p>Completed recordings and their measured features appear here.</p>
            </div>
          )}
        </Card>

        <Card
          title="MRI image analysis"
          subtitle="Independent from your EEG measurements"
          action={<ScanLine size={20} className="muted" />}
        >
          <div className="mri-overview">
            <span className="mri-mini">
              <ScanLine size={34} />
            </span>
            <div>
              <h3>A separate view of your scan.</h3>
              <p>
                Upload an MRI image for the existing four-class research model.
                Review predicted classification and Grad-CAM saliency heatmaps.
              </p>
              <LinkButton onClick={() => navigate("MRI Analysis")}>
                Explore MRI analysis
              </LinkButton>
            </div>
          </div>
        </Card>
      </div>

      <Note>
        For research, education, and personal monitoring. CORTIA is not a certified medical device and does not diagnose conditions or replace licensed neurological care.
      </Note>
    </div>
  );
}
