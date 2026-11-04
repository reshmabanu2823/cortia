import { useEffect, useRef } from "react";
import "./splash.css";

const letters = [
  ["C", "0.758%", "16.618%", "16.818%", "68.513%"],
  ["R", "42.576%", "17.784%", "15.682%", "66.181%"],
  ["T", "58.333%", "17.784%", "14.621%", "66.181%"],
  ["I", "74.394%", "17.784%", "4.394%", "66.181%"],
  ["A", "80%", "17.784%", "19.318%", "66.181%"],
];

export function Splash() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/splash/bootstrap.js";
    document.body.appendChild(script);
  }, []);

  return <div id="cortia-splash" className="cortia-splash-overlay">
    <button id="cortia-skip" className="cortia-skip-btn" type="button">Skip intro</button>
    <div className="cortia-stage"><div id="cortia-lockup" className="cortia-lockup"><div className="cortia-film">
      <img src="/splash/cortia-poster.jpg" alt="" />
      <video id="cortia-v" muted playsInline preload="auto" disablePictureInPicture aria-label="CORTIA introduction">
        <source src="/splash/cortia-reveal.mp4" type="video/mp4" />
        <source src="/splash/cortia-reveal.webm" type="video/webm" />
      </video>
    </div></div></div>
    <div className="cortia-final"><div id="cortia-fin" className="cortia-fin" role="img" aria-label="CORTIA">
      {letters.map(([letter, left, top, width, height]) => <img key={letter} className="l" data-l={letter} src={`/splash/f_${letter}.webp`} alt="" draggable={false} style={{ left, top, width, height }} />)}
      <img id="cortia-brain" className="brain" src="/splash/final-brain.webp" alt="" draggable={false} />
      <img id="cortia-flier" className="flier" src="/splash/cortia-brain.webp" alt="" draggable={false} />
    </div></div>
  </div>;
}
