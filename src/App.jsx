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
  skip:     { id:"skip",     icon:"⏭️", name:"Frage überspringen", desc:"Sofort! Eine neue Frage wird gezogen – kein Voting nötig." },
  hint:     { id:"hint",     icon:"🔍", name:"Hinweis aufdecken",  desc:"Zeigt den Hinweis sofort an." },
  double:   { id:"double",   icon:"🎯", name:"Doppelte Punkte",    desc:"Diese Runde zählen alle Punkte doppelt." },
  sabotage: { id:"sabotage", icon:"💣", name:"Sabotage",           desc:"Verschiebe den Tipp eines Mitspielers heimlich um 30–80%. Der Gegner merkt nichts – bis zur Auflösung!" },
  change:   { id:"change",   icon:"🔄", name:"Tipp ändern",        desc:"Darf nach Abgabe einmal den Tipp korrigieren." },
  extra:    { id:"extra",    icon:"📊", name:"50/50",              desc:"Zeigt ob die richtige Antwort größer oder kleiner als eine zufällige Zahl in der Nähe ist." },
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
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

async function shareResult(room, t) {
  const pl = (room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const scores = room.scores||{};
  const sorted = [...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const winner = sorted[0];
  const history = room.history||[];
  const sabotageStats = room.sabotageStats||{};
  const jokerStats = room.jokerStats||{};
  const isDark = t.id === 'adult';

  // ── Compute all stats ──
  const betWins={}, betTotal={};
  pl.forEach(p=>{betWins[p.id]=0; betTotal[p.id]=0;});
  history.forEach(r=>{
    if(!r.bets||!r.closestId) return;
    Object.entries(r.bets).forEach(([pid,bet])=>{
      if(!bet) return;
      betTotal[pid]=(betTotal[pid]||0)+2;
      if(bet.closest===r.closestId) betWins[pid]=(betWins[pid]||0)+1;
      if(bet.farthest===r.farthestId) betWins[pid]=(betWins[pid]||0)+1;
    });
  });
  const avgDiff={}, diffCount={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer) return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g==null||g===-999999) return;
      avgDiff[pid]=(avgDiff[pid]||0)+Math.abs(g-r.answer);
      diffCount[pid]=(diffCount[pid]||0)+1;
    });
  });
  const exactHits={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer) return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g!=null&&Math.abs(g-r.answer)===0) exactHits[pid]=(exactHits[pid]||0)+1;
    });
  });
  const betKingId=pl.reduce((b,p)=>(betWins[p.id]||0)>(betWins[b]||0)&&(betTotal[p.id]||0)>0?p.id:b,null);
  const bestId=pl.reduce((b,p)=>{if(!diffCount[p.id])return b;if(!b)return p.id;return avgDiff[p.id]/diffCount[p.id]<avgDiff[b]/diffCount[b]?p.id:b;},null);
  const worstId=pl.reduce((b,p)=>{if(!diffCount[p.id])return b;if(!b)return p.id;return avgDiff[p.id]/diffCount[p.id]>avgDiff[b]/diffCount[b]?p.id:b;},null);
  const exactKingId=pl.reduce((b,p)=>(exactHits[p.id]||0)>(exactHits[b]||0)?p.id:b,pl[0]?.id);
  const sabKingId=pl.reduce((b,p)=>(sabotageStats[p.id]||0)>(sabotageStats[b]||0)?p.id:b,null);
  const jokerTotals={};
  pl.forEach(p=>{jokerTotals[p.id]=Object.values(jokerStats[p.id]||{}).reduce((a,x)=>a+x,0);});
  const jokerKingId=pl.reduce((b,p)=>(jokerTotals[p.id]||0)>(jokerTotals[b]||0)?p.id:b,pl[0]?.id);
  const name=n=>pl.find(p=>p.id===n)?.name||'?';

  // ── Canvas setup ──
  const W=620, PAD=28;
  // Calculate dynamic height
  const statsRows=[
    betKingId&&betTotal[betKingId]>0,
    bestId&&pl.length>1,
    worstId&&pl.length>1&&bestId!==worstId,
    exactKingId&&(exactHits[exactKingId]||0)>0,
    jokerKingId&&jokerTotals[jokerKingId]>0,
    sabKingId&&(sabotageStats[sabKingId]||0)>0,
  ].filter(Boolean).length;
  const H = 120 + 30 + sorted.length*44 + 20 + (statsRows>0?30+statsRows*40+16:0) + 64;

  const canvas = document.createElement('canvas');
  canvas.width = W*2; canvas.height = H*2; // retina
  const ctx = canvas.getContext('2d');
  ctx.scale(2,2);

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0,0,0,H);
  if(isDark){
    bg.addColorStop(0,'#181310');
    bg.addColorStop(1,'#0d0b0a');
  } else {
    bg.addColorStop(0,'#fffaf2');
    bg.addColorStop(1,'#fff4e0');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // ── Top accent bar (gradient) ──
  const barGrad = ctx.createLinearGradient(0,0,W,0);
  barGrad.addColorStop(0, t.accent);
  barGrad.addColorStop(1, t.gold);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0,0,W,5);

  // ── Logo ──
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillStyle = t.accent;
  ctx.fillText('Esti', PAD, 46);
  const estiW = ctx.measureText('Esti').width;
  ctx.fillStyle = t.gold;
  ctx.fillText('Mates', PAD+estiW, 46);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = isDark?'#6e5e54':'#b0a090';
  ctx.fillText('The pocket party game to prove your mates wrong.', PAD, 64);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = isDark?'#32261e':'#ffd58a';
  ctx.fillText(`${history.length} Runden gespielt`, W-PAD-ctx.measureText(`${history.length} Runden gespielt`).width, 64);

  // ── Divider ──
  ctx.strokeStyle = isDark?'#32261e':'#ffd58a';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(PAD,76); ctx.lineTo(W-PAD,76); ctx.stroke();

  // ── Winner banner ──
  const winGrad=ctx.createLinearGradient(PAD,78,W-PAD,78);
  winGrad.addColorStop(0,t.gold+'33');
  winGrad.addColorStop(1,t.gold+'08');
  ctx.fillStyle=winGrad;
  roundRect(ctx,PAD,82,W-PAD*2,46,8);
  ctx.fill();
  ctx.strokeStyle=t.gold+'55';
  ctx.lineWidth=1;
  roundRect(ctx,PAD,82,W-PAD*2,46,8);
  ctx.stroke();

  ctx.font='bold 15px system-ui, sans-serif';
  ctx.fillStyle=t.gold;
  ctx.fillText('🏆', PAD+12, 111);
  ctx.font='bold 18px system-ui, sans-serif';
  ctx.fillText(`${winner?.name||'?'} gewinnt!`, PAD+36, 111);
  ctx.font='13px system-ui, sans-serif';
  ctx.fillStyle=isDark?'#f2ece6':'#1e1e1e';
  const winPts=`${scores[winner?.id]||0} Punkte`;
  ctx.fillText(winPts, W-PAD-ctx.measureText(winPts).width, 111);

  // ── Scoreboard ──
  const medals=['🥇','🥈','🥉'];
  let y=146;
  ctx.font='bold 11px system-ui, sans-serif';
  ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
  ctx.fillText('ENDSTAND', PAD, y); y+=16;

  sorted.forEach((p,i)=>{
    const rowBg = i===0 ? t.gold+'18' : isDark?'#181310':'#fff4e0';
    ctx.fillStyle=rowBg;
    roundRect(ctx,PAD,y,W-PAD*2,36,6);
    ctx.fill();
    if(i===0){ctx.strokeStyle=t.gold+'44';ctx.lineWidth=1;roundRect(ctx,PAD,y,W-PAD*2,36,6);ctx.stroke();}

    ctx.font=`${i===0?'bold ':''}14px system-ui, sans-serif`;
    ctx.fillStyle=i===0?t.gold:isDark?'#6e5e54':'#b0a090';
    ctx.fillText(medals[i]||`${i+1}.`, PAD+10, y+23);

    ctx.font=`${i===0?'bold ':''}15px system-ui, sans-serif`;
    ctx.fillStyle=i===0?t.gold:isDark?'#f2ece6':'#1e1e1e';
    ctx.fillText(p.name, PAD+36, y+23);

    const pts=`${scores[p.id]||0}P`;
    ctx.font=`bold ${i===0?20:16}px system-ui, sans-serif`;
    ctx.fillStyle=i===0?t.gold:isDark?'#f2ece6':'#1e1e1e';
    ctx.fillText(pts, W-PAD-ctx.measureText(pts).width, y+24);
    y+=44;
  });
  y+=8;

  // ── Stats section ──
  const statItems=[
    betKingId&&betTotal[betKingId]>0&&{icon:'🎲',label:'Wettkönig',val:name(betKingId),sub:`${betWins[betKingId]}/${betTotal[betKingId]} Wetten`},
    bestId&&pl.length>1&&{icon:'🎯',label:'Bester Schätzer',val:name(bestId),sub:`Ø ${Math.round(avgDiff[bestId]/diffCount[bestId]*10)/10} Abw.`},
    worstId&&pl.length>1&&bestId!==worstId&&{icon:'🙈',label:'Schlechtester Schätzer',val:name(worstId),sub:`Ø ${Math.round(avgDiff[worstId]/diffCount[worstId]*10)/10} Abw.`},
    exactKingId&&(exactHits[exactKingId]||0)>0&&{icon:'💥',label:'Punktlandungen',val:name(exactKingId),sub:`${exactHits[exactKingId]}× exakt`},
    jokerKingId&&jokerTotals[jokerKingId]>0&&{icon:'🃏',label:'Joker-König',val:name(jokerKingId),sub:`${jokerTotals[jokerKingId]} Joker gespielt`},
    sabKingId&&(sabotageStats[sabKingId]||0)>0&&{icon:'💣',label:'Sabotage-König',val:name(sabKingId),sub:`${sabotageStats[sabKingId]}× sabotiert`},
  ].filter(Boolean);

  if(statItems.length>0){
    ctx.font='bold 11px system-ui, sans-serif';
    ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
    ctx.fillText('STATISTIKEN', PAD, y); y+=14;

    // two columns
    const colW=(W-PAD*2-10)/2;
    statItems.forEach((s,i)=>{
      const cx = PAD + (i%2)*(colW+10);
      const cy = y + Math.floor(i/2)*40;
      ctx.fillStyle=isDark?'#211c18':'#ffffff';
      roundRect(ctx,cx,cy,colW,34,6); ctx.fill();
      ctx.strokeStyle=isDark?'#32261e':'#ffd58a';
      ctx.lineWidth=1;
      roundRect(ctx,cx,cy,colW,34,6); ctx.stroke();

      ctx.font='14px system-ui,sans-serif';
      ctx.fillStyle=isDark?'#f2ece6':'#1e1e1e';
      ctx.fillText(s.icon, cx+8, cy+22);
      ctx.font='bold 12px system-ui,sans-serif';
      ctx.fillStyle=isDark?'#f2ece6':'#1e1e1e';
      ctx.fillText(s.val, cx+28, cy+16);
      ctx.font='10px system-ui,sans-serif';
      ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
      ctx.fillText(`${s.label} · ${s.sub}`, cx+28, cy+28);
    });
    y += Math.ceil(statItems.length/2)*40 + 10;
  }

  // ── Footer with QR Code ──
  const footerGrad=ctx.createLinearGradient(0,y,W,y);
  footerGrad.addColorStop(0,t.accent+'33');
  footerGrad.addColorStop(1,t.gold+'22');
  ctx.fillStyle=footerGrad;
  ctx.fillRect(0,y,W,H-y);
  ctx.strokeStyle=isDark?'#32261e':'#ffd58a';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();

  // Logo + URL left side
  ctx.font='bold 16px system-ui, sans-serif';
  ctx.fillStyle=t.accent;
  ctx.fillText('Esti', PAD, y+24);
  const ew=ctx.measureText('Esti').width;
  ctx.fillStyle=t.gold;
  ctx.fillText('Mates', PAD+ew, y+24);
  ctx.font='12px system-ui, sans-serif';
  ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
  ctx.fillText('playestimates.app', PAD, y+40);
  ctx.font='11px system-ui, sans-serif';
  ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
  ctx.fillText('Scan & mitspielen!', PAD, y+55);

  // ── Share or download (QR drawn async after image loads) ──
  return new Promise(resolve => {
    // Draw QR code from API
    const qrSize=64;
    const qrX=W-PAD-qrSize;
    const qrY=y+4;
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=https://playestimates.app&bgcolor=${isDark?'211c18':'fffaf2'}&color=${isDark?'e8360a':'e8360a'}`;
    const qrImg=new Image();
    qrImg.crossOrigin='anonymous';
    qrImg.onload=async()=>{
      ctx.save();
      ctx.beginPath();
      roundRect(ctx,qrX-4,qrY-4,qrSize+8,qrSize+8,6);
      ctx.fillStyle=isDark?'#211c18':'#ffffff';
      ctx.fill();
      ctx.strokeStyle=isDark?'#32261e':'#ffd58a';
      ctx.lineWidth=1;
      ctx.stroke();
      ctx.drawImage(qrImg,qrX,qrY,qrSize,qrSize);
      ctx.restore();
      canvas.toBlob(async blob => {
        const file = new File([blob], 'estimatess-ergebnis.png', {type:'image/png'});
        if(navigator.share && navigator.canShare?.({files:[file]})) {
          try {
            await navigator.share({
              title: 'EstiMates Ergebnis',
              text: `🏆 ${winner?.name} gewinnt mit ${scores[winner?.id]||0} Punkten! Spielt mit uns: playestimates.app`,
              files: [file]
            });
          } catch(e) { downloadCanvas(canvas); }
        } else {
          downloadCanvas(canvas);
        }
        resolve();
      }, 'image/png');
    };
    qrImg.onerror=async()=>{
      // QR failed – share without it
      canvas.toBlob(async blob => {
        const file = new File([blob], 'estimatess-ergebnis.png', {type:'image/png'});
        if(navigator.share && navigator.canShare?.({files:[file]})) {
          try {
            await navigator.share({
              title: 'EstiMates Ergebnis',
              text: `🏆 ${winner?.name} gewinnt mit ${scores[winner?.id]||0} Punkten! Spielt mit uns: playestimates.app`,
              files: [file]
            });
          } catch(e) { downloadCanvas(canvas); }
        } else {
          downloadCanvas(canvas);
        }
        resolve();
      }, 'image/png');
    };
    qrImg.src=qrUrl;
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

  const anyExact=ranked.some(r=>r.diff===0);
  const minDiff=ranked[0]?.diff??Infinity;
  const maxDiff=ranked[ranked.length-1]?.diff??Infinity;

  // All players tied for closest (same diff as minimum)
  const closestIds=ranked.filter(r=>r.diff===minDiff).map(r=>r.id);
  // All players tied for farthest (same diff as maximum)
  const farthestIds=ranked.filter(r=>r.diff===maxDiff).map(r=>r.id);

  // For Firebase/history: use first closest and first farthest
  const closestId=closestIds[0]||null;
  const farthestId=farthestIds[farthestIds.length-1]||null;

  const roundScores={};
  order.forEach(id=>{
    let pts=0;
    if(guesses[id]==null||guesses[id]===-999999||(room.afkPlayers||{})[id]){roundScores[id]=0;return;}
    const diff=Math.abs(guesses[id]-q.a);
    // Exact hit → 2 pts (all who hit exactly)
    if(diff===0) pts+=2;
    // Closest (not exact) → 1 pt for ALL who share the minimum diff
    else if(!anyExact&&closestIds.includes(id)) pts+=1;
    // Betting points
    const bet=bets[id]||{};
    // Bet counts if the player picked ANY of the tied closest/farthest
    if(closestIds.includes(bet.closest)) pts+=1;
    if(farthestIds.includes(bet.farthest)) pts+=1;
    roundScores[id]=doubleActive?pts*2:pts;
  });
  const newScores={...room.scores};
  order.forEach(id=>{newScores[id]=(newScores[id]||0)+(roundScores[id]||0);});
  return{roundScores,newScores,closestId,farthestId,closestIds,farthestIds};
}

function giveRandomJoker(enabledJokers){
  const pool=enabledJokers&&enabledJokers.length?enabledJokers:Object.keys(JOKER_DEFS);
  return pool[Math.floor(Math.random()*pool.length)];
}

function checkJokerReward(playerId, roundResult, room, enabledJokers){
  const {closestId, farthestId} = roundResult;
  const streak = (room.farthestStreak||{})[playerId]||0;
  const guesses=room.guesses||{};
  const q=room.q;
  // Max 1 of each joker type – filter out types player already has
  const existingJokers=(room.jokers||{})[playerId]||[];
  const available=enabledJokers.filter(jk=>!existingJokers.includes(jk));
  if(!available.length) return null; // player has all joker types already

  function giveAvailable(){
    return available[Math.floor(Math.random()*available.length)];
  }

  // Exact hit → always a joker
  if(guesses[playerId]!=null&&guesses[playerId]!==-999999&&Math.abs(guesses[playerId]-q.a)===0){
    return giveAvailable();
  }
  // Closest → 25% chance (alle Gleichstand-Gewinner)
  const closestIds=roundResult.closestIds||[closestId];
  if(closestIds.includes(playerId) && Math.random()<0.25){
    return giveAvailable();
  }
  // Correct bet → 25% chance
  const bets=room.bets||{};
  const bet=bets[playerId]||{};
  const betCorrect=bet.closest===closestId||bet.farthest===farthestId;
  if(betCorrect && Math.random()<0.25){
    return giveAvailable();
  }
  // 3x in a row farthest → trost joker
  if(playerId===farthestId && streak>=2){
    return giveAvailable();
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
  return <input type="text" inputMode={type==="number"?"text":undefined} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={{width:"100%",padding:"13px 15px",background:t.surface,border:`2px solid ${foc?t.accent:t.border}`,borderRadius:t.radius,color:t.text,fontSize:16,outline:"none",transition:"border-color .2s",...sx}}/>;
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
function JokerBar({room, myId, code, t, onSkip}){
  const myJokers   = (room.jokers||{})[myId]||[];
  const enabled    = room.enabledJokers||[];
  const afk        = !!(room.afkPlayers||{})[myId];
  const usedRound  = !!room.usedJokerThisRound;   // another joker was used this round
  const order      = room.order||[];

  const [showSabotage,   setShowSabotage]   = useState(false);
  const [sabotageTarget, setSabotageTarget] = useState("");

  // Count how many of each type the player holds
  const counts = {};
  myJokers.forEach(jk => { counts[jk] = (counts[jk]||0)+1; });

  const shortDesc = {
    skip:    "Sofort eine neue Frage ziehen",
    hint:    "Zeigt den Hinweis zur Frage an",
    double:  "Alle Punkte dieser Runde ×2",
    sabotage:"Tipp eines Mitspielers heimlich verschieben",
    change:  "Eigenen Tipp einmal korrigieren",
    extra:   "Antwort größer oder kleiner als X?",
  };

  /* ── consume joker from inventory ── */
  async function consume(type){
    const arr = [...myJokers];
    const i   = arr.indexOf(type);
    if(i === -1) return false;
    arr.splice(i, 1);
    await update(ref(db,`rooms/${code}/jokers`), {[myId]: arr});
    // track stats
    const prev = (room.jokerStats||{})[myId]||{};
    await update(ref(db,`rooms/${code}/jokerStats/${myId}`), {[type]: (prev[type]||0)+1});
    return true;
  }

  async function useJoker(type){
    if(afk) return;
    // Skip never blocks on usedRound – it replaces the whole question
    if(type !== "skip" && usedRound) return;
    const ok = await consume(type);
    if(!ok) return;

    if(type === "skip"){
      // Direct call – no Firebase flag needed
      if(onSkip) onSkip();
      return;
    }

    // Mark joker used this round so no second joker is played
    await dbPatch(code, {usedJokerThisRound: type, jokerUsedBy: myId});

    if(type === "hint"){
      await dbPatch(code, {hintVisible: true});
    }

    if(type === "double"){
      // calcRound already checks usedJokerThisRound==="double"
    }

    if(type === "change"){
      await dbPatch(code, {changeAllowed: myId});
    }

    if(type === "extra"){
      const answer  = room.q?.a || 0;
      const factor  = 0.3 + Math.random()*0.5;          // 30–80 %
      const dir     = Math.random() < 0.5 ? 1 : -1;
      const decoy   = Math.round(answer * (1 + dir*factor));
      const bigger  = answer > decoy;
      await dbPatch(code, {
        extraHint:      `Die Antwort ist ${bigger?"größer ↑":"kleiner ↓"} als ${fmtNum(decoy)}`,
        extraHintColor: bigger ? "#39d98a" : "#e8360a",
        extraHintFor:   myId,
      });
    }

    if(type === "sabotage"){
      setShowSabotage(true);
    }
  }

  async function submitSabotage(){
    if(!sabotageTarget){ setShowSabotage(false); return; }
    const g = (room.guesses||{})[sabotageTarget];
    if(g == null || g === -999999){ setShowSabotage(false); return; }
    const factor  = 0.3 + Math.random()*0.5;
    const dir     = Math.random() < 0.5 ? 1 : -1;
    const shifted = Math.round(g * (1 + dir*factor));
    await update(ref(db,`rooms/${code}/guesses`),   {[sabotageTarget]: shifted});
    await update(ref(db,`rooms/${code}/sabotaged`), {[sabotageTarget]: true});
    await update(ref(db,`rooms/${code}/sabotageStats`),
      {[myId]: ((room.sabotageStats||{})[myId]||0)+1});
    setShowSabotage(false);
    setSabotageTarget("");
  }

  if(!enabled.length) return null;

  return <Card t={t} style={{marginTop:12,padding:"14px 16px"}}>
    <p style={{fontSize:11,fontWeight:700,color:t.gold,letterSpacing:.8,marginBottom:10}}>
      🃏 JOKER ({myJokers.length})
      {usedRound && <span style={{color:t.muted,fontWeight:400}}> · diese Runde verbraucht</span>}
    </p>

    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {enabled.map(jk=>{
        const def      = JOKER_DEFS[jk]; if(!def) return null;
        const count    = counts[jk]||0;
        const has      = count > 0;
        const canClick = has && !afk && (jk==="skip" || !usedRound);
        return(
          <div key={jk} onClick={()=>canClick && useJoker(jk)}
            style={{display:"flex",alignItems:"center",gap:10,
              padding:"9px 12px",borderRadius:t.radius,
              background: canClick ? t.gold+"18" : t.surface,
              border:`1.5px solid ${canClick ? t.gold : t.border}`,
              opacity: has ? 1 : 0.3,
              cursor: canClick ? "pointer" : "default",
              transition:"all .15s"}}>
            <span style={{fontSize:18,minWidth:24,textAlign:"center"}}>{def.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,
                color: canClick ? t.gold : t.text}}>{def.name}</div>
              <div style={{fontSize:11,color:t.muted,marginTop:1}}>{shortDesc[jk]}</div>
            </div>
            <div style={{minWidth:22,height:22,borderRadius:100,
              background: has ? t.gold : t.border,
              color: has ? t.bg : t.muted,
              fontSize:12,fontWeight:800,flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {count}
            </div>
          </div>
        );
      })}
    </div>

    {/* 50/50 hint – only visible to the player who used it */}
    {room.extraHint && room.extraHintFor===myId &&
      <div style={{marginTop:10,padding:"10px 14px",
        background:(room.extraHintColor||t.gold)+"18",
        border:`2px solid ${room.extraHintColor||t.gold}`,
        borderRadius:t.radius,textAlign:"center"}}>
        <div style={{fontSize:10,color:room.extraHintColor||t.gold,
          fontWeight:700,letterSpacing:.8,marginBottom:3}}>📊 50/50 – nur für dich!</div>
        <div style={{fontSize:15,color:room.extraHintColor||t.gold,
          fontWeight:800}}>{room.extraHint}</div>
      </div>}

    {/* Sabotage: pick target */}
    {showSabotage &&
      <div style={{marginTop:10}}>
        <p style={{fontSize:13,color:t.danger,fontWeight:700,marginBottom:8}}>
          💣 Wen sabotieren?
        </p>
        {order.filter(id=>id!==myId&&!(room.afkPlayers||{})[id]).map(id=>{
          const p=room.players?.[id];
          return(
            <div key={id} onClick={()=>setSabotageTarget(id)}
              style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 12px",borderRadius:t.radius,cursor:"pointer",
                background: sabotageTarget===id ? t.danger+"22" : t.surface,
                border:`1.5px solid ${sabotageTarget===id ? t.danger : t.border}`,
                marginBottom:6}}>
              <Avatar name={p?.name} t={t} size={28}/>
              <span style={{fontWeight:600}}>{p?.name}</span>
            </div>
          );
        })}
        <Btn t={t} style={{background:t.danger,marginTop:8}}
          onClick={submitSabotage} disabled={!sabotageTarget} full>
          💣 Sabotieren!
        </Btn>
        <Btn t={t} variant="ghost" style={{marginTop:6}}
          onClick={()=>{setShowSabotage(false);setSabotageTarget("");}}>
          Abbrechen
        </Btn>
      </div>}
  </Card>;
}


/* AfkButton inline in screens */

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
function JokerSetupScreen({mode, onDone, t, onToggleDebug, debugModeInit}){
  const[withJokers,setWithJokers]=useState(false);
  const[enabled,setEnabled]=useState(Object.keys(JOKER_DEFS));
  const[speedMode,setSpeedMode]=useState(false);
  const[timerSecs,setTimerSecs]=useState(30);
  const[debugModeLocal,setDebugModeLocal]=useState(!!debugModeInit);
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
    {/* Debug Mode Toggle */}
    <div style={{marginTop:16,padding:"12px 14px",borderRadius:t.radius,background:t.surface,border:`1.5px dashed ${t.border}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:t.muted}}>🛠️ Debug-Modus</div>
          <div style={{fontSize:11,color:t.muted,marginTop:2}}>Joker manuell aufladen während des Spiels</div>
        </div>
        <button onClick={()=>{setDebugModeLocal(p=>!p);onToggleDebug(p=>!p);}} style={{padding:"7px 16px",borderRadius:t.radius,background:debugModeLocal?t.accent:t.surface,border:`2px solid ${debugModeLocal?t.accent:t.border}`,color:debugModeLocal?"#fff":t.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:t.fontBody,transition:"all .2s"}}>
          {debugModeLocal?"AN":"AUS"}
        </button>
      </div>
    </div>
    <div style={{marginTop:14}}>
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
  const allCats=catMeta.filter(c=>!c.locked).map(c=>c.name);
  const[selected,setSelected]=useState(allCats);
  function toggle(c,locked){
    if(locked) return;
    setSelected(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  }
  const allSelected=allCats.every(c=>selected.includes(c));
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>KATEGORIEN WÄHLEN</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?30:36,marginBottom:6}}>Was wollt ihr spielen?</h2>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <p style={{color:t.muted,fontSize:14}}>Wähle mindestens eine Kategorie</p>
      <button onClick={()=>setSelected(allSelected?[]:allCats)} style={{padding:"6px 14px",borderRadius:t.radius,background:allSelected?t.accent+"18":t.surface,border:`1.5px solid ${allSelected?t.accent:t.border}`,color:allSelected?t.accent:t.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:t.fontBody,whiteSpace:"nowrap"}}>
        {allSelected?"✗ Alle aus":"✓ Alle an"}
      </button>
    </div>
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
function QuestionScreen({room,myId,t,onGuess,code,debugMode,onSkip}){
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
          // time's up – submit sentinel
          onGuess(-999999);
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

  const isAfkMe = !!(afkPlayers[myId]);

  return <div style={{
    minHeight:"100vh", display:"flex", flexDirection:"column",
    maxWidth:520, margin:"0 auto", padding:"0 0 80px 0",
    background:t.bg,
  }}>

    {/* ── TOP BAR ── */}
    <div style={{padding:"12px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Pill t={t} color={t.green}>{t.id==="kids"?`🎯 Frage ${(room.qIdx||0)+1}`:`FRAGE ${(room.qIdx||0)+1}`}</Pill>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {room.usedJokerThisRound==="double"&&<Pill t={t} color={t.gold}>2× PUNKTE</Pill>}
        {/* Player chips inline */}
        {pl.map(p=>{
          const done=guesses[p.id]!=null;
          const isAfk=afkPlayers[p.id];
          return <div key={p.id} style={{
            padding:"3px 9px",borderRadius:100,fontSize:11,fontWeight:700,
            border:`1px solid ${isAfk?t.gold:done?t.green:t.border}`,
            color:isAfk?t.gold:done?t.green:t.muted,
            background:isAfk?t.gold+"18":done?t.green+"18":t.surface,
          }}>{p.name[0]} {isAfk?"⏸":done?"✓":"…"}</div>;
        })}
      </div>
    </div>

    {/* ── TIMER BAR ── */}
    {speedMode&&myGuess==null&&timeLeft!=null&&
      <div style={{padding:"6px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,fontWeight:700,
            color:timeLeft<=5?t.danger:timeLeft<=10?t.gold:t.green}}>⏱️ {timeLeft}s</span>
          <span style={{fontSize:11,color:t.muted}}>{doneCount}/{activePl.length} ✓</span>
        </div>
        <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",
            width:`${(timeLeft/timerSecs)*100}%`,
            background:timeLeft<=5?t.danger:timeLeft<=10?t.gold:t.green,
            borderRadius:3,transition:"width 1s linear, background .3s"}}/>
        </div>
      </div>}

    {/* ── QUESTION CARD ── */}
    <div style={{padding:"8px 16px 0",flex:1,display:"flex",flexDirection:"column",gap:8}}>
      <Card t={t} glow>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <span style={{fontSize:28}}>{q.emoji||"❓"}</span>
          <div style={{flex:1}}>
            <Pill t={t} color={t.muted} style={{marginBottom:6}}>{q.cat}</Pill>
            <p style={{fontSize:t.id==="kids"?18:16,lineHeight:1.55,
              fontWeight:t.id==="kids"?700:500,marginTop:6}}>{q.q}</p>
            <p style={{marginTop:8,color:t.muted,fontSize:13}}>
              Antwort in: <strong style={{color:t.gold}}>{q.unit}</strong>
            </p>
          </div>
        </div>
        {room.hintVisible&&
          <p style={{marginTop:8,padding:"7px 10px",background:t.gold+"18",
            borderRadius:t.radius,fontSize:13,color:t.gold,fontWeight:600}}>
            💡 {q.hint}
          </p>}
        {/* 50/50 hint – only for user who played it */}
        {room.extraHint&&room.extraHintFor===myId&&
          <div style={{marginTop:8,padding:"8px 10px",
            background:(room.extraHintColor||t.gold)+"18",
            border:`1.5px solid ${room.extraHintColor||t.gold}`,
            borderRadius:t.radius,textAlign:"center"}}>
            <div style={{fontSize:10,color:room.extraHintColor||t.gold,
              fontWeight:700,marginBottom:2}}>📊 50/50</div>
            <div style={{fontSize:14,color:room.extraHintColor||t.gold,
              fontWeight:800}}>{room.extraHint}</div>
          </div>}
      </Card>

      {/* ── INPUT OR SUBMITTED ── */}
      {showInput
        ?<Card t={t}>
          <p style={{fontSize:11,fontWeight:700,color:t.muted,
            letterSpacing:.6,marginBottom:8}}>
            {changeAllowed?"🔄 TIPP ÄNDERN":"DEIN TIPP"} ({q.unit})
          </p>
          <div style={{display:"flex",gap:8}}>
            <Inp type="number" value={val} onChange={setVal}
              placeholder="z.B. 42" t={t} autoFocus
              style={{fontSize:20,fontWeight:700,fontFamily:t.fontMono}}/>
            <Btn t={t} onClick={submit} disabled={!val}
              style={{flexShrink:0}}>OK ✓</Btn>
          </div>
          <p style={{marginTop:8,color:t.muted,fontSize:12}}>
            💬 Tippt erst, dann diskutiert!
          </p>
        </Card>
        :<Card t={t} style={{textAlign:"center"}}>
          <div style={{fontSize:36,fontFamily:t.fontMono,color:t.accent,
            fontWeight:800,marginBottom:4}}>{fmtNum(myGuess)} {q.unit}</div>
          <p style={{color:t.green,fontWeight:700,marginBottom:10}}>✓ Tipp abgegeben!</p>
          <div style={{height:4,background:t.border,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",
              width:`${activePl.length?doneCount/activePl.length*100:0}%`,
              background:`linear-gradient(90deg,${t.accent},${t.gold})`,
              borderRadius:3,transition:"width .4s ease"}}/>
          </div>
          <p style={{fontSize:11,color:t.muted,marginTop:5}}>
            {doneCount}/{activePl.length} haben getippt
          </p>
        </Card>}

      {/* ── JOKER BAR (collapsed until tapped) ── */}
      {room.enabledJokers?.length>0&&
        <JokerBar room={room} myId={myId} code={code} t={t} onSkip={onSkip}/>}

      {/* ── DEBUG PANEL ── */}
      {debugMode&&<div style={{padding:"12px",borderRadius:t.radius,
        background:t.surface,border:`2px dashed ${t.accent}`}}>
        <p style={{fontSize:10,fontWeight:700,color:t.accent,letterSpacing:.8,marginBottom:8}}>
          🛠️ DEBUG
        </p>
        <p style={{fontSize:10,color:t.muted,fontWeight:700,marginBottom:5}}>JOKER AUFLADEN</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {Object.values(JOKER_DEFS).map(jk=>(
            <button key={jk.id} onClick={async()=>{
              const cur=(room.jokers||{})[myId]||[];
              await update(ref(db,`rooms/${code}/jokers`),{[myId]:[...cur,jk.id]});
            }} style={{padding:"5px 9px",borderRadius:t.radius,background:t.card,
              border:`1px solid ${t.border}`,color:t.text,fontSize:11,
              fontWeight:700,cursor:"pointer",fontFamily:t.fontBody}}>
              {jk.icon}+
            </button>
          ))}
          <button onClick={async()=>{
            await update(ref(db,`rooms/${code}/jokers`),{[myId]:[]});
          }} style={{padding:"5px 9px",borderRadius:t.radius,
            background:t.danger+"22",border:`1px solid ${t.danger}`,
            color:t.danger,fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑️</button>
        </div>
        <p style={{fontSize:10,color:t.muted,fontWeight:700,marginBottom:5}}>PUNKTE</p>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {(room.order||[]).map(pid=>{
            const p=room.players?.[pid]; if(!p) return null;
            return <div key={pid} style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,flex:1,fontWeight:700}}>{p.name}</span>
              <span style={{fontSize:12,fontFamily:"monospace",
                color:t.gold,minWidth:24}}>{room.scores?.[pid]||0}P</span>
              <button onClick={async()=>await update(ref(db,`rooms/${code}/scores`),
                {[pid]:(room.scores?.[pid]||0)-1})}
                style={{width:22,height:22,borderRadius:4,background:t.danger+"22",
                  border:`1px solid ${t.danger}`,color:t.danger,fontSize:13,
                  cursor:"pointer",fontWeight:700}}>−</button>
              <button onClick={async()=>await update(ref(db,`rooms/${code}/scores`),
                {[pid]:(room.scores?.[pid]||0)+1})}
                style={{width:22,height:22,borderRadius:4,background:t.green+"22",
                  border:`1px solid ${t.green}`,color:t.green,fontSize:13,
                  cursor:"pointer",fontWeight:700}}>+</button>
            </div>;
          })}
        </div>
      </div>}
    </div>

    {/* ── FIXED BOTTOM BAR: AFK ── */}
    <div style={{
      position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
      width:"100%",maxWidth:520,
      padding:"10px 16px",
      background:t.bg+"ee",
      borderTop:`1px solid ${t.border}`,
      backdropFilter:"blur(8px)",
      zIndex:50,
    }}>
      <button onClick={async()=>{
        await update(ref(db,`rooms/${code}/afkPlayers`),{[myId]:isAfkMe?null:true});
      }} style={{
        width:"100%",padding:"11px",borderRadius:t.radius,
        background:isAfkMe?t.gold+"22":t.surface,
        border:`1.5px solid ${isAfkMe?t.gold:t.border}`,
        color:isAfkMe?t.gold:t.muted,
        fontSize:14,fontWeight:700,cursor:"pointer",
        fontFamily:t.fontBody,transition:"all .2s",
      }}>
        {isAfkMe?"▶️ Ich bin wieder da!":"⏸️ Kurz weg"}
      </button>
    </div>
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
    {/* AFK inline in betting */}
    <div style={{marginTop:14}}>
      <button onClick={async()=>{
        const isAfk=!!(room.afkPlayers||{})[myId];
        await update(ref(db,`rooms/${code}/afkPlayers`),{[myId]:isAfk?null:true});
      }} style={{width:"100%",padding:"10px",borderRadius:t.radius,
        background:(room.afkPlayers||{})[myId]?t.gold+"22":t.surface,
        border:`1.5px solid ${(room.afkPlayers||{})[myId]?t.gold:t.border}`,
        color:(room.afkPlayers||{})[myId]?t.gold:t.muted,
        fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:t.fontBody}}>
        {(room.afkPlayers||{})[myId]?"▶️ Ich bin wieder da!":"⏸️ Kurz weg"}
      </button>
    </div>
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
  const minDiffR=ranked[0]?.diff??Infinity;
  const closestIdsR=ranked.filter(r=>r.diff===minDiffR).map(r=>r.id);
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
      <p style={{marginTop:14,fontSize:t.id==="kids"?17:15,lineHeight:1.55,color:t.muted,maxWidth:380,margin:"14px auto 6px"}}>{q.q}</p>
      <div style={{fontFamily:t.fontTitle,fontSize:"clamp(50px,12vw,82px)",color:t.accent,lineHeight:1,marginTop:4,animation:"pop .5s ease both"}}>{fmtNum(q.a)} {q.unit}</div>
      <p style={{color:t.muted,marginTop:11,fontSize:15,lineHeight:1.6,maxWidth:380,margin:"11px auto 0"}}>{q.hint}</p>
    </div>
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>TIPPS DIESER RUNDE</p>
      {ranked.map((p,i)=>{const exact=p.diff===0,win=!exact&&closestIdsR.includes(p.id),pts=rs[p.id]||0,wasSabotaged=!!(room.sabotaged||{})[p.id];return <div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:exact?t.green+"18":win?t.accent+"14":wasSabotaged?t.danger+"10":t.surface,border:`1.5px solid ${exact?t.green:win?t.accent+"44":wasSabotaged?t.danger+"44":t.border}`,animation:`fu .3s ${i*.07}s ease both`}}><span style={{fontSize:18,minWidth:20}}>{medals[i]||`${i+1}.`}</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}{wasSabotaged&&<span style={{color:t.danger,fontSize:11,marginLeft:6}}>💣 sabotiert!</span>}</span><span style={{fontFamily:t.fontMono,fontSize:13,color:win||exact?t.accent:t.text}}>{fmtNum(p.guess)} {q.unit}</span><span style={{fontFamily:t.fontMono,fontSize:11,color:t.muted,minWidth:44,textAlign:"right"}}>Δ{fmtNum(p.diff)}</span>{pts>0&&<Pill t={t} color={exact?t.green:t.gold}>+{pts}P</Pill>}</div>;})}
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
  const[debugMode,setDebugMode]=useState(false);
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
      // Safety: if advancing got stuck, reset it after 5s
      if(r.advancing && r.phase==="question"){
        setTimeout(async()=>{
          const fresh=await dbGet(r.code);
          if(fresh?.advancing && fresh?.phase==="question"){
            await dbPatch(r.code,{advancing:false});
          }
        },5000);
      }
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
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:0,selectedCats,usedJokerThisRound:null,hintVisible:false,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,sabotaged:{},newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1});
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
    // -999999 = timer expired (counts as answered), null = not yet answered
    const allDone=activePlayers.length>0&&activePlayers.every(id=>guesses[id]!=null||!!afk[id]);
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
        // Treat -999999 (timer expired) as answered

        // Skip check moved to separate useEffect below

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

  // (Skip is now handled directly in JokerBar via onSkip prop)

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
        const existing=(r.jokers||{})[pid]||[];
        // Max 1 of each joker type – no duplicates
        if(!existing.includes(joker)){
          newJokersThisRound[pid]=joker;
          jokerUpdates[pid]=[...existing,joker];
        } else {
          // Already has this type – try a different one
          const others=(r.enabledJokers||[]).filter(j=>!existing.includes(j));
          if(others.length>0){
            const alt=others[Math.floor(Math.random()*others.length)];
            newJokersThisRound[pid]=alt;
            jokerUpdates[pid]=[...existing,alt];
          }
          // If player has all types already, no new joker
        }
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
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:(r.qIdx||0)+1,usedJokerThisRound:null,hintVisible:false,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1,sabotaged:{}});
  }

  async function handleSkip(){
    const r=await dbGet(code);
    const cats=r.selectedCats||selectedCatsRef.current||Object.keys(QUESTIONS[mode]);
    const q=getQuestion(mode,cats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:(r.qIdx||0)+1,usedJokerThisRound:null,jokerUsedBy:null,hintVisible:false,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1,sabotaged:{}});
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
    {screen==="jokerSetup"&&room&&room.hostId===myId&&<JokerSetupScreen mode={mode} onDone={handleJokerSetupDone} t={t} onToggleDebug={setDebugMode} debugModeInit={debugMode}/>}
    {screen==="jokerSetup"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Joker-Einstellungen...</p></div>}
    {screen==="categories"&&room&&room.hostId===myId&&<CategoryScreen mode={mode} onStart={handleStartWithCats} t={t}/>}
    {screen==="categories"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Kategorien...</p></div>}
    {screen==="question"&&room&&<QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess} code={code} debugMode={debugMode} onSkip={handleSkip}/>}
    {screen==="betting"&&room&&(room.order||[]).filter(id=>!(room.afkPlayers||{})[id]).length>1&&<BettingScreen room={room} myId={myId} t={t} onBet={handleBet} code={code}/>}
    {screen==="results"&&room&&<ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd}/>}
    {screen==="final"&&room&&<FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart}/>}
  </>;
}
