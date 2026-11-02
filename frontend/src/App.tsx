import { LandingPage } from "./pages/Landing";
import { DeviceSetup, RecordingControls } from "./pages/Acquisition";
import {
  BaselineComparison,
  SessionEvidence,
} from "./pages/SessionViews";
import { BaselinesPage } from "./pages/Baselines";
import { MRIPage } from "./pages/MRI";
import { HistoryPage } from "./pages/History";
import { InsightsPage } from "./pages/Insights";
import { OverviewPage } from "./pages/Overview";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Fingerprint,
  FlaskConical,
  History as HistoryIcon,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Radio,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import type { User, Recording, Baseline, Live, Point, MRI } from "./types";
import { api, post, date, number, title } from "./api";
import { BandChart, Spectrum, Waveform, colors } from "./charts";
import {
  Badge,
  Brand,
  Card,
  Empty,
  Note,
  SignalEmpty,
} from "./ui";

type Page =
  | "Overview"
  | "Live EEG"
  | "Brainwaves"
  | "Baselines"
  | "MRI Analysis"
  | "History & reports"
  | "AI Insights";
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Live EEG", icon: Activity },
  { name: "Brainwaves", icon: BarChart3 },
  { name: "Baselines", icon: Fingerprint },
  { name: "MRI Analysis", icon: ScanLine },
  { name: "History & reports", icon: HistoryIcon },
  { name: "AI Insights", icon: Sparkles },
] as const;
const descriptions: Record<Page, string> = {
  Overview: "A clearer view of your brain activity.",
  "Live EEG": "Acquire, inspect, and record your actual signal.",
  Brainwaves: "From signal to spectrum. Every calculation, traceable.",
  Baselines: "Your patterns. Your point of reference.",
  "MRI Analysis": "A separate perspective, through image classification.",
  "History & reports": "Your recordings, in context and over time.",
  "AI Insights": "Understand what your measurements can tell you.",
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [targetPage, setTargetPage] = useState<Page>("Overview");

  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="app-loading">
        <Brand />
        <Loader2 className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );

  if (showLanding) {
    return (
      <LandingPage
        authenticated={!!user}
        onEnter={(dest) => {
          if (dest) {
            setTargetPage(dest as Page);
          }
          setShowLanding(false);
        }}
      />
    );
  }

  return user ? (
    <Workspace
      user={user}
      initialPage={targetPage}
      onLogout={() => setUser(null)}
      onHome={() => setShowLanding(true)}
    />
  ) : (
    <Auth
      onLogin={setUser}
      onBack={() => setShowLanding(true)}
    />
  );
}
function Auth({ onLogin, onBack }: { onLogin: (u: User) => void; onBack?: () => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      onLogin(
        await post<User>(
          `/auth/${register ? "register" : "login"}`,
          Object.fromEntries(data),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand onClick={onBack} />
        <div className="auth-story-content">
          <span className="eyebrow light">PERSONAL BRAIN MONITORING</span>
          <h1>
            Understand your
            <br />
            own signal.
          </h1>
          <p>
            Real recordings. Individual baselines.
            <br />A thoughtful approach to brain activity.
          </p>
          <div className="brain-art" aria-hidden="true">
            <img
              src="/cortia/cortia-brain.webp"
              alt="CORTIA Brain"
              className="auth-brain-img"
            />
            <span className="orbit one" />
            <span className="orbit two" />
            <span className="art-label">CORTIA / RESEARCH WORKSPACE</span>
          </div>
        </div>
        <div className="auth-foot">
          <ShieldCheck size={17} /> Local storage. Private by design.
        </div>
      </section>
      <section className="auth-form">
        {onBack && (
          <button
            type="button"
            className="landing-skip-btn"
            onClick={onBack}
            style={{ marginBottom: 16, padding: "4px 8px" }}
          >
            ← Back to Home
          </button>
        )}
        <span className="eyebrow">YOUR RESEARCH WORKSPACE</span>
        <h2>
          {register ? "Start your personal record." : "Welcome to CORTIA."}
        </h2>
        <p>
          {register
            ? "Create an account on this computer."
            : "Sign in to your local monitoring workspace."}
        </p>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              name="username"
              required
              minLength={1}
              maxLength={128}
              autoComplete="username"
              placeholder="Your username or email"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={1}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="Enter your password"
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? <Loader2 className="spin" size={17} /> : null}
            {register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to CORTIA?"}{" "}
          <button
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create account"}
          </button>
        </p>
        <div className="auth-disclaimer">
          <FlaskConical size={18} />
          <span>
            Research and personal monitoring only.
            <br />
            Not a clinically validated diagnostic device.
          </span>
        </div>
      </section>
    </main>
  );
}
function Workspace({
  user,
  onLogout,
  initialPage,
  onHome,
}: {
  user: User;
  onLogout: () => void;
  initialPage?: Page;
  onHome?: () => void;
}) {
  const [page, setPage] = useState<Page>(initialPage || "Overview");

  useEffect(() => {
    if (initialPage) {
      setPage(initialPage);
    }
  }, [initialPage]);
  const [menu, setMenu] = useState(false);
  const [sessions, setSessions] = useState<Recording[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [mris, setMris] = useState<MRI[]>([]);
  const [selected, setSelected] = useState<Recording | null>(null);
  const [live, setLive] = useState<Live>({
    state: "disconnected",
    samples: [],
    recording_id: null,
    latest: null,
  });
  const [points, setPoints] = useState<Point[]>([]);
  const [wsOnline, setWsOnline] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  const refresh = useCallback(async () => {
    try {
      const [s, b, m] = await Promise.all([
        api<Recording[]>("/sessions"),
        api<Baseline[]>("/baselines"),
        api<MRI[]>("/mri/history"),
      ]);
      setSessions(s);
      setBaselines(b);
      setMris(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!live.recording_id) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [live.recording_id, refresh]);
  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    let streamId: number | null | undefined = undefined;
    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/live`,
      );
      socket.onopen = () => setWsOnline(true);
      socket.onmessage = (e) => {
        const value: Live = JSON.parse(e.data);
        setLive(value);
        if (value.state === "disconnected" || value.state === "busy") {
          setPoints([]);
          streamId = value.stream_id;
        } else if (value.stream_id !== streamId) {
          streamId = value.stream_id;
          setPoints(value.samples);
        } else if (value.samples.length)
          setPoints((current) => [...current, ...value.samples].slice(-2500));
      };
      socket.onclose = () => {
        setWsOnline(false);
        setPoints([]);
        setLive({
          state: "disconnected",
          samples: [],
          recording_id: null,
          latest: null,
          error: "Live stream unavailable. Reconnecting…",
        });
        if (!disposed) timer = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(id: string) {
    await action(async () => {
      setSelected(await api<Recording>(`/sessions/${id}`));
      setPage("Brainwaves");
    });
  }
  const last = sessions[0];
  const analysis = selected ? selected.latest_segment : live.latest;
  const navigate = (p: Page) => {
    setPage(p);
    setMenu(false);
    setError("");
  };
  const liveAvailable = !!live.live_available && wsOnline;
  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand onClick={onHome} />
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <span className="nav-label">MONITOR & UNDERSTAND</span>
        <nav>
          {nav.slice(0, 4).map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={18} />
              {name}
              {name === "Live EEG" && liveAvailable && (
                <span className="nav-live" />
              )}
            </button>
          ))}
          <span className="nav-label second">EXPLORE & REFLECT</span>
          {nav.slice(4).map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-card">
            <FlaskConical size={18} />
            <strong>Built around evidence.</strong>
            <p>
              Measurements first.
              <br />
              Interpretation with care.
            </p>
            <button onClick={() => navigate("AI Insights")}>
              Our approach <ArrowRight size={13} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.username}</strong>
              <span>Personal account</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await post("/auth/logout");
                  onLogout();
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={12} /> <strong>{page}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="local-label">
              <ShieldCheck size={14} />
              Local workspace
            </span>
            <span className={`server-dot ${wsOnline ? "ready" : ""}`} />
            <span className="server-label">
              {wsOnline ? "Backend connected" : "Reconnecting"}
            </span>
          </div>
        </header>
        <main className="content">
          {page !== "Overview" && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  CORTIA / {page.toUpperCase()}
                </span>
                <h1>{page}</h1>
                <p>{descriptions[page]}</p>
              </div>
              {page === "Brainwaves" && (
                <select
                  aria-label="Analysis source"
                  value={selected?.id || ""}
                  onChange={(e) => {
                    if (e.target.value) void choose(e.target.value);
                    else setSelected(null);
                  }}
                >
                  <option value="">Live analysis</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {date(s.started_at)} · {s.context.task}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {error && (
            <div className="error error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {live.error && page === "Live EEG" && (
            <div className="note amber">
              <CircleHelp size={16} />
              {live.error}
            </div>
          )}
          {loading ? (
            <div className="loading-panel">
              <Loader2 className="spin" />
              Loading your records…
            </div>
          ) : (
            <>
              {page === "Overview" && (
                <OverviewPage
                  liveAvailable={liveAvailable}
                  live={live}
                  points={points}
                  sessions={sessions}
                  baselines={baselines}
                  last={last}
                  navigate={navigate}
                  choose={choose}
                />
              )}
              {page === "Live EEG" && (
                <>
                  <div className="live-grid">
                    <Card
                      title="Acquisition setup"
                      subtitle="Documented Chords UNO-R4 protocol"
                    >
                      <DeviceSetup live={live} busy={busy} action={action} />
                    </Card>
                    <Card
                      title="Live waveform"
                      subtitle={
                        liveAvailable
                          ? `${live.config?.sampling_hz} samples/second · ADC counts`
                          : "Measured signals appear after hardware connection"
                      }
                      action={
                        <Badge tone={liveAvailable ? "green" : "neutral"}>
                          {liveAvailable ? "Live signal" : "Unavailable"}
                        </Badge>
                      }
                    >
                      {liveAvailable && points.length ? (
                        <Waveform points={points} />
                      ) : (
                        <SignalEmpty />
                      )}
                      <div className="live-info">
                        <span>
                          <Radio size={14} />
                          {liveAvailable
                            ? "Receiving hardware samples"
                            : "No hardware data"}
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {number(
                            (live.recording_samples || 0) /
                              (live.config?.sampling_hz || 500),
                            1,
                          )}{" "}
                          s recorded
                        </span>
                      </div>
                    </Card>
                  </div>
                  <div className="two-column">
                    <Card
                      title="Recording controls"
                      subtitle="Context makes recordings comparable"
                    >
                      <RecordingControls
                        live={live}
                        busy={busy}
                        action={action}
                        refresh={refresh}
                        notify={notify}
                      />
                    </Card>
                    <Card
                      title="Signal integrity"
                      subtitle="Quality checks use eight-second windows"
                    >
                      {liveAvailable && live.latest ? (
                        <>
                          <div className="quality-result">
                            <Badge
                              tone={
                                live.latest.quality.usable ? "green" : "amber"
                              }
                            >
                              {live.latest.quality.usable
                                ? "Passes configured checks"
                                : "Window excluded"}
                            </Badge>
                            <h3>
                              {live.latest.quality.usable
                                ? "Usable for exploratory analysis"
                                : "Signal needs review"}
                            </h3>
                            <p>
                              {live.latest.quality.reasons
                                .map(title)
                                .join(" · ") ||
                                "No flatline, clipping, abrupt-step or missing-sample flag in latest window."}
                            </p>
                          </div>
                          <Note>
                            Passing heuristics does not prove artifact-free EEG.
                            One channel cannot reliably separate brain, eye, and
                            muscle activity.
                          </Note>
                        </>
                      ) : (
                        <Empty
                          title="Quality assessment pending"
                          text="Connect hardware and collect an uninterrupted eight-second window."
                        />
                      )}
                    </Card>
                  </div>
                </>
              )}
              {page === "Brainwaves" && (
                <>
                  <div className="context-strip">
                    <Waves size={18} />
                    <span>
                      {selected
                        ? `Recorded session · ${date(selected.started_at)} · ${selected.context.eyes} eyes · ${selected.context.montage}`
                        : "Live analysis · latest complete eight-second window"}
                    </span>
                    <Badge>
                      {selected ? "Recorded data" : "Hardware data"}
                    </Badge>
                  </div>
                  {analysis && analysis.quality.usable ? (
                    <>
                      <div className="band-grid">
                        {Object.entries(analysis.power || {}).map(
                          ([band, value]) => (
                            <div className="band-card" key={band}>
                              <span style={{ color: colors[band] }}>
                                ● {title(band)}
                              </span>
                              <strong>
                                {number(
                                  (analysis.relative_power?.[band] || 0) * 100,
                                  1,
                                )}
                                <small>%</small>
                              </strong>
                              <p>
                                {number(value)} ADC² ·{" "}
                                {band === "delta"
                                  ? "0.5–4"
                                  : band === "theta"
                                    ? "4–8"
                                    : band === "alpha"
                                      ? "8–13"
                                      : "13–29.5"}{" "}
                                Hz
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                      <div className="two-column">
                        <Card
                          title="Power spectral density"
                          subtitle="Welch estimate · ADC²/Hz"
                        >
                          <Spectrum analysis={analysis} />
                        </Card>
                        <Card
                          title="Relative band power"
                          subtitle="Share of retained 0.5–29.5 Hz power"
                        >
                          <BandChart analysis={analysis} />
                        </Card>
                      </div>
                      <div className="ratio-grid">
                        {Object.entries(analysis.ratios || {}).map(
                          ([key, value]) => (
                            <Card key={key} title={title(key) + " ratio"}>
                              <div className="ratio-value">
                                {number(value)}
                                <Badge>Exploratory</Badge>
                              </div>
                              <p className="muted">
                                {value === null
                                  ? "Denominator too small for a stable ratio."
                                  : "Calculated band power ratio. No direct cognitive or diagnostic meaning."}
                              </p>
                            </Card>
                          ),
                        )}
                      </div>
                      <Card
                        title="FFT amplitude spectrum"
                        subtitle="Hann-windowed amplitude · ADC counts"
                      >
                        <Spectrum analysis={analysis} fft />
                      </Card>
                    </>
                  ) : (
                    <Card>
                      <Empty
                        title={
                          analysis
                            ? "Window excluded from interpretation"
                            : "No brainwave analysis available"
                        }
                        text={
                          analysis
                            ? `Quality flags: ${analysis.quality.reasons.map(title).join(", ")}. Raw samples remain preserved.`
                            : "Record a usable EEG window or choose a previous session."
                        }
                        action={
                          <button
                            className="secondary"
                            onClick={() => navigate("Live EEG")}
                          >
                            Open live monitor <ArrowRight size={16} />
                          </button>
                        }
                      />
                    </Card>
                  )}
                  {selected && (
                    <SessionEvidence
                      session={selected}
                      onWindow={(result) =>
                        setSelected((current) =>
                          current
                            ? { ...current, latest_segment: result }
                            : null,
                        )
                      }
                    />
                  )}
                  {selected?.baseline && (
                    <BaselineComparison comparison={selected.baseline} />
                  )}
                  <Note>
                    Beta stops at 29.5 Hz. Gamma unavailable. Results depend on
                    montage, task, eyes, hardware bandwidth, filtering, and
                    artifacts.
                  </Note>
                </>
              )}
              {page === "Baselines" && (
                <BaselinesPage
                  sessions={sessions}
                  baselines={baselines}
                  busy={busy}
                  action={action}
                  refresh={refresh}
                  notify={notify}
                />
              )}
              {page === "MRI Analysis" && (
                <MRIPage
                  mris={mris}
                  action={action}
                  busy={busy}
                  refresh={refresh}
                  notify={notify}
                />
              )}
              {page === "History & reports" && (
                <HistoryPage sessions={sessions} choose={choose} />
              )}
              {page === "AI Insights" && (
                <InsightsPage sessions={sessions} action={action} busy={busy} />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Waves size={13} /> CORTIA · Personal brain monitoring
            </span>
            <span>Measured with care. Interpreted with context.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
