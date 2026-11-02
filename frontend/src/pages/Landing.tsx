import {
  ScanLine,
  Activity,
  ArrowRight,
  BookOpen,
  ShieldCheck,
} from "lucide-react";

interface LandingProps {
  onEnter: (targetPage?: string) => void;
  authenticated: boolean;
}

export function LandingPage({ onEnter, authenticated }: LandingProps) {
  return (
    <div className="landing-root">
      {/* Top Header Controls */}
      <header className="landing-top-nav">
        <div className="landing-nav-brand">
          <img
            src="/cortia/cortia-brain.webp"
            alt="CORTIA"
            className="landing-mini-logo"
          />
          <span className="landing-brand-name">
            CORTIA<span className="landing-period">.</span>
          </span>
        </div>

        <div className="landing-nav-actions">
          <button
            type="button"
            onClick={() => onEnter()}
            className="landing-enter-btn"
          >
            {authenticated ? "Open Workspace" : "Enter Application"}
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="landing-container">
        {/* Blooming Brand Lockup & Hero */}
        <div className="landing-brand-hero bloomed">
          <div className="landing-lockup-wrapper" role="img" aria-label="Cortia">
            <img
              src="/cortia/cortia-lockup.png"
              alt="CORTIA"
              className="landing-lockup-img"
            />
          </div>

          <div className="landing-hero-text">
            <h1 className="landing-title">
              Neural Intelligence &amp; Clinical Workstation
            </h1>
            <p className="landing-description">
              A local-first research platform integrating deep learning cranial MRI
              tumor classification with Grad-CAM attention saliency and real-time single-channel EEG biopotential telemetry.
            </p>
          </div>

          {/* Dual Portal Workspaces */}
          <div className="landing-portals-grid">
            {/* MRI Portal */}
            <div
              className="landing-portal-card portal-mri"
              onClick={() => onEnter("MRI Analysis")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onEnter("MRI Analysis");
              }}
            >
              <div className="portal-card-top">
                <div className="portal-icon-box mri-badge">
                  <ScanLine size={24} />
                </div>
                <span className="portal-pill mri-pill">
                  4-Class Model Active
                </span>
              </div>
              <div className="portal-card-body">
                <h2 className="portal-card-title">MRI Diagnostic Classifier</h2>
                <p className="portal-card-desc">
                  Validated 4-class brain tumor classification with MobileNetV2,
                  transparent Grad-CAM saliency overlays, and downloadable JSON/image records.
                </p>
              </div>
              <div className="portal-cta mri-cta">
                <span>Launch MRI Workspace</span>
                <ArrowRight size={16} />
              </div>
            </div>

            {/* EEG Portal */}
            <div
              className="landing-portal-card portal-eeg"
              onClick={() => onEnter("Live EEG")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onEnter("Live EEG");
              }}
            >
              <div className="portal-card-top">
                <div className="portal-icon-box eeg-badge">
                  <Activity size={24} />
                </div>
                <span className="portal-pill eeg-pill">
                  Live Telemetry
                </span>
              </div>
              <div className="portal-card-body">
                <h2 className="portal-card-title">EEG Signal Intelligence</h2>
                <p className="portal-card-desc">
                  Chords UNO-R4 serial telemetry, fourth-order Butterworth SOS
                  filtering, Welch PSD spectral bands, and frozen personal baseline tracking.
                </p>
              </div>
              <div className="portal-cta eeg-cta">
                <span>Launch EEG Workspace</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </div>

          {/* Direct General Entry Bar */}
          <div className="landing-direct-action">
            <button
              type="button"
              className="landing-main-cta"
              onClick={() => onEnter()}
            >
              {authenticated ? "Enter Main Dashboard" : "Sign In or Register"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>

      {/* Footer Strip */}
      <footer className="landing-footer-strip">
        <div className="landing-status-indicator">
          <ShieldCheck size={14} className="status-shield" />
          <span>Core PACS Engine Active &bull; Single-Process Workstation &bull; 100% Local &amp; Private</span>
        </div>
        <div className="landing-footer-links">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-link"
          >
            <BookOpen size={13} />
            API Docs
          </a>
        </div>
      </footer>
    </div>
  );
}
