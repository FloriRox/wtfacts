import { useState, useEffect, useRef } from "react";
import QUESTIONS_RAW from "./questions/index.js";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA4ylsGv34UhkQJsxSWhmPx2eb5IPhI7SA",
  authDomain: "estimates-958c6.firebaseapp.com",
  databaseURL: "https://estimates-958c6-default-rtdb.firebaseio.com",
  projectId: "estimates-958c6",
  storageBucket: "estimates-958c6.firebasestorage.app",
  messagingSenderId: "504687472282",
  appId: "1:504687472282:web:d129a0ddb9b209f2c13923",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const dbRef   = (c)    => ref(db, `rooms/${c}`);
const dbSet   = (c, v) => set(dbRef(c), v);
const dbPatch = (c, v) => update(dbRef(c), v);
const dbGet   = (c)    => get(dbRef(c)).then(s => s.val());
const dbListen= (c,fn) => onValue(dbRef(c), s => fn(s.val()));

/* ─── THEMES ─────────────────────────────────────── */
const AYOULT = {
  id:"adult", bg:"#0d0b0a", surface:"#181310", card:"#211c18", border:"#32261e",
  accent:"#e8360a", gold:"#ff8c2a", green:"#39d98a", text:"#f2ece6", muted:"#6e5e54", danger:"#cc2244",
  fontTitle:"'Bebas Neue', sans-serif", fontBody:"'DM Sans', sans-serif", fontMono:"'DM Mono', monospace",
  radius:"10px", emoji:"🔥",
};
const KIDS = {
  id:"kids", bg:"#fffaf2", surface:"#fff4e0", card:"#ffffff", border:"#ffd58a",
  accent:"#ff5c5c", gold:"#ffca2c", green:"#42c96e", text:"#1e1e1e", muted:"#b0a090", danger:"#ff4444",
  fontTitle:"'Fredoka One', cursive", fontBody:"'Nunito', sans-serif", fontMono:"'Nunito', sans-serif",
  radius:"20px", emoji:"🌈",
};

/* ─── QUESTION DATABASE ──────────────────────────── */
// questions kommen aus src/questions/ – eine Datei pro Kategorie
// Locked-Status wird in src/questions/index.js gesetzt

// Adapter: wandelt neues Format in App-kompatibles Format um
const QUESTIONS = {};
Object.keys(QUESTIONS_RAW).forEach(mode => {
  QUESTIONS[mode] = {};
  Object.entries(QUESTIONS_RAW[mode]).forEach(([cat, { questions, locked }]) => {
    QUESTIONS[mode][cat] = questions.map(q => ({ ...q, locked }));
  });
});

// Gibt alle Kategorien zurück (mit locked-Info)
export function getCategoryMeta(mode) {
  return Object.entries(QUESTIONS_RAW[mode]).map(([name, { questions, locked }]) => ({
    name,
    count: questions.length,
    locked,
  }));
}

/* ─── HELPERS ────────────────────────────────────── */
const genCode   = () => Math.random().toString(36).slice(2,7).toUpperCase();
const fmtNum    = (n) => {
  if(n==null) return "?";
  const num=Number(n);
  // integers that look like years (1000-2200) or any whole number: no thousand separator
  if(Number.isInteger(num)&&num>=1000&&num<=2200) return String(num);
  // other integers >= 10000: use separator
  if(Number.isInteger(num)) return num.toLocaleString("de-DE");
  // decimals
  return num.toLocaleString("de-DE",{maximumFractionDigits:2});
};
const inviteUrl = (c) => `${location.origin}${location.pathname}?room=${c}`;
function avatarColor(name,t){
  const h=[...(name||"?")].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return t.id==="kids"?`hsl(${h},60%,55%)`:`hsl(${h},40%,32%)`;
}
const inject=(css)=>{
  let el=document.getElementById("wtf-style");
  if(!el){el=document.createElement("style");el.id="wtf-style";document.head.appendChild(el);}
  el.textContent=css;
};
function globalCSS(t){
  const fonts=t.id==="kids"
    ?`@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');`
    :`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');`;
  return `${fonts}
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
`;}

function getQuestion(mode, selectedCats, usedIds){
  const cats=QUESTIONS[mode];
  const available=selectedCats.filter(c=>cats[c]);
  if(!available.length)return null;
  // gather all unused questions from selected categories
  let pool=[];
  available.forEach(cat=>{
    cats[cat].forEach((q,i)=>{
      const id=`${cat}::${i}`;
      if(!usedIds.includes(id)) pool.push({...q,id,cat});
    });
  });
  if(!pool.length){
    // all used – reset
    usedIds.splice(0,usedIds.length);
    available.forEach(cat=>{
      cats[cat].forEach((q,i)=>pool.push({...q,id:`${cat}::${i}`,cat}));
    });
  }
  return pool[Math.floor(Math.random()*pool.length)];
}

function calcRound(room){
  const q=room.q,order=room.order||[],guesses=room.guesses||{},bets=room.bets||{};
  const ranked=order.filter(id=>guesses[id]!=null).map(id=>({id,diff:Math.abs(guesses[id]-q.a)})).sort((a,b)=>a.diff-b.diff);
  const closestId=ranked[0]?.id,farthestId=ranked[ranked.length-1]?.id,anyExact=ranked.some(r=>r.diff===0);
  const roundScores={};
  order.forEach(id=>{
    let pts=0;
    if(guesses[id]==null){roundScores[id]=0;return;}
    const diff=Math.abs(guesses[id]-q.a);
    if(diff===0)pts+=2;
    else if(!anyExact&&id===closestId)pts+=1;
    const bet=bets[id]||{};
    if(bet.closest===closestId)pts+=1;
    if(bet.farthest===farthestId)pts+=1;
    roundScores[id]=pts;
  });
  const newScores={...room.scores};
  order.forEach(id=>{newScores[id]=(newScores[id]||0)+(roundScores[id]||0);});
  return{roundScores,newScores,closestId,farthestId};
}

function launchConfetti(){
  const cols=["#ff5c5c","#ffca2c","#42c96e","#4ecdc4","#a29bfe","#fd79a8","#ff8c2a"];
  for(let i=0;i<65;i++){
    const el=document.createElement("div");
    const sz=6+Math.random()*9;
    el.style.cssText=`position:fixed;top:-12px;left:${Math.random()*100}vw;width:${sz}px;height:${sz}px;border-radius:2px;background:${cols[Math.floor(Math.random()*cols.length)]};animation:confettifall ${1.3+Math.random()*2}s ${Math.random()*.4}s linear forwards;pointer-events:none;z-index:9999;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),4000);
  }
}

/* ─── PRIMITIVES ─────────────────────────────────── */
const row={display:"flex",alignItems:"center",gap:10};
const col={display:"flex",flexDirection:"column",gap:12};
const page={minHeight:"100vh",padding:"24px 16px",maxWidth:520,margin:"0 auto"};

function Spinner({t}){return <div style={{width:28,height:28,border:`3px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto"}}/>;}
function Btn({children,onClick,variant="primary",disabled,t,full,style:sx={}}){
  const base={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"13px 22px",border:"none",borderRadius:t.radius,fontSize:15,fontWeight:700,letterSpacing:.3,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.38:1,transition:"all .15s",width:full?"100%":undefined,WebkitTapHighlightColor:"transparent",userSelect:"none"};
  const v={primary:{background:t.accent,color:"#fff"},secondary:{background:"transparent",color:t.text,border:`2px solid ${t.border}`},ghost:{background:"transparent",color:t.muted}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...v[variant],...sx}}>{children}</button>;
}
function Inp({value,onChange,placeholder,type="text",t,autoFocus,style:sx={}}){
  const[foc,setFoc]=useState(false);
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} inputMode={type==="number"?"decimal":undefined} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={{width:"100%",padding:"13px 15px",background:t.surface,border:`2px solid ${foc?t.accent:t.border}`,borderRadius:t.radius,color:t.text,fontSize:16,outline:"none",transition:"border-color .2s",...sx}}/>;
}
function Card({children,t,glow,style:sx={}}){
  return <div style={{background:t.card,border:`1.5px solid ${glow?t.accent+"77":t.border}`,borderRadius:t.radius,padding:20,boxShadow:glow?`0 0 20px ${t.accent}18`:undefined,...sx}}>{children}</div>;
}
function Pill({children,color,t}){
  const c=color||t.accent;
  return <span style={{display:"inline-block",padding:"3px 11px",borderRadius:100,fontSize:12,fontWeight:700,letterSpacing:.4,fontFamily:t.fontMono,background:c+"22",color:c,border:`1px solid ${c}44`}}>{children}</span>;
}
function Avatar({name,t,size=36}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:avatarColor(name,t),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.42,fontWeight:800,flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;
}
function Logo({t,size="lg"}){
  const fs=size==="lg"?"clamp(52px,12vw,80px)":"36px";
  if(t.id==="adult")return <div style={{fontFamily:t.fontTitle,fontSize:fs,letterSpacing:2,lineHeight:1,color:t.accent,animation:"flame 2.5s ease infinite"}}>
    Esti<span style={{color:t.gold}}>Mates</span>
    {size==="lg"&&<div style={{fontFamily:t.fontBody,fontSize:12,letterSpacing:1.8,color:t.muted,marginTop:6,textTransform:"uppercase"}}>The pocket party game to prove your mates wrong.</div>}
  </div>;
  return <div style={{textAlign:"center"}}>
    <div style={{fontFamily:t.fontTitle,fontSize:fs,lineHeight:1.1}}>
      <span style={{animation:"rainbow 3s linear infinite"}}>Esti</span><span style={{animation:"rainbow 3s .5s linear infinite"}}>Mates</span>
    </div>
    {size==="lg"&&<div style={{fontSize:13,color:t.muted,marginTop:4}}>The pocket party game to prove your mates wrong. 🎉</div>}
    {size!=="lg"&&<div style={{fontSize:16,animation:"bop 1.2s ease infinite"}}>🎉✨</div>}
  </div>;
}
function LoadingOverlay({t,text}){
  return <div style={{position:"fixed",inset:0,background:t.bg+"ee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:999}}>{t.id==="kids"?<div style={{fontSize:48,animation:"bop .6s ease infinite"}}>🤔</div>:<Spinner t={t}/>}<p style={{color:t.muted,fontSize:15}}>{text}</p></div>;
}
function QRCode({url,t}){
  const bg=t.id==="adult"?"211c18":"ffffff";
  const fg=t.id==="adult"?"e8360a":"ff5c5c";
  return <div style={{textAlign:"center",marginTop:18}}>
    <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:10}}>EINLAYOUNGS-QR</p>
    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}&bgcolor=${bg}&color=${fg}`} alt="QR" style={{width:130,height:130,borderRadius:t.radius,border:`2px solid ${t.border}`}}/>
    <p style={{fontSize:12,color:t.muted,marginTop:7}}>Scannen zum Join</p>
  </div>;
}

/* ─── HOME ───────────────────────────────────────── */
function HomeScreen({onHost,onJoin}){
  const[tab,setTab]=useState(()=>new URLSearchParams(location.search).get("room")?"join":"landing");
  const[name,setName]=useState("");
  const[code,setCode]=useState(()=>new URLSearchParams(location.search).get("room")||"");
  const[mode,setMode]=useState("adult");
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);
  const t=mode==="kids"?KIDS:AYOULT;
  useEffect(()=>{inject(globalCSS(tab==="landing"?AYOULT:t));},[t,tab]);

  async function submit(){
    if(!name.trim()){setError("Please enter your name.");return;}
    setError("");
    if(tab==="host"){onHost(name.trim(),mode);}
    else{
      const c=code.trim().toUpperCase();
      if(!c){setError("Please enter a room code.");return;}
      setBusy(true);
      const room=await dbGet(c);
      setBusy(false);
      if(!room){setError("Room not found.");return;}
      if(room.phase!=="lobby"){setError("Game already in progress.");return;}
      onJoin(c,name.trim(),room.mode);
    }
  }

  if(tab==="landing"){
    inject(globalCSS(AYOULT));
    return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:AYOULT.bg,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,54,10,.18),transparent 65%)",top:-200,left:"50%",transform:"translateX(-50%)",filter:"blur(50px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",maxWidth:460,width:"100%",position:"relative",animation:"fu .4s ease both"}}>
        <Logo t={AYOULT} size="lg"/>
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:44}}>
          <Btn t={AYOULT} onClick={()=>{setTab("host");setMode("adult");}} style={{minWidth:150}}>Create Room</Btn>
          <Btn t={AYOULT} variant="secondary" onClick={()=>setTab("join")} style={{minWidth:150}}>Join</Btn>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:36}}>
          {["1–15 players","330 questions","Real-time","Wetten"].map(x=><Pill key={x} t={AYOULT} color={AYOULT.muted}>{x}</Pill>)}
        </div>
      </div>
    </div>;
  }

  return <div style={{...page,background:t.bg,animation:"fu .3s ease both"}}>
    <Btn t={t} variant="ghost" onClick={()=>{setTab("landing");inject(globalCSS(AYOULT));}} style={{marginBottom:18,padding:"8px 0"}}>← Back</Btn>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:22}}/>
    {tab==="host"&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>GAME MODE</p>
      <div style={{display:"flex",gap:10}}>
        {[{id:"adult",icon:"🔥",label:"Adults",sub:"Funny · spicy"},{id:"kids",icon:"🌈",label:"Kids",sub:"Colorful · safe"}].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:"14px 8px",borderRadius:t.radius,background:mode===m.id?t.accent+"18":t.surface,border:`2px solid ${mode===m.id?t.accent:t.border}`,color:mode===m.id?t.accent:t.muted,cursor:"pointer",transition:"all .2s",fontFamily:t.fontBody,textAlign:"center"}}>
            <div style={{fontSize:22}}>{m.icon}</div>
            <div style={{fontWeight:800,fontSize:13,marginTop:3}}>{m.label}</div>
            <div style={{fontSize:11,color:t.muted,marginTop:2}}>{m.sub}</div>
          </button>
        ))}
      </div>
    </Card>}
    <Card t={t}>
      <div style={col}>
        <Inp value={name} onChange={setName} placeholder={t.id==="kids"?"Your name 😊":"Your name"} t={t} autoFocus/>
        {tab==="join"&&<Inp value={code} onChange={v=>setCode(v.toUpperCase())} placeholder="Room code (e.g. AB3XY)" t={t} style={{letterSpacing:3,fontWeight:700,fontFamily:t.fontMono}}/>}
        {error&&<p style={{color:t.danger,fontSize:13}}>{error}</p>}
        <Btn t={t} onClick={submit} disabled={busy} full>{busy?"Searching...":tab==="host"?`${t.emoji} Create Room`:"Join →"}</Btn>
      </div>
    </Card>
  </div>;
}

/* ─── CATEGORY SELECTION ─────────────────────────── */
function CategoryScreen({mode,onStart,t}){
  const catMeta=Object.entries(QUESTIONS_RAW[mode]).map(([name,{questions,locked}])=>({name,count:questions.length,locked}));
  const freeKey="🎯 Gratis-Test";
  const [selected,setSelected]=useState([freeKey]);

  function toggle(c,locked){
    if(locked) return; // locked categories can't be selected
    setSelected(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  }

  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>CHOOSE CATEGORIES</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?30:36,marginBottom:6}}>
      {t.id==="kids"?"What do you want to play?":"What are we playing?"}
    </h2>
    <p style={{color:t.muted,fontSize:14,marginBottom:18}}>Choose at least one category</p>
    <div style={{...col,marginBottom:18}}>
      {catMeta.map(({name,count,locked})=>{
        const isFree=name===freeKey;
        const sel=selected.includes(name);
        return <div key={name} onClick={()=>toggle(name,locked)} style={{
          ...row,padding:"13px 16px",borderRadius:t.radius,
          cursor:locked?"not-allowed":"pointer",
          background:locked?t.surface:sel?t.accent+"18":t.surface,
          border:`2px solid ${locked?t.border:sel?t.accent:t.border}`,
          opacity:locked?0.5:1,
          transition:"all .15s"}}>
          <div style={{fontSize:22,minWidth:32}}>
            {locked?"🔒":sel?"✅":"⬜"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15}}>{name}</div>
            {isFree&&<div style={{fontSize:12,color:t.green,fontWeight:700,marginTop:2}}>✓ Free – perfect for trying out!</div>}
            {locked&&<div style={{fontSize:12,color:t.muted,fontWeight:700,marginTop:2}}>🔒 Coming soon – paid pack</div>}
            <div style={{fontSize:12,color:t.muted,marginTop:1}}>{count} questions</div>
          </div>
        </div>;
      })}
    </div>
    <Btn t={t} full disabled={selected.length===0} onClick={()=>onStart(selected)}>
      {t.id==="kids"?`Start game mit ${selected.length} category/ies 🎮`:`Start game (${selected.length} category/ies →`}
    </Btn>
  </div>;
}

/* ─── LOBBY ──────────────────────────────────────── */
function LobbyScreen({room,code,myId,t,onGoCategories}){
  const[copied,setCopied]=useState(false);
  const isHost=room.hostId===myId;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const link=inviteUrl(code);
  function copy(){navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>{t.id==="kids"?"🎈 LOBBY":"LOBBY"}</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?34:40,marginBottom:6}}>{t.id==="kids"?"Waiting for everyone!":"Waiting for players"}</h2>
    <div style={{...row,marginBottom:16}}>
      <span style={{fontFamily:t.fontMono,fontSize:28,letterSpacing:5,color:t.accent,fontWeight:800}}>{code}</span>
      <Btn t={t} variant="secondary" onClick={copy} style={{padding:"7px 13px",fontSize:13}}>{copied?"✓ Kopiert!":"📋 Link"}</Btn>
    </div>
    <Card t={t} style={{marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.7,marginBottom:12}}>PLAYERS ({pl.length}/15)</p>
      <div style={col}>
        {pl.map(p=>(
          <div key={p.id} style={{...row,padding:"10px 12px",background:t.surface,borderRadius:t.radius,border:`1.5px solid ${p.id===myId?t.accent+"55":t.border}`}}>
            <Avatar name={p.name} t={t}/>
            <span style={{flex:1,fontWeight:600}}>{p.name}</span>
            {p.id===room.hostId&&<Pill t={t} color={t.gold}>HOST</Pill>}
            {p.id===myId&&p.id!==room.hostId&&<Pill t={t}>YOU</Pill>}
          </div>
        ))}
      </div>
      <QRCode url={link} t={t}/>
    </Card>
    {isHost
      ?<Btn t={t} onClick={onGoCategories} full>{t.id==="kids"?"Choose categories 🎮":"Choose categories →"}</Btn>
      :<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{t.id==="kids"?"Waiting for the host 🙂":"Waiting for the host..."}</p>}
  </div>;
}

/* ─── QUESTION ───────────────────────────────────── */
function QuestionScreen({room,myId,t,onGuess}){
  const[val,setVal]=useState("");
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{};
  const myGuess=guesses[myId];
  const doneCount=Object.values(guesses).filter(v=>v!=null).length;
  if(!q)return <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner t={t}/></div>;
  function submit(){const n=parseFloat(val.replace(",","."));if(isNaN(n))return;onGuess(n);}
  return <div style={page}>
    <div style={{...row,justifyContent:"space-between",marginBottom:18,animation:"fu .3s ease both"}}>
      <Pill t={t} color={t.green}>{t.id==="kids"?`🎯 Question ${(room.qIdx||0)+1}`:`QUESTION ${(room.qIdx||0)+1}`}</Pill>
      <span style={{fontSize:13,color:t.muted,fontFamily:t.fontMono}}>{doneCount}/{pl.length} ✓</span>
    </div>
    <Card t={t} glow style={{marginBottom:14,animation:"fu .3s .05s ease both"}}>
      <div style={{fontSize:26,marginBottom:8}}>{q.emoji||"❓"}</div>
      <Pill t={t} color={t.muted}>{q.cat}</Pill>
      <p style={{fontSize:t.id==="kids"?20:18,lineHeight:1.55,fontWeight:t.id==="kids"?700:500,marginTop:12}}>{q.q}</p>
      <p style={{marginTop:12,color:t.muted,fontSize:14}}>Answer in: <strong style={{color:t.gold}}>{q.unit}</strong></p>
    </Card>
    {myGuess==null
      ?<Card t={t} style={{animation:"fu .3s .1s ease both"}}>
        <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.6,marginBottom:10}}>{t.id==="kids"?`YOUR GUESS (${q.unit}) 🤔`:`YOUR GUESS (${q.unit})`}</p>
        <div style={row}>
          <Inp type="number" value={val} onChange={setVal} placeholder="e.g. 42" t={t} autoFocus style={{fontSize:22,fontWeight:700,fontFamily:t.fontMono}}/>
          <Btn t={t} onClick={submit} disabled={!val} style={{flexShrink:0}}>OK ✓</Btn>
        </div>
        <p style={{marginTop:11,color:t.muted,fontSize:13,lineHeight:1.5}}>{t.id==="kids"?"💬 Talk – but don't show your number!":"💬 Discuss – but don't show your guess!"}</p>
      </Card>
      :<Card t={t} style={{textAlign:"center",animation:"fu .3s .1s ease both"}}>
        <div style={{fontSize:42,fontFamily:t.fontMono,color:t.accent,fontWeight:800,marginBottom:6}}>{fmtNum(myGuess)} {q.unit}</div>
        <p style={{color:t.green,fontWeight:700,marginBottom:14}}>✓ Guess submitted!</p>
        <div style={{fontSize:12,color:t.muted,display:"flex",justifyContent:"space-between",marginBottom:5}}><span>Waiting for everyone...</span><span>{doneCount}/{pl.length}</span></div>
        <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(doneCount/pl.length)*100}%`,background:`linear-gradient(90deg,${t.accent},${t.gold})`,borderRadius:3,transition:"width .4s ease"}}/></div>
      </Card>}
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:14}}>
      {pl.map(p=>{const done=guesses[p.id]!=null;return <div key={p.id} style={{padding:"5px 12px",borderRadius:100,fontSize:13,fontWeight:700,border:`1px solid ${done?t.green:t.border}`,color:done?t.green:t.muted,background:done?t.green+"18":t.surface,transition:"all .25s"}}>{p.name} {done?"✓":"…"}</div>;})}
    </div>
  </div>;
}

/* ─── BETTING ────────────────────────────────────── */
function BettingScreen({room,myId,t,onBet}){
  const[closest,setClosest]=useState("");
  const[farthest,setFarthest]=useState("");
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const others=pl.filter(p=>p.id!==myId);
  const myBet=(room.bets||{})[myId];
  const soloOther=others.length===1;
  function RG({label,color,val,setVal}){
    return <Card t={t} style={{marginBottom:12}}>
      <p style={{color,fontSize:13,fontWeight:800,marginBottom:10}}>{label}</p>
      {others.map(p=>{const sel=val===p.id;return <div key={p.id} onClick={()=>setVal(p.id)} style={{...row,padding:"11px 13px",borderRadius:t.radius,cursor:"pointer",background:sel?color+"18":t.surface,border:`1.5px solid ${sel?color:t.border}`,marginBottom:8,transition:"all .15s"}}><input type="radio" readOnly checked={sel} style={{accentColor:color}}/><Avatar name={p.name} t={t} size={30}/><span style={{fontWeight:600}}>{p.name}</span></div>;})}
    </Card>;
  }
  const canSubmit=soloOther?!!closest:!!(closest&&farthest&&closest!==farthest);
  function submitBet(){onBet(closest,soloOther?closest:farthest);}
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Pill t={t} color={t.gold}>{t.id==="kids"?"🎲 BETS":"BETS"}</Pill>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?32:38,margin:"8px 0 5px"}}>{t.id==="kids"?"Who's closest?":"Who's where?"}</h2>
    <p style={{color:t.muted,marginBottom:18,fontSize:14}}>Correct bet = +1 extra point</p>
    {myBet
      ?<Card t={t} style={{textAlign:"center"}}><div style={{fontSize:52,animation:"bop 1.2s ease infinite",marginBottom:10}}>🎲</div><p style={{fontWeight:700,fontSize:17}}>Bet placed!</p><p style={{color:t.muted,marginTop:7,animation:"pulse 1.5s ease infinite"}}>Waiting for reveal...</p></Card>
      :<>
        <RG label={t.id==="kids"?"🎯 Who's CLOSEST?":"🎯 CLOSEST guess"} color={t.green} val={closest} setVal={setClosest}/>
        {!soloOther&&<RG label={t.id==="kids"?"🙈 Who's FURTHEST off?":"💀 FURTHEST off"} color={t.danger} val={farthest} setVal={setFarthest}/>}
        {soloOther&&<p style={{color:t.muted,fontSize:13,marginBottom:12,textAlign:"center"}}>With 2 players one choice is enough 👆</p>}
        <Btn t={t} full disabled={!canSubmit} onClick={submitBet}>Place bet 🎲</Btn>
      </>}
  </div>;
}

/* ─── RESULTS ────────────────────────────────────── */
function ResultsScreen({room,myId,t,onNext,onEnd}){
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{},bets=room.bets||{},scores=room.scores||{},rs=room.roundScores||{};
  const isHost=room.hostId===myId;
  const medals=["🥇","🥈","🥉"];
  const ranked=pl.filter(p=>guesses[p.id]!=null).map(p=>({...p,guess:guesses[p.id],diff:Math.abs(guesses[p.id]-q.a)})).sort((a,b)=>a.diff-b.diff);
  const closestId=ranked[0]?.id,farthestId=ranked[ranked.length-1]?.id;
  return <div style={page}>
    <div style={{textAlign:"center",marginBottom:22,animation:"fu .3s ease both"}}>
      <div style={{fontSize:30,marginBottom:6}}>{q.emoji||"❓"}</div>
      <Pill t={t}>ANSWER</Pill>
      <div style={{fontFamily:t.fontTitle,fontSize:"clamp(50px,12vw,82px)",color:t.accent,lineHeight:1,marginTop:8,animation:"pop .5s ease both",textShadow:t.id==="adult"?"0 0 32px rgba(232,54,10,.35)":undefined}}>{fmtNum(q.a)} {q.unit}</div>
      <p style={{color:t.muted,marginTop:11,fontSize:15,lineHeight:1.6,maxWidth:380,margin:"11px auto 0"}}>{q.hint}</p>
    </div>
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{t.id==="kids"?"GUESSES 📊":"THIS ROUND'S GUESSES"}</p>
      {ranked.map((p,i)=>{const exact=p.diff===0,win=i===0&&!exact,pts=rs[p.id]||0;return <div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:exact?t.green+"18":win?t.accent+"14":t.surface,border:`1.5px solid ${exact?t.green:win?t.accent+"44":t.border}`,animation:`fu .3s ${i*.07}s ease both`}}><span style={{fontSize:18,minWidth:20}}>{medals[i]||`${i+1}.`}</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}</span><span style={{fontFamily:t.fontMono,fontSize:13,color:win||exact?t.accent:t.text}}>{fmtNum(p.guess)} {q.unit}</span><span style={{fontFamily:t.fontMono,fontSize:11,color:t.muted,minWidth:44,textAlign:"right"}}>Δ{fmtNum(p.diff)}</span>{pts>0&&<Pill t={t} color={exact?t.green:t.gold}>+{pts}P</Pill>}</div>;})}
    </Card>
    {Object.keys(bets).length>0&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>BETS</p>
      {pl.map(p=>{
        const b=bets[p.id];if(!b)return null;
        const cp=pl.find(x=>x.id===b.closest),fp=pl.find(x=>x.id===b.farthest);
        const okC=b.closest===closestId,okF=b.farthest===farthestId;
        const betPts=(rs[p.id]||0)-(()=>{const diff=Math.abs((guesses[p.id]||0)-q.a);const base=diff===0?2:p.id===closestId&&!ranked.some(r=>r.diff===0)?1:0;return base;})();
        return <div key={p.id} style={{marginBottom:12,padding:"10px 12px",background:t.surface,borderRadius:t.radius,border:`1px solid ${t.border}`}}>
          <div style={{...row,marginBottom:8}}>
            <Avatar name={p.name} t={t} size={26}/>
            <span style={{fontWeight:700,fontSize:14}}>{p.name}</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:100,background:okC?t.green+"22":t.danger+"18",border:`1px solid ${okC?t.green:t.danger}`,fontSize:13}}>
              <span>{okC?"🎯":"❌"}</span>
              <span style={{color:okC?t.green:t.danger,fontWeight:700}}>Closest: {cp?.name||"?"}</span>
              {okC&&<span style={{color:t.green,fontSize:11,fontWeight:800}}>+1P</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:100,background:okF?t.green+"22":t.danger+"18",border:`1px solid ${okF?t.green:t.danger}`,fontSize:13}}>
              <span>{okF?"💀":"❌"}</span>
              <span style={{color:okF?t.green:t.danger,fontWeight:700}}>Furthest: {fp?.name||"?"}</span>
              {okF&&<span style={{color:t.green,fontSize:11,fontWeight:800}}>+1P</span>}
            </div>
          </div>
        </div>;
      })}
    </Card>}
    <Card t={t} style={{marginBottom:18}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{t.id==="kids"?"POINTS 🏆":"TOTAL POINTS"}</p>
      {[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<pl.length-1?`1px solid ${t.border}`:"none"}}><span style={{fontFamily:t.fontTitle,fontSize:20,color:i===0?t.gold:t.muted,minWidth:20}}>{i+1}</span><Avatar name={p.name} t={t} size={30}/><span style={{flex:1,fontWeight:p.id===myId?800:400}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:12}}> (You)</span>}</span><span style={{fontFamily:t.fontTitle,fontSize:32,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span></div>)}
    </Card>
    {isHost?<div style={{display:"flex",gap:10}}><Btn t={t} onClick={onNext} full>Nächste Question →</Btn><Btn t={t} variant="secondary" onClick={onEnd}>End game</Btn></div>:<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{t.id==="kids"?"Waiting for the host 🙂":"Waiting for the host..."}</p>}
  </div>;
}

/* ─── FINAL ──────────────────────────────────────── */
function FinalScreen({room,myId,t,onRestart}){
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const scores=room.scores||{};
  const allBets=room.allBets||{};  // accumulated bets across rounds
  const allGuesses=room.allGuesses||{};  // accumulated guesses across rounds
  const sorted=[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const winner=sorted[0];
  const loser=sorted[sorted.length-1];
  const medals=["🥇","🥈","🥉"];
  useEffect(()=>{launchConfetti();},[]);

  // Calculate stats from history
  const history=room.history||[];
  const totalRounds=history.length;

  // Bet king: most correct bets
  const betWins={};
  const betTotal={};
  pl.forEach(p=>{betWins[p.id]=0;betTotal[p.id]=0;});
  history.forEach(r=>{
    if(!r.bets||!r.closestId)return;
    Object.entries(r.bets).forEach(([pid,bet])=>{
      if(!bet)return;
      betTotal[pid]=(betTotal[pid]||0)+2;
      if(bet.closest===r.closestId) betWins[pid]=(betWins[pid]||0)+1;
      if(bet.farthest===r.farthestId) betWins[pid]=(betWins[pid]||0)+1;
    });
  });
  const betKingId=pl.reduce((best,p)=>(!best||betWins[p.id]>betWins[best])&&betTotal[p.id]>0?p.id:best,null);
  const betKing=pl.find(p=>p.id===betKingId);
  const betKingRate=betKingId&&betTotal[betKingId]>0?Math.round((betWins[betKingId]/betTotal[betKingId])*100):0;

  // Worst guesser: highest average diff
  const avgDiff={};
  const diffCount={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g==null)return;
      avgDiff[pid]=(avgDiff[pid]||0)+Math.abs(g-r.answer);
      diffCount[pid]=(diffCount[pid]||0)+1;
    });
  });
  const worstId=pl.reduce((worst,p)=>{
    if(!diffCount[p.id])return worst;
    const avg=avgDiff[p.id]/diffCount[p.id];
    if(!worst)return p.id;
    return avg>(avgDiff[worst]/diffCount[worst])?p.id:worst;
  },null);
  const worstPlayer=pl.find(p=>p.id===worstId);

  const bestId=pl.reduce((best,p)=>{
    if(!diffCount[p.id])return best;
    const avg=avgDiff[p.id]/diffCount[p.id];
    if(!best)return p.id;
    return avg<(avgDiff[best]/diffCount[best])?p.id:best;
  },null);
  const bestPlayer=pl.find(p=>p.id===bestId);

  // Exact hits per player
  const exactHits={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g!=null&&Math.abs(g-r.answer)===0) exactHits[pid]=(exactHits[pid]||0)+1;
    });
  });
  const exactKingId=pl.reduce((best,p)=>(exactHits[p.id]||0)>(exactHits[best]||0)?p.id:best,pl[0]?.id);
  const exactKing=pl.find(p=>p.id===exactKingId);

  const bestAvg=bestId&&diffCount[bestId]?Math.round(avgDiff[bestId]/diffCount[bestId]*10)/10:null;
  const worstAvg=worstId&&diffCount[worstId]?Math.round(avgDiff[worstId]/diffCount[worstId]*10)/10:null;

  const statCards=[
    betKing&&{icon:"🎲",label:"Bet King",name:betKing.name,sub:`${betWins[betKingId]} von ${betTotal[betKingId]} bets correct (${betKingRate}%)`,color:t.gold},
    bestPlayer&&sorted.length>1&&{icon:"🎯",label:"Best Guesser",name:bestPlayer.name,sub:`avg. ${fmtNum(bestAvg)} ${totalRounds>0?"deviation":""}`,color:t.green},
    worstPlayer&&sorted.length>1&&bestId!==worstId&&{icon:"🙈",label:"Worst Guesser",name:worstPlayer.name,sub:`avg. ${fmtNum(worstAvg)} deviation`,color:t.danger},
    exactKing&&(exactHits[exactKingId]||0)>0&&{icon:"💥",label:"Bull's-eyes",name:exactKing.name,sub:`${exactHits[exactKingId]} exact hits`,color:t.accent},
  ].filter(Boolean);

  return <div style={{...page,textAlign:"center",paddingTop:36}}>
    <div style={{fontSize:68,animation:"pop .7s ease both"}}>{t.id==="kids"?"🏆🎉🌟":"🏆"}</div>
    <div style={{fontFamily:t.fontTitle,fontSize:50,color:t.gold,marginTop:6,animation:"pop .7s .1s ease both",lineHeight:1}}>{winner?.name||"?"}</div>
    <p style={{color:t.muted,fontSize:16,margin:"5px 0 24px"}}>{t.id==="kids"?`wins with ${scores[winner?.id]||0} points! 🎊`:`wins with ${scores[winner?.id]||0} points.`}</p>

    {/* Endstand */}
    <Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>FINAL SCORE</p>
      {sorted.map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<sorted.length-1?`1px solid ${t.border}`:"none",animation:`fu .4s ${i*.08}s ease both`}}>
        <span style={{fontSize:20,minWidth:26}}>{medals[i]||`${i+1}.`}</span>
        <Avatar name={p.name} t={t}/>
        <span style={{flex:1,fontWeight:p.id===myId?800:400,fontSize:15,textAlign:"left"}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:11}}> (You)</span>}</span>
        <span style={{fontFamily:t.fontTitle,fontSize:36,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span>
      </div>)}
    </Card>

    {/* Stats */}
    {statCards.length>0&&<Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>STATS</p>
      {statCards.map((s,i)=><div key={i} style={{...row,padding:"10px 12px",borderRadius:t.radius,background:s.color+"14",border:`1px solid ${s.color}33`,marginBottom:8}}>
        <div style={{fontSize:26,minWidth:34}}>{s.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:s.color,fontWeight:700,letterSpacing:.5,marginBottom:1}}>{s.label.toUpperCase()}</div>
          <div style={{fontWeight:800,fontSize:15}}>{s.name}</div>
          <div style={{fontSize:12,color:t.muted,marginTop:1}}>{s.sub}</div>
        </div>
      </div>)}
    </Card>}

    <Btn t={t} onClick={onRestart} full style={{marginBottom:16}}>{t.id==="kids"?"🔄 Play again!":"Start new round"}</Btn>
  </div>;
}

/* ─── ROOT APP ───────────────────────────────────── */
export default function App(){
  const[screen,setScreen]=useState("home");
  const[room,setRoom]=useState(null);
  const[code,setCode]=useState(null);
  const[myId]=useState(()=>"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
  const[mode,setMode]=useState("adult");
  const[loading,setLoading]=useState(false);
  const[loadTxt,setLoadTxt]=useState("");
  const usedIdsRef=useRef([]);
  const selectedCatsRef=useRef([]);
  const unsubRef=useRef(null);
  const t=mode==="kids"?KIDS:AYOULT;
  useEffect(()=>{inject(globalCSS(t));},[t]);

  function listenRoom(c){
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=dbListen(c,r=>{
      if(!r)return;
      setRoom({...r});
      setMode(r.mode||"adult");
      const map={lobby:"lobby",categories:"categories",question:"question",betting:"betting",results:"results",final:"final"};
      if(map[r.phase])setScreen(map[r.phase]);
      // reset advance guards on new question
      if(r.phase==="question"){advanceGuessPhaseRef.current=false;advanceBetPhaseRef.current=false;}
      if(r.phase==="betting"){advanceBetPhaseRef.current=false;}
    });
  }

  async function handleHost(name,m){
    setMode(m);
    const c=genCode();
    setCode(c);
    await dbSet(c,{code:c,mode:m,hostId:myId,players:{[myId]:{id:myId,name}},order:[myId],phase:"lobby",guesses:{},bets:{},scores:{},roundScores:{},q:null,qIdx:0,history:[]});
    listenRoom(c);
  }

  async function handleJoin(c,name,m){
    setMode(m||"adult");
    setCode(c);
    const r=await dbGet(c);
    await dbPatch(c,{players:{...r.players,[myId]:{id:myId,name}},order:[...(r.order||[]),myId]});
    listenRoom(c);
  }

  async function handleGoCategories(){
    await dbPatch(code,{phase:"categories"});
  }

  async function handleStartWithCats(selectedCats){
    selectedCatsRef.current=selectedCats;
    const q=getQuestion(mode,selectedCats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:0,selectedCats});
  }

  async function handleGuess(val){
    // write own guess
    await update(ref(db,`rooms/${code}/guesses`),{[myId]:val});
    // only the HOST decides when to advance phase – avoids race conditions
    // the onValue listener (listenRoom) will pick up the change for everyone
    // host watches and advances once all guesses are in
  }

  // called by the room listener whenever room updates
  const advanceGuessPhaseRef=useRef(false);
  useEffect(()=>{
    if(!room||room.phase!=="question")return;
    const order=room.order||[];
    const guesses=room.guesses||{};
    const allDone=order.length>0&&order.every(id=>guesses[id]!=null);
    // only host advances to avoid double-write
    if(allDone&&room.hostId===myId&&!advanceGuessPhaseRef.current){
      advanceGuessPhaseRef.current=true;
      const advance=async()=>{
        const r=await dbGet(code);
        const g=r.guesses||{};
        const stillAllDone=(r.order||[]).every(id=>g[id]!=null);
        if(!stillAllDone)return;
        if((r.order||[]).length<3){
          const merged={...r,guesses:g};
          const{roundScores,newScores,closestId,farthestId}=calcRound(merged);
          const histEntry={guesses:g,answer:r.q?.a,bets:{},closestId,farthestId};
          const prevHistory=r.history||[];
          await dbPatch(code,{phase:"results",roundScores,scores:newScores,history:[...prevHistory,histEntry]});
        } else {
          await dbPatch(code,{phase:"betting"});
        }
      };
      advance();
    }
    if(!allDone) advanceGuessPhaseRef.current=false;
  },[room?.guesses,room?.phase]);

  async function handleBet(closest,farthest){
    await update(ref(db,`rooms/${code}/bets`),{[myId]:{closest,farthest}});
    // host advances phase once all bets are in
  }

  const advanceBetPhaseRef=useRef(false);
  useEffect(()=>{
    if(!room||room.phase!=="betting")return;
    const order=room.order||[];
    const bets=room.bets||{};
    const allDone=order.length>0&&order.every(id=>bets[id]&&bets[id].closest&&bets[id].farthest);
    if(allDone&&room.hostId===myId&&!advanceBetPhaseRef.current){
      advanceBetPhaseRef.current=true;
      const advance=async()=>{
        const r=await dbGet(code);
        const b=r.bets||{};
        const stillAllDone=(r.order||[]).every(id=>b[id]&&b[id].closest&&b[id].farthest);
        if(!stillAllDone)return;
        const{roundScores,newScores,closestId,farthestId}=calcRound(r);
        const histEntry={guesses:r.guesses,answer:r.q?.a,bets:b,closestId,farthestId};
        const prevHistory=r.history||[];
        await dbPatch(code,{phase:"results",roundScores,scores:newScores,history:[...prevHistory,histEntry]});
      };
      advance();
    }
    if(!allDone) advanceBetPhaseRef.current=false;
  },[room?.bets,room?.phase]);

  async function handleNext(){
    const r=await dbGet(code);
    const cats=r.selectedCats||selectedCatsRef.current||Object.keys(QUESTIONS[mode]);
    const q=getQuestion(mode,cats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:(r.qIdx||0)+1});
  }

  async function handleEnd(){await dbPatch(code,{phase:"final"});}

  function handleRestart(){
    if(unsubRef.current)unsubRef.current();
    setRoom(null);setCode(null);setScreen("home");
    usedIdsRef.current=[];selectedCatsRef.current=[];
  }

  return <>
    {loading&&<LoadingOverlay t={t} text={loadTxt}/>}
    {screen==="home"&&<HomeScreen onHost={handleHost} onJoin={handleJoin}/>}
    {screen==="lobby"&&room&&<LobbyScreen room={room} code={code} myId={myId} t={t} onGoCategories={handleGoCategories}/>}
    {screen==="categories"&&room&&room.hostId===myId&&<CategoryScreen mode={mode} onStart={handleStartWithCats} t={t}/>}
    {screen==="categories"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host is choosing categories...</p></div>}
    {screen==="question"&&room&&<QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess}/>}
    {screen==="betting"&&room&&(room.order||[]).length>1&&<BettingScreen room={room} myId={myId} t={t} onBet={handleBet}/>}
    {screen==="results"&&room&&<ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd}/>}
    {screen==="final"&&room&&<FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart}/>}
  </>;
}
