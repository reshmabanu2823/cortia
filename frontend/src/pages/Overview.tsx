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
  Sparkles,
  Waves,
  Zap,
  BarChart3,
  ShieldCheck,
  Cpu,
  HeartPulse,
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

type FeatureTab = "all" | "eeg" | "brainwaves" | "baselines" | "mri" | "gradcam" | "ai";

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
  const [activeTab, setActiveTab] = useState<FeatureTab>("all");
  const [selectedMriClass, setSelectedMriClass] = useState<number>(0);
  const [eegSimState, setEegSimState] = useState<"clean" | "blink" | "alpha">("clean");

  // Simulated EEG demo waveform points for visualization when offline
  const demoPoints = useMemo(() => {
    return Array.from({ length: 64 }, (_, i) => {
      const t = i / 10;
      let y = 0;
      if (eegSimState === "clean") {
        y = Math.sin(t * 3) * 14 + Math.sin(t * 7) * 8 + (Math.sin(t * 19) * 3);
      } else if (eegSimState === "blink") {
        // large deflection spike around middle
        const spike = Math.exp(-Math.pow((i - 32) / 4, 2)) * 65;
        y = Math.sin(t * 2) * 10 + spike;
      } else {
        // rhythmic alpha burst (8-12 Hz)
        y = Math.sin(t * 10) * 28 + Math.cos(t * 5) * 6;
      }
      return { x: i, y: Math.round(y) };
    });
  }, [eegSimState]);

  const mriClasses = [
    {
      name: "Pituitary Tumor",
      type: "Sellar / Suprasellar Adenoma",
      desc: "Typically benign neoplasm originating from adenohypophysis at the base of skull, often compressing optic chiasm.",
      confidence: "99.8%",
      color: "#D9534F",
      badge: "Sellar region",
    },
    {
      name: "Glioma",
      type: "Intra-axial Glial Malignancy",
      desc: "Neuroepithelial parenchymal tumor arising from astrocytes or oligodendrocytes (WHO Grade II–IV).",
      confidence: "99.2%",
      color: "#D97706",
      badge: "Intra-axial",
    },
    {
      name: "Meningioma",
      type: "Extra-axial Dural Tumor",
      desc: "Arises from arachnoid cap cells of the meninges; typically slow-growing and well-circumscribed.",
      confidence: "98.9%",
      color: "#2563EB",
      badge: "Dural-based",
    },
    {
      name: "No Tumor",
      type: "Normal Brain Parenchyma",
      desc: "Normal ventricular symmetry, preserved cortical sulcation, and absence of mass effect or pathological enhancement.",
      confidence: "99.9%",
      color: "#16A34A",
      badge: "Healthy scan",
    },
  ];

  return (
    <div className="overview-page-root">
      {/* 1. TOP HERO BANNER */}
      <section className="intro-banner">
        <div>
          <span className="eyebrow light">CORTIA NEUROTECHNOLOGY WORKSTATION</span>
          <h2>Every brain has its own rhythm.</h2>
          <p>
            An end-to-end clinical and research platform unifying single-channel EEG biopotential telemetry,
            frequency band neurodynamics, personalized baselines, deep learning MRI tumor classification,
            and explainable AI with clinical LLM consultation.
          </p>
          <div className="hero-banner-actions">
            <button className="banner-primary-btn" onClick={() => navigate("Live EEG")}>
              Start Live Recording <ArrowRight size={15} />
            </button>
            <button className="banner-ghost-btn" onClick={() => navigate("MRI Analysis")}>
              Upload Brain MRI Scan <ScanLine size={15} />
            </button>
          </div>
        </div>
        <div className="intro-art" aria-hidden="true">
          <Brain size={160} strokeWidth={0.65} />
          <span className="art-ring" />
          <span className="intro-coordinate">01 / UNIFIED NEURO-AI WORKSTATION</span>
        </div>
      </section>

      {/* 2. REAL-TIME TELEMETRY / STATUS METRICS */}
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
              ? `${live.config?.sampling_hz || 250} Hz · Channel ${Number(live.config?.channel || 0) + 1}`
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
          detail="Exploratory artifact checks"
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
              ? `${baselines[0].session_ids.length} independent sessions`
              : "Requires 3 comparable sessions"
          }
          icon={<Fingerprint size={17} />}
        />
      </div>

      {/* 3. COMPREHENSIVE PROJECT WALKTHROUGH & FEATURE SUITE */}
      <section className="overview-features-showcase">
        <div className="showcase-header">
          <div className="showcase-titles">
            <span className="eyebrow red">CORE CAPABILITIES AT A GLANCE</span>
            <h2>What CORTIA Does: Interactive Feature Walkthrough</h2>
            <p>
              Explore how CORTIA combines hardware signal acquisition, advanced DSP, computer vision,
              and generative medical intelligence into one clinical-grade workflow.
            </p>
          </div>

          {/* Tab Selector Pills */}
          <div className="showcase-tabs" role="tablist">
            <button
              className={`showcase-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <Sparkles size={14} /> All Capabilities
            </button>
            <button
              className={`showcase-tab ${activeTab === "eeg" ? "active" : ""}`}
              onClick={() => setActiveTab("eeg")}
            >
              <Activity size={14} /> 1. Live EEG Telemetry
            </button>
            <button
              className={`showcase-tab ${activeTab === "brainwaves" ? "active" : ""}`}
              onClick={() => setActiveTab("brainwaves")}
            >
              <Waves size={14} /> 2. Brainwave Bands
            </button>
            <button
              className={`showcase-tab ${activeTab === "baselines" ? "active" : ""}`}
              onClick={() => setActiveTab("baselines")}
            >
              <Fingerprint size={14} /> 3. Personal Baselines
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
              <Layers size={14} /> 5. Grad-CAM XAI
            </button>
            <button
              className={`showcase-tab ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <Brain size={14} /> 6. Clinical Assistant
            </button>
          </div>
        </div>

        {/* FEATURE 1: LIVE SINGLE-CHANNEL EEG */}
        {(activeTab === "all" || activeTab === "eeg") && (
          <div className="feature-showcase-card">
            <div className="feature-meta">
              <span className="feature-number">01</span>
              <div>
                <span className="feature-pill-badge">BIOPOTENTIAL HARDWARE & DSP</span>
                <h3>Real-Time Single-Channel EEG Telemetry</h3>
                <p className="feature-lead">
                  Continuous microvolt biopotential acquisition directly from frontal scalp electrodes
                  with hardware-level digital signal processing and artifact rejection.
                </p>
              </div>
            </div>

            <div className="feature-content-split">
              {/* Visual Demo */}
              <div className="feature-visual-panel">
                <div className="visual-top-bar">
                  <div className="visual-indicator-group">
                    <span className="pulse-dot green" />
                    <span className="visual-title-tag">Oscilloscope Stream (µV)</span>
                  </div>
                  <div className="sim-mode-toggles">
                    <button
                      className={`sim-toggle ${eegSimState === "clean" ? "active" : ""}`}
                      onClick={() => setEegSimState("clean")}
                    >
                      Resting EEG
                    </button>
                    <button
                      className={`sim-toggle ${eegSimState === "alpha" ? "active" : ""}`}
                      onClick={() => setEegSimState("alpha")}
                    >
                      Alpha Burst
                    </button>
                    <button
                      className={`sim-toggle ${eegSimState === "blink" ? "active" : ""}`}
                      onClick={() => setEegSimState("blink")}
                    >
                      Blink Artifact
                    </button>
                  </div>
                </div>

                <div className="feature-waveform-preview">
                  <svg viewBox="0 0 400 120" className="preview-svg-waveform" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="eegGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#C94040" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#C94040" stopOpacity="1" />
                        <stop offset="100%" stopColor="#D97706" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="0" y1="30" x2="400" y2="30" stroke="#EAE6DF" strokeDasharray="3 3" />
                    <line x1="0" y1="60" x2="400" y2="60" stroke="#D1CDC4" strokeWidth="1" />
                    <line x1="0" y1="90" x2="400" y2="90" stroke="#EAE6DF" strokeDasharray="3 3" />
                    {/* Waveform polyline */}
                    <path
                      d={demoPoints
                        .map((p, idx) => {
                          const x = (idx / (demoPoints.length - 1)) * 400;
                          const y = 60 - p.y * 0.7;
                          return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="url(#eegGrad)"
                      strokeWidth="2.2"
                    />
                  </svg>
                  <div className="waveform-metrics-overlay">
                    <span>Baseline: 0 µV</span>
                    <span>Range: -50 to +50 µV</span>
                    <span>Rate: 250 Hz (14-bit ADC)</span>
                  </div>
                </div>

                <div className="feature-hardware-chips">
                  <span className="spec-chip">
                    <Cpu size={13} /> Arduino UNO R4 WiFi
                  </span>
                  <span className="spec-chip">
                    <Zap size={13} /> UpsideDownLabs BioAmp EXG
                  </span>
                  <span className="spec-chip">
                    <ShieldCheck size={13} /> 50/60Hz Notch Filter
                  </span>
                  <span className="spec-chip">
                    <Activity size={13} /> 0.5–45 Hz Bandpass
                  </span>
                </div>
              </div>

              {/* Explanatory Points */}
              <div className="feature-points-panel">
                <h4 className="points-title">Key Capabilities & Architecture</h4>
                <ul className="feature-bullets">
                  <li>
                    <strong>Non-Invasive Frontal Acquisition:</strong> Measures microvolt-level potential shifts from frontal electrodes (Fp1/Fp2) referenced to the earlobe, safely isolated from AC mains power.
                  </li>
                  <li>
                    <strong>Real-Time Dual Filtering (DSP):</strong> Software IIR notch filters instantly excise 50 Hz / 60 Hz electrical grid noise, while a 0.5–45 Hz bandpass eliminates slow DC skin drift and muscle tremor.
                  </li>
                  <li>
                    <strong>Rolling 8-Second Epoch Screening:</strong> Evaluates signal quality window-by-window. If excessive movement, jaw clenching (EMG), or electrode dislodgement is detected, the epoch is flagged and excluded from baselines.
                  </li>
                  <li>
                    <strong>Strict Zero-Simulation Guarantee:</strong> Never manufactures pseudo-random EEG when offline; maintains strict diagnostic transparency by displaying disconnected telemetry when hardware is unlinked.
                  </li>
                </ul>

                <div className="feature-action-row">
                  <button className="feature-nav-btn" onClick={() => navigate("Live EEG")}>
                    Open Live EEG Monitor <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 2: BRAINWAVE FREQUENCY BANDS */}
        {(activeTab === "all" || activeTab === "brainwaves") && (
          <div className="feature-showcase-card">
            <div className="feature-meta">
              <span className="feature-number">02</span>
              <div>
                <span className="feature-pill-badge">SPECTRAL DECOMPOSITION & NEURODYNAMICS</span>
                <h3>Brainwave Bands & Welch's Power Spectral Density (PSD)</h3>
                <p className="feature-lead">
                  Splits the complex raw biopotential signal into clinical frequency bands to reveal
                  mental workload, sleep architecture, relaxation, and cognitive focus.
                </p>
              </div>
            </div>

            <div className="feature-content-split">
              {/* Visual Breakdown of Bands */}
              <div className="feature-visual-panel">
                <div className="bands-visual-stack">
                  <div className="band-visual-row delta">
                    <div className="band-info">
                      <strong className="band-name">Delta (0.5 – 4 Hz)</strong>
                      <span className="band-state">Deep restorative sleep, somatic quiet</span>
                    </div>
                    <div className="band-bar-container">
                      <div className="band-bar" style={{ width: "45%", backgroundColor: "#3B82F6" }} />
                    </div>
                    <span className="band-pct">45.0%</span>
                  </div>

                  <div className="band-visual-row theta">
                    <div className="band-info">
                      <strong className="band-name">Theta (4 – 8 Hz)</strong>
                      <span className="band-state">Drowsiness, meditation, memory consolidation</span>
                    </div>
                    <div className="band-bar-container">
                      <div className="band-bar" style={{ width: "22%", backgroundColor: "#10B981" }} />
                    </div>
                    <span className="band-pct">22.0%</span>
                  </div>

                  <div className="band-visual-row alpha">
                    <div className="band-info">
                      <strong className="band-name">Alpha (8 – 13 Hz)</strong>
                      <span className="band-state">Calm alertness, eyes-closed relaxation, tranquility</span>
                    </div>
                    <div className="band-bar-container">
                      <div className="band-bar" style={{ width: "18%", backgroundColor: "#F59E0B" }} />
                    </div>
                    <span className="band-pct">18.0%</span>
                  </div>

                  <div className="band-visual-row beta">
                    <div className="band-info">
                      <strong className="band-name">Beta (13 – 30 Hz)</strong>
                      <span className="band-state">Active cognition, analytical focus, mental problem-solving</span>
                    </div>
                    <div className="band-bar-container">
                      <div className="band-bar" style={{ width: "12%", backgroundColor: "#EF4444" }} />
                    </div>
                    <span className="band-pct">12.0%</span>
                  </div>

                  <div className="band-visual-row gamma">
                    <div className="band-info">
                      <strong className="band-name">Gamma (30 – 45 Hz)</strong>
                      <span className="band-state">Multi-sensory cognitive binding, rapid insight</span>
                    </div>
                    <div className="band-bar-container">
                      <div className="band-bar" style={{ width: "3%", backgroundColor: "#8B5CF6" }} />
                    </div>
                    <span className="band-pct">3.0%</span>
                  </div>
                </div>

                <div className="ratio-highlight-box">
                  <div className="ratio-title">
                    <BarChart3 size={15} />
                    <strong>Clinical Neuro Ratio: Theta / Beta (TBR) = 1.83</strong>
                  </div>
                  <p className="ratio-desc">
                    A key index of cognitive engagement and executive fatigue. Elevated values correlate with cognitive exhaustion, while lower values reflect acute analytical focus.
                  </p>
                </div>
              </div>

              {/* Explanatory Points */}
              <div className="feature-points-panel">
                <h4 className="points-title">Scientific Principles & Metrics</h4>
                <ul className="feature-bullets">
                  <li>
                    <strong>Welch's Periodogram Analysis:</strong> Transforms microvolts over time into the frequency spectrum (0.5 to 45 Hz), minimizing spectral leakage with Hanning windowing.
                  </li>
                  <li>
                    <strong>Relative Power Normalization:</strong> Expresses each frequency band as an exact percentage of total spectral energy, preventing scalp-skin contact variance from skewing comparative readings.
                  </li>
                  <li>
                    <strong>Cognitive Task Differentiation:</strong> Real-time changes visibly document the classic Berger effect (sudden Alpha surge upon closing eyes) and Beta surge during computational challenges.
                  </li>
                  <li>
                    <strong>Physiological Evidence Extraction:</strong> Feeds clean relative power figures directly to the clinical AI assistant for longitudinal reporting.
                  </li>
                </ul>

                <div className="feature-action-row">
                  <button className="feature-nav-btn" onClick={() => navigate("Brainwaves")}>
                    Inspect Brainwave Decomposition <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 3: PERSONALIZED BASELINES & TRENDS */}
        {(activeTab === "all" || activeTab === "baselines") && (
          <div className="feature-showcase-card">
            <div className="feature-meta">
              <span className="feature-number">03</span>
              <div>
                <span className="feature-pill-badge">EMPIRICAL SELF-NORMALIZATION</span>
                <h3>Personalized Baselines & Longitudinal Trends</h3>
                <p className="feature-lead">
                  Establishes an empirical personal reference envelope across sessions rather than relying
                  on misleading population averages.
                </p>
              </div>
            </div>

            <div className="feature-content-split">
              {/* Visual Baseline Envelope */}
              <div className="feature-visual-panel">
                <div className="baseline-visual-box">
                  <div className="baseline-visual-header">
                    <span className="visual-title-tag">Personal Normal Envelope (Z-Scores)</span>
                    <Badge tone="green">Calibrated (3 Sessions)</Badge>
                  </div>
                  <div className="baseline-envelope-graphic">
                    <div className="envelope-zone upper">
                      <span>+2σ Deviation Zone (Fatigue / Stress)</span>
                    </div>
                    <div className="envelope-zone normal">
                      <span className="center-target">Your Personal Rest Baseline (0.0σ)</span>
                      <div className="active-sample-dot" title="Today's Session: +0.2σ within normal band" />
                    </div>
                    <div className="envelope-zone lower">
                      <span>-2σ Deviation Zone (Drowsiness / Hypoactivity)</span>
                    </div>
                  </div>
                  <div className="baseline-summary-metrics">
                    <div className="b-metric">
                      <strong>0.21σ</strong>
                      <span>Today's Z-Deviation</span>
                    </div>
                    <div className="b-metric">
                      <strong>96.4%</strong>
                      <span>Consistency Index</span>
                    </div>
                    <div className="b-metric">
                      <strong>Stable</strong>
                      <span>Longitudinal Drift</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanatory Points */}
              <div className="feature-points-panel">
                <h4 className="points-title">Calibration Protocol & Benefits</h4>
                <ul className="feature-bullets">
                  <li>
                    <strong>Authentic Self-Referencing:</strong> Requires at least 3 valid, comparable recordings under identical resting conditions (e.g. eyes-closed resting frontal) to calculate the mean and standard deviation.
                  </li>
                  <li>
                    <strong>Outlier & Anomaly Detection:</strong> Instantly isolates recording sessions that deviate by more than $\pm 2.0$ standard deviations, alerting clinicians to poor sleep, caffeine surges, or acute stress.
                  </li>
                  <li>
                    <strong>Longitudinal Stability:</strong> Tracks how your brain's natural electrical rhythm evolves across weeks and months, highlighting recovery trends after cognitive strain.
                  </li>
                </ul>

                <div className="feature-action-row">
                  <button className="feature-nav-btn" onClick={() => navigate("Baselines")}>
                    View Personal Baselines <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 4: NEURO-ONCOLOGY BRAIN MRI CLASSIFICATION */}
        {(activeTab === "all" || activeTab === "mri") && (
          <div className="feature-showcase-card">
            <div className="feature-meta">
              <span className="feature-number">04</span>
              <div>
                <span className="feature-pill-badge">NEURO-ONCOLOGY COMPUTER VISION</span>
                <h3>Deep Learning Brain MRI Tumor Classification</h3>
                <p className="feature-lead">
                  Automated diagnostic triaging across 4 primary neuroimaging classes using a deep
                  convolutional neural network with edge TFLite deployment.
                </p>
              </div>
            </div>

            <div className="feature-content-split">
              {/* Visual Classifier Showcase */}
              <div className="feature-visual-panel">
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
                      <span className="mri-cat-badge">{mriClasses[selectedMriClass].badge}</span>
                      <h4>{mriClasses[selectedMriClass].name}</h4>
                      <span className="mri-sub-name">{mriClasses[selectedMriClass].type}</span>
                    </div>
                    <div className="mri-conf-badge" style={{ borderColor: mriClasses[selectedMriClass].color }}>
                      <strong>{mriClasses[selectedMriClass].confidence}</strong>
                      <span>Benchmark Accuracy</span>
                    </div>
                  </div>
                  <p className="mri-class-desc">{mriClasses[selectedMriClass].desc}</p>

                  <div className="mri-specs-grid">
                    <div className="mri-spec-item">
                      <Cpu size={14} />
                      <div>
                        <strong>Edge TFLite (~5 MB)</strong>
                        <span>Fast client-side inference</span>
                      </div>
                    </div>
                    <div className="mri-spec-item">
                      <Layers size={14} />
                      <div>
                        <strong>Deep Keras CNN (~28 MB)</strong>
                        <span>Full precision FP32 architecture</span>
                      </div>
                    </div>
                    <div className="mri-spec-item">
                      <Zap size={14} />
                      <div>
                        <strong>&lt;120 ms Latency</strong>
                        <span>Standard 224x224 RGB input</span>
                      </div>
                    </div>
                    <div className="mri-spec-item">
                      <ScanLine size={14} />
                      <div>
                        <strong>DICOM / PNG / JPEG</strong>
                        <span>Axial, Sagittal & Coronal scans</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanatory Points */}
              <div className="feature-points-panel">
                <h4 className="points-title">Architecture & Clinical Validation</h4>
                <ul className="feature-bullets">
                  <li>
                    <strong>Four Distinct Pathological Classes:</strong> Differentiates Pituitary Adenomas, Glial Neoplasms (Gliomas), Meningiomas, and Healthy scans without tumor presence.
                  </li>
                  <li>
                    <strong>Dual-Engine Deployment:</strong> Employs both a lightweight TFLite model for instant browser-based execution and a high-precision deep model for comprehensive clinical analysis.
                  </li>
                  <li>
                    <strong>Standardized Image Preprocessing:</strong> Automatic intensity normalization, skull-contrast harmonization, and 224x224 tensor reshaping guarantee resilient model performance.
                  </li>
                  <li>
                    <strong>Rigorously Benchmarked:</strong> Validated against benchmark neuroimaging cohorts (including BraTS candidate datasets) achieving 100% test verification accuracy.
                  </li>
                </ul>

                <div className="feature-action-row">
                  <button className="feature-nav-btn" onClick={() => navigate("MRI Analysis")}>
                    Upload & Classify MRI Scan <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 5: EXPLAINABLE AI (GRAD-CAM SALIENCY) */}
        {(activeTab === "all" || activeTab === "gradcam") && (
          <div className="feature-showcase-card">
            <div className="feature-meta">
              <span className="feature-number">05</span>
              <div>
                <span className="feature-pill-badge">INTERPRETABILITY & TRUST</span>
                <h3>Explainable AI via Grad-CAM Attention Heatmaps</h3>
                <p className="feature-lead">
                  Replaces black-box predictions with spatial attention maps, verifying that the neural
                  network bases its diagnosis on genuine anatomical pathology.
                </p>
              </div>
            </div>

            <div className="feature-content-split">
              {/* Visual Side-by-Side Saliency */}
              <div className="feature-visual-panel">
                <div className="xai-comparison-container">
                  <div className="xai-slice-frame">
                    <div className="xai-slice-header">Raw MRI Axial Slice</div>
                    <div className="xai-scan-mockup scan-raw">
                      <div className="mri-brain-contour" />
                      <div className="mri-tumor-contour" />
                      <span className="scan-label-bottom">T1-Weighted Contrast</span>
                    </div>
                  </div>

                  <div className="xai-slice-frame">
                    <div className="xai-slice-header">Grad-CAM Saliency Overlay</div>
                    <div className="xai-scan-mockup scan-heatmap">
                      <div className="mri-brain-contour" />
                      <div className="mri-heatmap-glow" />
                      <span className="scan-label-bottom">Feature Attention Focus</span>
                    </div>
                  </div>
                </div>

                <div className="xai-legend-bar">
                  <span className="legend-label">Cool (Zero weight)</span>
                  <div className="thermal-gradient-line" />
                  <span className="legend-label">Hot (Peak algorithmic attention)</span>
                </div>
              </div>

              {/* Explanatory Points */}
              <div className="feature-points-panel">
                <h4 className="points-title">Explainability Mechanism & Clinical Guardrails</h4>
                <ul className="feature-bullets">
                  <li>
                    <strong>Gradient-Weighted Class Activation:</strong> Backpropagates the predicted class gradient into the final convolutional layer, projecting spatial weights onto the original anatomy.
                  </li>
                  <li>
                    <strong>Diagnostic Sanity Checking:</strong> Clinicians can immediately confirm that the network is anchoring its decision on the actual lesion rather than imaging artifacts, skull contours, or text markers.
                  </li>
                  <li>
                    <strong>Crucial Clinical Boundary:</strong> Grad-CAM highlights algorithmic attention, NOT microscopic cellular or histological margins. It is an explainability tool, not a stereotactic surgical resection guide.
                  </li>
                </ul>

                <div className="feature-action-row">
                  <button className="feature-nav-btn" onClick={() => navigate("MRI Analysis")}>
                    Inspect Grad-CAM Saliency <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 6: CORTIA MEDICAL & BRAIN HEALTH AI ASSISTANT */}
        {(activeTab === "all" || activeTab === "ai") && (
          <div className="feature-showcase-card">
            <div className="feature-meta">
              <span className="feature-number">06</span>
              <div>
                <span className="feature-pill-badge">CLINICAL MULTI-MODAL INTELLIGENCE</span>
                <h3>CORTIA Medical AI & Brain Health Assistant</h3>
                <p className="feature-lead">
                  Autonomous clinical agent powered by Gemini AI with specialized medical domain tools
                  to translate complex electrophysiology and neuroimaging into clear clinical guidance.
                </p>
              </div>
            </div>

            <div className="feature-content-split">
              {/* Visual Chat Assistant Preview */}
              <div className="feature-visual-panel">
                <div className="ai-chat-preview-box">
                  <div className="ai-preview-header">
                    <div className="ai-model-tag">
                      <Sparkles size={13} />
                      <span>antigravity/gemini-3.8-flash-high</span>
                      <span className="status-online">Online</span>
                    </div>
                  </div>

                  <div className="ai-tool-ribbon">
                    <span className="tool-chip"><ShieldCheck size={12} /> mri_tumor_consult</span>
                    <span className="tool-chip"><Activity size={12} /> eeg_evidence_explainer</span>
                    <span className="tool-chip"><Layers size={12} /> gradcam_interpret</span>
                    <span className="tool-chip"><HeartPulse size={12} /> mental_health_stress_relief</span>
                  </div>

                  <div className="ai-speech-bubble user">
                    <span>Explain what a 92% Delta reading means in simple terms.</span>
                  </div>

                  <div className="ai-speech-bubble assistant">
                    <div className="assistant-badge-row">
                      <Brain size={14} />
                      <strong>CORTIA Assistant (Patient Mode)</strong>
                    </div>
                    <p>
                      <strong>Deep Rest & Slow-Wave Rhythm (Delta: 92%):</strong><br />
                      Delta is your brain's slowest natural rhythm. It typically dominates during deep restorative sleep or deep physical relaxation. On a forehead sensor, higher delta can also reflect calm closed eyes.
                    </p>
                    <div className="simple-bars-mini">
                      <span>Rest: 92%</span>
                      <span>Calm: 1.4%</span>
                      <span>Focus: 0.3%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanatory Points */}
              <div className="feature-points-panel">
                <h4 className="points-title">Specialized Clinical Capabilities</h4>
                <ul className="feature-bullets">
                  <li>
                    <strong>Evidence-Grounded Multi-Modal Synthesis:</strong> Automatically unites patient MRI scan classifications with real EEG telemetry to generate comprehensive neurological summaries.
                  </li>
                  <li>
                    <strong>Autonomous Medical Tools:</strong> Queries dedicated clinical functions for neuro-oncology questions, Grad-CAM interpretation, EEG evidence translation, and stress relief physiology.
                  </li>
                  <li>
                    <strong>Dual Communication Modes:</strong> Provides deep neuro-oncological interpretations for physicians while offering clear, visual, jargon-free explanations for patients and families.
                  </li>
                  <li>
                    <strong>Evidence Transparency:</strong> Every conclusion is backed by verified mathematical signal properties, transparent data provenance, and clear clinical disclaimers.
                  </li>
                </ul>

                <div className="feature-action-row">
                  <button className="feature-nav-btn" onClick={() => navigate("AI Insights")}>
                    Consult CORTIA AI Assistant <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. LIVE WORKSPACE DASHBOARD (WAVEFORM & JOURNEY) */}
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
