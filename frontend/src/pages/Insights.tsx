import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  Send,
  Bot,
  User as UserIcon,
  BookOpen,
  Key,
  RotateCcw,
  ShieldCheck,
  Check,
  AlertTriangle,
  HeartPulse,
  Brain,
  Activity,
  PhoneCall,
  X,
  Moon,
  Zap,
  Smile,
  Coffee,
  BarChart2,
} from "lucide-react";
import type { Recording, Insight, Action } from "../types";
import { api, post, date } from "../api";
import { Card, Empty, Badge, Note } from "../ui";
import "./insights.css";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  provider?: string;
  created_at?: string;
  red_flags?: {
    has_red_flags: boolean;
    overall_urgency: string;
    flags: Array<{
      urgency: string;
      suspected_condition: string;
      immediate_action: string;
    }>;
  };
}

interface AIConfig {
  provider: string;
  model: string;
  configured: boolean;
  endpoint: string;
  supported_models: string[];
}

function renderInlineFormatted(text: string): (string | React.ReactNode)[] {
  const elements: (string | React.ReactNode)[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      elements.push(text.slice(lastIdx, match.index));
    }
    if (match[2]) {
      elements.push(
        <strong key={`b-${match.index}`} className="msg-strong">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      elements.push(
        <code key={`c-${match.index}`} className="msg-code">
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      elements.push(
        <em key={`i-${match.index}`} className="msg-em">
          {match[4]}
        </em>
      );
    }
    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    elements.push(text.slice(lastIdx));
  }
  return elements.length > 0 ? elements : [text];
}

interface FormattedBlock {
  type: "heading" | "bullet_list" | "numbered_list" | "paragraph" | "boundary_card";
  headingLevel?: number;
  stepNumber?: string;
  title?: string;
  items?: Array<{ prefix?: string; text: string }>;
  content?: string;
}

function FormattedContent({ content }: { content: string }) {
  if (!content) return null;

  // 1. Strip comment lines, horizontal dividers (---, ***), and raw annotations
  const lines = content
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => {
      const s = l.trim();
      if (!s) return true;
      if (/^(\-{3,}|\*{3,}|_{3,}|\- \- \-|\* \* \*)$/.test(s)) return false;
      if (s.startsWith("<!--") || s.endsWith("-->")) return false;
      if (/^#\s+(TODO|NOTE|comment|DEBUG)/i.test(s)) return false;
      return true;
    });

  const blocks: FormattedBlock[] = [];
  let currentBullets: Array<{ prefix?: string; text: string }> = [];
  let currentNumbered: Array<{ prefix?: string; text: string }> = [];

  const flushLists = () => {
    if (currentBullets.length > 0) {
      blocks.push({ type: "bullet_list", items: [...currentBullets] });
      currentBullets = [];
    }
    if (currentNumbered.length > 0) {
      blocks.push({ type: "numbered_list", items: [...currentNumbered] });
      currentNumbered = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushLists();
      continue;
    }

    // Heading: ### Title or ## Title
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushLists();
      const level = headingMatch[1].length;
      let rawTitle = headingMatch[2].trim();
      rawTitle = rawTitle.replace(/\*\*/g, "");

      const numMatch = rawTitle.match(/^(\d+)[\.\)]\s*(.+)$/);
      let stepNumber: string | undefined;
      let title = rawTitle;
      if (numMatch) {
        stepNumber = numMatch[1];
        title = numMatch[2];
      }

      const isCaution =
        /boundary|not represent|critical|warning|red flag|caution|limitation/i.test(title);

      if (isCaution) {
        blocks.push({
          type: "boundary_card",
          title,
          stepNumber,
        });
      } else {
        blocks.push({
          type: "heading",
          headingLevel: level,
          stepNumber,
          title,
        });
      }
      continue;
    }

    // Bullet item: * or -
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
    if (bulletMatch) {
      if (currentNumbered.length > 0) flushLists();
      const rawItem = bulletMatch[1].trim();
      const termMatch = rawItem.match(/^(\*\*[^*]+(?:\:|\*\*))\s*(.*)$/);
      if (termMatch) {
        const prefix = termMatch[1].replace(/\*\*/g, "").replace(/\:$/, "");
        const rest = termMatch[2];
        currentBullets.push({ prefix, text: rest });
      } else {
        currentBullets.push({ text: rawItem });
      }
      continue;
    }

    // Numbered item: 1. or 2)
    const numListMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numListMatch) {
      if (currentBullets.length > 0) flushLists();
      const step = numListMatch[1];
      const rawItem = numListMatch[2].trim();
      const termMatch = rawItem.match(/^(\*\*[^*]+(?:\:|\*\*))\s*(.*)$/);
      if (termMatch) {
        const prefix = termMatch[1].replace(/\*\*/g, "").replace(/\:$/, "");
        const rest = termMatch[2];
        currentNumbered.push({ prefix: `${step}. ${prefix}`, text: rest });
      } else {
        currentNumbered.push({ prefix: `${step}.`, text: rawItem });
      }
      continue;
    }

    // Regular line / paragraph
    flushLists();
    blocks.push({ type: "paragraph", content: trimmed });
  }

  flushLists();

  return (
    <div className="clean-formatted-response">
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          return (
            <div key={idx} className="clean-block-heading">
              {block.stepNumber ? (
                <div className="heading-with-step">
                  <span className="step-badge">{block.stepNumber}</span>
                  <h4 className="heading-text">{block.title}</h4>
                </div>
              ) : (
                <h4 className="heading-text-banner">{block.title}</h4>
              )}
            </div>
          );
        }

        if (block.type === "boundary_card") {
          return (
            <div key={idx} className="clean-boundary-card">
              <div className="boundary-card-header">
                <AlertTriangle size={15} className="boundary-icon" />
                <strong>{block.stepNumber ? `${block.stepNumber}. ` : ""}{block.title}</strong>
              </div>
            </div>
          );
        }

        if (block.type === "bullet_list") {
          return (
            <ul key={idx} className="clean-styled-list">
              {block.items?.map((item, itemIdx) => (
                <li key={itemIdx} className="clean-list-item">
                  <span className="clean-list-dot" />
                  <div className="clean-list-body">
                    {item.prefix && (
                      <strong className="item-prefix">{item.prefix}: </strong>
                    )}
                    <span className="item-text">{renderInlineFormatted(item.text)}</span>
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbered_list") {
          return (
            <ol key={idx} className="clean-styled-numbered-list">
              {block.items?.map((item, itemIdx) => (
                <li key={itemIdx} className="clean-num-item">
                  <span className="num-prefix-badge">{item.prefix}</span>
                  <span className="num-text">{renderInlineFormatted(item.text)}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={idx} className="clean-paragraph">
            {renderInlineFormatted(block.content || "")}
          </p>
        );
      })}
    </div>
  );
}

function SmoothResponse({ content, animate, onProgress }: { content: string; animate: boolean; onProgress: () => void }) {
  const [visible, setVisible] = useState(animate ? 0 : content.length);
  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(content.length);
      return;
    }
    setVisible(0);
    const boundaries = Array.from(content.matchAll(/\S+\s*/g), match => match.index! + match[0].length);
    const duration = Math.min(6000, Math.max(450, boundaries.length * 35));
    const started = performance.now();
    let frame = 0;
    let previous = -1;
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - started) / duration);
      const index = Math.min(boundaries.length - 1, Math.floor(fraction * boundaries.length));
      const next = fraction === 1 ? content.length : boundaries[index] ?? content.length;
      if (next !== previous) { setVisible(next); previous = next; }
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [content, animate]);
  useEffect(() => { onProgress(); }, [visible, onProgress]);
  return <div className={visible < content.length ? "response-revealing" : "response-complete"} aria-busy={visible < content.length}>
    <FormattedContent content={content.slice(0, visible)} />
  </div>;
}

const HEALTH_PROMPTS = [
  {
    category: "Stress & Mental Health",
    text: "I am feeling overwhelmed and stressed. Guide me through a somatic grounding exercise.",
  },
  {
    category: "Neurological Red Flags",
    text: "What are the critical stroke warning signs under the BE-FAST protocol?",
  },
  {
    category: "Brain MRI Classification",
    text: "Explain the difference between Meningioma and Glioma on brain MRI.",
  },
  {
    category: "Explainability & Grad-CAM",
    text: "How should Grad-CAM visual attention heatmaps be interpreted clinically?",
  },
  {
    category: "Sleep & Brain Health",
    text: "How does slow-wave sleep facilitate glymphatic waste clearance in the brain?",
  },
  {
    category: "EEG Electrophysiology",
    text: "What does my EEG Theta/Beta ratio indicate about cognitive alertness?",
  },
];

export function InsightsPage({
  sessions,
  action,
  busy,
}: {
  sessions: Recording[];
  action: Action;
  busy: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"assistant" | "explanations">("assistant");

  // AI Assistant Chat State
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showToolDrawer, setShowToolDrawer] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState(localStorage.getItem("cortia_gemini_key") || "");
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("cortia_gemini_model") || "antigravity/gemini-3.8-flash-high"
  );
  const [keySaved, setKeySaved] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const followResponse = useRef(true);
  const followConversation = useCallback(() => {
    const thread = threadRef.current;
    if (!thread || !followResponse.current) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);
  useEffect(() => {
    const content = threadRef.current?.querySelector('.chat-messages-list');
    if (!content) return;
    const observer = new ResizeObserver(followConversation);
    observer.observe(content);
    return () => observer.disconnect();
  }, [messages.length, followConversation]);

  // Health Tool States
  const [stressScore, setStressScore] = useState(10);
  const [stressResult, setStressResult] = useState<any>(null);
  const [tbrTheta, setTbrTheta] = useState(35.0);
  const [tbrBeta, setTbrBeta] = useState(15.0);
  const [tbrResult, setTbrResult] = useState<any>(null);
  const [redFlagText, setRedFlagText] = useState("");
  const [redFlagResult, setRedFlagResult] = useState<any>(null);

  // Recording Explanations State
  const [sid, setSid] = useState(sessions[0]?.id || "");
  const [external, setExternal] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);

  // Fetch AI Config on mount
  useEffect(() => {
    api<AIConfig>("/ai/config")
      .then((cfg) => {
        setAiConfig(cfg);
        if (cfg.model && !localStorage.getItem("cortia_gemini_model")) {
          setSelectedModel(cfg.model);
        }
      })
      .catch(() => null);
  }, []);

  // Fetch session explanations when sid changes
  useEffect(() => {
    let cancelled = false;
    setInsights([]);
    if (sid) {
      void action(async () => {
        const rows = await api<Insight[]>(`/sessions/${sid}/explanations`);
        if (!cancelled) setInsights(rows);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [sid]);

  // Scroll to bottom on new message
  useEffect(() => {
    followConversation();
  }, [messages, chatBusy, followConversation]);

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputQuery).trim();
    if (!text || chatBusy) return;
    followResponse.current = true;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setChatBusy(true);

    try {
      const payload: any = {
        message: text,
        conversation_id: convId,
        model: selectedModel,
      };
      if (customKey.trim()) {
        payload.api_key = customKey.trim();
      }

      const res = await post<{
        conversation_id: string;
        reply: string;
        provider: string;
        model: string;
        citations: string[];
        red_flags?: any;
        created_at: string;
      }>("/ai/chat", payload);

      setConvId(res.conversation_id);
      const asstMsg: ChatMessage = {
        role: "assistant",
        content: res.reply,
        citations: res.citations,
        provider: res.provider,
        red_flags: res.red_flags,
        created_at: res.created_at,
      };
      setMessages((prev) => [...prev, asstMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Error contacting AI consultation service: ${(e as Error).message}`,
        provider: "System Error",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatBusy(false);
    }
  }

  function handleSaveKey() {
    if (customKey.trim()) {
      localStorage.setItem("cortia_gemini_key", customKey.trim());
    } else {
      localStorage.removeItem("cortia_gemini_key");
    }
    localStorage.setItem("cortia_gemini_model", selectedModel);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  }

  function handleNewChat() {
    setMessages([]);
    setConvId(null);
  }

  async function handleRunStress() {
    try {
      const res = await post<any>("/ai/tools/stress", { score: stressScore, max_score: 16 });
      setStressResult(res);
    } catch (e) {
      setStressResult({ error: (e as Error).message });
    }
  }

  async function handleRunTbr() {
    try {
      const res = await post<any>("/ai/tools/tbr", { theta_pct: tbrTheta, beta_pct: tbrBeta });
      setTbrResult(res);
    } catch (e) {
      setTbrResult({ error: (e as Error).message });
    }
  }

  async function handleRunRedFlag() {
    if (!redFlagText.trim()) return;
    try {
      const res = await post<any>("/ai/tools/red-flags", { symptoms: redFlagText });
      setRedFlagResult(res);
    } catch (e) {
      setRedFlagResult({ error: (e as Error).message });
    }
  }

  return (
    <div className={`insights-view ${activeTab === "assistant" ? "assistant-mode" : ""}`}>
      {/* Top Banner */}
      <div className="insight-banner">
        <Sparkles size={25} />
        <div>
          <h2>CORTIA Assistant</h2>
          <p>
            Understand your EEG recordings, MRI results, and brain health questions.
          </p>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="assistant-tabs-nav">
        <button
          type="button"
          className={`assistant-tab-btn ${activeTab === "assistant" ? "active" : ""}`}
          onClick={() => setActiveTab("assistant")}
        >
          <Bot size={16} />
          Conversation
        </button>
        <button
          type="button"
          className={`assistant-tab-btn ${activeTab === "explanations" ? "active" : ""}`}
          onClick={() => setActiveTab("explanations")}
        >
          <BookOpen size={16} />
          Recording insights
        </button>
      </div>

      {/* TAB 1: GEMINI AI ASSISTANT */}
      {activeTab === "assistant" && (
        <div className="assistant-layout">
          {/* Quick Health Tools Toolbar */}
          <div className="health-tools-bar">
            <span className="health-tools-label">
              <HeartPulse size={15} />
              Clinical Health Tools:
            </span>
            <button
              type="button"
              className={`health-tool-btn ${showToolDrawer === "stress" ? "active" : ""}`}
              onClick={() => setShowToolDrawer(showToolDrawer === "stress" ? null : "stress")}
            >
              <HeartPulse size={13} />
              Stress Screener (PSS)
            </button>
            <button
              type="button"
              className={`health-tool-btn ${showToolDrawer === "tbr" ? "active" : ""}`}
              onClick={() => setShowToolDrawer(showToolDrawer === "tbr" ? null : "tbr")}
            >
              <Activity size={13} />
              Theta/Beta Ratio
            </button>
            <button
              type="button"
              className={`health-tool-btn ${showToolDrawer === "redflags" ? "active" : ""}`}
              onClick={() => setShowToolDrawer(showToolDrawer === "redflags" ? null : "redflags")}
            >
              <AlertTriangle size={13} />
              Neuro Red Flag Checker
            </button>
            <button
              type="button"
              className={`health-tool-btn ${showToolDrawer === "crisis" ? "active" : ""}`}
              onClick={() => setShowToolDrawer(showToolDrawer === "crisis" ? null : "crisis")}
            >
              <PhoneCall size={13} />
              24/7 Crisis Resources
            </button>
            <button
              type="button"
              className="health-tool-btn"
              onClick={() => handleSendMessage("Please review and summarize my latest brain MRI scan classification and Grad-CAM findings.")}
              title="Review latest patient MRI scan"
            >
              <Brain size={13} />
              Review Latest MRI
            </button>
            <button
              type="button"
              className="health-tool-btn"
              onClick={() => handleSendMessage("Please review and summarize my latest EEG recording session and frequency band power distribution.")}
              title="Review latest patient EEG recording"
            >
              <Activity size={13} />
              Review Latest EEG
            </button>
            <button
              type="button"
              className="health-tool-btn"
              onClick={() =>
                handleSendMessage(
                  "Please explain my latest recorded EEG session in simple everyday language. What do my sensed brainwaves mean for my focus, stress, and relaxation?"
                )
              }
              title="Translate EEG biopotentials into simple plain language"
            >
              <Sparkles size={13} />
              Plain-Language EEG Explainer
            </button>
          </div>

          {/* Tool Drawers */}
          {showToolDrawer === "stress" && (
            <div className="tool-drawer-panel">
              <div className="tool-drawer-header">
                <strong>Perceived Stress Scale (PSS-4) Clinical Calculator</strong>
                <button type="button" className="icon-button" onClick={() => setShowToolDrawer(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className="tool-drawer-body">
                <p className="muted" style={{ fontSize: "12px", marginBottom: "12px" }}>
                  The PSS measures perceived unpredictability, uncontrollability, and overload over the past month.
                </p>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    Your Score (0 to 16):
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={stressScore}
                      onChange={(e) => setStressScore(Number(e.target.value))}
                      style={{ width: "70px", padding: "6px" }}
                    />
                  </label>
                  <button type="button" className="primary" onClick={handleRunStress}>
                    Evaluate Stress
                  </button>
                </div>
                {stressResult && (
                  <div className="tool-result-box">
                    <Badge>{stressResult.category}</Badge>
                    <p style={{ margin: "8px 0", fontSize: "13px" }}>{stressResult.clinical_interpretation}</p>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#57524E" }}>
                      {stressResult.evidence_based_recommendations?.map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {showToolDrawer === "tbr" && (
            <div className="tool-drawer-panel">
              <div className="tool-drawer-header">
                <strong>Theta/Beta Ratio (TBR) Cognitive Arousal Calculator</strong>
                <button type="button" className="icon-button" onClick={() => setShowToolDrawer(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className="tool-drawer-body">
                <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    Theta Power %:
                    <input
                      type="number"
                      step="0.1"
                      value={tbrTheta}
                      onChange={(e) => setTbrTheta(Number(e.target.value))}
                      style={{ width: "80px", padding: "6px" }}
                    />
                  </label>
                  <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    Beta Power %:
                    <input
                      type="number"
                      step="0.1"
                      value={tbrBeta}
                      onChange={(e) => setTbrBeta(Number(e.target.value))}
                      style={{ width: "80px", padding: "6px" }}
                    />
                  </label>
                  <button type="button" className="primary" onClick={handleRunTbr}>
                    Compute Ratio
                  </button>
                </div>
                {tbrResult && (
                  <div className="tool-result-box">
                    <strong>Ratio: {tbrResult.theta_beta_ratio}</strong> &bull; <Badge>{tbrResult.cognitive_state}</Badge>
                    <p style={{ margin: "6px 0", fontSize: "12px" }}>{tbrResult.interpretation}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {showToolDrawer === "redflags" && (
            <div className="tool-drawer-panel">
              <div className="tool-drawer-header">
                <strong>Acute Neurological Red Flag Checker</strong>
                <button type="button" className="icon-button" onClick={() => setShowToolDrawer(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className="tool-drawer-body">
                <p className="muted" style={{ fontSize: "12px", marginBottom: "8px" }}>
                  Screens for emergency indicators: thunderclap headache, sudden weakness, slurred speech (BE-FAST), or severe meningismus.
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Describe acute symptoms (e.g., sudden facial droop, worst headache of life)..."
                    value={redFlagText}
                    onChange={(e) => setRedFlagText(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #E5E4DC" }}
                  />
                  <button type="button" className="primary" onClick={handleRunRedFlag}>
                    Check Symptoms
                  </button>
                </div>
                {redFlagResult && (
                  <div className="tool-result-box">
                    {redFlagResult.has_red_flags ? (
                      <div style={{ color: "#A83232" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}>
                          <AlertTriangle size={16} />
                          {redFlagResult.overall_urgency}: Medical Evaluation Required
                        </div>
                        {redFlagResult.flags.map((f: any, idx: number) => (
                          <div key={idx} style={{ marginTop: "6px", fontSize: "12px" }}>
                            <strong>{f.suspected_condition}</strong>: {f.immediate_action}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#3F775B", fontSize: "12px" }}>
                        <Check size={14} style={{ display: "inline", marginRight: "4px" }} />
                        {redFlagResult.message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showToolDrawer === "crisis" && (
            <div className="tool-drawer-panel" style={{ borderLeftColor: "#C94040" }}>
              <div className="tool-drawer-header">
                <strong>24/7 Mental Health Crisis Resources</strong>
                <button type="button" className="icon-button" onClick={() => setShowToolDrawer(null)}>
                  <X size={15} />
                </button>
              </div>
              <div className="tool-drawer-body" style={{ fontSize: "13px", lineHeight: "1.7" }}>
                <p style={{ margin: "0 0 8px 0" }}>
                  If you or someone you know is in crisis or experiencing unbearable emotional pain, free, confidential support is available 24/7:
                </p>
                <div>&bull; <strong>US &amp; Canada</strong>: Call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline) | Text <strong>HOME to 741741</strong></div>
                <div>&bull; <strong>United Kingdom</strong>: Call <strong>116 123</strong> (Samaritans) | NHS: Call <strong>111</strong></div>
                <div>&bull; <strong>India</strong>: Call <strong>14416</strong> or <strong>1800-891-4416</strong> (Tele-MANAS, Govt. of India)</div>
                <div>&bull; <strong>Emergency Everywhere</strong>: Dial local emergency services (<strong>911 / 112 / 999</strong>)</div>
              </div>
            </div>
          )}

          {/* Assistant Header Card */}
          <Card
            className="conversation-card"
            title="Your conversation"
            subtitle="Ask a question or explore your latest results."
            action={
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className="gemini-badge">
                  <Sparkles size={13} />
                  {aiConfig?.configured || customKey ? "Connected" : "Evidence mode"}
                </span>
                <button
                  type="button"
                  className="icon-button bordered"
                  title="Configure Gemini API Key & Model"
                  onClick={() => setShowConfig(!showConfig)}
                >
                  <Key size={14} />
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    className="icon-button bordered"
                    title="Start New Conversation"
                    onClick={handleNewChat}
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            }
          >
            {/* Optional Gemini Settings Bar */}
            {showConfig && (
              <div className="ai-config-drawer">
                <div className="config-row">
                  <label>
                    Gemini API Key
                    <input
                      type="password"
                      placeholder="Enter API Key (sk-... or Google AI Studio key)"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                    />
                  </label>
                  <label>
                    Model
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      <option value="antigravity/gemini-3.8-flash-high">antigravity/gemini-3.8-flash-high (Active)</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="primary"
                    style={{ alignSelf: "flex-end", padding: "10px 16px" }}
                    onClick={handleSaveKey}
                  >
                    {keySaved ? <Check size={14} /> : null}
                    {keySaved ? "Saved!" : "Save Key"}
                  </button>
                </div>
                <p className="muted" style={{ marginTop: "8px", fontSize: "11px" }}>
                  Active Endpoint: <code>{aiConfig?.endpoint || "http://127.0.0.1:5000/v1"}</code>.
                  Credentials are preserved locally and used directly for consultation requests.
                </p>
              </div>
            )}

            {/* Conversation Window */}
            <div className="chat-thread-container" ref={threadRef} onScroll={() => {
              const thread = threadRef.current;
              if (thread && !followResponse.current && thread.scrollHeight - thread.scrollTop - thread.clientHeight < 96) followResponse.current = true;
            }} onWheel={(event) => { if (event.deltaY < 0) followResponse.current = false; }}>
              {messages.length === 0 ? (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">
                    <img src="/cortia/cortia-lockup.png" alt="CORTIA" />
                  </div>
                  <h3>What would you like to understand?</h3>
                  <p>
                    Explore a recording, review an MRI result, or ask a brain health question.
                  </p>

                  <div className="starter-prompts-grid">
                    {HEALTH_PROMPTS.slice(0, 4).map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="starter-prompt-card"
                        onClick={() => handleSendMessage(item.text)}
                      >
                        <div>
                          <span className="starter-category">{item.category}</span>
                          <span className="starter-text">{item.text}</span>
                        </div>
                        <Send size={12} className="starter-send-icon" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="chat-messages-list">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`chat-bubble-row ${m.role === "user" ? "user-row" : "asst-row"}`}
                    >
                      <div className="bubble-avatar">
                        {m.role === "user" ? <UserIcon size={16} /> : <img src="/cortia/cortia-brain.webp" alt="CORTIA" />}
                      </div>
                      <div className="bubble-content">
                        <div className="bubble-header">
                          <strong>{m.role === "user" ? "You" : "CORTIA Medical AI"}</strong>
                          {m.provider && <span className="bubble-provider">{m.provider}</span>}
                        </div>

                        {/* Red Flag Warning Alert if present */}
                        {m.red_flags?.has_red_flags && (
                          <div className="chat-red-flag-alert">
                            <AlertTriangle size={16} />
                            <div>
                              <strong>CLINICAL EMERGENCY ADVISORY [{m.red_flags.overall_urgency}]:</strong>
                              {m.red_flags.flags.map((f: any, fIdx: number) => (
                                <div key={fIdx}>&bull; {f.suspected_condition} — <em>{f.immediate_action}</em></div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className={`bubble-text ${m.role === "assistant" ? "asst-bubble-body" : "user-bubble-body"}`}>
                          {m.role === "assistant" ? (
                            <SmoothResponse content={m.content} animate={idx === messages.length - 1 && m.provider !== "System Error" && !m.red_flags?.has_red_flags} onProgress={followConversation} />
                          ) : (
                            m.content
                          )}
                        </div>

                        {/* Citations block */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="bubble-citations">
                            <span className="citations-label">
                              <ShieldCheck size={12} />
                              Verified Scientific &amp; Clinical Sources:
                            </span>
                            <ul>
                              {m.citations.map((cite, cIdx) => (
                                <li key={cIdx}>{cite}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatBusy && (
                    <div className="chat-bubble-row asst-row">
                      <div className="bubble-avatar">
                        <img src="/cortia/cortia-brain.webp" alt="CORTIA" />
                      </div>
                      <div className="bubble-content">
                        <div className="bubble-thinking">
                          <Loader2 className="spin" size={16} />
                          <span>CORTIA is preparing a response…</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <form
              className="chat-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                aria-label="Message CORTIA"
                placeholder="Message CORTIA…"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={chatBusy}
              />
              <button
                type="submit"
                className="primary chat-send-btn"
                disabled={chatBusy || !inputQuery.trim()}
              >
                {chatBusy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                Send
              </button>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: EEG RECORDING EXPLANATIONS */}
      {activeTab === "explanations" && (
        <div className="explanations-layout">
          <Card
            title="Explain a recording"
            subtitle="Backend evidence summaries work without an external AI service"
          >
            {sessions.length ? (
              <div className="form-stack">
                <label>
                  Recording
                  <select value={sid} onChange={(e) => setSid(e.target.value)}>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {date(s.started_at)} · {s.context.task}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={external}
                    onChange={(e) => setExternal(e.target.checked)}
                  />
                  <span>
                    Use configured Gemini AI to select evidence statements
                    <small>
                      I consent to send curated metrics. No raw EEG, images, or account details are sent.
                    </small>
                  </span>
                </label>
                <button
                  className="primary fit"
                  disabled={busy || !sid}
                  onClick={() =>
                    void action(async () => {
                      const item = await post<Insight>(
                        `/sessions/${sid}/explanations`,
                        {
                          use_external_ai: external,
                          consent_to_send_metrics: external,
                        },
                      );
                      setInsights((rows) => [item, ...rows]);
                    })
                  }
                >
                  {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                  Generate explanation
                </button>
              </div>
            ) : (
              <Empty
                title="Measurements come first"
                text="Record EEG before requesting an explanation. No values or clinical findings are invented to fill this view."
              />
            )}
          </Card>

          {insights.map((i) => (
            <Card
              key={i.id}
              title={
                i.ai_generated
                  ? "AI-assisted evidence selection"
                  : "Verified evidence summary"
              }
              subtitle={`${date(i.created_at)} · ${i.provider}`}
              action={
                <Badge>
                  {i.ai_generated ? "AI assisted" : "Backend generated"}
                </Badge>
              }
            >
              {/* Human-Friendly Plain Language Translation Card */}
              {i.human_explanation && (
                <div className="human-eeg-card">
                  <div className="human-eeg-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <BarChart2 size={18} style={{ color: "#C94040" }} />
                      <strong style={{ fontSize: "15px", color: "#3D1519" }}>
                        {i.human_explanation.state_title}
                      </strong>
                    </div>
                    <Badge tone={i.human_explanation.state_badge_color === "success" ? "success" : undefined}>
                      {i.human_explanation.state_badge}
                    </Badge>
                  </div>

                  {/* Visual Brainwave Proportional Spectrum Bar */}
                  {i.human_explanation.band_breakdown && i.human_explanation.band_breakdown.length > 0 && (
                    <div className="visual-spectrum-container">
                      <div className="visual-spectrum-bar">
                        {i.human_explanation.band_breakdown.map((b: any, bIdx: number) =>
                          b.percentage > 0.5 ? (
                            <div
                              key={bIdx}
                              className="spectrum-slice"
                              style={{
                                width: `${Math.max(b.percentage, 3)}%`,
                                backgroundColor: b.color,
                              }}
                              title={`${b.name}: ${b.percentage}%`}
                            />
                          ) : null
                        )}
                      </div>
                      <div className="visual-spectrum-legend">
                        {i.human_explanation.band_breakdown.map((b: any, bIdx: number) => (
                          <div key={bIdx} className="legend-item">
                            <span className="legend-dot" style={{ backgroundColor: b.color }} />
                            <span className="legend-name">{b.name}</span>
                            <strong className="legend-pct">{b.percentage}%</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="human-eeg-summary">
                    {i.human_explanation.summary}
                  </p>

                  {/* Intuitive Visual State Cards */}
                  {i.human_explanation.band_breakdown && i.human_explanation.band_breakdown.length > 0 && (
                    <div className="human-bands-grid">
                      {i.human_explanation.band_breakdown.map((b: any, bIdx: number) => {
                        let IconComp = Smile;
                        if (b.technical_tag === "Delta") IconComp = Moon;
                        else if (b.technical_tag === "Beta") IconComp = Zap;
                        else if (b.technical_tag === "Theta") IconComp = Coffee;

                        return (
                          <div key={bIdx} className="human-band-item" style={{ borderTop: `3px solid ${b.color}` }}>
                            <div className="human-band-top">
                              <span className="human-band-name" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <IconComp size={14} style={{ color: b.color }} />
                                {b.name}
                              </span>
                              <span className="human-band-pct" style={{ color: b.color, fontSize: "15px", fontWeight: 700 }}>
                                {b.percentage}%
                              </span>
                            </div>
                            <span className="human-band-desc">{b.simple_desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Signal Quality & Helpful Tip Banner */}
                  <div className="human-eeg-quality-banner">
                    <div className="quality-pill">
                      <strong>Signal Stability: </strong>
                      <span>{i.human_explanation.signal_clarity}</span>
                    </div>
                    {i.human_explanation.tip && (
                      <div className="quality-tip">
                        💡 {i.human_explanation.tip}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsed Technical Verification Details */}
              <details className="technical-statements-collapse">
                <summary className="technical-statements-summary">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={14} />
                    View Statistical Audit &amp; Technical Statements ({i.statements.length})
                  </span>
                  <span className="expand-hint">Click to inspect</span>
                </summary>
                <div className="insight-statements" style={{ marginTop: "12px" }}>
                  {i.statements.map((s, index) => (
                    <p key={s}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {s}
                    </p>
                  ))}
                </div>
              </details>
              <details>
                <summary>Evidence provenance</summary>
                <p className="hash">Snapshot SHA-256: {i.evidence_digest}</p>
                <p className="muted">
                  Summaries preserve their original evidence snapshot. They may predate newer baseline versions.
                </p>
              </details>
            </Card>
          ))}
        </div>
      )}

      <Note>
        CORTIA AI Assistant and Evidence Protocols support clinical workflows and education.
        Grad-CAM visual attention overlays and single-channel biopotential telemetry are research and exploratory tools,
        not standalone diagnostic instruments. For acute emergencies (severe sudden headache, stroke signs, or crisis),
        contact emergency services (911/112) or call/text 988 immediately.
      </Note>
    </div>
  );
}
