import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get } from "firebase/database";

/* ─────────────────────────────────────────────────────────────
   FIREBASE
───────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyA4ylsGv34UhkQJsxSWhmPx2eb5IPhI7SA",
  authDomain: "wtfacts-958c6.firebaseapp.com",
  databaseURL: "https://wtfacts-958c6-default-rtdb.firebaseio.com",
  projectId: "wtfacts-958c6",
  storageBucket: "wtfacts-958c6.firebasestorage.app",
  messagingSenderId: "504687472282",
  appId: "1:504687472282:web:d129a0ddb9b209f2c13923",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

function dbRef(code)       { return ref(db, `rooms/${code}`); }
function dbSet(code, val)  { return set(dbRef(code), val); }
function dbPatch(code, val){ return update(dbRef(code), val); }
function dbGet(code)       { return get(dbRef(code)).then(s => s.val()); }
function dbListen(code, fn){
  const unsub = onValue(dbRef(code), snap => fn(snap.val()));
  return unsub; // call to stop listening
}

/* ─────────────────────────────────────────────────────────────
   THEMES
───────────────────────────────────────────────────────────── */
const ADULT = {
  id: "adult",
  bg: "#0d0b0a", surface: "#181310", card: "#211c18", border: "#32261e",
  accent: "#e8360a", gold: "#ff8c2a", green: "#39d98a",
  text: "#f2ece6", muted: "#6e5e54", danger: "#cc2244",
  fontTitle: "'Bebas Neue', sans-serif",
  fontBody:  "'DM Sans', sans-serif",
  fontMono:  "'DM Mono', monospace",
  radius: "10px", emoji: "🔥",
};
const KIDS = {
  id: "kids",
  bg: "#fffaf2", surface: "#fff4e0", card: "#ffffff", border: "#ffd58a",
  accent: "#ff5c5c", gold: "#ffca2c", green: "#42c96e",
  text: "#1e1e1e", muted: "#b0a090", danger: "#ff4444",
  fontTitle: "'Fredoka One', cursive",
  fontBody:  "'Nunito', sans-serif",
  fontMono:  "'Nunito', sans-serif",
  radius: "20px", emoji: "🌈",
};

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const genCode   = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const fmtNum    = (n) => n == null ? "?" : Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });
const inviteUrl = (c) => `${location.origin}${location.pathname}?room=${c}`;

function avatarColor(name, t) {
  const h = [...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return t.id === "kids" ? `hsl(${h},60%,55%)` : `hsl(${h},40%,32%)`;
}

const inject = (css) => {
  let el = document.getElementById("wtf-style");
  if (!el) { el = document.createElement("style"); el.id = "wtf-style"; document.head.appendChild(el); }
  el.textContent = css;
};

function globalCSS(t) {
  const fonts = t.id === "kids"
    ? `@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');`
    : `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');`;
  return `
${fonts}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{background:${t.bg};color:${t.text};font-family:${t.fontBody};-webkit-tap-highlight-color:transparent}
input,button{font-family:${t.fontBody}}
button{cursor:pointer}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
input[type=number]{-moz-appearance:textfield}
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-thumb{background:${t.border};border-radius:2px}
@keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes pop{0%{transform:scale(0);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes bop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes flame{0%,100%{text-shadow:0 0 16px #e8360a,0 0 32px #ff7c2a}50%{text-shadow:0 0 28px #ff7c2a,0 0 56px #e8360a}}
@keyframes rainbow{0%{color:#ff5c5c}16%{color:#ffca2c}33%{color:#42c96e}50%{color:#4ecdc4}66%{color:#a29bfe}83%{color:#fd79a8}100%{color:#ff5c5c}}
@keyframes confettifall{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}
`;
}

/* ─────────────────────────────────────────────────────────────
   AI QUESTION
───────────────────────────────────────────────────────────── */
const SYS_ADULT = `Du bist Quizmaster von "WTFacts" — frech, witzig, für Erwachsene.
Generiere Fragen über echtes, verifiziertes aber absurdes Wissen. Antwort = immer eine Zahl.
Kategorien (abwechseln): Menschlicher Körper & Biologie (inkl. dezente Sexualität), Bizarre Weltrekorde, Tierreich (Fortpflanzung/Körper/Verhalten), Essen & Trinken, Geschichte & Kuriositäten, Astronomie & Physik, Absurde Preise/Mengen/Zahlen, Medizin & verrückte Studien.
Ton: locker, witzig, manchmal leicht anstößig. NUR echte Fakten. Antworte NUR mit reinem JSON, kein Markdown.`;

const SYS_KIDS = `Du bist Quizmaster von "WTFacts Kids" — bunt, fröhlich, für Kinder.
Generiere lustige, erstaunliche Fakten-Fragen. Antwort = immer eine Zahl.
Kategorien (abwechseln): Tiere, Weltraum & Planeten, Natur & Pflanzen, Sport & Rekorde, Essen & Lebensmittel, Geografie, Dinosaurier.
Kindgerecht, kein anstößiger Inhalt. Nur echte Fakten. Antworte NUR mit reinem JSON, kein Markdown.`;

const FB_ADULT = { question: "Wie lang war der längste jemals dokumentierte menschliche Bart in cm?", answer: 570, unit: "cm", hint: "Hans Langseth trug ihn ein Leben lang. Das Smithsonian bewahrt ihn bis heute.", topic: "Rekorde", emoji: "🧔" };
const FB_KIDS  = { question: "Wie viele Herzen hat ein Tintenfisch?", answer: 3, unit: "Herzen", hint: "Zwei davon pumpen Blut zu den Kiemen, eines zum Rest des Körpers.", topic: "Tiere", emoji: "🐙" };

async function generateQuestion(mode, usedTopics) {
  const avoid = usedTopics.length ? `Vermeide diese Themen: ${usedTopics.slice(-5).join(", ")}.` : "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: mode === "adult" ? SYS_ADULT : SYS_KIDS,
        messages: [{ role: "user", content: `Generiere eine Frage. ${avoid}\nJSON: {"question":"...","answer":42,"unit":"kg","hint":"...","topic":"...","emoji":"🔥"}` }],
      }),
    });
    const data = await res.json();
    const txt  = (data.content || []).find((b) => b.type === "text")?.text || "";
    const q    = JSON.parse(txt.trim());
    if (q.question && q.answer != null) return q;
    throw new Error("bad parse");
  } catch {
    return mode === "adult" ? FB_ADULT : FB_KIDS;
  }
}

/* ─────────────────────────────────────────────────────────────
   SCORE CALCULATION
───────────────────────────────────────────────────────────── */
function calcRound(room) {
  const q        = room.q;
  const order    = room.order || [];
  const guesses  = room.guesses || {};
  const bets     = room.bets || {};

  const ranked = order
    .filter((id) => guesses[id] != null)
    .map((id)    => ({ id, diff: Math.abs(guesses[id] - q.answer) }))
    .sort((a, b) => a.diff - b.diff);

  const closestId  = ranked[0]?.id;
  const farthestId = ranked[ranked.length - 1]?.id;
  const anyExact   = ranked.some((r) => r.diff === 0);

  const roundScores = {};
  order.forEach((id) => {
    let pts = 0;
    if (guesses[id] == null) { roundScores[id] = 0; return; }
    const diff = Math.abs(guesses[id] - q.answer);
    if (diff === 0) pts += 2;
    else if (!anyExact && id === closestId) pts += 1;
    const bet = bets[id] || {};
    if (bet.closest  === closestId)  pts += 1;
    if (bet.farthest === farthestId) pts += 1;
    roundScores[id] = pts;
  });

  const newScores = { ...room.scores };
  order.forEach((id) => { newScores[id] = (newScores[id] || 0) + (roundScores[id] || 0); });

  return { roundScores, newScores, closestId, farthestId };
}

/* ─────────────────────────────────────────────────────────────
   CONFETTI
───────────────────────────────────────────────────────────── */
function launchConfetti() {
  const cols = ["#ff5c5c","#ffca2c","#42c96e","#4ecdc4","#a29bfe","#fd79a8","#ff8c2a"];
  for (let i = 0; i < 65; i++) {
    const el = document.createElement("div");
    const sz = 6 + Math.random() * 9;
    el.style.cssText = `position:fixed;top:-12px;left:${Math.random()*100}vw;
      width:${sz}px;height:${sz}px;border-radius:2px;
      background:${cols[Math.floor(Math.random()*cols.length)]};
      animation:confettifall ${1.3+Math.random()*2}s ${Math.random()*.4}s linear forwards;
      pointer-events:none;z-index:9999;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

/* ─────────────────────────────────────────────────────────────
   DESIGN PRIMITIVES
───────────────────────────────────────────────────────────── */
const row = { display:"flex", alignItems:"center", gap:10 };
const col = { display:"flex", flexDirection:"column", gap:12 };
const page = { minHeight:"100vh", padding:"24px 16px", maxWidth:520, margin:"0 auto" };

function Spinner({ t }) {
  return <div style={{ width:28, height:28, border:`3px solid ${t.border}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto" }} />;
}

function Btn({ children, onClick, variant="primary", disabled, t, full, style:sx={} }) {
  const base = {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
    padding:"13px 22px", border:"none", borderRadius:t.radius,
    fontSize:15, fontWeight:700, letterSpacing:.3,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? .38 : 1,
    transition:"all .15s", width: full ? "100%" : undefined,
    WebkitTapHighlightColor:"transparent", userSelect:"none",
  };
  const variants = {
    primary:   { background:t.accent, color:"#fff" },
    secondary: { background:"transparent", color:t.text, border:`2px solid ${t.border}` },
    ghost:     { background:"transparent", color:t.muted },
  };
  return <button onClick={disabled ? undefined : onClick} style={{...base,...variants[variant],...sx}}>{children}</button>;
}

function Inp({ value, onChange, placeholder, type="text", t, autoFocus, style:sx={} }) {
  const [foc, setFoc] = useState(false);
  return (
    <input
      type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      inputMode={type === "number" ? "decimal" : undefined}
      onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
      style={{ width:"100%", padding:"13px 15px", background:t.surface,
        border:`2px solid ${foc ? t.accent : t.border}`, borderRadius:t.radius,
        color:t.text, fontSize:16, outline:"none", transition:"border-color .2s", ...sx }}
    />
  );
}

function Card({ children, t, glow, style:sx={} }) {
  return (
    <div style={{ background:t.card, border:`1.5px solid ${glow ? t.accent+"77" : t.border}`,
      borderRadius:t.radius, padding:20,
      boxShadow: glow ? `0 0 20px ${t.accent}18` : undefined, ...sx }}>
      {children}
    </div>
  );
}

function Pill({ children, color, t }) {
  const c = color || t.accent;
  return (
    <span style={{ display:"inline-block", padding:"3px 11px", borderRadius:100,
      fontSize:12, fontWeight:700, letterSpacing:.4, fontFamily:t.fontMono,
      background:c+"22", color:c, border:`1px solid ${c}44` }}>
      {children}
    </span>
  );
}

function Avatar({ name, t, size=36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%",
      background:avatarColor(name,t), color:"#fff",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*.42, fontWeight:800, flexShrink:0 }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function Logo({ t, size="lg" }) {
  const fs = size === "lg" ? "clamp(56px,13vw,88px)" : "40px";
  if (t.id === "adult") return (
    <div style={{ fontFamily:t.fontTitle, fontSize:fs, letterSpacing:3, lineHeight:1,
      color:t.accent, animation:"flame 2.5s ease infinite" }}>
      WTFacts
      {size === "lg" && <div style={{ fontFamily:t.fontBody, fontSize:12, letterSpacing:2.5, color:t.muted, marginTop:4 }}>FAKTEN. DIE DU NIE GEBRAUCHT HAST.</div>}
    </div>
  );
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontFamily:t.fontTitle, fontSize:fs, lineHeight:1.1, animation:"rainbow 3s linear infinite" }}>WTFacts</div>
      <div style={{ fontSize: size==="lg"?24:16, animation:"bop 1.2s ease infinite" }}>🌈✨</div>
    </div>
  );
}

function LoadingOverlay({ t, text }) {
  return (
    <div style={{ position:"fixed", inset:0, background:t.bg+"ee",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      gap:16, zIndex:999 }}>
      {t.id === "kids"
        ? <div style={{ fontSize:48, animation:"bop .6s ease infinite" }}>🤔</div>
        : <Spinner t={t} />}
      <p style={{ color:t.muted, fontSize:15 }}>{text}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN: HOME
───────────────────────────────────────────────────────────── */
function HomeScreen({ onHost, onJoin }) {
  const [tab,   setTab]   = useState(() => new URLSearchParams(location.search).get("room") ? "join" : "landing");
  const [name,  setName]  = useState("");
  const [code,  setCode]  = useState(() => new URLSearchParams(location.search).get("room") || "");
  const [mode,  setMode]  = useState("adult");
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);
  const t = mode === "kids" ? KIDS : ADULT;

  useEffect(() => { inject(globalCSS(tab === "landing" ? ADULT : t)); }, [t, tab]);

  async function submit() {
    if (!name.trim()) { setError("Bitte gib deinen Namen ein."); return; }
    setError("");
    if (tab === "host") {
      onHost(name.trim(), mode);
    } else {
      const c = code.trim().toUpperCase();
      if (!c) { setError("Bitte gib einen Raumcode ein."); return; }
      setBusy(true);
      const room = await dbGet(c);
      setBusy(false);
      if (!room) { setError("Raum nicht gefunden. Ist der Code richtig?"); return; }
      if (room.phase !== "lobby") { setError("Das Spiel läuft bereits."); return; }
      onJoin(c, name.trim(), room.mode);
    }
  }

  if (tab === "landing") {
    inject(globalCSS(ADULT));
    return (
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", padding:24,
        background:ADULT.bg, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(232,54,10,.18),transparent 65%)",
          top:-200, left:"50%", transform:"translateX(-50%)", filter:"blur(50px)", pointerEvents:"none" }} />
        <div style={{ textAlign:"center", maxWidth:460, width:"100%", position:"relative", animation:"fu .4s ease both" }}>
          <Logo t={ADULT} size="lg" />
          <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:44 }}>
            <Btn t={ADULT} onClick={() => { setTab("host"); setMode("adult"); }} style={{ minWidth:150 }}>Raum erstellen</Btn>
            <Btn t={ADULT} variant="secondary" onClick={() => setTab("join")} style={{ minWidth:150 }}>Beitreten</Btn>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginTop:36 }}>
            {["1–15 Spieler","KI-generiert","Echtzeit","Wetten"].map(x => <Pill key={x} t={ADULT} color={ADULT.muted}>{x}</Pill>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...page, background:t.bg, animation:"fu .3s ease both" }}>
      <Btn t={t} variant="ghost" onClick={() => { setTab("landing"); inject(globalCSS(ADULT)); }} style={{ marginBottom:18, padding:"8px 0" }}>← Zurück</Btn>
      <Logo t={t} size="sm" />
      <div style={{ marginTop:22 }} />

      {tab === "host" && (
        <Card t={t} style={{ marginBottom:12 }}>
          <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.8, marginBottom:12 }}>SPIELMODUS</p>
          <div style={{ display:"flex", gap:10 }}>
            {[{ id:"adult", icon:"🔥", label:"Erwachsene", sub:"Witzig · obszön" },
              { id:"kids",  icon:"🌈", label:"Kinder",     sub:"Bunt · sicher"  }].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                flex:1, padding:"14px 8px", borderRadius:t.radius,
                background: mode===m.id ? t.accent+"18" : t.surface,
                border:`2px solid ${mode===m.id ? t.accent : t.border}`,
                color: mode===m.id ? t.accent : t.muted,
                cursor:"pointer", transition:"all .2s", fontFamily:t.fontBody, textAlign:"center",
              }}>
                <div style={{ fontSize:22 }}>{m.icon}</div>
                <div style={{ fontWeight:800, fontSize:13, marginTop:3 }}>{m.label}</div>
                <div style={{ fontSize:11, color:t.muted, marginTop:2 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card t={t}>
        <div style={col}>
          <Inp value={name} onChange={setName} placeholder={t.id==="kids" ? "Dein Name 😊" : "Dein Name"} t={t} autoFocus />
          {tab === "join" && (
            <Inp value={code} onChange={v => setCode(v.toUpperCase())}
              placeholder="Raumcode (z.B. AB3XY)" t={t}
              style={{ letterSpacing:3, fontWeight:700, fontFamily:t.fontMono }} />
          )}
          {error && <p style={{ color:t.danger, fontSize:13 }}>{error}</p>}
          <Btn t={t} onClick={submit} disabled={busy} full>
            {busy ? "Suche Raum..." : tab==="host" ? `${t.emoji} Raum erstellen` : "Beitreten →"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN: LOBBY
───────────────────────────────────────────────────────────── */
function LobbyScreen({ room, code, myId, t, onStart }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myId;
  const pl = (room.order || []).map(id => room.players?.[id]).filter(Boolean);

  function copy() {
    navigator.clipboard.writeText(inviteUrl(code))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div style={{ ...page, animation:"fu .3s ease both" }}>
      <Logo t={t} size="sm" />
      <div style={{ marginTop:18, marginBottom:6 }}>
        <Pill t={t} color={t.green}>{t.id==="kids" ? "🎈 LOBBY" : "LOBBY"}</Pill>
      </div>
      <h2 style={{ fontFamily:t.fontTitle, fontSize:t.id==="kids"?34:40, marginBottom:6 }}>
        {t.id==="kids" ? "Warte auf alle!" : "Warte auf Mitspieler"}
      </h2>

      <div style={{ ...row, marginBottom:22 }}>
        <span style={{ fontFamily:t.fontMono, fontSize:28, letterSpacing:5, color:t.accent, fontWeight:800 }}>{code}</span>
        <Btn t={t} variant="secondary" onClick={copy} style={{ padding:"7px 13px", fontSize:13 }}>
          {copied ? "✓ Kopiert!" : "📋 Link"}
        </Btn>
      </div>

      <Card t={t} style={{ marginBottom:14 }}>
        <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.7, marginBottom:12 }}>
          SPIELER ({pl.length}/15)
        </p>
        <div style={col}>
          {pl.map(p => (
            <div key={p.id} style={{ ...row, padding:"10px 12px", background:t.surface,
              borderRadius:t.radius, border:`1.5px solid ${p.id===myId ? t.accent+"55" : t.border}` }}>
              <Avatar name={p.name} t={t} />
              <span style={{ flex:1, fontWeight:600 }}>{p.name}</span>
              {p.id === room.hostId && <Pill t={t} color={t.gold}>HOST</Pill>}
              {p.id === myId && p.id !== room.hostId && <Pill t={t}>DU</Pill>}
            </div>
          ))}
        </div>
      </Card>

      {isHost
        ? <Btn t={t} onClick={onStart} full>{t.id==="kids" ? "Spiel starten 🎮" : "Spiel starten →"}</Btn>
        : <p style={{ textAlign:"center", color:t.muted, animation:"pulse 1.5s ease infinite" }}>
            {t.id==="kids" ? "Warte auf den Spielleiter 🙂" : "Warte auf den Host..."}
          </p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN: QUESTION
───────────────────────────────────────────────────────────── */
function QuestionScreen({ room, myId, t, onGuess }) {
  const [val, setVal] = useState("");
  const q       = room.q;
  const pl      = (room.order || []).map(id => room.players?.[id]).filter(Boolean);
  const guesses = room.guesses || {};
  const myGuess = guesses[myId];
  const doneCount = Object.values(guesses).filter(v => v != null).length;

  if (!q) return <div style={{ ...page, display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner t={t} /></div>;

  function submit() {
    const n = parseFloat(val.replace(",", "."));
    if (isNaN(n)) return;
    onGuess(n);
  }

  return (
    <div style={page}>
      <div style={{ ...row, justifyContent:"space-between", marginBottom:18, animation:"fu .3s ease both" }}>
        <Pill t={t} color={t.green}>{t.id==="kids" ? `🎯 Frage ${(room.qIdx||0)+1}` : `FRAGE ${(room.qIdx||0)+1}`}</Pill>
        <span style={{ fontSize:13, color:t.muted, fontFamily:t.fontMono }}>{doneCount}/{pl.length} ✓</span>
      </div>

      <Card t={t} glow style={{ marginBottom:14, animation:"fu .3s .05s ease both" }}>
        <div style={{ fontSize:26, marginBottom:8 }}>{q.emoji||"❓"}</div>
        <Pill t={t} color={t.muted}>{q.topic}</Pill>
        <p style={{ fontSize:t.id==="kids"?20:18, lineHeight:1.55, fontWeight:t.id==="kids"?700:500, marginTop:12 }}>
          {q.question}
        </p>
        <p style={{ marginTop:12, color:t.muted, fontSize:14 }}>
          Antwort in: <strong style={{ color:t.gold }}>{q.unit}</strong>
        </p>
      </Card>

      {myGuess == null ? (
        <Card t={t} style={{ animation:"fu .3s .1s ease both" }}>
          <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.6, marginBottom:10 }}>
            {t.id==="kids" ? `DEIN TIPP (${q.unit}) 🤔` : `DEIN TIPP (${q.unit})`}
          </p>
          <div style={row}>
            <Inp type="number" value={val} onChange={setVal} placeholder="z.B. 42"
              t={t} autoFocus style={{ fontSize:22, fontWeight:700, fontFamily:t.fontMono }} />
            <Btn t={t} onClick={submit} disabled={!val} style={{ flexShrink:0 }}>OK ✓</Btn>
          </div>
          <p style={{ marginTop:11, color:t.muted, fontSize:13, lineHeight:1.5 }}>
            {t.id==="kids" ? "💬 Redet – aber zeigt eure Zahl nicht!" : "💬 Diskutiert – zeigt euren Tipp aber nicht!"}
          </p>
        </Card>
      ) : (
        <Card t={t} style={{ textAlign:"center", animation:"fu .3s .1s ease both" }}>
          <div style={{ fontSize:42, fontFamily:t.fontMono, color:t.accent, fontWeight:800, marginBottom:6 }}>
            {fmtNum(myGuess)} {q.unit}
          </div>
          <p style={{ color:t.green, fontWeight:700, marginBottom:14 }}>✓ Tipp abgegeben!</p>
          <div style={{ fontSize:12, color:t.muted, display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span>Warte auf alle...</span><span>{doneCount}/{pl.length}</span>
          </div>
          <div style={{ height:5, background:t.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(doneCount/pl.length)*100}%`,
              background:`linear-gradient(90deg,${t.accent},${t.gold})`, borderRadius:3, transition:"width .4s ease" }} />
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:14 }}>
        {pl.map(p => {
          const done = guesses[p.id] != null;
          return (
            <div key={p.id} style={{ padding:"5px 12px", borderRadius:100, fontSize:13, fontWeight:700,
              border:`1px solid ${done ? t.green : t.border}`,
              color: done ? t.green : t.muted,
              background: done ? t.green+"18" : t.surface,
              transition:"all .25s" }}>
              {p.name} {done ? "✓" : "…"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN: BETTING
───────────────────────────────────────────────────────────── */
function BettingScreen({ room, myId, t, onBet }) {
  const [closest,  setClosest]  = useState("");
  const [farthest, setFarthest] = useState("");
  const pl     = (room.order || []).map(id => room.players?.[id]).filter(Boolean);
  const others = pl.filter(p => p.id !== myId);
  const myBet  = (room.bets || {})[myId];

  function RadioGroup({ label, color, val, setVal }) {
    return (
      <Card t={t} style={{ marginBottom:12 }}>
        <p style={{ color, fontSize:13, fontWeight:800, marginBottom:10 }}>{label}</p>
        {others.map(p => {
          const sel = val === p.id;
          return (
            <div key={p.id} onClick={() => setVal(p.id)} style={{
              ...row, padding:"11px 13px", borderRadius:t.radius, cursor:"pointer",
              background: sel ? color+"18" : t.surface,
              border:`1.5px solid ${sel ? color : t.border}`,
              marginBottom:8, transition:"all .15s",
            }}>
              <input type="radio" readOnly checked={sel} style={{ accentColor:color }} />
              <Avatar name={p.name} t={t} size={30} />
              <span style={{ fontWeight:600 }}>{p.name}</span>
            </div>
          );
        })}
      </Card>
    );
  }

  return (
    <div style={{ ...page, animation:"fu .3s ease both" }}>
      <Pill t={t} color={t.gold}>{t.id==="kids" ? "🎲 WETTEN" : "WETTEN"}</Pill>
      <h2 style={{ fontFamily:t.fontTitle, fontSize:t.id==="kids"?32:38, margin:"8px 0 5px" }}>
        {t.id==="kids" ? "Wer trifft's am besten?" : "Wer liegt wo?"}
      </h2>
      <p style={{ color:t.muted, marginBottom:18, fontSize:14 }}>Richtige Wette = +1 Punkt extra</p>

      {myBet ? (
        <Card t={t} style={{ textAlign:"center" }}>
          <div style={{ fontSize:52, animation:"bop 1.2s ease infinite", marginBottom:10 }}>🎲</div>
          <p style={{ fontWeight:700, fontSize:17 }}>Wette gesetzt!</p>
          <p style={{ color:t.muted, marginTop:7, animation:"pulse 1.5s ease infinite" }}>Warte auf Auflösung...</p>
        </Card>
      ) : (
        <>
          <RadioGroup label={t.id==="kids" ? "🎯 Wer liegt AM NÄCHSTEN?" : "🎯 AM NÄCHSTEN dran"}
            color={t.green} val={closest} setVal={setClosest} />
          <RadioGroup label={t.id==="kids" ? "🙈 Wer liegt AM WEITESTEN?" : "💀 AM WEITESTEN daneben"}
            color={t.danger} val={farthest} setVal={setFarthest} />
          <Btn t={t} full disabled={!closest || !farthest || closest===farthest}
            onClick={() => onBet(closest, farthest)}>
            Wette abgeben 🎲
          </Btn>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN: RESULTS
───────────────────────────────────────────────────────────── */
function ResultsScreen({ room, myId, t, onNext, onEnd }) {
  const q       = room.q;
  const pl      = (room.order || []).map(id => room.players?.[id]).filter(Boolean);
  const guesses = room.guesses || {};
  const bets    = room.bets || {};
  const scores  = room.scores || {};
  const rs      = room.roundScores || {};
  const isHost  = room.hostId === myId;
  const medals  = ["🥇","🥈","🥉"];

  const ranked = pl
    .filter(p => guesses[p.id] != null)
    .map(p => ({ ...p, guess:guesses[p.id], diff:Math.abs(guesses[p.id] - q.answer) }))
    .sort((a,b) => a.diff - b.diff);
  const closestId  = ranked[0]?.id;
  const farthestId = ranked[ranked.length-1]?.id;

  return (
    <div style={page}>
      {/* Answer reveal */}
      <div style={{ textAlign:"center", marginBottom:22, animation:"fu .3s ease both" }}>
        <div style={{ fontSize:30, marginBottom:6 }}>{q.emoji||"❓"}</div>
        <Pill t={t}>AUFLÖSUNG</Pill>
        <div style={{ fontFamily:t.fontTitle, fontSize:"clamp(50px,12vw,82px)",
          color:t.accent, lineHeight:1, marginTop:8, animation:"pop .5s ease both",
          textShadow: t.id==="adult" ? "0 0 32px rgba(232,54,10,.35)" : undefined }}>
          {fmtNum(q.answer)} {q.unit}
        </div>
        <p style={{ color:t.muted, marginTop:11, fontSize:15, lineHeight:1.6, maxWidth:380, margin:"11px auto 0" }}>
          {q.hint}
        </p>
      </div>

      {/* Guesses */}
      <Card t={t} style={{ marginBottom:12, animation:"fu .3s .06s ease both" }}>
        <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.8, marginBottom:12 }}>
          {t.id==="kids" ? "TIPPS 📊" : "TIPPS DIESER RUNDE"}
        </p>
        {ranked.map((p,i) => {
          const exact = p.diff === 0;
          const win   = i === 0 && !exact;
          const pts   = rs[p.id] || 0;
          return (
            <div key={p.id} style={{ ...row, padding:"10px 13px", borderRadius:t.radius, marginBottom:8,
              background: exact ? t.green+"18" : win ? t.accent+"14" : t.surface,
              border:`1.5px solid ${exact ? t.green : win ? t.accent+"44" : t.border}`,
              animation:`fu .3s ${i*.07}s ease both` }}>
              <span style={{ fontSize:18, minWidth:20 }}>{medals[i]||`${i+1}.`}</span>
              <Avatar name={p.name} t={t} size={28} />
              <span style={{ fontWeight:700, flex:1, fontSize:14 }}>{p.name}</span>
              <span style={{ fontFamily:t.fontMono, fontSize:13, color:win||exact?t.accent:t.text }}>
                {fmtNum(p.guess)} {q.unit}
              </span>
              <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.muted, minWidth:44, textAlign:"right" }}>
                Δ{fmtNum(p.diff)}
              </span>
              {pts > 0 && <Pill t={t} color={exact ? t.green : t.gold}>+{pts}P</Pill>}
            </div>
          );
        })}
      </Card>

      {/* Bets */}
      {Object.keys(bets).length > 0 && (
        <Card t={t} style={{ marginBottom:12, animation:"fu .3s .12s ease both" }}>
          <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.8, marginBottom:10 }}>WETTEN</p>
          {pl.map(p => {
            const b = bets[p.id]; if (!b) return null;
            const cp = pl.find(x => x.id===b.closest);
            const fp = pl.find(x => x.id===b.farthest);
            const okC = b.closest  === closestId;
            const okF = b.farthest === farthestId;
            return (
              <div key={p.id} style={{ fontSize:14, color:t.muted, lineHeight:1.9 }}>
                <strong style={{ color:t.text }}>{p.name}</strong>:{" "}
                <span style={{ color:okC?t.green:t.danger }}>🎯 {cp?.name||"?"} {okC?"✓":"✗"}</span>
                {" · "}
                <span style={{ color:okF?t.green:t.danger }}>{t.id==="kids"?"🙈":"💀"} {fp?.name||"?"} {okF?"✓":"✗"}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Scoreboard */}
      <Card t={t} style={{ marginBottom:18, animation:"fu .3s .18s ease both" }}>
        <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.8, marginBottom:12 }}>
          {t.id==="kids" ? "PUNKTE 🏆" : "GESAMTPUNKTE"}
        </p>
        {[...pl].sort((a,b) => (scores[b.id]||0)-(scores[a.id]||0)).map((p,i) => (
          <div key={p.id} style={{ ...row, padding:"10px 0",
            borderBottom: i<pl.length-1 ? `1px solid ${t.border}` : "none" }}>
            <span style={{ fontFamily:t.fontTitle, fontSize:20, color:i===0?t.gold:t.muted, minWidth:20 }}>{i+1}</span>
            <Avatar name={p.name} t={t} size={30} />
            <span style={{ flex:1, fontWeight:p.id===myId?800:400 }}>
              {p.name}{p.id===myId && <span style={{ color:t.accent, fontSize:12 }}> (Du)</span>}
            </span>
            <span style={{ fontFamily:t.fontTitle, fontSize:32, color:i===0?t.gold:t.text }}>
              {scores[p.id]||0}
            </span>
          </div>
        ))}
      </Card>

      {isHost ? (
        <div style={{ display:"flex", gap:10 }}>
          <Btn t={t} onClick={onNext} full>Nächste Frage →</Btn>
          <Btn t={t} variant="secondary" onClick={onEnd}>Beenden</Btn>
        </div>
      ) : (
        <p style={{ textAlign:"center", color:t.muted, animation:"pulse 1.5s ease infinite" }}>
          {t.id==="kids" ? "Warte auf den Spielleiter 🙂" : "Warte auf den Host..."}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCREEN: FINAL
───────────────────────────────────────────────────────────── */
function FinalScreen({ room, myId, t, onRestart }) {
  const pl     = (room.order || []).map(id => room.players?.[id]).filter(Boolean);
  const scores = room.scores || {};
  const sorted = [...pl].sort((a,b) => (scores[b.id]||0)-(scores[a.id]||0));
  const winner = sorted[0];
  const medals = ["🥇","🥈","🥉"];

  useEffect(() => { launchConfetti(); }, []);

  return (
    <div style={{ ...page, textAlign:"center", paddingTop:44 }}>
      <div style={{ fontSize:72, animation:"pop .7s ease both" }}>{t.id==="kids" ? "🏆🎉🌟" : "🏆"}</div>
      <div style={{ fontFamily:t.fontTitle, fontSize:52, color:t.gold, marginTop:7, animation:"pop .7s .1s ease both" }}>
        {winner?.name||"?"}
      </div>
      <p style={{ color:t.muted, fontSize:17, margin:"5px 0 30px" }}>
        {t.id==="kids" ? `gewinnt mit ${scores[winner?.id]||0} Punkten! 🎊` : `gewinnt mit ${scores[winner?.id]||0} Punkten.`}
      </p>
      <Card t={t} style={{ textAlign:"left", marginBottom:20 }}>
        <p style={{ fontSize:11, fontWeight:700, color:t.muted, letterSpacing:.8, marginBottom:16 }}>ENDSTAND</p>
        {sorted.map((p,i) => (
          <div key={p.id} style={{ ...row, padding:"11px 0",
            borderBottom: i<sorted.length-1 ? `1px solid ${t.border}` : "none",
            animation:`fu .4s ${i*.09}s ease both` }}>
            <span style={{ fontSize:22, minWidth:26 }}>{medals[i]||`${i+1}.`}</span>
            <Avatar name={p.name} t={t} />
            <span style={{ flex:1, fontWeight:p.id===myId?800:400, fontSize:15 }}>{p.name}</span>
            <span style={{ fontFamily:t.fontTitle, fontSize:38, color:i===0?t.gold:t.text }}>
              {scores[p.id]||0}
            </span>
          </div>
        ))}
      </Card>
      <Btn t={t} onClick={onRestart} full>
        {t.id==="kids" ? "🔄 Nochmal spielen!" : "Neue Runde starten"}
      </Btn>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────────────────────── */
export default function App() {
  const [screen,  setScreen]  = useState("home");
  const [room,    setRoom]    = useState(null);
  const [code,    setCode]    = useState(null);
  const [myId]                = useState(() => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2,5));
  const [myName,  setMyName]  = useState("");
  const [mode,    setMode]    = useState("adult");
  const [loading, setLoading] = useState(false);
  const [loadTxt, setLoadTxt] = useState("");
  const topicsRef             = useRef([]);
  const unsubRef              = useRef(null);

  const t = mode === "kids" ? KIDS : ADULT;

  useEffect(() => { inject(globalCSS(t)); }, [t]);

  // ── Subscribe to Firebase room ─────────────────
  function listenRoom(c) {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = dbListen(c, (r) => {
      if (!r) return;
      setRoom({ ...r });
      setMode(r.mode || "adult");
      const map = { lobby:"lobby", question:"question", betting:"betting", results:"results", final:"final" };
      if (map[r.phase]) setScreen(map[r.phase]);
    });
  }

  // ── ACTIONS ────────────────────────────────────
  async function handleHost(name, m) {
    setMyName(name);
    setMode(m);
    const c = genCode();
    setCode(c);
    const roomData = {
      code:c, mode:m, hostId:myId,
      players:{ [myId]:{ id:myId, name } },
      order:[myId],
      phase:"lobby",
      guesses:{}, bets:{}, scores:{}, roundScores:{},
      q:null, qIdx:0,
    };
    await dbSet(c, roomData);
    listenRoom(c);
  }

  async function handleJoin(c, name, m) {
    setMyName(name);
    setMode(m || "adult");
    setCode(c);
    const r = await dbGet(c);
    const newPlayers = { ...r.players, [myId]:{ id:myId, name } };
    const newOrder   = [...(r.order||[]), myId];
    await dbPatch(c, { players:newPlayers, order:newOrder });
    listenRoom(c);
  }

  async function handleStart() {
    setLoading(true);
    setLoadTxt(mode==="kids" ? "🤔 Frage wird generiert..." : "KI generiert eine Frage...");
    const q = await generateQuestion(mode, topicsRef.current);
    topicsRef.current.push(q.topic);
    setLoading(false);
    await dbPatch(code, { phase:"question", q, guesses:{}, bets:{}, roundScores:{}, qIdx:room?.qIdx||0 });
  }

  async function handleGuess(val) {
    // Write guess to Firebase
    await update(ref(db, `rooms/${code}/guesses`), { [myId]: val });
    // Check if all players have guessed
    const r = await dbGet(code);
    const guesses = r.guesses || {};
    const allDone = (r.order||[]).every(id => guesses[id] != null);
    if (allDone) {
      // if only 1 player, skip betting
      if ((r.order||[]).length <= 1) {
        const { roundScores, newScores } = calcRound({ ...r, guesses });
        await dbPatch(code, { phase:"results", roundScores, scores:newScores });
      } else {
        await dbPatch(code, { phase:"betting" });
      }
    }
  }

  async function handleBet(closest, farthest) {
    await update(ref(db, `rooms/${code}/bets`), { [myId]:{ closest, farthest } });
    const r = await dbGet(code);
    const bets = r.bets || {};
    const allDone = (r.order||[]).every(id => bets[id] != null);
    if (!allDone) return;
    const { roundScores, newScores } = calcRound(r);
    await dbPatch(code, { phase:"results", roundScores, scores:newScores });
  }

  async function handleNext() {
    setLoading(true);
    setLoadTxt(mode==="kids" ? "🤔 Neue Frage..." : "Nächste Frage kommt...");
    const q = await generateQuestion(mode, topicsRef.current);
    topicsRef.current.push(q.topic);
    setLoading(false);
    await dbPatch(code, { phase:"question", q, guesses:{}, bets:{}, roundScores:{}, qIdx:(room?.qIdx||0)+1 });
  }

  async function handleEnd() {
    await dbPatch(code, { phase:"final" });
  }

  function handleRestart() {
    if (unsubRef.current) unsubRef.current();
    setRoom(null); setCode(null); setScreen("home"); topicsRef.current = [];
  }

  // ── RENDER ─────────────────────────────────────
  return (
    <>
      {loading && <LoadingOverlay t={t} text={loadTxt} />}

      {screen === "home" && (
        <HomeScreen onHost={handleHost} onJoin={handleJoin} />
      )}
      {screen === "lobby" && room && (
        <LobbyScreen room={room} code={code} myId={myId} t={t} onStart={handleStart} />
      )}
      {screen === "question" && room && (
        <QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess} />
      )}
      {screen === "betting" && room && (room.order||[]).length > 1 && (
        <BettingScreen room={room} myId={myId} t={t} onBet={handleBet} />
      )}
      {screen === "results" && room && (
        <ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd} />
      )}
      {screen === "final" && room && (
        <FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart} />
      )}
    </>
  );
}
