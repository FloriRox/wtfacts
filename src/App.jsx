import { useState, useEffect, useRef } from "react";
import QUESTIONS_RAW from "./questions/index.js";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "wtfacts-958c6.firebaseapp.com",
  databaseURL: "https://wtfacts-958c6-default-rtdb.firebaseio.com",
  projectId: "wtfacts-958c6",
  storageBucket: "wtfacts-958c6.firebasestorage.app",
  messagingSenderId: "504687472282",
  appId: "1:504687472282:web:d129a0ddb9b209f2c13923",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const dbRef    = (c)    => ref(db, `rooms/${c}`);
const dbSet    = (c, v) => set(dbRef(c), v);
const dbPatch  = (c, v) => update(dbRef(c), v);
const dbGet    = (c)    => get(dbRef(c)).then(s => s.val());
const dbListen = (c,fn) => onValue(dbRef(c), s => fn(s.val()));

/* ─── THEMES ──────────────────────────────────────── */
const ADULT = {
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

/* ─── JOKER DEFINITIONS ───────────────────────────── */
const JOKER_DEFS = {
  skip:     { id:"skip",     icon:"⏭️", name:"Frage überspringen", desc:"Mehrheitsvotum – bei Ja wird eine neue Frage gezogen." },
  hint:     { id:"hint",     icon:"🔍", name:"Hinweis aufdecken",  desc:"Zeigt den Hinweis sofort an." },
  double:   { id:"double",   icon:"🎯", name:"Doppelte Punkte",    desc:"Diese Runde zählen alle Punkte doppelt." },
  sabotage: { id:"sabotage", icon:"💣", name:"Sabotage",           desc:"Verschiebe einen Mitspieler um ±20% vom richtigen Wert." },
  change:   { id:"change",   icon:"🔄", name:"Tipp ändern",        desc:"Darf nach Abgabe einmal den Tipp korrigieren." },
  extra:    { id:"extra",    icon:"📊", name:"50/50",              desc:"Zeigt ob die Antwort größer oder kleiner als X ist." },
};

/* ─── QUESTIONS ───────────────────────────────────── */
let QUESTIONS = {};
try {
  Object.keys(QUESTIONS_RAW).forEach(mode => {
    QUESTIONS[mode] = {};
    Object.entries(QUESTIONS_RAW[mode]).forEach(([cat, { questions, locked }]) => {
      QUESTIONS[mode][cat] = questions.map(q => ({ ...q, locked }));
    });
  });
} catch(e) {
  throw new Error("Failed to load questions: " + e.message);
}

/* ─── SHARING ────────────────────────────────────── */
async function shareResult(room, t) {
  const pl = (room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const scores = room.scores||{};
  const sorted = [...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const winner = sorted[0];
  const history = room.history||[];
  const sabotageStats = room.sabotageStats||{};
  const jokerStats = room.jokerStats||{};

  // Build share card as canvas
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const isDark = t.id === 'adult';

  // Background
  ctx.fillStyle = isDark ? '#0d0b0a' : '#fffaf2';
  ctx.fillRect(0, 0, 600, 400);

  // Accent bar top
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, 600, 6);

  // Logo
  ctx.fillStyle = t.accent;
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('Esti', 30, 60);
  ctx.fillStyle = t.gold;
  ctx.fillText('Mates', 102, 60);

  // Tagline
  ctx.fillStyle = isDark ? '#6e5e54' : '#b0a090';
  ctx.font = '13px sans-serif';
  ctx.fillText('The pocket party game to prove your mates wrong.', 30, 82);

  // Winner
  ctx.fillStyle = t.gold;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`🏆 ${winner?.name || '?'} gewinnt!`, 30, 130);
  ctx.fillStyle = isDark ? '#f2ece6' : '#1e1e1e';
  ctx.font = '18px sans-serif';
  ctx.fillText(`${scores[winner?.id]||0} Punkte · ${history.length} Runden`, 30, 158);

  // Divider
  ctx.strokeStyle = isDark ? '#32261e' : '#ffd58a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30,175); ctx.lineTo(570,175); ctx.stroke();

  // Scoreboard
  const medals = ['🥇','🥈','🥉'];
  sorted.slice(0,5).forEach((p,i) => {
    const y = 205 + i*36;
    ctx.fillStyle = i===0 ? t.gold : isDark ? '#6e5e54' : '#b0a090';
    ctx.font = `${i===0?'bold ':''  }16px sans-serif`;
    ctx.fillText(`${medals[i]||`${i+1}.`}  ${p.name}`, 30, y);
    ctx.fillStyle = i===0 ? t.gold : isDark ? '#f2ece6' : '#1e1e1e';
    ctx.font = `bold ${i===0?22:18}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${scores[p.id]||0}P`, 570, y);
    ctx.textAlign = 'left';
  });

  // Fun facts row
  const sabKing = pl.reduce((b,p)=>(sabotageStats[p.id]||0)>(sabotageStats[b?.id]||0)?p:b, null);
  const jokKing = pl.reduce((b,p)=>{
    const tot=Object.values(jokerStats[p.id]||{}).reduce((a,x)=>a+x,0);
    const btot=Object.values(jokerStats[b?.id]||{}).reduce((a,x)=>a+x,0);
    return tot>btot?p:b;
  }, null);

  ctx.fillStyle = isDark ? '#32261e' : '#ffd58a';
  ctx.fillRect(0, 350, 600, 50);
  ctx.fillStyle = isDark ? '#6e5e54' : '#b0a090';
  ctx.font = '13px sans-serif';
  const facts = [
    sabKing&&sabotageStats[sabKing.id]>0?`💣 ${sabKing.name} sabotierte ${sabotageStats[sabKing.id]}x`:null,
    jokKing&&Object.values(jokerStats[jokKing.id]||{}).reduce((a,x)=>a+x,0)>0?`🃏 ${jokKing.name} zockte die meisten Joker`:null,
    `Jetzt spielen: playestimates.app`
  ].filter(Boolean);
  ctx.fillText(facts.join('  ·  '), 20, 380);

  // Convert to blob and share
  return new Promise(resolve => {
    canvas.toBlob(async blob => {
      const file = new File([blob], 'estimateess-ergebnis.png', {type:'image/png'});
      if(navigator.share && navigator.canShare?.({files:[file]})) {
        try {
          await navigator.share({
            title: 'EstiMates Ergebnis',
            text: `🏆 ${winner?.name} gewinnt mit ${scores[winner?.id]||0} Punkten! Spiel mit uns: playestimates.app`,
            files: [file]
          });
        } catch(e) { downloadCanvas(canvas); }
      } else {
        downloadCanvas(canvas);
      }
      resolve();
    }, 'image/png');
  });
}

function downloadCanvas(canvas) {
  const a = document.createElement('a');
  a.download = 'estimatess-ergebnis.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/* ─── HELPERS ─────────────────────────────────────── */
const genCode  = () => Math.random().toString(36).slice(2,7).toUpperCase();
const fmtNum   = (n) => {
  if(n==null) return "?";
  const num=Number(n);
  if(Number.isInteger(num)&&num>=1000&&num<=2200) return String(num);
  if(Number.isInteger(num)) return num.toLocaleString("de-DE");
  return num.toLocaleString("de-DE",{maximumFractionDigits:2});
};
const inviteUrl = (c) => `${location.origin}${location.pathname}?room=${c}`;
function avatarColor(name,t){
  const h=[...(name||"?")].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return t.id==="kids"?`hsl(${h},60%,55%)`:`hsl(${h},40%,32%)`;
}
const inject=(css)=>{
  let el=document.getElementById("em-style");
  if(!el){el=document.createElement("style");el.id="em-style";document.head.appendChild(el);}
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
  let pool=[];
  available.forEach(cat=>{
    cats[cat].forEach((q,i)=>{
      const id=`${cat}::${i}`;
      if(!usedIds.includes(id)) pool.push({...q,id,cat});
    });
  });
  if(!pool.length){
    usedIds.splice(0,usedIds.length);
    available.forEach(cat=>{
      cats[cat].forEach((q,i)=>pool.push({...q,id:`${cat}::${i}`,cat}));
    });
  }
  return pool[Math.floor(Math.random()*pool.length)];
}

function calcRound(room){
  const q=room.q, order=room.order||[], guesses=room.guesses||{}, bets=room.bets||{};
  const doubleActive=!!(room.usedJokerThisRound==="double");
  const ranked=order
    .filter(id=>guesses[id]!=null&&guesses[id]!==-999999&&!(room.afkPlayers||{})[id])
    .map(id=>({id,diff:Math.abs(guesses[id]-q.a)}))
    .sort((a,b)=>a.diff-b.diff);
  const closestId=ranked[0]?.id, farthestId=ranked[ranked.length-1]?.id, anyExact=ranked.some(r=>r.diff===0);
  const roundScores={};
  order.forEach(id=>{
    let pts=0;
    if(guesses[id]==null||guesses[id]===-999999||(room.afkPlayers||{})[id]){roundScores[id]=0;return;}
    const diff=Math.abs(guesses[id]-q.a);
    if(diff===0) pts+=2;
    else if(!anyExact&&id===closestId) pts+=1;
    const bet=bets[id]||{};
    if(bet.closest===closestId) pts+=1;
    if(bet.farthest===farthestId) pts+=1;
    roundScores[id]=doubleActive?pts*2:pts;
  });
  const newScores={...room.scores};
  order.forEach(id=>{newScores[id]=(newScores[id]||0)+(roundScores[id]||0);});
  return{roundScores,newScores,closestId,farthestId};
}

function giveRandomJoker(enabledJokers){
  const pool=enabledJokers&&enabledJokers.length?enabledJokers:Object.keys(JOKER_DEFS);
  return pool[Math.floor(Math.random()*pool.length)];
}

function checkJokerReward(playerId, roundResult, room, enabledJokers){
  // Returns joker type or null
  const {closestId, farthestId, roundScores} = roundResult;
  const streak = (room.farthestStreak||{})[playerId]||0;
  // Exact hit → always a joker
  const guesses=room.guesses||{};
  const q=room.q;
  if(guesses[playerId]!=null && Math.abs(guesses[playerId]-q.a)===0){
    return giveRandomJoker(enabledJokers);
  }
  // Closest → 25% chance
  if(playerId===closestId && Math.random()<0.25){
    return giveRandomJoker(enabledJokers);
  }
  // Correct bet → 25% chance
  const bets=room.bets||{};
  const bet=bets[playerId]||{};
  const betCorrect=bet.closest===closestId||bet.farthest===farthestId;
  if(betCorrect && Math.random()<0.25){
    return giveRandomJoker(enabledJokers);
  }
  // 3x in a row farthest → trost joker
  if(playerId===farthestId && streak>=2){
    return giveRandomJoker(enabledJokers);
  }
  return null;
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

/* ─── PRIMITIVES ──────────────────────────────────── */
const row  = {display:"flex",alignItems:"center",gap:10};
const col  = {display:"flex",flexDirection:"column",gap:12};
const page = {minHeight:"100vh",padding:"24px 16px",maxWidth:520,margin:"0 auto"};

function Spinner({t}){return <div style={{width:28,height:28,border:`3px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto"}}/>;}
function Btn({children,onClick,variant="primary",disabled,t,full,style:sx={}}){
  const base={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"13px 22px",border:"none",borderRadius:t.radius,fontSize:15,fontWeight:700,letterSpacing:.3,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.38:1,transition:"all .15s",width:full?"100%":undefined,WebkitTapHighlightColor:"transparent",userSelect:"none"};
  const v={primary:{background:t.accent,color:"#fff"},secondary:{background:"transparent",color:t.text,border:`2px solid ${t.border}`},ghost:{background:"transparent",color:t.muted},warning:{background:t.gold,color:"#fff"}};
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
    <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:10}}>EINLADUNGS-QR</p>
    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}&bgcolor=${bg}&color=${fg}`} alt="QR" style={{width:130,height:130,borderRadius:t.radius,border:`2px solid ${t.border}`}}/>
    <p style={{fontSize:12,color:t.muted,marginTop:7}}>Scannen zum Beitreten</p>
  </div>;
}

/* ─── JOKER BAR (shown during question) ──────────────── */
function JokerBar({room, myId, code, t}){
  const myJokers=(room.jokers||{})[myId]||[];
  const enabledJokers=room.enabledJokers||[];
  const afk=(room.afkPlayers||{})[myId];
  const [sabotageTarget,setSabotageTarget]=useState("");
  const [showSabotage,setShowSabotage]=useState(false);
  const [showSkipVote,setShowSkipVote]=useState(false);
  const skipVotes=room.skipVotes||{};
  const order=room.order||[];
  const activePlayers=order.filter(id=>!(room.afkPlayers||{})[id]);
  const skipCount=Object.values(skipVotes).filter(Boolean).length;
  const skipNeeded=Math.ceil(activePlayers.length/2);
  const usedThisRound=room.usedJokerThisRound;

  async function useJoker(type){
    if(usedThisRound||afk) return;
    const newJokers=myJokers.filter((_,i)=>i!==myJokers.indexOf(type));
    await update(ref(db,`rooms/${code}/jokers`),{[myId]:newJokers});
    await dbPatch(code,{usedJokerThisRound:type,jokerUsedBy:myId});
    // track usage stats
    const prev=(room.jokerStats||{})[myId]||{};
    const key=`jokerStats/${myId}/${type}`;
    await update(ref(db,`rooms/${code}`),{[key.replace(/\//g,".")]: ((room.jokerStats||{})[myId]?.[type]||0)+1});
    if(type==="double"){
      // no further action needed, calcRound checks usedJokerThisRound
    }
    if(type==="hint"){
      await dbPatch(code,{hintVisible:true});
    }
    if(type==="extra"){
      // reveal bigger/smaller hint
      const guesses=room.guesses||{};
      const vals=Object.values(guesses).filter(v=>v!=null);
      const median=vals.sort((a,b)=>a-b)[Math.floor(vals.length/2)]||0;
      const answer=room.q?.a||0;
      const direction=answer>median?"größer":"kleiner";
      await dbPatch(code,{extraHint:`Die Antwort ist ${direction} als ${fmtNum(median)}`});
    }
    if(type==="sabotage"){
      setShowSabotage(true);
    }
    if(type==="skip"){
      setShowSkipVote(true);
      await update(ref(db,`rooms/${code}/skipVotes`),{[myId]:true});
    }
    if(type==="change"){
      await dbPatch(code,{changeAllowed:myId});
    }
  }

  async function submitSabotage(){
    if(!sabotageTarget) return;
    // shift target's guess by ±20%
    const guesses=room.guesses||{};
    const targetGuess=guesses[sabotageTarget];
    if(targetGuess==null){setShowSabotage(false);return;}
    const shift=Math.random()<0.5?1.2:0.8;
    const newGuess=Math.round(targetGuess*shift);
    await update(ref(db,`rooms/${code}/guesses`),{[sabotageTarget]:newGuess});
    // track sabotage stats
    await update(ref(db,`rooms/${code}`),{[`sabotageStats/${myId}`]:((room.sabotageStats||{})[myId]||0)+1});
    setShowSabotage(false);
  }

  if(!enabledJokers.length||!myJokers.length) return null;

  return <Card t={t} style={{marginTop:12,marginBottom:4}}>
    <p style={{fontSize:11,fontWeight:700,color:t.gold,letterSpacing:.8,marginBottom:8}}>🃏 DEINE JOKER {usedThisRound?<span style={{color:t.muted}}>(diese Runde verbraucht)</span>:""}</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {myJokers.slice(0,5).map((jk,i)=>{
        const def=JOKER_DEFS[jk];
        if(!def) return null;
        return <button key={i} onClick={()=>!usedThisRound&&useJoker(jk)} disabled={!!usedThisRound||!!afk} title={def.desc}
          style={{padding:"8px 14px",borderRadius:t.radius,background:usedThisRound?t.surface:t.gold+"22",border:`1.5px solid ${usedThisRound?t.border:t.gold}`,color:usedThisRound?t.muted:t.gold,fontSize:13,fontWeight:700,cursor:usedThisRound?"not-allowed":"pointer",opacity:usedThisRound?.5:1}}>
          {def.icon} {def.name}
        </button>;
      })}
    </div>
    {/* Skip vote status */}
    {Object.keys(skipVotes).length>0&&<div style={{marginTop:10,padding:"8px 12px",background:t.surface,borderRadius:t.radius,fontSize:13,color:t.muted}}>
      ⏭️ Skip-Abstimmung: <strong style={{color:t.accent}}>{skipCount}/{skipNeeded}</strong> Stimmen nötig
    </div>}
    {/* Extra hint */}
    {room.extraHint&&<div style={{marginTop:10,padding:"8px 12px",background:t.gold+"18",border:`1px solid ${t.gold}44`,borderRadius:t.radius,fontSize:13,color:t.gold,fontWeight:700}}>
      📊 {room.extraHint}
    </div>}
    {/* Sabotage target picker */}
    {showSabotage&&<div style={{marginTop:10}}>
      <p style={{fontSize:13,color:t.danger,fontWeight:700,marginBottom:8}}>💣 Wen sabotieren?</p>
      {order.filter(id=>id!==myId&&!(room.afkPlayers||{})[id]).map(id=>{
        const p=room.players?.[id];
        return <div key={id} onClick={()=>setSabotageTarget(id)} style={{...row,padding:"9px 12px",borderRadius:t.radius,cursor:"pointer",background:sabotageTarget===id?t.danger+"22":t.surface,border:`1.5px solid ${sabotageTarget===id?t.danger:t.border}`,marginBottom:6}}>
          <Avatar name={p?.name} t={t} size={28}/>
          <span style={{fontWeight:600}}>{p?.name}</span>
        </div>;
      })}
      <Btn t={t} variant="primary" style={{background:t.danger,marginTop:8}} onClick={submitSabotage} disabled={!sabotageTarget} full>💣 Sabotieren!</Btn>
    </div>}
  </Card>;
}

/* ─── AFK / PAUSE BUTTON ─────────────────────────── */
function AfkButton({myId, code, room, t}){
  const isAfk=!!(room.afkPlayers||{})[myId];
  async function toggle(){
    await update(ref(db,`rooms/${code}/afkPlayers`),{[myId]:isAfk?null:true});
  }
  return <button onClick={toggle} style={{
    position:"fixed",bottom:20,right:16,
    padding:"10px 16px",borderRadius:100,
    background:isAfk?t.gold:t.surface,
    border:`2px solid ${isAfk?t.gold:t.border}`,
    color:isAfk?t.bg:t.muted,
    fontSize:13,fontWeight:700,
    boxShadow:"0 2px 12px rgba(0,0,0,.3)",
    zIndex:100,cursor:"pointer"
  }}>
    {isAfk?"▶️ Ich bin wieder da!":"⏸️ Kurz weg"}
  </button>;
}

/* ─── HOME ────────────────────────────────────────── */
function HomeScreen({onHost,onJoin}){
  const[tab,setTab]=useState(()=>new URLSearchParams(location.search).get("room")?"join":"landing");
  const[name,setName]=useState("");
  const[code,setCode]=useState(()=>new URLSearchParams(location.search).get("room")||"");
  const[mode,setMode]=useState("adult");
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);
  const t=mode==="kids"?KIDS:ADULT;
  useEffect(()=>{inject(globalCSS(tab==="landing"?ADULT:t));},[t,tab]);

  async function submit(){
    if(!name.trim()){setError("Bitte gib deinen Namen ein.");return;}
    setError("");
    if(tab==="host"){onHost(name.trim(),mode);}
    else{
      const c=code.trim().toUpperCase();
      if(!c){setError("Bitte gib einen Raumcode ein.");return;}
      setBusy(true);
      const room=await dbGet(c);
      setBusy(false);
      if(!room){setError("Raum nicht gefunden.");return;}
      if(room.phase!=="lobby"){setError("Das Spiel läuft bereits.");return;}
      onJoin(c,name.trim(),room.mode);
    }
  }

  if(tab==="landing"){
    inject(globalCSS(ADULT));
    return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:ADULT.bg,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,54,10,.18),transparent 65%)",top:-200,left:"50%",transform:"translateX(-50%)",filter:"blur(50px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",maxWidth:460,width:"100%",position:"relative",animation:"fu .4s ease both"}}>
        <Logo t={ADULT} size="lg"/>
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:44}}>
          <Btn t={ADULT} onClick={()=>{setTab("host");setMode("adult");}} style={{minWidth:150}}>Raum erstellen</Btn>
          <Btn t={ADULT} variant="secondary" onClick={()=>setTab("join")} style={{minWidth:150}}>Beitreten</Btn>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:36}}>
          {["1–15 Spieler","4.800+ Fragen","Echtzeit","Joker"].map(x=><Pill key={x} t={ADULT} color={ADULT.muted}>{x}</Pill>)}
        </div>
      </div>
    </div>;
  }

  return <div style={{...page,background:t.bg,animation:"fu .3s ease both"}}>
    <Btn t={t} variant="ghost" onClick={()=>{setTab("landing");inject(globalCSS(ADULT));}} style={{marginBottom:18,padding:"8px 0"}}>← Zurück</Btn>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:22}}/>
    {tab==="host"&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>SPIELMODUS</p>
      <div style={{display:"flex",gap:10}}>
        {[{id:"adult",icon:"🔥",label:"Erwachsene",sub:"Witzig · obszön"},{id:"kids",icon:"🌈",label:"Kinder",sub:"Bunt · sicher"}].map(m=>(
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
        <Inp value={name} onChange={setName} placeholder={t.id==="kids"?"Dein Name 😊":"Dein Name"} t={t} autoFocus/>
        {tab==="join"&&<Inp value={code} onChange={v=>setCode(v.toUpperCase())} placeholder="Raumcode (z.B. AB3XY)" t={t} style={{letterSpacing:3,fontWeight:700,fontFamily:t.fontMono}}/>}
        {error&&<p style={{color:t.danger,fontSize:13}}>{error}</p>}
        <Btn t={t} onClick={submit} disabled={busy} full>{busy?"Suche Raum...":tab==="host"?`${t.emoji} Raum erstellen`:"Beitreten →"}</Btn>
      </div>
    </Card>
  </div>;
}

/* ─── GAME SETUP (Joker + Speed-Modus) ───────────── */
function JokerSetupScreen({mode, onDone, t}){
  const[withJokers,setWithJokers]=useState(false);
  const[enabled,setEnabled]=useState(Object.keys(JOKER_DEFS));
  const[speedMode,setSpeedMode]=useState(false);
  const[timerSecs,setTimerSecs]=useState(30);
  function toggle(id){setEnabled(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>

    {/* Speed Mode */}
    <div style={{marginTop:20,marginBottom:8}}><Pill t={t} color={t.accent}>⚡ SPEED-MODUS</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?26:32,marginBottom:6}}>Mit Timer spielen?</h2>
    <p style={{color:t.muted,fontSize:13,marginBottom:14}}>Keine Antwort in der Zeit = 0 Punkte.</p>
    <div style={{display:"flex",gap:10,marginBottom:14}}>
      {[{v:false,label:"🐢 Kein Timer"},{v:true,label:"⚡ Speed!"}].map(o=>(
        <button key={String(o.v)} onClick={()=>setSpeedMode(o.v)} style={{flex:1,padding:"14px 8px",borderRadius:t.radius,background:speedMode===o.v?t.accent+"22":t.surface,border:`2px solid ${speedMode===o.v?t.accent:t.border}`,color:speedMode===o.v?t.accent:t.muted,fontWeight:700,fontSize:14,cursor:"pointer",transition:"all .2s",fontFamily:t.fontBody}}>
          {o.label}
        </button>
      ))}
    </div>
    {speedMode&&<Card t={t} style={{marginBottom:16,background:t.accent+"0e",border:`1px solid ${t.accent}33`}}>
      <p style={{fontSize:12,color:t.accent,fontWeight:700,marginBottom:10}}>⏱️ TIMER PRO FRAGE</p>
      <div style={{display:"flex",gap:10}}>
        {[15,30,60].map(s=>(
          <button key={s} onClick={()=>setTimerSecs(s)} style={{flex:1,padding:"12px 6px",borderRadius:t.radius,background:timerSecs===s?t.accent:t.surface,border:`2px solid ${timerSecs===s?t.accent:t.border}`,color:timerSecs===s?"#fff":t.muted,fontWeight:700,fontSize:16,cursor:"pointer",transition:"all .2s",fontFamily:t.fontMono}}>
            {s}s
          </button>
        ))}
      </div>
    </Card>}

    {/* Jokers */}
    <div style={{marginTop:8,marginBottom:8}}><Pill t={t} color={t.gold}>🃏 JOKER</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?26:32,marginBottom:6}}>Mit Jokern spielen?</h2>
    <p style={{color:t.muted,fontSize:13,marginBottom:14}}>Joker werden durch gutes Spielen verdient.</p>
    <div style={{display:"flex",gap:10,marginBottom:14}}>
      {[{v:false,label:"🚫 Ohne Joker"},{v:true,label:"🃏 Mit Jokern"}].map(o=>(
        <button key={String(o.v)} onClick={()=>setWithJokers(o.v)} style={{flex:1,padding:"14px 8px",borderRadius:t.radius,background:withJokers===o.v?t.gold+"22":t.surface,border:`2px solid ${withJokers===o.v?t.gold:t.border}`,color:withJokers===o.v?t.gold:t.muted,fontWeight:700,fontSize:14,cursor:"pointer",transition:"all .2s",fontFamily:t.fontBody}}>
          {o.label}
        </button>
      ))}
    </div>
    {withJokers&&<>
      <p style={{fontSize:12,color:t.muted,marginBottom:12,fontWeight:700,letterSpacing:.5}}>JOKER AUSWÄHLEN (max. 3 aktiv)</p>
      <div style={col}>
        {Object.values(JOKER_DEFS).map(jk=>{
          const on=enabled.includes(jk.id);
          const atMax=enabled.length>=3&&!on;
          return <div key={jk.id} onClick={()=>!atMax&&toggle(jk.id)} style={{...row,padding:"13px 16px",borderRadius:t.radius,cursor:atMax?"not-allowed":"pointer",background:on?t.gold+"18":t.surface,border:`2px solid ${on?t.gold:t.border}`,opacity:atMax?.45:1,transition:"all .15s"}}>
            <span style={{fontSize:22,minWidth:32}}>{jk.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{jk.name}</div>
              <div style={{fontSize:12,color:t.muted,marginTop:2}}>{jk.desc}</div>
            </div>
            <div style={{width:22,height:22,borderRadius:4,background:on?t.gold:t.surface,border:`2px solid ${on?t.gold:t.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,flexShrink:0}}>
              {on?"✓":""}
            </div>
          </div>;
        })}
      </div>
      <Card t={t} style={{marginTop:14,background:t.gold+"10",border:`1px solid ${t.gold}33`}}>
        <p style={{fontSize:12,color:t.gold,fontWeight:700,marginBottom:6}}>🎁 Wie bekommt man Joker?</p>
        <div style={{fontSize:12,color:t.muted,lineHeight:1.7}}>
          🎯 Punktlandung → Joker garantiert<br/>
          🥇 Nächster dran → 25% Chance<br/>
          🎲 Richtige Wette → 25% Chance<br/>
          💀 3× hintereinander Letzter → Trost-Joker
        </div>
      </Card>
    </>}
    <div style={{marginTop:20}}>
      <Btn t={t} full onClick={()=>onDone(withJokers?enabled:[],speedMode,timerSecs)}>
        Weiter →
      </Btn>
    </div>
  </div>;
}

/* ─── CATEGORY SELECTION ─────────────────────────── */
function CategoryScreen({mode,onStart,t}){
  const catMeta=Object.entries(QUESTIONS_RAW[mode]).map(([name,{questions,locked}])=>({name,count:questions.length,locked}));
  const freeKey="🎯 Gratis-Test";
  const[selected,setSelected]=useState([freeKey]);
  function toggle(c,locked){
    if(locked) return;
    setSelected(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  }
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>KATEGORIEN WÄHLEN</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?30:36,marginBottom:6}}>Was wollt ihr spielen?</h2>
    <p style={{color:t.muted,fontSize:14,marginBottom:18}}>Wähle mindestens eine Kategorie</p>
    <div style={{...col,marginBottom:18}}>
      {catMeta.map(({name,count,locked})=>{
        const isFree=name===freeKey;
        const sel=selected.includes(name);
        return <div key={name} onClick={()=>toggle(name,locked)} style={{...row,padding:"13px 16px",borderRadius:t.radius,cursor:locked?"not-allowed":"pointer",background:locked?t.surface:sel?t.accent+"18":t.surface,border:`2px solid ${locked?t.border:sel?t.accent:t.border}`,opacity:locked?0.5:1,transition:"all .15s"}}>
          <div style={{fontSize:22,minWidth:32}}>{locked?"🔒":sel?"✅":"⬜"}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15}}>{name}</div>
            {isFree&&<div style={{fontSize:12,color:t.green,fontWeight:700,marginTop:2}}>✓ Kostenlos – perfekt zum Testen!</div>}
            {locked&&<div style={{fontSize:12,color:t.muted,fontWeight:700,marginTop:2}}>🔒 Kommt bald – kostenpflichtiges Paket</div>}
            <div style={{fontSize:12,color:t.muted,marginTop:1}}>{count} Fragen</div>
          </div>
        </div>;
      })}
    </div>
    <Btn t={t} full disabled={selected.length===0} onClick={()=>onStart(selected)}>
      Spiel starten ({selected.length} {selected.length===1?"Kategorie":"Kategorien"}) →
    </Btn>
  </div>;
}

/* ─── LOBBY ───────────────────────────────────────── */
function LobbyScreen({room,code,myId,t,onGoJokerSetup}){
  const[copied,setCopied]=useState(false);
  const isHost=room.hostId===myId;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const link=inviteUrl(code);
  function copy(){navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>{t.id==="kids"?"🎈 LOBBY":"LOBBY"}</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?34:40,marginBottom:6}}>Warte auf Mitspieler</h2>
    <div style={{...row,marginBottom:16}}>
      <span style={{fontFamily:t.fontMono,fontSize:28,letterSpacing:5,color:t.accent,fontWeight:800}}>{code}</span>
      <Btn t={t} variant="secondary" onClick={copy} style={{padding:"7px 13px",fontSize:13}}>{copied?"✓ Kopiert!":"📋 Link"}</Btn>
    </div>
    <Card t={t} style={{marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.7,marginBottom:12}}>SPIELER ({pl.length}/15)</p>
      <div style={col}>
        {pl.map(p=>(
          <div key={p.id} style={{...row,padding:"10px 12px",background:t.surface,borderRadius:t.radius,border:`1.5px solid ${p.id===myId?t.accent+"55":t.border}`}}>
            <Avatar name={p.name} t={t}/>
            <span style={{flex:1,fontWeight:600}}>{p.name}</span>
            {p.id===room.hostId&&<Pill t={t} color={t.gold}>HOST</Pill>}
            {p.id===myId&&p.id!==room.hostId&&<Pill t={t}>DU</Pill>}
          </div>
        ))}
      </div>
      <QRCode url={link} t={t}/>
    </Card>
    {isHost
      ?<Btn t={t} onClick={onGoJokerSetup} full>{t.id==="kids"?"Los geht's 🎮":"Weiter →"}</Btn>
      :<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>Warte auf den Spielleiter 🙂</p>}
  </div>;
}

/* ─── QUESTION ────────────────────────────────────── */
function QuestionScreen({room,myId,t,onGuess,code}){
  const[val,setVal]=useState("");
  const[timeLeft,setTimeLeft]=useState(null);
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{};
  const myGuess=guesses[myId];
  const afkPlayers=room.afkPlayers||{};
  const activePl=pl.filter(p=>!afkPlayers[p.id]);
  const doneCount=activePl.filter(p=>guesses[p.id]!=null).length;
  const changeAllowed=room.changeAllowed===myId;
  const hintVisible=room.hintVisible;
  const speedMode=room.speedMode;
  const timerSecs=room.timerSecs||30;

  // Speed mode timer
  useEffect(()=>{
    if(!speedMode||myGuess!=null)return;
    setTimeLeft(timerSecs);
    const iv=setInterval(()=>{
      setTimeLeft(prev=>{
        if(prev<=1){
          clearInterval(iv);
          // time's up – submit 0 if no answer given
          onGuess(-999999); // sentinel for "no answer"
          return 0;
        }
        return prev-1;
      });
    },1000);
    return ()=>clearInterval(iv);
  },[speedMode,q?.id,myGuess]);

  if(!q)return <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner t={t}/></div>;

  function submit(){
    const n=parseFloat(val.replace(",","."));
    if(isNaN(n))return;
    onGuess(n);
    setVal("");
  }

  const showInput=myGuess==null||(changeAllowed&&myGuess!=null);

  return <div style={page}>
    <div style={{...row,justifyContent:"space-between",marginBottom:12,animation:"fu .3s ease both"}}>
      <Pill t={t} color={t.green}>{t.id==="kids"?`🎯 Frage ${(room.qIdx||0)+1}`:`FRAGE ${(room.qIdx||0)+1}`}</Pill>
      <div style={{...row,gap:8}}>
        {room.enabledJokers?.length>0&&<span style={{fontSize:13,color:t.gold}}>🃏</span>}
        {room.usedJokerThisRound==="double"&&<Pill t={t} color={t.gold}>2× PUNKTE</Pill>}
        <span style={{fontSize:13,color:t.muted,fontFamily:t.fontMono}}>{doneCount}/{activePl.length} ✓</span>
      </div>
    </div>
    {/* Speed mode timer bar */}
    {speedMode&&myGuess==null&&timeLeft!=null&&<div style={{marginBottom:14,animation:"fu .3s ease both"}}>
      <div style={{...row,justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:13,fontWeight:700,color:timeLeft<=5?t.danger:timeLeft<=10?t.gold:t.green}}>
          ⏱️ {timeLeft}s
        </span>
        <span style={{fontSize:12,color:t.muted}}>Beeil dich!</span>
      </div>
      <div style={{height:6,background:t.border,borderRadius:3,overflow:"hidden"}}>
        <div style={{
          height:"100%",
          width:`${(timeLeft/timerSecs)*100}%`,
          background:timeLeft<=5?t.danger:timeLeft<=10?t.gold:t.green,
          borderRadius:3,
          transition:"width 1s linear, background .3s"
        }}/>
      </div>
    </div>}
    <Card t={t} glow style={{marginBottom:14,animation:"fu .3s .05s ease both"}}>
      <div style={{fontSize:26,marginBottom:8}}>{q.emoji||"❓"}</div>
      <Pill t={t} color={t.muted}>{q.cat}</Pill>
      <p style={{fontSize:t.id==="kids"?20:18,lineHeight:1.55,fontWeight:t.id==="kids"?700:500,marginTop:12}}>{q.q}</p>
      <p style={{marginTop:12,color:t.muted,fontSize:14}}>Antwort in: <strong style={{color:t.gold}}>{q.unit}</strong></p>
      {(hintVisible||room.usedJokerThisRound==="hint")&&<p style={{marginTop:10,padding:"8px 12px",background:t.gold+"18",borderRadius:t.radius,fontSize:13,color:t.gold,fontWeight:600}}>💡 {q.hint}</p>}
    </Card>
    {showInput
      ?<Card t={t} style={{animation:"fu .3s .1s ease both"}}>
        <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.6,marginBottom:10}}>{changeAllowed?"🔄 TIPP ÄNDERN":"DEIN TIPP"} ({q.unit})</p>
        <div style={row}>
          <Inp type="number" value={val} onChange={setVal} placeholder="z.B. 42" t={t} autoFocus style={{fontSize:22,fontWeight:700,fontFamily:t.fontMono}}/>
          <Btn t={t} onClick={submit} disabled={!val} style={{flexShrink:0}}>OK ✓</Btn>
        </div>
        <p style={{marginTop:11,color:t.muted,fontSize:13,lineHeight:1.5}}>💬 Diskutiert – zeigt euren Tipp aber nicht!</p>
      </Card>
      :<Card t={t} style={{textAlign:"center",animation:"fu .3s .1s ease both"}}>
        <div style={{fontSize:42,fontFamily:t.fontMono,color:t.accent,fontWeight:800,marginBottom:6}}>{fmtNum(myGuess)} {q.unit}</div>
        <p style={{color:t.green,fontWeight:700,marginBottom:14}}>✓ Tipp abgegeben!</p>
        <div style={{fontSize:12,color:t.muted,display:"flex",justifyContent:"space-between",marginBottom:5}}><span>Warte auf alle...</span><span>{doneCount}/{activePl.length}</span></div>
        <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${activePl.length?doneCount/activePl.length*100:0}%`,background:`linear-gradient(90deg,${t.accent},${t.gold})`,borderRadius:3,transition:"width .4s ease"}}/></div>
      </Card>}

    {/* Joker bar */}
    {room.enabledJokers?.length>0&&<JokerBar room={room} myId={myId} code={code} t={t}/>}

    {/* Player status chips */}
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:14}}>
      {pl.map(p=>{
        const done=guesses[p.id]!=null;
        const isAfk=afkPlayers[p.id];
        return <div key={p.id} style={{padding:"5px 12px",borderRadius:100,fontSize:13,fontWeight:700,border:`1px solid ${isAfk?t.gold:done?t.green:t.border}`,color:isAfk?t.gold:done?t.green:t.muted,background:isAfk?t.gold+"18":done?t.green+"18":t.surface,transition:"all .25s"}}>
          {p.name} {isAfk?"⏸️":done?"✓":"…"}
        </div>;
      })}
    </div>

    {/* AFK button */}
    <AfkButton myId={myId} code={code} room={room} t={t}/>
  </div>;
}

/* ─── BETTING ─────────────────────────────────────── */
function BettingScreen({room,myId,t,onBet,code}){
  const[closest,setClosest]=useState("");
  const[farthest,setFarthest]=useState("");
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const afkPlayers=room.afkPlayers||{};
  const others=pl.filter(p=>p.id!==myId&&!afkPlayers[p.id]);
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
    <Pill t={t} color={t.gold}>WETTEN</Pill>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?32:38,margin:"8px 0 5px"}}>Wer trifft's am besten?</h2>
    <p style={{color:t.muted,marginBottom:18,fontSize:14}}>Richtige Wette = +1 Punkt extra</p>
    {myBet
      ?<Card t={t} style={{textAlign:"center"}}><div style={{fontSize:52,animation:"bop 1.2s ease infinite",marginBottom:10}}>🎲</div><p style={{fontWeight:700,fontSize:17}}>Wette gesetzt!</p><p style={{color:t.muted,marginTop:7,animation:"pulse 1.5s ease infinite"}}>Warte auf Auflösung...</p></Card>
      :<>
        <RG label="🎯 AM NÄCHSTEN dran" color={t.green} val={closest} setVal={setClosest}/>
        {!soloOther&&<RG label="💀 AM WEITESTEN daneben" color={t.danger} val={farthest} setVal={setFarthest}/>}
        {soloOther&&<p style={{color:t.muted,fontSize:13,marginBottom:12,textAlign:"center"}}>Bei 2 Spielern reicht eine Auswahl 👆</p>}
        <Btn t={t} full disabled={!canSubmit} onClick={submitBet}>Wette abgeben 🎲</Btn>
      </>}
    <AfkButton myId={myId} code={code} room={room} t={t}/>
  </div>;
}

/* ─── RESULTS ─────────────────────────────────────── */
function ResultsScreen({room,myId,t,onNext,onEnd}){
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{},bets=room.bets||{},scores=room.scores||{},rs=room.roundScores||{};
  const isHost=room.hostId===myId;
  const medals=["🥇","🥈","🥉"];
  const afkPlayers=room.afkPlayers||{};
  const ranked=pl.filter(p=>guesses[p.id]!=null&&guesses[p.id]!==-999999&&!afkPlayers[p.id]).map(p=>({...p,guess:guesses[p.id],diff:Math.abs(guesses[p.id]-q.a)})).sort((a,b)=>a.diff-b.diff);
  const noAnswer=pl.filter(p=>guesses[p.id]===-999999&&!afkPlayers[p.id]);
  const closestId=ranked[0]?.id,farthestId=ranked[ranked.length-1]?.id;
  const doubleActive=room.usedJokerThisRound==="double";
  const jokerUsedBy=room.jokerUsedBy;
  const jokerUsedName=jokerUsedBy?room.players?.[jokerUsedBy]?.name:"";

  // show newly earned jokers
  const myNewJoker=room.newJokersThisRound?.[myId];

  return <div style={page}>
    <div style={{textAlign:"center",marginBottom:22,animation:"fu .3s ease both"}}>
      <div style={{fontSize:30,marginBottom:6}}>{q.emoji||"❓"}</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
        <Pill t={t}>AUFLÖSUNG</Pill>
        {room.speedMode&&<Pill t={t} color={t.accent}>⚡ Speed</Pill>}
      </div>
      {doubleActive&&<div style={{marginTop:8}}><Pill t={t} color={t.gold}>🎯 DOPPELTE PUNKTE aktiv!</Pill></div>}
      {room.usedJokerThisRound&&room.usedJokerThisRound!=="double"&&<div style={{marginTop:8,fontSize:13,color:t.gold}}>{JOKER_DEFS[room.usedJokerThisRound]?.icon} {jokerUsedName} nutzte: {JOKER_DEFS[room.usedJokerThisRound]?.name}</div>}
      <div style={{fontFamily:t.fontTitle,fontSize:"clamp(50px,12vw,82px)",color:t.accent,lineHeight:1,marginTop:8,animation:"pop .5s ease both"}}>{fmtNum(q.a)} {q.unit}</div>
      <p style={{color:t.muted,marginTop:11,fontSize:15,lineHeight:1.6,maxWidth:380,margin:"11px auto 0"}}>{q.hint}</p>
    </div>
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>TIPPS DIESER RUNDE</p>
      {ranked.map((p,i)=>{const exact=p.diff===0,win=i===0&&!exact,pts=rs[p.id]||0;return <div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:exact?t.green+"18":win?t.accent+"14":t.surface,border:`1.5px solid ${exact?t.green:win?t.accent+"44":t.border}`,animation:`fu .3s ${i*.07}s ease both`}}><span style={{fontSize:18,minWidth:20}}>{medals[i]||`${i+1}.`}</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}</span><span style={{fontFamily:t.fontMono,fontSize:13,color:win||exact?t.accent:t.text}}>{fmtNum(p.guess)} {q.unit}</span><span style={{fontFamily:t.fontMono,fontSize:11,color:t.muted,minWidth:44,textAlign:"right"}}>Δ{fmtNum(p.diff)}</span>{pts>0&&<Pill t={t} color={exact?t.green:t.gold}>+{pts}P</Pill>}</div>;})}
      {noAnswer&&noAnswer.map(p=><div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:t.danger+"10",border:`1.5px solid ${t.danger}33`,opacity:.7}}><span style={{fontSize:18,minWidth:20}}>⏱️</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}</span><span style={{color:t.danger,fontSize:13,fontWeight:700}}>Zu langsam!</span><Pill t={t} color={t.danger}>0P</Pill></div>)}
    </Card>
    {Object.keys(bets).length>0&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>WETTEN</p>
      {pl.map(p=>{
        const b=bets[p.id];if(!b)return null;
        const cp=pl.find(x=>x.id===b.closest),fp=pl.find(x=>x.id===b.farthest);
        const okC=b.closest===closestId,okF=b.farthest===farthestId;
        return <div key={p.id} style={{marginBottom:12,padding:"10px 12px",background:t.surface,borderRadius:t.radius,border:`1px solid ${t.border}`}}>
          <div style={{...row,marginBottom:8}}><Avatar name={p.name} t={t} size={26}/><span style={{fontWeight:700,fontSize:14}}>{p.name}</span></div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:100,background:okC?t.green+"22":t.danger+"18",border:`1px solid ${okC?t.green:t.danger}`,fontSize:13}}>
              <span>{okC?"🎯":"❌"}</span><span style={{color:okC?t.green:t.danger,fontWeight:700}}>Nächster: {cp?.name||"?"}</span>{okC&&<span style={{color:t.green,fontSize:11,fontWeight:800}}>+1P</span>}
            </div>
            {fp&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:100,background:okF?t.green+"22":t.danger+"18",border:`1px solid ${okF?t.green:t.danger}`,fontSize:13}}>
              <span>{okF?"💀":"❌"}</span><span style={{color:okF?t.green:t.danger,fontWeight:700}}>Weitester: {fp?.name||"?"}</span>{okF&&<span style={{color:t.green,fontSize:11,fontWeight:800}}>+1P</span>}
            </div>}
          </div>
        </div>;
      })}
    </Card>}
    {/* New joker notification */}
    {myNewJoker&&<Card t={t} glow style={{marginBottom:12,textAlign:"center",border:`2px solid ${t.gold}`}}>
      <div style={{fontSize:36,marginBottom:6}}>🎁</div>
      <p style={{fontWeight:800,color:t.gold,fontSize:16}}>Du hast einen Joker gewonnen!</p>
      <p style={{color:t.muted,fontSize:14,marginTop:4}}>{JOKER_DEFS[myNewJoker]?.icon} {JOKER_DEFS[myNewJoker]?.name}</p>
    </Card>}
    <Card t={t} style={{marginBottom:18}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>GESAMTPUNKTE</p>
      {[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<pl.length-1?`1px solid ${t.border}`:"none"}}><span style={{fontFamily:t.fontTitle,fontSize:20,color:i===0?t.gold:t.muted,minWidth:20}}>{i+1}</span><Avatar name={p.name} t={t} size={30}/><span style={{flex:1,fontWeight:p.id===myId?800:400}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:12}}> (Du)</span>}</span><span style={{fontFamily:t.fontTitle,fontSize:32,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span></div>)}
    </Card>
    {isHost?<div style={{display:"flex",gap:10}}><Btn t={t} onClick={onNext} full>Nächste Frage →</Btn><Btn t={t} variant="secondary" onClick={onEnd}>Beenden</Btn></div>:<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>Warte auf den Spielleiter 🙂</p>}
  </div>;
}

/* ─── FINAL ───────────────────────────────────────── */
function FinalScreen({room,myId,t,onRestart}){
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const scores=room.scores||{};
  const sorted=[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const winner=sorted[0];
  const medals=["🥇","🥈","🥉"];
  useEffect(()=>{launchConfetti();},[]);
  const history=room.history||[];
  const totalRounds=history.length;

  // Bet stats
  const betWins={},betTotal={};
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
  const betKingId=pl.reduce((best,p)=>(!best||(betWins[p.id]||0)>(betWins[best]||0))&&(betTotal[p.id]||0)>0?p.id:best,null);
  const betKing=pl.find(p=>p.id===betKingId);
  const betKingRate=betKingId&&betTotal[betKingId]>0?Math.round(betWins[betKingId]/betTotal[betKingId]*100):0;

  // Guess stats
  const avgDiff={},diffCount={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g==null)return;
      avgDiff[pid]=(avgDiff[pid]||0)+Math.abs(g-r.answer);
      diffCount[pid]=(diffCount[pid]||0)+1;
    });
  });
  const bestId=pl.reduce((best,p)=>{
    if(!diffCount[p.id])return best;
    if(!best)return p.id;
    return avgDiff[p.id]/diffCount[p.id]<avgDiff[best]/diffCount[best]?p.id:best;
  },null);
  const worstId=pl.reduce((worst,p)=>{
    if(!diffCount[p.id])return worst;
    if(!worst)return p.id;
    return avgDiff[p.id]/diffCount[p.id]>avgDiff[worst]/diffCount[worst]?p.id:worst;
  },null);
  const bestPlayer=pl.find(p=>p.id===bestId);
  const worstPlayer=pl.find(p=>p.id===worstId);
  const bestAvg=bestId&&diffCount[bestId]?Math.round(avgDiff[bestId]/diffCount[bestId]*10)/10:null;
  const worstAvg=worstId&&diffCount[worstId]?Math.round(avgDiff[worstId]/diffCount[worstId]*10)/10:null;

  // Exact hits
  const exactHits={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g!=null&&Math.abs(g-r.answer)===0) exactHits[pid]=(exactHits[pid]||0)+1;
    });
  });
  const exactKingId=pl.reduce((best,p)=>(exactHits[p.id]||0)>(exactHits[best]||0)?p.id:best,pl[0]?.id);
  const exactKing=pl.find(p=>p.id===exactKingId);

  // Joker stats
  const jokerStats=room.jokerStats||{};
  const jokerTotals={};
  pl.forEach(p=>{
    jokerTotals[p.id]=Object.values(jokerStats[p.id]||{}).reduce((a,b)=>a+b,0);
  });
  const jokerKingId=pl.reduce((best,p)=>(jokerTotals[p.id]||0)>(jokerTotals[best]||0)?p.id:best,pl[0]?.id);
  const jokerKing=pl.find(p=>p.id===jokerKingId);

  // Sabotage stats
  const sabotageStats=room.sabotageStats||{};
  const sabotageKingId=pl.reduce((best,p)=>(sabotageStats[p.id]||0)>(sabotageStats[best]||0)?p.id:best,pl[0]?.id);
  const sabotageKing=pl.find(p=>p.id===sabotageKingId&&(sabotageStats[p.id]||0)>0);

  const statCards=[
    betKing&&{icon:"🎲",label:"Wettkönig",name:betKing.name,sub:`${betWins[betKingId]} von ${betTotal[betKingId]} Wetten (${betKingRate}%)`,color:t.gold},
    bestPlayer&&sorted.length>1&&{icon:"🎯",label:"Bester Schätzer",name:bestPlayer.name,sub:`Ø ${fmtNum(bestAvg)} Abweichung`,color:t.green},
    worstPlayer&&sorted.length>1&&bestId!==worstId&&{icon:"🙈",label:"Schlechtester Schätzer",name:worstPlayer.name,sub:`Ø ${fmtNum(worstAvg)} Abweichung`,color:t.danger},
    exactKing&&(exactHits[exactKingId]||0)>0&&{icon:"💥",label:"Punktlandungen",name:exactKing.name,sub:`${exactHits[exactKingId]} exakte Treffer`,color:t.accent},
    jokerKing&&(jokerTotals[jokerKingId]||0)>0&&{icon:"🃏",label:"Joker-König",name:jokerKing.name,sub:`${jokerTotals[jokerKingId]} Joker gezockt`,color:t.gold},
    sabotageKing&&{icon:"💣",label:"Sabotage-König",name:sabotageKing.name,sub:`${sabotageStats[sabotageKingId]} Sabotagen`,color:t.danger},
  ].filter(Boolean);

  return <div style={{...page,textAlign:"center",paddingTop:36}}>
    <div style={{fontSize:68,animation:"pop .7s ease both"}}>{t.id==="kids"?"🏆🎉🌟":"🏆"}</div>
    <div style={{fontFamily:t.fontTitle,fontSize:50,color:t.gold,marginTop:6,animation:"pop .7s .1s ease both",lineHeight:1}}>{winner?.name||"?"}</div>
    <p style={{color:t.muted,fontSize:16,margin:"5px 0 24px"}}>gewinnt mit {scores[winner?.id]||0} Punkten! 🎊</p>
    <Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>ENDSTAND</p>
      {sorted.map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<sorted.length-1?`1px solid ${t.border}`:"none",animation:`fu .4s ${i*.08}s ease both`}}>
        <span style={{fontSize:20,minWidth:26}}>{medals[i]||`${i+1}.`}</span>
        <Avatar name={p.name} t={t}/>
        <span style={{flex:1,fontWeight:p.id===myId?800:400,fontSize:15,textAlign:"left"}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:11}}> (Du)</span>}</span>
        <span style={{fontFamily:t.fontTitle,fontSize:36,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span>
      </div>)}
    </Card>
    {statCards.length>0&&<Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>STATISTIKEN</p>
      {statCards.map((s,i)=><div key={i} style={{...row,padding:"10px 12px",borderRadius:t.radius,background:s.color+"14",border:`1px solid ${s.color}33`,marginBottom:8}}>
        <div style={{fontSize:26,minWidth:34}}>{s.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:s.color,fontWeight:700,letterSpacing:.5,marginBottom:1}}>{s.label.toUpperCase()}</div>
          <div style={{fontWeight:800,fontSize:15}}>{s.name}</div>
          <div style={{fontSize:12,color:t.muted,marginTop:1}}>{s.sub}</div>
        </div>
      </div>)}
    </Card>}
    {/* Share button */}
    <Btn t={t} variant="secondary" full onClick={()=>shareResult(room,t)} style={{marginBottom:12}}>
      📤 Ergebnis teilen / speichern
    </Btn>
    <Btn t={t} onClick={onRestart} full style={{marginBottom:16}}>🔄 Nochmal spielen!</Btn>
  </div>;
}

/* ─── ROOT APP ────────────────────────────────────── */
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
  const enabledJokersRef=useRef([]);
  const unsubRef=useRef(null);
  const advanceGuessPhaseRef=useRef(false);
  const advanceBetPhaseRef=useRef(false);
  const t=mode==="kids"?KIDS:ADULT;
  useEffect(()=>{inject(globalCSS(t));},[t]);

  function listenRoom(c){
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=dbListen(c,r=>{
      if(!r)return;
      setRoom({...r});
      setMode(r.mode||"adult");
      const map={lobby:"lobby",jokerSetup:"jokerSetup",categories:"categories",question:"question",betting:"betting",results:"results",final:"final"};
      if(map[r.phase])setScreen(map[r.phase]);
      if(r.phase==="question"){advanceGuessPhaseRef.current=false;advanceBetPhaseRef.current=false;}
      if(r.phase==="betting"){advanceBetPhaseRef.current=false;}
    });
  }

  async function handleHost(name,m){
    setMode(m);
    const c=genCode();
    setCode(c);
    await dbSet(c,{code:c,mode:m,hostId:myId,players:{[myId]:{id:myId,name}},order:[myId],phase:"lobby",guesses:{},bets:{},scores:{},roundScores:{},q:null,qIdx:0,history:[],jokers:{},enabledJokers:[],jokerStats:{},sabotageStats:{},farthestStreak:{},afkPlayers:{}});
    listenRoom(c);
  }

  async function handleJoin(c,name,m){
    setMode(m||"adult");
    setCode(c);
    const r=await dbGet(c);
    await dbPatch(c,{players:{...r.players,[myId]:{id:myId,name}},order:[...(r.order||[]),myId]});
    listenRoom(c);
  }

  async function handleGoJokerSetup(){
    await dbPatch(code,{phase:"jokerSetup"});
  }

  async function handleJokerSetupDone(enabledJokers, speedMode, timerSecs){
    enabledJokersRef.current=enabledJokers;
    await dbPatch(code,{enabledJokers,speedMode:!!speedMode,timerSecs:speedMode?timerSecs:null,phase:"categories"});
  }

  async function handleGoCategories(){
    await dbPatch(code,{phase:"categories"});
  }

  async function handleStartWithCats(selectedCats){
    selectedCatsRef.current=selectedCats;
    const q=getQuestion(mode,selectedCats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:0,selectedCats,usedJokerThisRound:null,hintVisible:false,extraHint:null,skipVotes:{},newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1});
  }

  async function handleGuess(val){
    await update(ref(db,`rooms/${code}/guesses`),{[myId]:val});
  }

  // Auto-advance: all guesses in → betting or results
  useEffect(()=>{
    if(!room||room.phase!=="question")return;
    const order=room.order||[];
    const afk=room.afkPlayers||{};
    const activePlayers=order.filter(id=>!afk[id]);
    const guesses=room.guesses||{};
    const allDone=activePlayers.length>0&&activePlayers.every(id=>guesses[id]!=null);
    if(allDone&&room.hostId===myId&&!advanceGuessPhaseRef.current){
      advanceGuessPhaseRef.current=true;
      const advance=async()=>{
        const r=await dbGet(code);
        if(r.phase!=="question")return; // already advanced
        if(r.advancing)return; // another client already processing
        await dbPatch(code,{advancing:true}); // lock
        const g=r.guesses||{};
        const afkP=r.afkPlayers||{};
        const active=(r.order||[]).filter(id=>!afkP[id]);
        if(!active.every(id=>g[id]!=null)){await dbPatch(code,{advancing:false});return;}

        // Check skip votes
        const skipVotes=r.skipVotes||{};
        const skipCount=Object.values(skipVotes).filter(Boolean).length;
        const skipNeeded=Math.ceil(active.length/2);
        if(skipCount>=skipNeeded){
          // skip this question
          const cats=r.selectedCats||selectedCatsRef.current||Object.keys(QUESTIONS[mode]);
          const newQ=getQuestion(mode,cats,usedIdsRef.current);
          if(newQ)usedIdsRef.current.push(newQ.id);
          await dbPatch(code,{phase:"question",q:newQ,guesses:{},bets:{},roundScores:{},qIdx:(r.qIdx||0)+1,usedJokerThisRound:null,hintVisible:false,extraHint:null,skipVotes:{},newJokersThisRound:{},changeAllowed:null});
          return;
        }

        if(active.length<3){
          const merged={...r,guesses:g};
          const result=calcRound(merged);
          const newJokers=await distributeJokers(r,result,active);
          const histEntry={guesses:g,answer:r.q?.a,bets:{},closestId:result.closestId,farthestId:result.farthestId};
          await dbPatch(code,{phase:"results",roundScores:result.roundScores,scores:result.newScores,history:[...(r.history||[]),histEntry],newJokersThisRound:newJokers,advancing:false});
        } else {
          await dbPatch(code,{phase:"betting",advancing:false});
        }
      };
      advance();
    }
    if(!allDone)advanceGuessPhaseRef.current=false;
  },[room?.guesses,room?.phase,room?.skipVotes]);

  async function handleBet(closest,farthest){
    await update(ref(db,`rooms/${code}/bets`),{[myId]:{closest,farthest}});
  }

  // Auto-advance: all bets in → results
  useEffect(()=>{
    if(!room||room.phase!=="betting")return;
    const order=room.order||[];
    const afk=room.afkPlayers||{};
    const active=order.filter(id=>!afk[id]);
    const bets=room.bets||{};
    const allDone=active.length>0&&active.every(id=>bets[id]&&bets[id].closest);
    if(allDone&&room.hostId===myId&&!advanceBetPhaseRef.current){
      advanceBetPhaseRef.current=true;
      const advance=async()=>{
        const r=await dbGet(code);
        if(r.phase!=="betting")return; // already advanced
        if(r.advancing)return; // lock
        await dbPatch(code,{advancing:true});
        const b=r.bets||{};
        const afkP=r.afkPlayers||{};
        const act=(r.order||[]).filter(id=>!afkP[id]);
        if(!act.every(id=>b[id]&&b[id].closest)){await dbPatch(code,{advancing:false});return;}
        const result=calcRound(r);
        const newJokers=await distributeJokers(r,result,act);
        const histEntry={guesses:r.guesses,answer:r.q?.a,bets:b,closestId:result.closestId,farthestId:result.farthestId};
        await dbPatch(code,{phase:"results",roundScores:result.roundScores,scores:result.newScores,history:[...(r.history||[]),histEntry],newJokersThisRound:newJokers,advancing:false});
      };
      advance();
    }
    if(!allDone)advanceBetPhaseRef.current=false;
  },[room?.bets,room?.phase]);

  async function distributeJokers(r, roundResult, activePlayers){
    const enabledJokers=r.enabledJokers||[];
    if(!enabledJokers.length) return {};
    // Guard: only distribute once per round using qIdx as key
    if(r.jokersDistributedForRound===r.qIdx) return {};
    // Mark as distributed immediately to prevent double-run
    await dbPatch(code,{jokersDistributedForRound:r.qIdx});
    const newJokersThisRound={};
    const jokerUpdates={};
    const streakUpdates={};
    const {closestId,farthestId}=roundResult;

    for(const pid of activePlayers){
      const joker=checkJokerReward(pid,roundResult,r,enabledJokers);
      if(joker){
        newJokersThisRound[pid]=joker;
        const existing=(r.jokers||{})[pid]||[];
        // Cap jokers per player at 5 to prevent infinite accumulation
        if(existing.length<5) jokerUpdates[pid]=[...existing,joker];
      }
      if(pid===farthestId){
        streakUpdates[pid]=((r.farthestStreak||{})[pid]||0)+1;
      } else {
        streakUpdates[pid]=0;
      }
    }
    if(Object.keys(jokerUpdates).length){
      await update(ref(db,`rooms/${code}/jokers`),jokerUpdates);
    }
    if(Object.keys(streakUpdates).length){
      await update(ref(db,`rooms/${code}/farthestStreak`),streakUpdates);
    }
    return newJokersThisRound;
  }

  async function handleNext(){
    const r=await dbGet(code);
    const cats=r.selectedCats||selectedCatsRef.current||Object.keys(QUESTIONS[mode]);
    const q=getQuestion(mode,cats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:(r.qIdx||0)+1,usedJokerThisRound:null,hintVisible:false,extraHint:null,skipVotes:{},newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1});
  }

  async function handleEnd(){await dbPatch(code,{phase:"final"});}

  function handleRestart(){
    if(unsubRef.current)unsubRef.current();
    setRoom(null);setCode(null);setScreen("home");
    usedIdsRef.current=[];selectedCatsRef.current=[];enabledJokersRef.current=[];
  }

  return <>
    {loading&&<LoadingOverlay t={t} text={loadTxt}/>}
    {screen==="home"&&<HomeScreen onHost={handleHost} onJoin={handleJoin}/>}
    {screen==="lobby"&&room&&<LobbyScreen room={room} code={code} myId={myId} t={t} onGoJokerSetup={handleGoJokerSetup}/>}
    {screen==="jokerSetup"&&room&&room.hostId===myId&&<JokerSetupScreen mode={mode} onDone={handleJokerSetupDone} t={t}/>}
    {screen==="jokerSetup"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Joker-Einstellungen...</p></div>}
    {screen==="categories"&&room&&room.hostId===myId&&<CategoryScreen mode={mode} onStart={handleStartWithCats} t={t}/>}
    {screen==="categories"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Kategorien...</p></div>}
    {screen==="question"&&room&&<QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess} code={code}/>}
    {screen==="betting"&&room&&(room.order||[]).filter(id=>!(room.afkPlayers||{})[id]).length>1&&<BettingScreen room={room} myId={myId} t={t} onBet={handleBet} code={code}/>}
    {screen==="results"&&room&&<ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd}/>}
    {screen==="final"&&room&&<FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart}/>}
  </>;
}
