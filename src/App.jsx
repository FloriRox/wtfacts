// EstiMates – Build-Marker: remove-inapp-scanner v5
import React, { useState, useEffect, useRef } from "react";
import { QUESTIONS_DE, QUESTIONS_EN, QUESTIONS_ES } from "./questions/index.js";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get, remove } from "firebase/database";
import { getAuth, signInAnonymously, signInWithPopup, signInWithRedirect, signInWithCredential, GoogleAuthProvider, OAuthProvider, linkWithPopup, linkWithRedirect, getRedirectResult, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "wtfacts-958c6.firebaseapp.com",
  databaseURL: "https://wtfacts-958c6-default-rtdb.firebaseio.com",
  projectId: "wtfacts-958c6",
  storageBucket: "wtfacts-958c6.firebasestorage.app",
  messagingSenderId: "504687472282",
  appId: "1:504687472282:web:d129a0ddb9b209f2c13923",
};
var firebaseApp = initializeApp(firebaseConfig);
var db = getDatabase(firebaseApp);
var ADMIN_UIDS = ['ENjkAgrSN5OF4f9OdRuWJDs7qqM2','DpjTjx4Nk4RrivFmwBDsJvxOgj62'];
var isAdmin = (uid) => ADMIN_UIDS.includes(uid);
var auth;
try { auth = getAuth(firebaseApp); } catch(e) { console.error("Auth init failed:", e); }
var googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
var appleProvider = new OAuthProvider('apple.com');
var dbRef    = (c)    => ref(db, `rooms/${c}`);
var dbSet    = (c, v) => set(dbRef(c), v);
var dbPatch  = (c, v) => update(dbRef(c), v);
var dbGet    = (c)    => get(dbRef(c)).then(s => s.val());
var dbListen = (c,fn) => onValue(dbRef(c), s => fn(s.val()));

/* ─── GLOBAL STATS ───────────────────────────────── */
function hashString(str){
  let h=0;
  for(let i=0;i<str.length;i++){h=Math.imul(31,h)+str.charCodeAt(i)|0;}
  return Math.abs(h).toString(36);
}
const PLAYER_HASH=(()=>{
  let h=localStorage.getItem("em_phash");
  if(!h){h=hashString(navigator.userAgent+(Date.now()%100000));localStorage.setItem("em_phash",h);}
  return h;
})();

async function saveGlobalStats(roundData,lang){
  try {
    const {diff,exact,mode,category,groupSize,allIn,jokerUsed,timeToGuess}=roundData;
    const phash=PLAYER_HASH;
    const platform=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?'mobile':'desktop';
    const browserLang=navigator.language?.slice(0,2)||'de';
    const statRef=ref(db,`globalStats/players/${phash}`);
    const snap=await get(statRef);
    const prev=snap.val()||{gamesPlayed:0,totalDiff:0,exactHits:0,rounds:0};
    await update(statRef,{
      gamesPlayed:  prev.gamesPlayed+(roundData.isNewGame?1:0),
      totalDiff:    (prev.totalDiff||0)+diff,
      exactHits:    (prev.exactHits||0)+(exact?1:0),
      rounds:       (prev.rounds||0)+1,
      allIns:       (prev.allIns||0)+(allIn?1:0),
      allInHits:    (prev.allInHits||0)+(allIn&&exact?1:0),
      lang,browserLang,platform,
      lastSeen:     Date.now(),
    });
    // Per-category stats
    if(category){
      const catRef=ref(db,`globalStats/categories/${category}`);
      const catSnap=await get(catRef);
      const cat=catSnap.val()||{plays:0,totalDiff:0,exactHits:0};
      await update(catRef,{
        plays:     cat.plays+1,
        totalDiff: (cat.totalDiff||0)+diff,
        exactHits: (cat.exactHits||0)+(exact?1:0),
      });
    }
    // Demographics
    if(groupSize){
      const grpRef=ref(db,`globalStats/demographics/groupSize/${Math.min(groupSize,10)}`);
      const grpSnap=await get(grpRef);
      const grp=grpSnap.val()||{count:0,totalDiff:0};
      await update(grpRef,{count:grp.count+1, totalDiff:(grp.totalDiff||0)+diff});
    }
    // Region tracking (timezone-based)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';
      const region = tz.split('/')[0]||'unknown';
      const country = tz.split('/')[1]?.replace('_',' ')||'unknown';
      const regionRef = ref(db,`globalStats/demographics/region/${region}/${country}`);
      const regionSnap = await get(regionRef);
      const regionData = regionSnap.val()||{count:0};
      await update(regionRef,{count:regionData.count+1});
    } catch(e){ /* region tracking optional */ }
    // Language tracking
    try {
      const langRef = ref(db,`globalStats/demographics/lang/${lang||'de'}`);
      const langSnap = await get(langRef);
      const langData = langSnap.val()||{count:0,totalDiff:0};
      await update(langRef,{
        count: langData.count+1,
        totalDiff: (langData.totalDiff||0)+diff,
      });
    } catch(e){ /* lang tracking optional */ }
  } catch(e){ console.warn("Stats save failed",e); }
}

async function getGlobalRank(avgDiff){
  try {
    const snap=await get(ref(db,"globalStats/players"));
    const players=snap.val()||{};
    const avgs=Object.values(players)
      .filter(p=>p.rounds>=5)
      .map(p=>p.totalDiff/p.rounds)
      .sort((a,b)=>a-b);
    if(!avgs.length)return null;
    const better=avgs.filter(a=>a<avgDiff).length;
    return Math.round((1-better/avgs.length)*100);
  } catch(e){ return null; }
}

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

/* ─── BARRIEREFREIHEIT (global, persistent) ──────── */
function loadA11y(){ try{ var o=JSON.parse(localStorage.getItem('em_a11y')||'{}')||{}; if(o.contrast===undefined) o.contrast=true; return o; }catch(e){ return {contrast:true}; } }
var A11Y = loadA11y();
function applyLargeText(){ try{ document.documentElement.style.zoom = A11Y.large ? '1.12' : ''; }catch(e){} }
function setA11yPref(key,val){ A11Y={...A11Y,[key]:val}; try{ localStorage.setItem('em_a11y',JSON.stringify(A11Y)); }catch(e){} applyLargeText(); }
var _a11yCache={};
/* ─── EIGENE FARBEN (global, persistent) ── */
function loadCustomColors(){ try{ return JSON.parse(localStorage.getItem('em_colors')||'{}')||{}; }catch(e){ return {}; } }
var CUSTOM_COLORS = loadCustomColors();
function setCustomColor(key,val){ CUSTOM_COLORS={...CUSTOM_COLORS,[key]:val}; try{ localStorage.setItem('em_colors',JSON.stringify(CUSTOM_COLORS)); }catch(e){} }
function clearCustomColor(key){ var c={...CUSTOM_COLORS}; delete c[key]; CUSTOM_COLORS=c; try{ localStorage.setItem('em_colors',JSON.stringify(CUSTOM_COLORS)); }catch(e){} }
function resetCustomColors(){ CUSTOM_COLORS={}; try{ localStorage.removeItem('em_colors'); }catch(e){} }
/* ─── BUTTON-STIL (global, persistent): Ecken, Tiefe, Glanz ── */
function loadCustomStyle(){ try{ return JSON.parse(localStorage.getItem('em_btnstyle')||'{}')||{}; }catch(e){ return {}; } }
var CUSTOM_STYLE = loadCustomStyle();
function setCustomStyle(key,val){ CUSTOM_STYLE={...CUSTOM_STYLE,[key]:val}; try{ localStorage.setItem('em_btnstyle',JSON.stringify(CUSTOM_STYLE)); }catch(e){} }
function resetCustomStyle(){ CUSTOM_STYLE={}; try{ localStorage.removeItem('em_btnstyle'); }catch(e){} }
/* ─── BUSINESS-CI (Name + Logo, lokal + Raum-Sync) ── */
function loadBiz(){ try{ return JSON.parse(localStorage.getItem('em_business')||'{}')||{}; }catch(e){ return {}; } }
var BIZ = loadBiz();
function setBizField(key,val){ BIZ={...BIZ,[key]:val}; try{ localStorage.setItem('em_business',JSON.stringify(BIZ)); }catch(e){} }
function resetBiz(){ BIZ={}; try{ localStorage.removeItem('em_business'); }catch(e){} }
function btnShadowFor(depth){ return depth==='shadow' ? '0 4px 14px rgba(0,0,0,.28)' : depth==='3d' ? '0 5px 0 rgba(0,0,0,.32)' : 'none'; }
// Wrapper: erst Barrierefreiheit/Heller Modus, dann eigene Farben + Button-Stil drüberlegen
function applyA11y(base){
  var th=applyBaseA11y(base);
  var ks=CUSTOM_COLORS?Object.keys(CUSTOM_COLORS):[];
  var hasStyle=CUSTOM_STYLE && (CUSTOM_STYLE.radius!=null || CUSTOM_STYLE.depth || CUSTOM_STYLE.gloss);
  if(!ks.length && !hasStyle) return th;
  var o={...th};
  ks.forEach(function(k){ if(CUSTOM_COLORS[k]) o[k]=CUSTOM_COLORS[k]; });
  if(hasStyle){
    if(CUSTOM_STYLE.radius!=null) o.radius=CUSTOM_STYLE.radius;
    o.btnShadow=btnShadowFor(CUSTOM_STYLE.depth);
    o.btnGloss=!!CUSTOM_STYLE.gloss;
  }
  return o;
}
function applyBaseA11y(base){
  if(!A11Y || (!A11Y.cb && !A11Y.contrast && !A11Y.light)) return base;
  var key=base.id+'|'+(A11Y.cb?1:0)+'|'+(A11Y.contrast?1:0)+'|'+(A11Y.light?1:0);
  if(_a11yCache[key]) return _a11yCache[key];
  var t={...base};
  // Heller/freundlicher Modus (nur Adult): warme, einladende Palette – ersetzt den Dark-Look
  if(A11Y.light && base.id==='adult'){
    t={...t, bg:'#faf5ee', surface:'#ffffff', card:'#ffffff', border:'#e7dccd',
      accent:'#e8470a', gold:'#dd7d12', green:'#1f9d63', text:'#2b211a', muted:'#9b8b7b'};
    if(A11Y.cb) t.green='#2f7fe0';
    _a11yCache[key]=t; return t; // im hellen Modus kein zusätzlicher Dark-Kontrast
  }
  if(A11Y.cb){
    // Rot/Grün-Schwäche: "richtig/nah" wird Blau statt Grün (klar von Rot unterscheidbar)
    t.green = '#3b9dff';
  }
  if(A11Y.contrast){
    if(base.id==='kids'){ t.bg='#ffffff'; t.text='#000000'; t.muted='#4a4036'; t.border='#1e1e1e'; }
    else { t.bg='#000000'; t.surface='#16110d'; t.card='#1d1813'; t.text='#ffffff'; t.muted='#cabcae'; t.border='#7a6656'; }
  }
  _a11yCache[key]=t;
  return t;
}

/* ─── BARRIEREFREIHEIT-MENÜ ──────────────────────── */
function A11yMenu({t, lang, onA11y, compact=false, onOpenColors=null, onOpenBusiness=null}){
  const L=(de,en,es)=>lang==='en'?en:lang==='es'?es:de;
  const items=[
    {k:'light', icon:'☀️', label:L('Heller Modus','Light mode','Modo claro')},
    {k:'cb', icon:'🎨', label:L('Rot/Grün-Schwäche','Red/green colorblind','Daltonismo rojo/verde')},
    {k:'large', icon:'🔠', label:L('Große Schrift','Large text','Texto grande')},
    {k:'contrast', icon:'◐', label:L('Hoher Kontrast','High contrast','Alto contraste')},
  ];
  const pad=compact?'8px 12px':'10px 20px';
  const fs=compact?13:14;
  const rad=compact?t.radius:100;
  const sw=compact?34:38, sh=compact?20:22, kn=compact?16:18;
  return <div style={{width:'100%',display:'flex',flexDirection:'column',gap:compact?6:8}}>
    {items.map(it=>{
      const on=!!A11Y[it.k];
      return <button key={it.k} onClick={()=>onA11y&&onA11y(it.k,!on)}
        style={{width:'100%',display:'flex',alignItems:'center',gap:10,
          justifyContent:'flex-start',background:t.surface,
          border:`1.5px solid ${on?t.gold:t.border}`,borderRadius:rad,padding:pad,
          color:t.text,fontSize:fs,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
        <span style={{fontSize:compact?15:16,width:20,textAlign:'center'}}>{it.icon}</span>
        <span style={{flex:1,textAlign:'left'}}>{it.label}</span>
        <span style={{width:sw,height:sh,borderRadius:sh/2,background:on?t.gold:t.border,
          position:'relative',transition:'background .15s',flexShrink:0,display:'inline-block'}}>
          <span style={{position:'absolute',top:2,left:on?sw-kn-2:2,width:kn,height:kn,
            borderRadius:'50%',background:'#fff',transition:'left .15s'}}/>
        </span>
      </button>;
    })}
    {onOpenColors&&<button onClick={onOpenColors}
      style={{width:'100%',display:'flex',alignItems:'center',gap:10,justifyContent:'flex-start',
        background:t.surface,border:`1.5px solid ${t.border}`,borderRadius:rad,padding:pad,
        color:t.text,fontSize:fs,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
      <span style={{fontSize:compact?15:16,width:20,textAlign:'center'}}>🎨</span>
      <span style={{flex:1,textAlign:'left'}}>{L('Farben & Stil','Colors & style','Colores y estilo')}</span>
      <span style={{color:t.muted}}>›</span>
    </button>}
    {onOpenBusiness&&<button onClick={onOpenBusiness}
      style={{width:'100%',display:'flex',alignItems:'center',gap:10,justifyContent:'flex-start',
        background:t.surface,border:`1.5px solid ${t.border}`,borderRadius:rad,padding:pad,
        color:t.text,fontSize:fs,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
      <span style={{fontSize:compact?15:16,width:20,textAlign:'center'}}>🏢</span>
      <span style={{flex:1,textAlign:'left'}}>{L('Business-CI','Business CI','CI de empresa')}</span>
      <span style={{color:t.muted}}>›</span>
    </button>}
  </div>;
}

var COLOR_PRESETS = [
  {id:'dark',      emoji:'🌙', name:{de:'Standard Dunkel',en:'Default Dark',es:'Oscuro estándar'},
    colors:{bg:'#0d0b0a',surface:'#181310',card:'#211c18',border:'#32261e',accent:'#e8360a',gold:'#ff8c2a',green:'#39d98a',danger:'#cc2244',text:'#f2ece6',muted:'#6e5e54'}},
  {id:'light',     emoji:'☀️', name:{de:'Standard Hell',en:'Default Light',es:'Claro estándar'},
    colors:{bg:'#faf5ee',surface:'#ffffff',card:'#ffffff',border:'#e7dccd',accent:'#e8470a',gold:'#dd7d12',green:'#1f9d63',danger:'#d6334e',text:'#2b211a',muted:'#9b8b7b'}},
  {id:'midnight',  emoji:'🌌', name:{de:'Mitternachtsblau',en:'Midnight Blue',es:'Azul medianoche'},
    colors:{bg:'#0F1525',surface:'#182034',card:'#202B45',border:'#2E3B57',accent:'#3B82F6',gold:'#FFB84D',green:'#34D399',danger:'#F1566B',text:'#EDF1FB',muted:'#8B97AE'}},
  {id:'coral',     emoji:'🪸', name:{de:'Koralle',en:'Coral',es:'Coral'},
    colors:{bg:'#FFF4EF',surface:'#FFFFFF',card:'#FFF9F5',border:'#F3DBCF',accent:'#F15B4C',gold:'#EFA13A',green:'#2FB083',danger:'#E0466A',text:'#3A2B27',muted:'#A98B80'}},
  {id:'mint',      emoji:'🌿', name:{de:'Mint Frisch',en:'Fresh Mint',es:'Menta fresca'},
    colors:{bg:'#F0FAF5',surface:'#FFFFFF',card:'#F6FDF9',border:'#CFE9DD',accent:'#0FA98E',gold:'#F2A93B',green:'#17B26A',danger:'#E5484D',text:'#1E2B27',muted:'#6E8A80'}},
  {id:'eucalyptus',emoji:'🍃', name:{de:'Eukalyptus',en:'Eucalyptus',es:'Eucalipto'},
    colors:{bg:'#EEF2ED',surface:'#FFFFFF',card:'#F6F8F4',border:'#D6DED1',accent:'#4F8A78',gold:'#C99A4A',green:'#4CA578',danger:'#C75D63',text:'#2C352F',muted:'#8A988E'}},
  {id:'pastel',    emoji:'🌸', name:{de:'Pastelltraum',en:'Pastel Dream',es:'Sueño pastel'},
    colors:{bg:'#14131C',surface:'#1E1C28',card:'#272433',border:'#383447',accent:'#8E7BF0',gold:'#FFC98C',green:'#6EE7B7',danger:'#FB7185',text:'#ECEAF6',muted:'#8E8AA3'}},
];
function applyColorPreset(colors){ CUSTOM_COLORS={...colors}; try{ localStorage.setItem('em_colors',JSON.stringify(CUSTOM_COLORS)); }catch(e){} }
/* ─── EIGENE CI-KONZEPTE (benannt, speicherbar) ── */
function loadSavedThemes(){ try{ return JSON.parse(localStorage.getItem('em_savedThemes')||'[]')||[]; }catch(e){ return []; } }
var SAVED_THEMES = loadSavedThemes();
function persistSavedThemes(){ try{ localStorage.setItem('em_savedThemes', JSON.stringify(SAVED_THEMES)); }catch(e){} }
function saveThemePreset(name, colors){ var id='ci_'+Date.now().toString(36); SAVED_THEMES=[...SAVED_THEMES,{id,name:name,colors:colors}]; persistSavedThemes(); return id; }
function deleteSavedTheme(id){ SAVED_THEMES=SAVED_THEMES.filter(function(x){return x.id!==id;}); persistSavedThemes(); }

function ColorEditor({t, lang, onChange, onClose}){
  const L=(de,en,es)=>lang==='en'?en:lang==='es'?es:de;
  const[,setTick]=useState(0); const rerender=()=>setTick(x=>x+1);
  const tokens=[
    {k:'bg',     label:L('Hintergrund','Background','Fondo')},
    {k:'surface',label:L('Felder / Oberfläche','Fields / surface','Campos / superficie')},
    {k:'card',   label:L('Karten','Cards','Tarjetas')},
    {k:'border', label:L('Feldumrandung','Field border','Borde de campo')},
    {k:'accent', label:L('Buttons / Akzent','Buttons / accent','Botones / acento')},
    {k:'gold',   label:L('Highlight (Gold)','Highlight (gold)','Resaltado (oro)')},
    {k:'green',  label:L('Richtig (Grün)','Correct (green)','Correcto (verde)')},
    {k:'danger', label:L('Fehler (Rot)','Error (red)','Error (rojo)')},
    {k:'text',   label:L('Text','Text','Texto')},
    {k:'muted',  label:L('Text gedämpft','Muted text','Texto atenuado')},
  ];
  const norm=v=>(v&&/^#[0-9a-fA-F]{6}$/.test(v))?v:'#000000';
  const change=(k,v)=>{ setCustomColor(k,v); onChange&&onChange(); rerender(); };
  const resetOne=k=>{ clearCustomColor(k); onChange&&onChange(); rerender(); };
  const resetAll=()=>{ resetCustomColors(); resetCustomStyle(); onChange&&onChange(); rerender(); };
  const pickPreset=p=>{ applyColorPreset(p.colors); onChange&&onChange(); rerender(); };
  const[ciName,setCiName]=useState('');
  const currentColors=()=>({bg:t.bg,surface:t.surface,card:t.card,border:t.border,accent:t.accent,gold:t.gold,green:t.green,danger:t.danger,text:t.text,muted:t.muted});
  const saveCI=()=>{ const n=(ciName||'').trim(); if(!n) return; saveThemePreset(n,currentColors()); setCiName(''); onChange&&onChange(); rerender(); };
  const applyCI=c=>{ applyColorPreset(c.colors); onChange&&onChange(); rerender(); };
  const delCI=id=>{ deleteSavedTheme(id); rerender(); };
  const setStyle=(k,v)=>{ setCustomStyle(k,v); onChange&&onChange(); rerender(); };
  const curRadius=CUSTOM_STYLE.radius!=null?CUSTOM_STYLE.radius:(t.radius!=null?t.radius:12);
  const curDepth=CUSTOM_STYLE.depth||'flat';
  const curGloss=!!CUSTOM_STYLE.gloss;
  return <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
    display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:520,background:t.card,
      borderTopLeftRadius:18,borderTopRightRadius:18,padding:'16px 16px 28px',maxHeight:'88vh',overflowY:'auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <p style={{fontSize:16,fontWeight:800,color:t.text,margin:0}}>🎨 {L('Farben & Stil','Colors & style','Colores y estilo')}</p>
        <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,fontSize:24,cursor:'pointer',lineHeight:1}}>×</button>
      </div>
      <p style={{fontSize:12,color:t.muted,margin:'0 0 14px'}}>{L('Änderungen sind sofort sichtbar und bleiben gespeichert.','Changes apply live and are saved.','Los cambios se aplican al instante y se guardan.')}</p>
      {/* ── Vorlagen / Presets ── */}
      <p style={{fontSize:11,fontWeight:800,color:t.muted,letterSpacing:.6,margin:'0 0 8px',textTransform:'uppercase'}}>
        {L('Vorlagen','Presets','Plantillas')}
      </p>
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,marginBottom:16,WebkitOverflowScrolling:'touch'}}>
        {COLOR_PRESETS.map(p=>{
          const active=Object.keys(p.colors).every(k=>(CUSTOM_COLORS[k]||'').toLowerCase()===p.colors[k].toLowerCase());
          return <button key={p.id} onClick={()=>pickPreset(p)}
            style={{flex:'0 0 auto',display:'flex',flexDirection:'column',gap:7,padding:'9px 11px',borderRadius:t.radius,
              background:t.surface,border:`2px solid ${active?t.accent:t.border}`,cursor:'pointer',
              fontFamily:t.fontBody,minWidth:104,alignItems:'flex-start'}}>
            <div style={{display:'flex',gap:3}}>
              {[p.colors.bg,p.colors.accent,p.colors.gold,p.colors.green].map((c,ci)=>(
                <span key={ci} style={{width:17,height:17,borderRadius:5,background:c,
                  border:`1px solid ${t.border}`,display:'inline-block'}}/>
              ))}
            </div>
            <span style={{fontSize:11,fontWeight:700,color:active?t.accent:t.text,whiteSpace:'nowrap',
              overflow:'hidden',textOverflow:'ellipsis',maxWidth:130}}>{p.emoji} {p.name[lang]||p.name.de}</span>
          </button>;
        })}
      </div>
      {/* ── Eigene CI-Konzepte speichern/abrufen ── */}
      <p style={{fontSize:11,fontWeight:800,color:t.muted,letterSpacing:.6,margin:'0 0 8px',textTransform:'uppercase'}}>
        {L('Meine CIs','My CIs','Mis CIs')}
      </p>
      <div style={{display:'flex',gap:8,marginBottom:SAVED_THEMES.length?10:14}}>
        <input value={ciName} onChange={e=>setCiName(e.target.value.slice(0,30))}
          onKeyDown={e=>{ if(e.key==='Enter') saveCI(); }}
          placeholder={L('Name, z. B. „Aldiana CI"','Name, e.g. "Aldiana CI"','Nombre, p. ej. "CI Aldiana"')}
          style={{flex:1,minWidth:0,boxSizing:'border-box',padding:'9px 12px',borderRadius:t.radius,
            background:t.surface,border:`1.5px solid ${t.border}`,color:t.text,fontSize:13,
            fontFamily:t.fontBody,outline:'none'}}/>
        <button onClick={saveCI} disabled={!ciName.trim()}
          style={{flexShrink:0,padding:'9px 14px',borderRadius:t.radius,
            background:ciName.trim()?t.accent:t.surface,border:`1.5px solid ${ciName.trim()?t.accent:t.border}`,
            color:ciName.trim()?'#fff':t.muted,fontSize:13,fontWeight:700,
            cursor:ciName.trim()?'pointer':'default',fontFamily:t.fontBody}}>💾 {L('Speichern','Save','Guardar')}</button>
      </div>
      {SAVED_THEMES.length>0&&<div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,marginBottom:14,WebkitOverflowScrolling:'touch'}}>
        {SAVED_THEMES.map(c=>{
          const active=Object.keys(c.colors).every(k=>(CUSTOM_COLORS[k]||'').toLowerCase()===(c.colors[k]||'').toLowerCase());
          return <div key={c.id} style={{flex:'0 0 auto',position:'relative',display:'flex',flexDirection:'column',gap:7,
            padding:'9px 11px',borderRadius:t.radius,background:t.surface,
            border:`2px solid ${active?t.accent:t.border}`,minWidth:108}}>
            <button onClick={()=>delCI(c.id)} title={L('Löschen','Delete','Eliminar')}
              style={{position:'absolute',top:-7,right:-7,width:20,height:20,borderRadius:'50%',
                background:t.danger,color:'#fff',border:'none',fontSize:12,lineHeight:1,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',fontFamily:t.fontBody}}>×</button>
            <div onClick={()=>applyCI(c)} style={{cursor:'pointer'}}>
              <div style={{display:'flex',gap:3,marginBottom:7}}>
                {[c.colors.bg,c.colors.accent,c.colors.gold,c.colors.green].map((col,ci)=>(
                  <span key={ci} style={{width:17,height:17,borderRadius:5,background:col,
                    border:`1px solid ${t.border}`,display:'inline-block'}}/>
                ))}
              </div>
              <span style={{fontSize:11,fontWeight:700,color:active?t.accent:t.text,whiteSpace:'nowrap',
                overflow:'hidden',textOverflow:'ellipsis',maxWidth:130,display:'block'}}>{c.name}</span>
            </div>
          </div>;
        })}
      </div>}
      <div style={{background:t.bg,border:`1.5px solid ${t.border}`,borderRadius:t.radius,padding:12,marginBottom:14,
        display:'flex',alignItems:'center',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:t.text,fontWeight:700,fontSize:14}}>{L('Vorschau','Preview','Vista previa')}</div>
          <div style={{color:t.muted,fontSize:12}}>{L('So sieht es aus','Looks like this','Se ve así')}</div>
        </div>
        <span style={{background:t.gold,color:t.bg,fontWeight:800,fontSize:12,padding:'3px 8px',borderRadius:100,flexShrink:0}}>★</span>
        <button style={{background:t.accent,color:'#fff',border:'none',borderRadius:t.radius,padding:'8px 14px',fontWeight:800,fontSize:13,flexShrink:0,fontFamily:t.fontBody,boxShadow:(t.btnShadow&&t.btnShadow!=='none')?t.btnShadow:undefined,backgroundImage:t.btnGloss?'linear-gradient(to bottom, rgba(255,255,255,.28), rgba(255,255,255,0) 55%)':undefined}}>{L('Button','Button','Botón')}</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {tokens.map(tok=>{
          const cur=norm(t[tok.k]);
          const custom=CUSTOM_COLORS[tok.k]!=null;
          return <div key={tok.k} style={{display:'flex',alignItems:'center',gap:12,
            background:t.surface,border:`1.5px solid ${t.border}`,borderRadius:t.radius,padding:'8px 12px'}}>
            <input type="color" value={cur} onChange={e=>change(tok.k,e.target.value)}
              style={{width:38,height:38,border:'none',background:'none',cursor:'pointer',padding:0,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:t.text}}>{tok.label}{custom&&<span style={{color:t.gold}}> •</span>}</div>
              <div style={{fontSize:11,color:t.muted,fontFamily:t.fontMono}}>{cur}</div>
            </div>
            {custom&&<button onClick={()=>resetOne(tok.k)}
              style={{background:'none',border:`1px solid ${t.border}`,borderRadius:100,color:t.muted,
                fontSize:13,cursor:'pointer',padding:'4px 9px',fontFamily:t.fontBody,flexShrink:0}}>↺</button>}
          </div>;
        })}
      </div>
      {/* ── Button-Stil ── */}
      <p style={{fontSize:11,fontWeight:800,color:t.muted,letterSpacing:.6,margin:'18px 0 8px',textTransform:'uppercase'}}>
        🔘 {L('Button-Stil','Button style','Estilo de botón')}
      </p>
      <div style={{marginBottom:10}}>
        <p style={{fontSize:11,color:t.muted,margin:'0 0 5px'}}>{L('Ecken','Corners','Esquinas')}</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[{l:L('Eckig','Square','Recto'),v:4},{l:'Soft',v:10},{l:L('Rund','Round','Redondo'),v:16},{l:'Pill',v:999}].map(o=>{
            const on=curRadius===o.v;
            return <button key={o.v} onClick={()=>setStyle('radius',o.v)}
              style={{padding:'6px 13px',borderRadius:Math.min(o.v,22),background:on?t.accent+'22':t.surface,
                border:`1.5px solid ${on?t.accent:t.border}`,color:on?t.accent:t.text,fontSize:12,
                fontWeight:700,cursor:'pointer',fontFamily:t.fontBody}}>{o.l}</button>;
          })}
        </div>
      </div>
      <div style={{marginBottom:10}}>
        <p style={{fontSize:11,color:t.muted,margin:'0 0 5px'}}>{L('Tiefe / Schatten','Depth / shadow','Profundidad / sombra')}</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[{l:L('Flach','Flat','Plano'),v:'flat'},{l:L('Schatten','Shadow','Sombra'),v:'shadow'},{l:'3D',v:'3d'}].map(o=>{
            const on=curDepth===o.v;
            return <button key={o.v} onClick={()=>setStyle('depth',o.v)}
              style={{padding:'6px 13px',borderRadius:t.radius,background:on?t.accent+'22':t.surface,
                border:`1.5px solid ${on?t.accent:t.border}`,color:on?t.accent:t.text,fontSize:12,
                fontWeight:700,cursor:'pointer',fontFamily:t.fontBody,
                boxShadow:o.v==='shadow'?'0 3px 8px rgba(0,0,0,.25)':o.v==='3d'?'0 3px 0 rgba(0,0,0,.3)':'none'}}>{o.l}</button>;
          })}
        </div>
      </div>
      <div style={{marginBottom:4}}>
        <p style={{fontSize:11,color:t.muted,margin:'0 0 5px'}}>{L('Glanz / Reflektion','Gloss / reflection','Brillo / reflejo')}</p>
        <div style={{display:'flex',gap:6}}>
          {[{l:L('Aus','Off','No'),v:false},{l:L('An','On','Sí'),v:true}].map(o=>{
            const on=curGloss===o.v;
            return <button key={String(o.v)} onClick={()=>setStyle('gloss',o.v)}
              style={{padding:'6px 16px',borderRadius:t.radius,
                background:on?t.accent:t.surface,
                backgroundImage:(o.v&&on)?'linear-gradient(to bottom, rgba(255,255,255,.3), rgba(255,255,255,0) 55%)':undefined,
                border:`1.5px solid ${on?t.accent:t.border}`,color:on?'#fff':t.text,fontSize:12,
                fontWeight:700,cursor:'pointer',fontFamily:t.fontBody}}>{o.l}</button>;
          })}
        </div>
      </div>
      <button onClick={resetAll} style={{width:'100%',marginTop:16,padding:'11px',borderRadius:t.radius,
        background:'none',border:`1.5px solid ${t.danger}66`,color:t.danger,fontSize:13,fontWeight:700,
        cursor:'pointer',fontFamily:t.fontBody}}>{L('Alles zurücksetzen','Reset everything','Restablecer todo')}</button>
    </div>
  </div>;
}

/* ─── BUSINESS-CI: „powered by"-Badge (wiederverwendbar) ── */
function PoweredBy({name, logo, t, size='md'}){
  if(!name && !logo) return null;
  const big = size==='lg';
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:big?14:8,opacity:.95,flexWrap:'wrap'}}>
    {logo && <img src={logo} alt="" style={{height:big?48:26,width:'auto',maxWidth:big?180:90,objectFit:'contain'}}/>}
    {name && <span style={{fontSize:big?15:11,color:t.muted,fontWeight:600,letterSpacing:.3}}>
      powered by <span style={{color:t.text,fontWeight:800}}>{name}</span>
    </span>}
  </div>;
}

/* ─── BUSINESS-CI: Einrichtungs-Maske (Teil des Business-Pakets, dormant) ── */
function BusinessScreen({t, lang, onOpenColors, onChange, onClose}){
  const L=(de,en,es)=>lang==='en'?en:lang==='es'?es:de;
  const[,setTick]=useState(0); const rerender=()=>setTick(x=>x+1);
  const fileRef=React.useRef(null);
  const change=()=>{ onChange&&onChange(); rerender(); };
  function onName(v){ setBizField('name', (v||'').slice(0,40)); change(); }
  function onLogoFile(e){
    const f=e.target.files&&e.target.files[0]; if(!f){ return; }
    const r=new FileReader();
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=220; let w=img.width||1, h=img.height||1;
        if(w>=h){ if(w>max){ h=Math.round(h*max/w); w=max; } }
        else { if(h>max){ w=Math.round(w*max/h); h=max; } }
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        try{ setBizField('logo', c.toDataURL('image/png')); change(); }catch(err){}
      };
      img.src=r.result;
    };
    r.readAsDataURL(f);
    e.target.value='';
  }
  const removeLogo=()=>{ setBizField('logo', null); change(); };
  const reset=()=>{ resetBiz(); change(); };
  const name=BIZ.name||'', logo=BIZ.logo||null;
  return <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
    display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:520,background:t.card,
      borderTopLeftRadius:18,borderTopRightRadius:18,padding:'16px 16px 28px',maxHeight:'90vh',overflowY:'auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <p style={{fontSize:16,fontWeight:800,color:t.text,margin:0}}>🏢 {L('Business-CI','Business CI','CI de empresa')}</p>
        <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,fontSize:24,cursor:'pointer',lineHeight:1}}>×</button>
      </div>
      <p style={{fontSize:12,color:t.muted,margin:'0 0 14px'}}>
        {L('Logo, Name & Farben deiner Marke – erscheinen auf dem Beamer und in der Lobby.',
           'Your brand logo, name & colors – shown on the beamer and in the lobby.',
           'Logo, nombre y colores de tu marca: se muestran en el proyector y la sala.')}
      </p>
      {/* Live-Vorschau */}
      <div style={{background:t.bg,border:`1.5px solid ${t.border}`,borderRadius:t.radius,
        padding:'20px 14px',marginBottom:16,textAlign:'center'}}>
        <div style={{fontFamily:t.fontTitle,fontSize:34,letterSpacing:1,lineHeight:1,marginBottom:12}}>
          <span style={{color:t.accent}}>Esti</span><span style={{color:t.gold}}>Mates</span>
        </div>
        {(name||logo)
          ? <PoweredBy name={name} logo={logo} t={t} size="lg"/>
          : <span style={{fontSize:12,color:t.muted}}>{L('Noch keine Marke gesetzt','No brand set yet','Sin marca aún')}</span>}
      </div>
      {/* Name */}
      <p style={{fontSize:11,fontWeight:800,color:t.muted,letterSpacing:.6,margin:'0 0 6px',textTransform:'uppercase'}}>
        {L('Firmenname','Company name','Nombre de empresa')}
      </p>
      <input value={name} onChange={e=>onName(e.target.value)}
        placeholder={L('z. B. Aldiana','e.g. Aldiana','p. ej. Aldiana')}
        style={{width:'100%',boxSizing:'border-box',padding:'11px 13px',borderRadius:t.radius,
          background:t.surface,border:`1.5px solid ${t.border}`,color:t.text,fontSize:14,
          fontFamily:t.fontBody,marginBottom:16,outline:'none'}}/>
      {/* Logo */}
      <p style={{fontSize:11,fontWeight:800,color:t.muted,letterSpacing:.6,margin:'0 0 6px',textTransform:'uppercase'}}>
        {L('Logo','Logo','Logo')}
      </p>
      <input ref={fileRef} type="file" accept="image/*" onChange={onLogoFile} style={{display:'none'}}/>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
        {logo && <div style={{background:t.surface,border:`1.5px solid ${t.border}`,borderRadius:t.radius,
          padding:8,display:'flex',alignItems:'center'}}>
          <img src={logo} alt="" style={{height:40,width:'auto',maxWidth:110,objectFit:'contain'}}/>
        </div>}
        <button onClick={()=>fileRef.current&&fileRef.current.click()}
          style={{flex:logo?'0 0 auto':1,padding:'10px 14px',borderRadius:t.radius,background:t.surface,
            border:`1.5px solid ${t.border}`,color:t.text,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:t.fontBody}}>
          {logo? L('Logo ändern','Change logo','Cambiar logo') : L('Logo hochladen','Upload logo','Subir logo')}
        </button>
        {logo && <button onClick={removeLogo}
          style={{padding:'10px 12px',borderRadius:t.radius,background:'none',
            border:`1.5px solid ${t.border}`,color:t.muted,fontSize:13,cursor:'pointer',fontFamily:t.fontBody}}>↺</button>}
      </div>
      {/* CI-Farben */}
      {onOpenColors && <button onClick={onOpenColors}
        style={{width:'100%',display:'flex',alignItems:'center',gap:10,justifyContent:'flex-start',
          background:t.surface,border:`1.5px solid ${t.border}`,borderRadius:t.radius,padding:'11px 14px',
          color:t.text,fontSize:14,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600,marginBottom:14}}>
        <span style={{fontSize:16,width:20,textAlign:'center'}}>🎨</span>
        <span style={{flex:1,textAlign:'left'}}>{L('CI-Farben & Stil','CI colors & style','Colores y estilo CI')}</span>
        <span style={{color:t.muted}}>›</span>
      </button>}
      <p style={{fontSize:11,color:t.muted,margin:'0 0 14px',lineHeight:1.5}}>
        {L('Logo & Name werden mit den Mitspielern und dem Beamer geteilt, sobald du einen Raum eröffnest.',
           'Logo & name are shared with players and the beamer when you open a room.',
           'El logo y el nombre se comparten al abrir una sala.')}
      </p>
      <button onClick={reset} style={{width:'100%',padding:'11px',borderRadius:t.radius,
        background:'none',border:`1.5px solid ${t.danger}66`,color:t.danger,fontSize:13,fontWeight:700,
        cursor:'pointer',fontFamily:t.fontBody}}>{L('Business-CI zurücksetzen','Reset business CI','Restablecer CI')}</button>
    </div>
  </div>;
}
const UI = {
  de: {
    createRoom:"Raum erstellen",join:"Beitreten",back:"← Zurück",
    yourName:"Dein Name",roomCode:"Raumcode (z.B. AB3XY)",
    searching:"Suche Raum...",roomNotFound:"Raum nicht gefunden.",
    gameRunning:"Das Spiel läuft bereits.",roomFull:"Raum voll (max. 50 Spieler).",
    enterName:"Bitte gib deinen Namen ein.",enterCode:"Bitte gib einen Raumcode ein.",
    waitingHost:"Warte auf den Spielleiter 🙂",
    players:"SPIELER",inviteQr:"EINLADUNGS-QR",scanJoin:"Scannen zum Beitreten",
    continueBtn:"Weiter →",categories:"Kategorien",
    allOn:"✓ Alle an",allOff:"✗ Alle aus",selected:"von",
    question:"FRAGE",reveal:"AUFLÖSUNG",
    yourTip:"DEIN TIPP",changeTip:"🔄 TIPP ÄNDERN",tipIn:"Antwort in",
    tipSubmitted:"✓ Tipp abgegeben!",waitingAll:"Warte auf alle...",
    haveTipped:"getippt",discuss:"💬 Tippt erst, dann diskutiert!",
    betting:"WETTEN",whoClosest:"Wer trifft\'s am besten?",
    betCorrect:"+1 Punkt extra",betSet:"Wette gesetzt!",waitRevealBet:"Warte auf Auflösung...",
    closestLabel:"🎯 AM NÄCHSTEN dran",farthestLabel:"💀 AM WEITESTEN daneben",
    submitBet:"Wette abgeben 🎲",twoPlayers:"Bei 2 Spielern reicht eine Auswahl 👆",
    roundScores:"TIPPS DIESER RUNDE",bets:"WETTEN",
    totalScore:"GESAMTPUNKTE",nextQ:"Nächste Frage →",
    endGame:"Beenden",waitNext:"Warte auf den Spielleiter 🙂",
    finalStand:"ENDSTAND",stats:"STATISTIKEN",
    shareBtn:"📤 Ergebnis teilen / speichern",playAgain:"🔄 Nochmal spielen!",
    afkAway:"II Kurz weg",afkBack:"▶ Ich bin wieder da!",
    jokerWon:"Joker gewonnen!",jokers:"JOKER",jokerUsed:"diese Runde verbraucht",
    speedMode:"⚡ SPEED-MODUS",noTimer:"🐢 Kein Timer",speed:"⚡ Speed!",
    jokerSection:"🃏 JOKER",jokerOn:"An",jokerOff:"Aus",
    jokerHowText:"🎯 Punktlandung → Joker · 🥇 Nächster (25%) · 🎲 Wette (25%) · 💀 3× Letzter → Trost",
    debugMode:"🔧 Debug-Modus",soundLabel:"🔊 Sound",
    sabotageWho:"💣 Wen sabotieren?",sabotageBtn:"💣 Sabotieren!",
    cancelBtn:"Abbrechen",betKing:"Wettkönig",bestGuesser:"Bester Schätzer",
    worstGuesser:"Schlechtester Schätzer",exactHits:"Punktlandungen",
    jokerKing:"Joker-König",sabotageKing:"Sabotage-König",
    sabotaged:"💣 sabotiert von",tooSlow:"Zu langsam!",
    globalRank:(p)=>"🌍 Du bist besser als "+p+"% aller Spieler weltweit",
    wins:(name,pts)=>name+" gewinnt mit "+pts+" Punkten! 🎊",
    roundsPlayed:"Runden gespielt",lobbyWaiting:"Warte auf Mitspieler",
    hostLabel:"HOST",youLabel:"DU",
    gameMode:"Spielmodus wählen",adultMode:"Erwachsene",kidsMode:"Kinder",adultSub:"Witzig · obszön",kidsSub:"Bunt · sicher",
    gameMode:"SPIELMODUS",freeSample:"Kostenlos",comingSoon:"Kommt bald",
    startWith:(n,s)=>n+" "+(s===1?"Kategorie":"Kategorien")+" →",
    chooseMin:"Wähle eine Kategorie",minOne:"Wähle mindestens eine Kategorie",
    debugOn:"AN",debugOff:"AUS",
    doubleActive:"DOPPELTE PUNKTE aktiv!",
    extraHintBigger:"größer ↑",extraHintSmaller:"kleiner ↓",extraHintPrefix:"Die Antwort ist",
    betSub:(w,t)=>w+" von "+t+" Wetten",
    avgDeviation:"Ø Abweichung",
    exactCount:(n)=>n+" exakte Treffer",
    jokerPlayed:(n)=>n+" Joker gespielt",
    sabotageCount:(n)=>n+" Sabotagen",
    hintLabel:"💡 HINWEIS",
    pts:"Punkte",
    onboardingSkip:"Überspringen",onboardingNext:"Weiter →",onboardingStart:"Demo spielen!",onboardingDone:"Los geht's!",onboardingReplay:"Nochmal ansehen",
    onboarding:[{emoji:"🎯",title:"Willkommen bei EstiMates!",text:"Das Schätz-Spiel für deine Gruppe. Schätze Zahlen so genau wie möglich – wer am nächsten dran ist gewinnt die Runde."},{emoji:"💡",title:"So funktioniert's",text:"Eine Frage erscheint – alle tippen gleichzeitig ihre Schätzung ein. Dann wird aufgelöst: wer war am nächsten dran?"},{emoji:"🃏",title:"Joker & Wetten",text:"Für gute Schätzungen bekommst du Joker. Setze sie ein um andere zu sabotieren, Hinweise zu enthüllen oder deine Punkte zu verdoppeln."},{emoji:"🏆",title:"Raum erstellen & spielen",text:"Erstelle einen Raum und teile den Code mit deinen Freunden. Alle joinen mit ihrem Handy – kein Download nötig. Jetzt eine kurze Demo-Runde ausprobieren?"}],
    allIn:"💥 Ich weiß es sicher!",allInActive:"💥 All-In aktiv!",allInHint:"Exakter Treffer = 2× Punkte · Daneben = -1 Punkt",
    countdownReady:"Bereit?",steckbriefTitle:"Stell dich vor!",steckbriefSkip:"Überspringen",steckbriefDone:"Fertig!",steckbriefKampfname:"Kampfname / Spitzname",steckbriefBeruf:"Beruf oder Rolle",steckbriefStaerke:"Deine geheime Stärke",steckbriefHobby:"Hobby",steckbriefFact:"Fun Fact über mich",steckbriefFeind:"Mein größter Feind im Raum",
    feedbackTitle:"Hat dir EstiMates Spaß gemacht?",feedbackYes:"⭐ App bewerten",feedbackNo:"💬 Feedback geben",feedbackBug:"🐛 Fehler melden",feedbackBugSubject:"Fehler in EstiMates",feedbackBugBody:"Frage: \nRichtige Antwort laut App: \nWas stimmt nicht: \n\nVielen Dank! Du erhältst einen Belohnungs-Code per E-Mail.",feedbackThanks:"Danke für dein Feedback!",feedbackReward:"Als Dankeschön senden wir dir einen 2h-Vollzugang-Code per E-Mail 🎁",
    disclaimer:"Alle Fragen dienen der Unterhaltung. Wir übernehmen keine Gewähr für Richtigkeit oder Aktualität der Inhalte.",
    demoLabel:"Demo",demoNext:"Nächste Frage →",demoGuess:"Deine Schätzung...",demoSubmit:"Schätzung abgeben ✓",demoAnswerLabel:"ANTWORT",demoTip:"Dein Tipp",demoDeviation:"Abweichung",
    scanCode:"📷 QR-Code scannen",scanOrType:"oder Code eingeben",
    bettingSection:"🎲 WETTEN",bettingOn:"Wetten aktiv",bettingOff:"Keine Wetten",betBoth:"🎯 Nächster & Weitester",betBest:"🏆 Nur Bester",betWorst:"🙈 Nur Schlechtester",
    scanJoin2:"Scan & mitspielen!",
    dailyChallenge:"📅 Tages-Challenge",dailySub:"Eine Frage täglich · Global",dailyPlay:"Heute schätzen!",dailyDone:"Heute bereits gespielt!",dailyRank:(p)=>"Besser als "+p+"% weltweit",dailyStreak:(n)=>"🔥 "+n+" Tage am Stück",kickPlayer:"Kick",kickConfirm:(n)=>n+" wirklich kicken?",kicked:"Du wurdest vom Host entfernt.",leaveGame:"Spiel verlassen",leaveConfirm:"Spiel wirklich verlassen?",closeRoomConfirm:"Raum schließen und zurück zum Start? Der Raum wird für alle beendet.",displayMode:"Gastgeber-Modus",waitingTips:"Wartet auf Tipps...",dispReady:"Bereit?",dispHostPrep:"Host bereitet das Spiel vor...",dispQuestion:"FRAGE",dispAnswer:"ANTWORT",dispRanking:"RANGLISTE",dispStats:"STATISTIKEN",dispJoker:"JOKER-INVENTAR",dispEvents:"EVENTS",dispScanJoin:"Scan to join",dispNoEvents:"Noch keine Events...",dispPhaseQuestion:"─── Neue Runde ───",dispPhaseResults:"─── Auflösung ───",dispPhaseBetting:"─── Wetten ───",dispPhaseFinal:"─── Spiel beendet ───",dispExact:"trifft EXAKT!",dispGuessed:"hat getippt",dispEarned:"erhält Joker",dispSabotaged:"wurde sabotiert",dispSaboteur:"von",dispJokerLabels:{sabotage:"sabotiert!",skip:"überspringt",hint:"Hint aufgedeckt",double:"Punkte verdoppelt",change:"Tipp geändert",extra:"50/50-Joker"},dispWins:"gewinnt!",jokerNames:{skip:"Skip",hint:"Hinweis",double:"Doppelt",sabotage:"Sabotage",change:"Tipp ändern",extra:"50/50-Joker"},jokerVerbs:{skip:"überspringt die Frage",hint:"deckt einen Hinweis auf",double:"verdoppelt seine Punkte",sabotage:"sabotiert",change:"ändert seinen Tipp",extra:"nutzt den 50/50-Joker"},
    camUnavailable:"Kamera nicht verfügbar",
    takePhoto:"📸 Gewinnerfoto aufnehmen",retakePhoto:"🔄 Nochmal",usePhoto:"✓ Verwenden",skipPhoto:"Ohne Foto teilen",photoHint:"Für die Share-Karte!",
  },
  en: {
    createRoom:"Create Room",join:"Join",back:"← Back",
    yourName:"Your Name",roomCode:"Room Code (e.g. AB3XY)",
    searching:"Searching...",roomNotFound:"Room not found.",
    gameRunning:"Game already running.",roomFull:"Room full (max. 50 players).",
    enterName:"Please enter your name.",enterCode:"Please enter a room code.",
    waitingHost:"Waiting for the host 🙂",
    players:"PLAYERS",inviteQr:"INVITE QR",scanJoin:"Scan to join",
    continueBtn:"Continue →",categories:"Categories",
    allOn:"✓ Select all",allOff:"✗ Deselect all",selected:"of",
    question:"QUESTION",reveal:"REVEAL",
    yourTip:"YOUR GUESS",changeTip:"🔄 CHANGE GUESS",tipIn:"Answer in",
    tipSubmitted:"✓ Guess submitted!",waitingAll:"Waiting for everyone...",
    haveTipped:"have guessed",discuss:"💬 Guess first, then discuss!",
    betting:"BETTING",whoClosest:"Who\'s closest?",
    betCorrect:"+1 bonus point",betSet:"Bet placed!",waitRevealBet:"Waiting for reveal...",
    closestLabel:"🎯 CLOSEST guess",farthestLabel:"💀 FARTHEST off",
    submitBet:"Place bet 🎲",twoPlayers:"With 2 players one choice is enough 👆",
    roundScores:"ROUND GUESSES",bets:"BETS",
    totalScore:"TOTAL SCORE",nextQ:"Next Question →",
    endGame:"End Game",waitNext:"Waiting for the host 🙂",
    finalStand:"FINAL STANDINGS",stats:"STATISTICS",
    shareBtn:"📤 Share / save result",playAgain:"🔄 Play again!",
    afkAway:"II Taking a break",afkBack:"▶ I\'m back!",
    jokerWon:"Joker won!",jokers:"JOKERS",jokerUsed:"used this round",
    speedMode:"⚡ SPEED MODE",noTimer:"🐢 No Timer",speed:"⚡ Speed!",
    jokerSection:"🃏 JOKERS",jokerOn:"On",jokerOff:"Off",
    jokerHowText:"🎯 Exact hit → Joker · 🥇 Closest (25%) · 🎲 Correct bet (25%) · 💀 3× Last → Consolation",
    debugMode:"🔧 Debug Mode",soundLabel:"🔊 Sound",
    sabotageWho:"💣 Who to sabotage?",sabotageBtn:"💣 Sabotage!",
    cancelBtn:"Cancel",betKing:"Bet King",bestGuesser:"Best Guesser",
    worstGuesser:"Worst Guesser",exactHits:"Exact Hits",
    jokerKing:"Joker King",sabotageKing:"Sabotage King",
    sabotaged:"💣 sabotaged by",tooSlow:"Too slow!",
    globalRank:(p)=>"🌍 You are better than "+p+"% of all players worldwide",
    wins:(name,pts)=>name+" wins with "+pts+" points! 🎊",
    roundsPlayed:"rounds played",lobbyWaiting:"Waiting for players",
    hostLabel:"HOST",youLabel:"YOU",
    gameMode:"Choose game mode",adultMode:"Adults",kidsMode:"Kids",adultSub:"Funny · edgy",kidsSub:"Colorful · safe",
    gameMode:"GAME MODE",freeSample:"Free",comingSoon:"Coming soon",
    startWith:(n,s)=>n+" "+(s===1?"category":"categories")+" →",
    chooseMin:"Choose a category",minOne:"Choose at least one category",
    debugOn:"ON",debugOff:"OFF",
    doubleActive:"DOUBLE POINTS active!",
    extraHintBigger:"higher ↑",extraHintSmaller:"lower ↓",extraHintPrefix:"The answer is",
    betSub:(w,t)=>w+" of "+t+" bets",
    avgDeviation:"Ø deviation",
    exactCount:(n)=>n+" exact hits",
    jokerPlayed:(n)=>n+" jokers played",
    sabotageCount:(n)=>n+" sabotages",
    hintLabel:"💡 HINT",
    pts:"pts",
    onboardingSkip:"Skip",onboardingNext:"Next →",onboardingStart:"Play demo!",onboardingDone:"Let's go!",onboardingReplay:"Watch again",
    onboarding:[{emoji:"🎯",title:"Welcome to EstiMates!",text:"The guessing game for your group. Estimate numbers as accurately as possible – whoever is closest wins the round."},{emoji:"💡",title:"How it works",text:"A question appears – everyone types their guess at the same time. Then it's revealed: who was closest?"},{emoji:"🃏",title:"Jokers & Betting",text:"Good guesses earn you jokers. Use them to sabotage others, reveal hints or double your points. Before each round you can bet on the best or worst guesser."},{emoji:"🏆",title:"Create a room & play",text:"Create a room and share the code with your friends. Everyone joins on their phone – no download needed. Want to try a quick demo round?"}],
    allIn:"💥 I know this one!",allInActive:"💥 All-In active!",allInHint:"Exact hit = 2× points · Miss = -1 point",
    countdownReady:"Ready?",steckbriefTitle:"Introduce yourself!",steckbriefSkip:"Skip",steckbriefDone:"Done!",steckbriefKampfname:"Nickname / Battle name",steckbriefBeruf:"Job or role",steckbriefStaerke:"Your secret strength",steckbriefHobby:"Hobby",steckbriefFact:"Fun fact about me",steckbriefFeind:"My biggest rival here",
    feedbackTitle:"Did you enjoy EstiMates?",feedbackYes:"⭐ Rate the app",feedbackNo:"💬 Give feedback",feedbackBug:"🐛 Report an error",feedbackBugSubject:"Error in EstiMates",feedbackBugBody:"Question: \nAnswer shown in app: \nWhat is wrong: \n\nThank you! You will receive a reward code by email.",feedbackThanks:"Thanks for your feedback!",feedbackReward:"As a thank you we will send you a 2h full-access code by email 🎁",
    disclaimer:"All questions are for entertainment purposes only. We do not guarantee the accuracy or currentness of any content.",
    demoLabel:"Demo",demoNext:"Next question →",demoGuess:"Your guess...",demoSubmit:"Submit guess ✓",demoAnswerLabel:"ANSWER",demoTip:"Your guess",demoDeviation:"Deviation",
    scanCode:"📷 Scan QR Code",scanOrType:"or enter code",
    bettingSection:"🎲 BETTING",bettingOn:"Betting on",bettingOff:"No betting",betBoth:"🎯 Closest & Farthest",betBest:"🏆 Best only",betWorst:"🙈 Worst only",
    scanJoin2:"Scan to play!",
    dailyChallenge:"📅 Daily Challenge",dailySub:"One question daily · Global",dailyPlay:"Play today!",dailyDone:"Already played today!",dailyRank:(p)=>"Better than "+p+"% worldwide",dailyStreak:(n)=>"🔥 "+n+" day streak",kickPlayer:"Kick",kickConfirm:(n)=>"Really kick "+n+"?",kicked:"You were removed by the host.",leaveGame:"Leave game",leaveConfirm:"Really leave the game?",closeRoomConfirm:"Close the room and go back? The room will end for everyone.",displayMode:"Host Display Mode",waitingTips:"Waiting for guesses...",dispReady:"Ready?",dispHostPrep:"Host is preparing the game...",dispQuestion:"QUESTION",dispAnswer:"ANSWER",dispRanking:"LEADERBOARD",dispStats:"STATISTICS",dispJoker:"JOKER INVENTORY",dispEvents:"EVENTS",dispScanJoin:"Scan to join",dispNoEvents:"No events yet...",dispPhaseQuestion:"─── New Round ───",dispPhaseResults:"─── Reveal ───",dispPhaseBetting:"─── Betting ───",dispPhaseFinal:"─── Game Over ───",dispExact:"hits EXACT!",dispGuessed:"has guessed",dispEarned:"receives Joker",dispSabotaged:"was sabotaged",dispSaboteur:"by",dispJokerLabels:{sabotage:"sabotages!",skip:"skips",hint:"reveals hint",double:"doubles points",change:"changes guess",extra:"50/50 joker"},dispWins:"wins!",jokerNames:{skip:"Skip",hint:"Hint",double:"Double",sabotage:"Sabotage",change:"Change guess",extra:"50/50 Joker"},jokerVerbs:{skip:"skips the question",hint:"reveals a hint",double:"doubles their points",sabotage:"sabotages",change:"changes their guess",extra:"uses the 50/50 joker"},
    camUnavailable:"Camera not available",
    takePhoto:"📸 Take winner photo",retakePhoto:"🔄 Retake",usePhoto:"✓ Use photo",skipPhoto:"Share without photo",photoHint:"For the share card!",
  },
  es: {
    createRoom:"Crear sala",join:"Unirse",back:"← Volver",
    yourName:"Tu nombre",roomCode:"Código de sala (ej. AB3XY)",
    searching:"Buscando...",roomNotFound:"Sala no encontrada.",
    gameRunning:"El juego ya está en curso.",roomFull:"Sala llena (máx. 50 jugadores).",
    enterName:"Por favor ingresa tu nombre.",enterCode:"Por favor ingresa un código.",
    waitingHost:"Esperando al anfitrión 🙂",
    players:"JUGADORES",inviteQr:"QR DE INVITACIÓN",scanJoin:"Escanear para unirse",
    continueBtn:"Continuar →",categories:"Categorías",
    allOn:"✓ Todas",allOff:"✗ Ninguna",selected:"de",
    question:"PREGUNTA",reveal:"RESPUESTA",
    yourTip:"TU RESPUESTA",changeTip:"🔄 CAMBIAR RESPUESTA",tipIn:"Respuesta en",
    tipSubmitted:"✓ ¡Respuesta enviada!",waitingAll:"Esperando a todos...",
    haveTipped:"han respondido",discuss:"💬 ¡Responde primero, luego discute!",
    betting:"APUESTAS",whoClosest:"¿Quién se acerca más?",
    betCorrect:"+1 punto extra",betSet:"¡Apuesta hecha!",waitRevealBet:"Esperando revelación...",
    closestLabel:"🎯 MÁS CERCA",farthestLabel:"💀 MÁS LEJOS",
    submitBet:"Apostar 🎲",twoPlayers:"Con 2 jugadores una elección es suficiente 👆",
    roundScores:"RESPUESTAS DE LA RONDA",bets:"APUESTAS",
    totalScore:"PUNTUACIÓN TOTAL",nextQ:"Siguiente pregunta →",
    endGame:"Terminar",waitNext:"Esperando al anfitrión 🙂",
    finalStand:"CLASIFICACIÓN FINAL",stats:"ESTADÍSTICAS",
    shareBtn:"📤 Compartir / guardar resultado",playAgain:"🔄 ¡Jugar de nuevo!",
    afkAway:"II Un momento",afkBack:"▶ ¡Ya estoy!",
    jokerWon:"¡Comodín ganado!",jokers:"COMODINES",jokerUsed:"usado esta ronda",
    speedMode:"⚡ MODO RÁPIDO",noTimer:"🐢 Sin tiempo",speed:"⚡ ¡Rápido!",
    jokerSection:"🃏 COMODINES",jokerOn:"Sí",jokerOff:"No",
    jokerHowText:"🎯 Acierto exacto → Comodín · 🥇 Más cerca (25%) · 🎲 Apuesta (25%) · 💀 3× Último → Consuelo",
    debugMode:"🔧 Modo Debug",soundLabel:"🔊 Sonido",
    sabotageWho:"💣 ¿A quién sabotear?",sabotageBtn:"💣 ¡Sabotear!",
    cancelBtn:"Cancelar",betKing:"Rey de apuestas",bestGuesser:"Mejor estimador",
    worstGuesser:"Peor estimador",exactHits:"Aciertos exactos",
    jokerKing:"Rey de comodines",sabotageKing:"Rey del sabotaje",
    sabotaged:"💣 saboteado por",tooSlow:"¡Demasiado lento!",
    globalRank:(p)=>"🌍 Eres mejor que el "+p+"% de todos los jugadores",
    wins:(name,pts)=>"¡"+name+" gana con "+pts+" puntos! 🎊",
    roundsPlayed:"rondas jugadas",lobbyWaiting:"Esperando jugadores",
    hostLabel:"ANFITRIÓN",youLabel:"TÚ",
    gameMode:"Elegir modo",adultMode:"Adultos",kidsMode:"Niños",adultSub:"Divertido · atrevido",kidsSub:"Colorido · seguro",
    gameMode:"MODO DE JUEGO",freeSample:"Gratis",comingSoon:"Próximamente",
    startWith:(n,s)=>"Empezar con "+n+" "+(s===1?"categoría":"categorías")+" →",
    chooseMin:"Elige una categoría",minOne:"Elige al menos una categoría",
    debugOn:"SÍ",debugOff:"NO",
    doubleActive:"PUNTOS DOBLES activos!",
    extraHintBigger:"mayor ↑",extraHintSmaller:"menor ↓",extraHintPrefix:"La respuesta es",
    betSub:(w,t)=>w+" de "+t+" apuestas",
    avgDeviation:"Ø desviación",
    exactCount:(n)=>n+" aciertos exactos",
    jokerPlayed:(n)=>n+" comodines usados",
    sabotageCount:(n)=>n+" sabotajes",
    hintLabel:"💡 PISTA",
    pts:"puntos",
    onboardingSkip:"Saltar",onboardingNext:"Siguiente →",onboardingStart:"¡Jugar demo!",onboardingDone:"¡Vamos!",onboardingReplay:"Ver de nuevo",
    onboarding:[{emoji:"🎯",title:"¡Bienvenido a EstiMates!",text:"El juego de estimación para tu grupo. Estima números con la mayor precisión posible – quien esté más cerca gana la ronda."},{emoji:"💡",title:"¿Cómo funciona?",text:"Aparece una pregunta – todos escriben su estimación al mismo tiempo. Luego se revela: ¿quién estaba más cerca?"},{emoji:"🃏",title:"Comodines y apuestas",text:"Las buenas estimaciones te dan comodines. Úsalos para sabotear a otros, revelar pistas o duplicar tus puntos."},{emoji:"🏆",title:"Crear sala y jugar",text:"Crea una sala y comparte el código con tus amigos. Todos se unen con su móvil – sin descarga. ¿Quieres probar una ronda de demostración?"}],
    allIn:"💥 ¡Lo sé seguro!",allInActive:"💥 All-In activo!",allInHint:"Acierto exacto = 2× puntos · Fallo = -1 punto",
    countdownReady:"¿Listos?",steckbriefTitle:"¡Preséntate!",steckbriefSkip:"Saltar",steckbriefDone:"¡Listo!",steckbriefKampfname:"Apodo / Nombre de batalla",steckbriefBeruf:"Trabajo o rol",steckbriefStaerke:"Tu fuerza secreta",steckbriefHobby:"Afición",steckbriefFact:"Dato curioso sobre mí",steckbriefFeind:"Mi mayor rival aquí",
    feedbackTitle:"¿Te gustó EstiMates?",feedbackYes:"⭐ Valorar la app",feedbackNo:"💬 Dar feedback",feedbackBug:"🐛 Reportar un error",feedbackBugSubject:"Error en EstiMates",feedbackBugBody:"Pregunta: \nRespuesta en la app: \nQué está mal: \n\n¡Gracias! Recibirás un código de recompensa por email.",feedbackThanks:"¡Gracias por tu feedback!",feedbackReward:"Como agradecimiento te enviaremos un código de acceso completo de 2h por email 🎁",
    disclaimer:"Todas las preguntas son solo para entretenimiento. No garantizamos la exactitud ni actualidad de los contenidos.",
    demoLabel:"Demo",demoNext:"Siguiente pregunta →",demoGuess:"Tu estimación...",demoSubmit:"Enviar estimación ✓",demoAnswerLabel:"RESPUESTA",demoTip:"Tu estimación",demoDeviation:"Desviación",
    scanCode:"📷 Escanear QR",scanOrType:"o introducir código",
    bettingSection:"🎲 APUESTAS",bettingOn:"Apuestas activas",bettingOff:"Sin apuestas",betBoth:"🎯 Cercano y lejano",betBest:"🏆 Solo mejor",betWorst:"🙈 Solo peor",
    scanJoin2:"¡Escanear y jugar!",
    dailyChallenge:"📅 Reto Diario",dailySub:"Una pregunta al día · Global",dailyPlay:"¡Jugar hoy!",dailyDone:"¡Ya jugaste hoy!",dailyRank:(p)=>"Mejor que el "+p+"% mundial",dailyStreak:(n)=>"🔥 "+n+" días seguidos",kickPlayer:"Expulsar",kickConfirm:(n)=>"¿Expulsar a "+n+"?",kicked:"El anfitrión te ha eliminado.",leaveGame:"Salir del juego",leaveConfirm:"¿Salir del juego?",closeRoomConfirm:"¿Cerrar la sala y volver? La sala terminará para todos.",displayMode:"Modo Anfitrión",waitingTips:"Esperando respuestas...",dispReady:"¿Listos?",dispHostPrep:"El anfitrión está preparando...",dispQuestion:"PREGUNTA",dispAnswer:"RESPUESTA",dispRanking:"CLASIFICACIÓN",dispStats:"ESTADÍSTICAS",dispJoker:"COMODINES",dispEvents:"EVENTOS",dispScanJoin:"Escanear para unirse",dispNoEvents:"Sin eventos aún...",dispPhaseQuestion:"─── Nueva Ronda ───",dispPhaseResults:"─── Revelación ───",dispPhaseBetting:"─── Apuestas ───",dispPhaseFinal:"─── Fin del Juego ───",dispExact:"¡acierta EXACTO!",dispGuessed:"ha respondido",dispEarned:"recibe Joker",dispSabotaged:"fue saboteado",dispSaboteur:"por",dispJokerLabels:{sabotage:"¡sabotea!",skip:"salta",hint:"revela pista",double:"dobla puntos",change:"cambia respuesta",extra:"comodín 50/50"},dispWins:"¡gana!",jokerNames:{skip:"Saltar",hint:"Pista",double:"Doble",sabotage:"Sabotaje",change:"Cambiar",extra:"50/50"},jokerVerbs:{skip:"salta la pregunta",hint:"revela una pista",double:"dobla sus puntos",sabotage:"sabotea a",change:"cambia su respuesta",extra:"usa el comodín 50/50"},
    camUnavailable:"Cámara no disponible",
    takePhoto:"📸 Foto del ganador",retakePhoto:"🔄 Repetir",usePhoto:"✓ Usar foto",skipPhoto:"Compartir sin foto",photoHint:"¡Para la tarjeta!",
  },
};

/* ─── JOKER DEFINITIONS ───────────────────────────── */
const JOKER_NAMES = {
  de: {
    skip:{name:"Frage überspringen",desc:"Sofort! Eine neue Frage wird gezogen."},
    hint:{name:"Hinweis aufdecken", desc:"Zeigt den Hinweis zur Frage an."},
    double:{name:"Doppelte Punkte", desc:"Alle Punkte dieser Runde ×2."},
    sabotage:{name:"Sabotage",      desc:"Tipp eines Mitspielers heimlich verschieben."},
    change:{name:"Tipp ändern",     desc:"Eigenen Tipp einmal korrigieren."},
    extra:{name:"50/50",            desc:"Antwort größer oder kleiner als X?"},
  },
  en: {
    skip:{name:"Skip Question",   desc:"Instantly draw a new question."},
    hint:{name:"Reveal Hint",     desc:"Shows the hint for this question."},
    double:{name:"Double Points", desc:"All points this round ×2."},
    sabotage:{name:"Sabotage",    desc:"Secretly shift a teammate's guess by 30–80%."},
    change:{name:"Change Guess",  desc:"Correct your own guess once."},
    extra:{name:"50/50",          desc:"Is the answer higher or lower than X?"},
  },
  es: {
    skip:{name:"Saltar pregunta", desc:"¡Instantáneo! Se sortea una nueva pregunta."},
    hint:{name:"Revelar pista",   desc:"Muestra la pista de esta pregunta."},
    double:{name:"Puntos dobles", desc:"Todos los puntos de esta ronda ×2."},
    sabotage:{name:"Sabotaje",    desc:"Desplaza secretamente la respuesta de alguien."},
    change:{name:"Cambiar respuesta", desc:"Corrige tu propia respuesta una vez."},
    extra:{name:"50/50",          desc:"¿La respuesta es mayor o menor que X?"},
  },
};
function getJokerDef(id, lang) {
  const icons = {skip:"⏭",hint:"🔍",double:"🎯",sabotage:"💣",change:"🔄",extra:"📊"};
  const names = (JOKER_NAMES[lang]||JOKER_NAMES.de)[id]||{name:id,desc:""};
  return {id, icon:icons[id]||"🃏", ...names};
}
// JOKER_DEFS kept for non-UI uses (enabledJokers array etc.)
const JOKER_DEFS = {
  skip:{id:"skip"},hint:{id:"hint"},double:{id:"double"},
  sabotage:{id:"sabotage"},change:{id:"change"},extra:{id:"extra"},
};

/* ─── QUESTIONS ───────────────────────────────────── */
function buildQuestions(raw) {
  const q = {};
  Object.keys(raw).forEach(mode => {
    q[mode] = {};
    Object.entries(raw[mode]).forEach(([cat, { questions, locked }]) => {
      q[mode][cat] = questions.map(x => ({ ...x, locked }));
    });
  });
  return q;
}
var QUESTIONS_MAP = { de: buildQuestions(QUESTIONS_DE), en: buildQuestions(QUESTIONS_EN), es: buildQuestions(QUESTIONS_ES) };
var QUESTIONS = QUESTIONS_MAP.de; // default, updated when lang changes
var QUESTIONS_RAW_MAP = { de: QUESTIONS_DE, en: QUESTIONS_EN, es: QUESTIONS_ES };
var QUESTIONS_RAW = QUESTIONS_DE; // for CategoryScreen

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

async function shareResult(room, t, lang, winnerPhoto=null) {
  const i=UI[lang]||UI.de;
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
  const PHOTO_H = winnerPhoto ? 180 : 0;
  const H = 120 + PHOTO_H + 30 + sorted.length*44 + 20 + (statsRows>0?30+statsRows*40+16:0) + 64;

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
  ctx.fillText(`${history.length} ${i.roundsPlayed}`, W-PAD-ctx.measureText(`${history.length} ${i.roundsPlayed}`).width, 64);

  // ── Divider ──
  ctx.strokeStyle = isDark?'#32261e':'#ffd58a';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(PAD,76); ctx.lineTo(W-PAD,76); ctx.stroke();

  // ── Winner photo (if provided) ──
  let y = 82;
  if(winnerPhoto) {
    // Draw photo as large circle at top center
    const PHR = 72; // radius
    const PHX = W/2;
    const PHY = y + PHR + 8;
    // Gold ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(PHX, PHY, PHR+5, 0, Math.PI*2);
    const ringGrad = ctx.createLinearGradient(PHX-PHR, PHY-PHR, PHX+PHR, PHY+PHR);
    ringGrad.addColorStop(0, t.gold);
    ringGrad.addColorStop(1, t.accent);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    // Clip to circle and draw photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(PHX, PHY, PHR, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(winnerPhoto, PHX-PHR, PHY-PHR, PHR*2, PHR*2);
    ctx.restore();
    // Trophy badge
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('🏆', PHX + PHR - 8, PHY - PHR + 20);
    y = PHY + PHR + 16;
  }

  // ── Winner banner ──
  const winGrad=ctx.createLinearGradient(PAD,y,W-PAD,y);
  winGrad.addColorStop(0,t.gold+'33');
  winGrad.addColorStop(1,t.gold+'08');
  ctx.fillStyle=winGrad;
  roundRect(ctx,PAD,y,W-PAD*2,46,8);
  ctx.fill();
  ctx.strokeStyle=t.gold+'55';
  ctx.lineWidth=1;
  roundRect(ctx,PAD,y,W-PAD*2,46,8);
  ctx.stroke();

  ctx.font='bold 15px system-ui, sans-serif';
  ctx.fillStyle=t.gold;
  ctx.fillText('🏆', PAD+12, y+29);
  ctx.font='bold 18px system-ui, sans-serif';
  ctx.fillText(`${winner?.name||'?'}`, PAD+36, y+29);
  ctx.font='13px system-ui, sans-serif';
  ctx.fillStyle=isDark?'#f2ece6':'#1e1e1e';
  const winPts=`${scores[winner?.id]||0} ${i.pts}`;
  ctx.fillText(winPts, W-PAD-ctx.measureText(winPts).width, y+29);
  y += 54;

  // ── Scoreboard ──
  const medals=['🥇','🥈','🥉'];
  ctx.font='bold 11px system-ui, sans-serif';
  ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
  ctx.fillText(i.finalStand, PAD, y); y+=16;

  sorted.forEach((p,idx)=>{
    const i=idx; // shadow fix
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
    betKingId&&betTotal[betKingId]>0&&{icon:'🎲',label:i.betKing,val:name(betKingId),sub:i.betSub(betWins[betKingId],betTotal[betKingId])},
    bestId&&pl.length>1&&{icon:'🎯',label:i.bestGuesser,val:name(bestId),sub:`${i.avgDeviation} ${Math.round(avgDiff[bestId]/diffCount[bestId]*10)/10}`},
    worstId&&pl.length>1&&bestId!==worstId&&{icon:'🙈',label:i.worstGuesser,val:name(worstId),sub:`${i.avgDeviation} ${Math.round(avgDiff[worstId]/diffCount[worstId]*10)/10}`},
    exactKingId&&(exactHits[exactKingId]||0)>0&&{icon:'💥',label:i.exactHits,val:name(exactKingId),sub:i.exactCount(exactHits[exactKingId])},
    jokerKingId&&jokerTotals[jokerKingId]>0&&{icon:'🃏',label:i.jokerKing,val:name(jokerKingId),sub:i.jokerPlayed(jokerTotals[jokerKingId])},
    sabKingId&&(sabotageStats[sabKingId]||0)>0&&{icon:'💣',label:i.sabotageKing,val:name(sabKingId),sub:i.sabotageCount(sabotageStats[sabKingId])},
  ].filter(Boolean);

  if(statItems.length>0){
    ctx.font='bold 11px system-ui, sans-serif';
    ctx.fillStyle=isDark?'#6e5e54':'#b0a090';
    ctx.fillText(i.stats, PAD, y); y+=14;

    // two columns
    const colW=(W-PAD*2-10)/2;
    statItems.forEach((s,si)=>{
      const cx = PAD + (si%2)*(colW+10);
      const cy = y + Math.floor(si/2)*40;
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
  ctx.fillText(i.scanJoin2, PAD, y+55);

  // ── Share or download (QR drawn async after image loads) ──
  return new Promise(resolve => {
    // Draw QR code from API
    const qrSize=64;
    const qrX=W-PAD-qrSize;
    const qrY=y+4;
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=https://playestimates.app&bgcolor=${(t.surface||(isDark?'#211c18':'#fffaf2')).replace('#','')}&color=${(t.accent||'#e8360a').replace('#','')}`;
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
              text: `🏆 ${winner?.name} – ${scores[winner?.id]||0} pts! playestimates.app`,
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
              text: `🏆 ${winner?.name} – ${scores[winner?.id]||0} pts! playestimates.app`,
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

/* ─── SOUNDS ─────────────────────────────────────── */
var SOUND_ENABLED_KEY="em_sound";
function isSoundOn(){ return localStorage.getItem(SOUND_ENABLED_KEY)!=="off"; }
function toggleSound(){ localStorage.setItem(SOUND_ENABLED_KEY,isSoundOn()?"off":"on"); }

function playSound(type){
  if(!isSoundOn())return;
  try {
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const g=ctx.createGain();
    g.connect(ctx.destination);
    const o=ctx.createOscillator();
    o.connect(g);
    const now=ctx.currentTime;
    if(type==="correct"){
      // Happy ding
      o.frequency.setValueAtTime(523,now);
      o.frequency.setValueAtTime(659,now+0.1);
      o.frequency.setValueAtTime(784,now+0.2);
      g.gain.setValueAtTime(0.3,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
      o.start(now); o.stop(now+0.5);
    } else if(type==="joker"){
      // Magical sparkle
      o.type="sine";
      o.frequency.setValueAtTime(880,now);
      o.frequency.exponentialRampToValueAtTime(1760,now+0.15);
      g.gain.setValueAtTime(0.2,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3);
    } else if(type==="reveal"){
      // Drum roll reveal
      o.type="triangle";
      o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(400,now+0.2);
      g.gain.setValueAtTime(0.4,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3);
    } else if(type==="tick"){
      // Timer tick
      o.type="square";
      o.frequency.setValueAtTime(800,now);
      g.gain.setValueAtTime(0.05,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.05);
      o.start(now); o.stop(now+0.05);
    } else if(type==="alarm"){
      // Timer urgent
      o.type="sawtooth";
      o.frequency.setValueAtTime(400,now);
      o.frequency.setValueAtTime(500,now+0.1);
      o.frequency.setValueAtTime(400,now+0.2);
      g.gain.setValueAtTime(0.2,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4);
    }
  } catch(e){}
}

/* ─── HELPERS ─────────────────────────────────────── */
var genCode  = () => Math.random().toString(36).slice(2,7).toUpperCase();
function fmtNum(n) {
  if(n==null) return "?";
  const num=Number(n);
  if(Number.isInteger(num)&&num>=1000&&num<=2200) return String(num);
  if(Number.isInteger(num)) return num.toLocaleString("de-DE");
  return num.toLocaleString("de-DE",{maximumFractionDigits:2});
}
var inviteUrl = (c) => `${location.origin}${location.pathname}?room=${c}`;
function avatarColor(name,t){
  const h=[...(name||"?")].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return t.id==="kids"?`hsl(${h},60%,55%)`:`hsl(${h},40%,32%)`;
}
var inject=(css)=>{
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
@keyframes revealSlide{0%{opacity:0;transform:translateX(-50%) translateY(-14px) scale(.6)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes pulseGold{0%,100%{box-shadow:0 0 0 2px #f5c542,0 0 8px 0 rgba(245,197,66,.45)}50%{box-shadow:0 0 0 2px #f5c542,0 0 16px 4px rgba(245,197,66,.85)}}

`;}

function getQuestion(mode, selectedCats, usedIds){
  const cats=QUESTIONS[mode];
  const available=selectedCats.filter(c=>cats[c]);
  if(!available.length)return null;
  let pool=[];
  available.forEach(cat=>{
    cats[cat].forEach((q,i)=>{
      const id=q.id||`${cat}::${i}`;
      if(!usedIds.includes(id)) pool.push({...q,id,cat});
    });
  });
  if(!pool.length){
    usedIds.splice(0,usedIds.length);
    available.forEach(cat=>{
      cats[cat].forEach((q,i)=>pool.push({...q,id:`${cat}::${i}`,cat}));
    });
  }
  const picked=pool[Math.floor(Math.random()*pool.length)];
  if(!picked) return null;
  // Firebase verwirft Writes mit undefined-Werten (z.B. eigene Fragen ohne hint)
  // -> Objekt säubern, damit phase:"question" nicht abgelehnt/zurückgerollt wird
  const clean={};
  Object.keys(picked).forEach(k=>{ if(picked[k]!==undefined) clean[k]=picked[k]; });
  if(clean.hint===undefined) clean.hint='';
  if(clean.emoji===undefined) clean.emoji='📝';
  return clean;
}

function calcRound(room){
  const q=room.q, order=room.order||[], guesses=room.guesses||{}, bets=room.bets||{};
  const doubleJokers=room.doubleJokers||{};
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
    // All-In KERS: exakter Treffer = +5, daneben = -5
    const isAllIn = !!(room.allIn||{})[id];
    if(isAllIn){
      if(diff===0) pts = pts + 4;  // +1 normal +4 bonus = +5 total
      else pts = -5;
    }
    // Doppeljoker: verdoppelt alles – auch Verluste (eigene Entscheidung!)
    roundScores[id]=doubleJokers[id]?pts*2:pts;
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
var row  = {display:"flex",alignItems:"center",gap:10};
var col  = {display:"flex",flexDirection:"column",gap:12};
var page = {minHeight:"100vh",padding:"24px 16px",maxWidth:520,margin:"0 auto"};

function Spinner({t}){return <div style={{width:28,height:28,border:`3px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto"}}/>;}
function Btn({children,onClick,variant="primary",disabled,t,full,style:sx={}}){
  const base={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"13px 22px",border:"none",borderRadius:t.radius,fontSize:15,fontWeight:700,letterSpacing:.3,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.38:1,transition:"all .15s",width:full?"100%":undefined,WebkitTapHighlightColor:"transparent",userSelect:"none"};
  const v={primary:{background:t.accent,color:"#fff"},secondary:{background:"transparent",color:t.text,border:`2px solid ${t.border}`},ghost:{background:"transparent",color:t.muted},warning:{background:t.gold,color:"#fff"}};
  const filled = variant==="primary"||variant==="warning";
  const styl = filled ? {
    boxShadow: (t.btnShadow && t.btnShadow!=="none") ? t.btnShadow : undefined,
    backgroundImage: t.btnGloss ? "linear-gradient(to bottom, rgba(255,255,255,.28), rgba(255,255,255,0) 55%)" : undefined,
  } : {};
  return <button onClick={disabled?undefined:onClick} style={{...base,...v[variant],...styl,...sx}}>{children}</button>;
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
  const big=size==="lg"||size==="xl";
  const fs=size==="xl"?"clamp(64px,17vw,116px)":size==="lg"?"clamp(52px,12vw,80px)":"36px";
  if(t.id==="adult")return <div style={{fontFamily:t.fontTitle,fontSize:fs,letterSpacing:2,lineHeight:1,color:t.accent,animation:"flame 2.5s ease infinite"}}>
    Esti<span style={{color:t.gold}}>Mates</span>
    {big&&<div style={{fontFamily:t.fontBody,fontSize:size==="xl"?14:12,letterSpacing:1.8,color:t.muted,marginTop:size==="xl"?10:6,textTransform:"uppercase"}}>The pocket party game to prove your mates wrong.</div>}
  </div>;
  return <div style={{textAlign:"center"}}>
    <div style={{fontFamily:t.fontTitle,fontSize:fs,lineHeight:1.1}}>
      <span style={{animation:"rainbow 3s linear infinite"}}>Esti</span><span style={{animation:"rainbow 3s .5s linear infinite"}}>Mates</span>
    </div>
    {big&&<div style={{fontSize:size==="xl"?15:13,color:t.muted,marginTop:4}}>The pocket party game to prove your mates wrong. 🎉</div>}
    {!big&&<div style={{fontSize:16,animation:"bop 1.2s ease infinite"}}>🎉✨</div>}
  </div>;
}
function LoadingOverlay({t,text}){
  return <div style={{position:"fixed",inset:0,background:t.bg+"ee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:999}}>{t.id==="kids"?<div style={{fontSize:48,animation:"bop .6s ease infinite"}}>🤔</div>:<Spinner t={t}/>}<p style={{color:t.muted,fontSize:15}}>{text}</p></div>;
}
function QRCode({url,t,lang,size=130}){
  const bg=(t.surface||'#211c18').replace('#','');
  const fg=(t.accent||'#e8360a').replace('#','');
  const label=(UI[lang]||UI.de).scanJoin;
  const px=size;
  return <div style={{textAlign:"center",marginTop:10}}>
    <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:8}}>{(UI[lang]||UI.de).inviteQr}</p>
    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${px*2}x${px*2}&data=${encodeURIComponent(url)}&bgcolor=${bg}&color=${fg}`} alt="QR" style={{width:px,height:px,borderRadius:t.radius,border:`2px solid ${t.border}`}}/>
    <p style={{fontSize:12,color:t.muted,marginTop:7}}>{label}</p>
  </div>;
}

/* ─── JOKER BAR (shown during question) ──────────────── */
function JokerBar({room, myId, code, t, onSkip, lang}){
  const i=UI[lang]||UI.de;
  const [flash,setFlash] = useState(null); // joker type currently flashing
  const myJokers   = (room.jokers||{})[myId]||[];
  const enabled    = room.enabledJokers||[];
  const afk        = !!(room.afkPlayers||{})[myId];
  const usedRound  = !!room.usedJokerThisRound;   // another joker was used this round
  const order      = room.order||[];

  const [showSabotage,   setShowSabotage]   = useState(false);
  const [sabotageTarget, setSabotageTarget] = useState("");
  const [sel,            setSel]            = useState(null); // angetippter Joker (Beschreibung)

  // Count how many of each type the player holds
  const counts = {};
  myJokers.forEach(jk => { counts[jk] = (counts[jk]||0)+1; });

  // shortDesc now comes from JOKER_NAMES (already translated via getJokerDef)
  const shortDesc = Object.fromEntries(
    ["skip","hint","double","sabotage","change","extra"].map(id => [id, getJokerDef(id,lang).desc])
  );

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
    // Visual flash feedback
    setFlash(type);
    setTimeout(()=>setFlash(null), 800);

    if(type === "skip"){
      // Direct call – no Firebase flag needed
      if(onSkip) onSkip();
      return;
    }

    // Mark joker used this round so no second joker is played
    await dbPatch(code, {usedJokerThisRound: type, jokerUsedBy: myId});

    if(type === "hint"){
      // Store who used it – only that player sees the hint
      await dbPatch(code, {hintVisible: true, hintFor: myId});
    }

    if(type === "double"){
      // Save which player used double joker
      await dbPatch(code, {doubleJokers: {[myId]: true}});
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
        extraHint:      `${i.extraHintPrefix} ${bigger?i.extraHintBigger:i.extraHintSmaller} als ${fmtNum(decoy)}`,
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
    // Ensure shifted value is never equal to the real answer
    const answer  = room.q?.a;
    let shifted   = Math.round(g * (1 + dir*factor));
    if(answer != null && shifted === answer){
      // Nudge by 1 to avoid accidental exact hit after sabotage
      shifted = shifted + (dir > 0 ? 1 : -1);
    }
    // Write atomically – reset advancing so calcRound re-runs with new value
    await dbPatch(code, {advancing: false});
    await update(ref(db,`rooms/${code}/guesses`),   {[sabotageTarget]: shifted});
    await update(ref(db,`rooms/${code}/sabotaged`), {[sabotageTarget]: myId}); // store saboteur id
    await update(ref(db,`rooms/${code}/sabotageStats`),
      {[myId]: ((room.sabotageStats||{})[myId]||0)+1});
    setShowSabotage(false);
    setSabotageTarget("");
  }

  if(!enabled.length) return null;

  return <Card t={t} style={{marginTop:8,padding:"10px 12px"}}>
    <p style={{fontSize:11,fontWeight:700,color:t.gold,letterSpacing:.8,marginBottom:8}}>
      🃏 JOKER ({myJokers.length})
      {usedRound && <span style={{color:t.muted,fontWeight:400}}> · {i.jokerUsed}</span>}
    </p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
      {enabled.map(jk=>{
        const def      = getJokerDef(jk,lang); if(!def) return null;
        const count    = counts[jk]||0;
        const has      = count > 0;
        const othersGuessed = (room.order||[])
          .filter(id=>id!==myId&&!(room.afkPlayers||{})[id])
          .some(id=>(room.guesses||{})[id]!=null&&(room.guesses||{})[id]!==-999999);
        const canClick = has && !afk && (jk==="skip" || !usedRound) &&
          (jk!=="sabotage" || othersGuessed);
        const isSel    = sel===jk;
        return(
          <button key={jk} onClick={()=>setSel(isSel?null:jk)}
            style={{position:"relative",display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:3,padding:"9px 6px",
              borderRadius:t.radius,fontFamily:t.fontBody,
              background: flash===jk ? t.gold+"44" : isSel ? t.gold+"22" : has ? t.gold+"12" : t.surface,
              border:`1.5px solid ${flash===jk||isSel ? t.gold : has ? t.gold+"77" : t.border}`,
              opacity: has ? 1 : 0.4, cursor:"pointer",
              transform: flash===jk ? "scale(1.04)" : "scale(1)", transition:"all .15s"}}>
            <span style={{fontSize:22,lineHeight:1}}>{def.icon}</span>
            <span style={{fontSize:10,fontWeight:700,whiteSpace:"nowrap",
              color: has ? t.gold : t.text}}>{def.name}</span>
            <span style={{position:"absolute",top:3,right:3,minWidth:16,height:16,borderRadius:100,
              background: has ? t.gold : t.border, color: has ? t.bg : t.muted,
              fontSize:10,fontWeight:800,padding:"0 3px",
              display:"flex",alignItems:"center",justifyContent:"center"}}>{count}</span>
          </button>
        );
      })}
    </div>

    {/* Beschreibung + Verwenden des angetippten Jokers */}
    {sel&&(()=>{
      const def=getJokerDef(sel,lang); if(!def) return null;
      const count=counts[sel]||0, has=count>0;
      const othersGuessed=(room.order||[]).filter(id=>id!==myId&&!(room.afkPlayers||{})[id])
        .some(id=>(room.guesses||{})[id]!=null&&(room.guesses||{})[id]!==-999999);
      const canClick=has&&!afk&&(sel==="skip"||!usedRound)&&(sel!=="sabotage"||othersGuessed);
      const reason = afk ? i.jokerUsed
        : !has ? (lang==='en'?'You don\u2019t have this joker':lang==='es'?'No tienes este comodín':'Diesen Joker hast du nicht')
        : (sel!=="skip"&&usedRound) ? i.jokerUsed
        : (sel==="sabotage"&&!othersGuessed) ? (lang==='en'?'Wait until others have guessed':lang==='es'?'Espera a que otros adivinen':'Erst wenn andere getippt haben')
        : null;
      return <div style={{marginTop:8,padding:"10px 12px",borderRadius:t.radius,
        background:t.surface,border:`1.5px solid ${t.gold}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:18}}>{def.icon}</span>
          <span style={{fontSize:13,fontWeight:800,color:t.gold,flex:1}}>{def.name}</span>
        </div>
        <p style={{fontSize:12,color:t.text,margin:"0 0 8px",lineHeight:1.4}}>{shortDesc[sel]}</p>
        <button onClick={()=>{ if(canClick){ useJoker(sel); setSel(null); } }} disabled={!canClick}
          style={{width:"100%",padding:"8px",borderRadius:t.radius,border:"none",
            background:canClick?t.gold:t.surface,color:canClick?t.bg:t.muted,
            fontSize:13,fontWeight:800,cursor:canClick?"pointer":"default",
            fontFamily:t.fontBody,border:canClick?"none":`1px solid ${t.border}`}}>
          {canClick ? (lang==='en'?'Use ✓':lang==='es'?'Usar ✓':'Verwenden ✓') : (reason||'—')}
        </button>
      </div>;
    })()}

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


/* ─── DAILY CHALLENGE ──────────────────────────────────── */
function getDailyKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDailyQuestion(lang) {
  const hash = getDailyKey().split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const cats = Object.values(QUESTIONS['adult']);
  const pool = cats.flat();
  return pool[hash % pool.length];
}

function DailyChallengeScreen({t, lang, onBack}) {
  const i = UI[lang]||UI.de;
  const [phase, setPhase] = React.useState('play');
  const [guess, setGuess] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [rank, setRank] = React.useState(null);
  const [streak, setStreak] = React.useState(0);
  const q = getDailyQuestion(lang);
  const todayKey = getDailyKey();
  const storageKey = `em_daily_${todayKey}`;

  React.useEffect(()=>{
    const saved = localStorage.getItem(storageKey);
    if(saved){ setResult(JSON.parse(saved)); setPhase('done'); }
    let s=0;
    for(let n=1;n<=365;n++){
      const d=new Date(); d.setDate(d.getDate()-n);
      const k=`em_daily_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if(localStorage.getItem(k)) s++; else break;
    }
    setStreak(s);
  },[]);

  async function submit(){
    const g=parseFloat(guess.replace(',','.'));
    if(isNaN(g)) return;
    const diff=Math.abs(g-q.a), exact=diff===0;
    const res={guess:g,answer:q.a,diff,exact,date:todayKey};
    localStorage.setItem(storageKey,JSON.stringify(res));
    setResult(res); setPhase('result');
    saveGlobalStats({diff,exact,isNewGame:true,mode:'adult'},lang);
    const r=await getGlobalRank(diff); setRank(r);
  }

  const pct=result?Math.max(0,Math.min(100,Math.round(100*(1-result.diff/Math.max(result.answer,1))))):0;

  return <div style={{...page,animation:'fu .3s ease both'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:t.muted,fontSize:22,cursor:'pointer'}}>←</button>
      <div>
        <p style={{fontWeight:700,fontSize:16,margin:0}}>{i.dailyChallenge}</p>
        <p style={{fontSize:12,color:t.muted,margin:0}}>{getDailyKey()}{streak>0?` · ${i.dailyStreak(streak)}`:''}</p>
      </div>
    </div>
    {phase==='play'&&<>
      <Card t={t} style={{marginBottom:16}}>
        <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:8}}>{i.dailyChallenge.toUpperCase()}</p>
        <p style={{fontSize:18,fontWeight:700,lineHeight:1.4}}>{q.q}</p>
        {q.unit&&<p style={{color:t.gold,fontSize:13,marginTop:6}}>{i.tipIn}: <strong>{q.unit}</strong></p>}
      </Card>
      <Card t={t} style={{marginBottom:16}}>
        <input type="number" value={guess} onChange={e=>setGuess(e.target.value)}
          placeholder={i.demoGuess||'...'}
          style={{width:'100%',padding:'12px 14px',fontSize:20,fontWeight:700,
            background:t.surface,border:`1.5px solid ${t.border}`,borderRadius:t.radius,
            color:t.text,textAlign:'center',boxSizing:'border-box'}}/>
      </Card>
      <Btn t={t} full onClick={submit} disabled={!guess}>{i.dailyPlay}</Btn>
    </>}
    {(phase==='result'||phase==='done')&&result&&<>
      <Card t={t} style={{marginBottom:16,textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:8}}>{result.exact?'🎯':pct>80?'🔥':pct>50?'👍':'😅'}</div>
        <p style={{fontSize:14,color:t.muted,marginBottom:4}}>{q.q}</p>
        <p style={{fontSize:28,fontWeight:800,color:t.gold,margin:'8px 0'}}>{fmtNum(result.answer)} <span style={{fontSize:14}}>{q.unit}</span></p>
        <p style={{fontSize:14,color:t.muted}}>{lang==='en'?'Your guess':lang==='es'?'Tu tirada':'Dein Tipp'}: <strong style={{color:t.text}}>{fmtNum(result.guess)}</strong> · ±<strong style={{color:result.exact?t.green:t.accent}}>{fmtNum(result.diff)}</strong></p>
      </Card>
      {rank!==null&&<Card t={t} style={{marginBottom:16,textAlign:'center',background:t.gold+'18',border:`1.5px solid ${t.gold}44`}}>
        <p style={{fontSize:18,fontWeight:700,color:t.gold,margin:0}}>{i.dailyRank(rank)}</p>
      </Card>}
      {phase==='done'&&<Card t={t} style={{marginBottom:16,textAlign:'center'}}>
        <p style={{color:t.muted,fontSize:14,margin:0}}>{i.dailyDone}</p>
      </Card>}
      <Btn t={t} full variant="secondary" onClick={onBack}>{i.back}</Btn>
    </>}
  </div>;
}

/* ─── HOME ────────────────────────────────────────── */


/* ─── ONBOARDING ────────────────────────────────── */
var SLIDE_COLORS = (t) => [t.accent, t.gold, '#39d98a', t.gold];
var ONBOARDING_SLIDES = (i, t) =>
  (i.onboarding||[]).map((s,idx) => ({...s, color: SLIDE_COLORS(t)[idx]||t.gold}));

const DEMO_QUESTIONS_I18N = {
  de: [
    {q:'Wie viele Stunden schläft ein Mensch durchschnittlich pro Nacht?', a:7, unit:'Stunden', hint:'Empfehlung: 7–9 Stunden.', emoji:'😴'},
    {q:'Wie viele Knochen hat ein erwachsener Mensch?', a:206, unit:'Knochen', hint:'Babies haben ~270, viele verschmelzen.', emoji:'🦴'},
    {q:'Wie viele Kilometer ist die Entfernung von der Erde zum Mond?', a:384400, unit:'km', hint:'Ca. 1,3 Lichtsekunden entfernt.', emoji:'🌙'},
  ],
  en: [
    {q:'How many hours does a person sleep on average per night?', a:7, unit:'hours', hint:'Recommendation: 7–9 hours.', emoji:'😴'},
    {q:'How many bones does an adult human have?', a:206, unit:'bones', hint:'Babies have ~270, many fuse together.', emoji:'🦴'},
    {q:'How many kilometers is the distance from Earth to the Moon?', a:384400, unit:'km', hint:'About 1.3 light-seconds away.', emoji:'🌙'},
  ],
  es: [
    {q:'¿Cuántas horas duerme una persona de media por noche?', a:7, unit:'horas', hint:'Recomendación: 7–9 horas.', emoji:'😴'},
    {q:'¿Cuántos huesos tiene un humano adulto?', a:206, unit:'huesos', hint:'Los bebés tienen ~270, muchos se fusionan.', emoji:'🦴'},
    {q:'¿Cuántos kilómetros hay entre la Tierra y la Luna?', a:384400, unit:'km', hint:'A unos 1,3 segundos luz de distancia.', emoji:'🌙'},
  ],
};
var DEMO_QUESTIONS = (lang) => DEMO_QUESTIONS_I18N[lang]||DEMO_QUESTIONS_I18N.de;

function OnboardingScreen({t, lang, onDone}) {
  const i = UI[lang]||UI.de;
  const [step, setStep] = React.useState(0); // 0-3 = slides, 4+ = demo
  const [demoStep, setDemoStep] = React.useState(0);
  const [demoPhase, setDemoPhase] = React.useState('play'); // play | result
  const [guess, setGuess] = React.useState('');
  const [demoResults, setDemoResults] = React.useState([]);

  const slides = ONBOARDING_SLIDES(i, t);
  const totalSlides = slides.length;
  const inDemo = step >= totalSlides;
  const demoQ = DEMO_QUESTIONS(lang)[demoStep];

  function submitGuess() {
    const g = parseFloat(guess.replace(',','.'));
    if(isNaN(g)) return;
    const diff = Math.abs(g - demoQ.a);
    setDemoResults(prev => [...prev, {guess:g, diff, exact:diff===0}]);
    setDemoPhase('result');
  }

  function nextDemo() {
    if(demoStep < DEMO_QUESTIONS(lang).length - 1) {
      setDemoStep(s => s+1);
      setDemoPhase('play');
      setGuess('');
    } else {
      localStorage.setItem('em_onboarded','1');
      onDone();
    }
  }

  // Slide view
  if(!inDemo) {
    const slide = slides[step];
    return <div style={{minHeight:'100vh',background:t.bg,display:'flex',
      flexDirection:'column',alignItems:'center',justifyContent:'center',
      padding:'24px 20px',maxWidth:520,margin:'0 auto',animation:'fu .3s ease both'}}>

      {/* Progress dots */}
      <div style={{display:'flex',gap:8,marginBottom:40}}>
        {slides.map((_,idx) => (
          <div key={idx} style={{width:idx===step?24:8,height:8,borderRadius:4,
            background:idx===step?slide.color:t.border,transition:'all .3s'}}/>
        ))}
      </div>

      {/* Content */}
      <div style={{fontSize:80,marginBottom:24,animation:'popIn .4s ease both'}}>{slide.emoji}</div>
      <h2 style={{fontSize:24,fontWeight:900,color:slide.color,textAlign:'center',
        margin:'0 0 16px',fontFamily:t.fontTitle}}>{slide.title}</h2>
      <p style={{fontSize:16,color:t.muted,textAlign:'center',lineHeight:1.7,
        margin:'0 0 48px',maxWidth:380}}>{slide.text}</p>

      {/* Buttons */}
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:340}}>
        {step < totalSlides - 1
          ? <Btn t={t} full onClick={()=>setStep(s=>s+1)}>{i.onboardingNext}</Btn>
          : <Btn t={t} full onClick={()=>setStep(totalSlides)}>{i.onboardingStart}</Btn>
        }
        <button onClick={()=>{localStorage.setItem('em_onboarded','1');onDone();}}
          style={{background:'none',border:'none',color:t.muted,fontSize:13,
            cursor:'pointer',fontFamily:t.fontBody,padding:'8px'}}>
          {i.onboardingSkip}
        </button>
      </div>
      {step===totalSlides-1&&i.disclaimer&&<p style={{
        fontSize:11,color:t.muted,textAlign:'center',
        maxWidth:340,lineHeight:1.5,marginTop:16,opacity:.7}}>
        ⚠ {i.disclaimer}
      </p>}
    </div>;
  }

  // Demo round
  return <div style={{...page,animation:'fu .3s ease both'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <p style={{fontSize:12,color:t.muted,margin:0}}>
        Demo {demoStep+1}/{DEMO_QUESTIONS.length}
      </p>
      <button onClick={()=>{localStorage.setItem('em_onboarded','1');onDone();}}
        style={{background:'none',border:'none',color:t.muted,fontSize:12,
          cursor:'pointer',fontFamily:t.fontBody,textDecoration:'underline'}}>
        {i.onboardingSkip}
      </button>
    </div>

    {/* Progress bar */}
    <div style={{height:4,background:t.border,borderRadius:2,marginBottom:24,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${((demoStep)/(DEMO_QUESTIONS.length))*100}%`,
        background:t.accent,borderRadius:2,transition:'width .4s'}}/>
    </div>

    {/* Question card */}
    <Card t={t} style={{marginBottom:16}}>
      <div style={{fontSize:32,textAlign:'center',marginBottom:8}}>{demoQ.emoji}</div>
      <p style={{fontSize:17,fontWeight:700,lineHeight:1.4,textAlign:'center',
        margin:'0 0 12px'}}>{demoQ.q}</p>
      {demoQ.unit&&<div style={{textAlign:'center'}}>
        <span style={{background:t.gold+'22',border:`1px solid ${t.gold}55`,
          borderRadius:8,padding:'4px 12px',color:t.gold,fontWeight:700,fontSize:13}}>
          Antwort in: {demoQ.unit}
        </span>
      </div>}
    </Card>

    {demoPhase==='play'&&<>
      <Card t={t} style={{marginBottom:16}}>
        <input type="number" value={guess} onChange={e=>setGuess(e.target.value)}
          placeholder={i.demoGuess||'...'}
          onKeyDown={e=>e.key==='Enter'&&submitGuess()}
          style={{width:'100%',padding:'12px 14px',fontSize:22,fontWeight:800,
            background:t.surface,border:`1.5px solid ${t.border}`,
            borderRadius:t.radius,color:t.text,textAlign:'center',
            boxSizing:'border-box'}}/>
      </Card>
      <Btn t={t} full onClick={submitGuess} disabled={!guess}>{i.demoSubmit||'✓'}</Btn>
    </>}

    {demoPhase==='result'&&<>
      <Card t={t} style={{marginBottom:16,textAlign:'center',
        background:t.gold+'18',border:`2px solid ${t.gold}`}}>
        <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:1,margin:'0 0 8px'}}>{i.demoAnswerLabel}</p>
        <p style={{fontSize:40,fontWeight:900,color:t.gold,margin:'0 0 4px'}}>
          {fmtNum(demoQ.a)} <span style={{fontSize:18}}>{demoQ.unit}</span>
        </p>
        <p style={{fontSize:14,color:t.muted,margin:'8px 0 0'}}>
          Dein Tipp: <strong style={{color:t.text}}>{fmtNum(demoResults[demoResults.length-1]?.guess)}</strong>
          {' · '}
          Abweichung: <strong style={{color:demoResults[demoResults.length-1]?.exact?'#39d98a':t.accent}}>
            {demoResults[demoResults.length-1]?.exact?'🎯 EXAKT!':'±'+fmtNum(demoResults[demoResults.length-1]?.diff)}
          </strong>
        </p>
        {demoQ.hint&&<p style={{fontSize:13,color:t.muted,marginTop:10,
          fontStyle:'italic'}}>💡 {demoQ.hint}</p>}
      </Card>
      <Btn t={t} full onClick={nextDemo}>
        {demoStep < DEMO_QUESTIONS.length-1 ? 'Nächste Frage →' : i.onboardingDone}
      </Btn>
    </>}
  </div>;
}


/* ─── STECKBRIEF SCREEN ─────────────────────────── */
function SteckbriefScreen({t, lang, myId, code, playerName, onDone, initial=null, onSaveProfile=null}) {
  const i = UI[lang]||UI.de;
  const fields = [
    {key:'kampfname', label:i.steckbriefKampfname, emoji:'✏', placeholder:'z.B. Der Schätzkönig'},
    {key:'fact',      label:i.steckbriefFact,       emoji:'🔥', placeholder:'z.B. Ich schlafe stehend'},
  ];
  const [vals, setVals] = React.useState(()=> initial ? {kampfname:initial.kampfname||'', fact:initial.fact||''} : {});
  const [busy, setBusy] = React.useState(false);
  const [selfie, setSelfie] = React.useState(initial?.selfie||null);
  const [showCam, setShowCam] = React.useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  async function startCam(){
    setShowCam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject=stream; videoRef.current.play(); }
    } catch(e){ setShowCam(false); }
  }
  function takeSelfie(){
    const v = videoRef.current;
    if(!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    const size = Math.min(v.videoWidth,v.videoHeight);
    const ox = (v.videoWidth-size)/2, oy = (v.videoHeight-size)/2;
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(v,-200,0,200,200); ctx.restore();
    setSelfie(canvas.toDataURL('image/jpeg',0.7));
    stopCam();
  }
  function stopCam(){
    if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setShowCam(false);
  }
  React.useEffect(()=>()=>stopCam(),[]);

  async function save() {
    setBusy(true);
    // Compress selfie to small size before Firebase
    let selfieSmall = null;
    if(selfie) {
      try {
        const img = new Image();
        img.src = selfie;
        await new Promise(r=>{ img.onload=r; });
        const c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        c.getContext('2d').drawImage(img,0,0,80,80);
        selfieSmall = c.toDataURL('image/jpeg', 0.5);
        localStorage.setItem(`em_selfie_${myId}`, selfie); // keep full size locally
      } catch(e){}
    }
    const steckbrief = {...vals, name: playerName, selfie: selfieSmall};
    await update(ref(db, `rooms/${code}/steckbriefe/${myId}`), steckbrief);
    // Account-Profil aktualisieren (nur eingeloggte Nutzer – Callback ist sonst null); volles Selfie fürs Vorbefüllen
    if(onSaveProfile) onSaveProfile({kampfname:vals.kampfname||'', fact:vals.fact||'', selfie:selfie||null});
    onDone();
  }

  return <div style={{position:'fixed',inset:0,zIndex:200,background:t.bg,overflowY:'auto',display:'flex',flexDirection:'column',maxWidth:520,margin:'0 auto',padding:'14px 16px 24px'}}>
    <h2 style={{fontSize:20,fontWeight:900,color:t.accent,margin:'0 0 4px',
      fontFamily:t.fontTitle}}>{i.steckbriefTitle}</h2>
    <p style={{fontSize:13,color:t.muted,margin:'0 0 12px'}}>
      {playerName} · {lang==='de'?'wird auf dem Beamer gezeigt':'shown on the big screen'}
    </p>
    {/* Selfie */}
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
      <div style={{width:72,height:72,borderRadius:'50%',overflow:'hidden',
        background:t.surface,border:`2px solid ${selfie?t.accent:t.border}`,
        flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {selfie
          ? <img src={selfie} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          : <span style={{fontSize:28}}>👤</span>}
      </div>
      <div>
        {showCam
          ? <div style={{position:'relative',width:160,height:160,borderRadius:12,overflow:'hidden',background:'#000'}}>
              <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}}/>
              <button onClick={takeSelfie} style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',background:t.accent,border:'none',borderRadius:100,padding:'6px 14px',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:700}}>📸</button>
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <button onClick={startCam} style={{padding:'7px 14px',borderRadius:t.radius,background:t.surface,border:`1px solid ${t.border}`,color:t.muted,fontSize:13,cursor:'pointer',fontFamily:t.fontBody}}>
                {selfie?i.steckbriefRetake:i.steckbriefSelfie}
              </button>
              <p style={{fontSize:11,color:t.muted,margin:0}}>{i.steckbriefSelfieHint}</p>
            </div>}
      </div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:8,flex:1}}>
      {fields.map(f=>(
        <div key={f.key}>
          <p style={{fontSize:12,color:t.muted,margin:'0 0 3px',fontWeight:600}}>
            {f.emoji} {f.label}
          </p>
          <input value={vals[f.key]||''} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}
            placeholder={f.placeholder}
            style={{width:'100%',padding:'9px 12px',background:t.surface,
              border:`1.5px solid ${t.border}`,borderRadius:t.radius,
              color:t.text,fontSize:14,fontFamily:t.fontBody,boxSizing:'border-box'}}/>
        </div>
      ))}
    </div>
    <div style={{display:'flex',gap:10,marginTop:14}}>
      <button onClick={onDone}
        style={{flex:1,padding:'11px',borderRadius:t.radius,background:'none',
          border:`1px solid ${t.border}`,color:t.muted,fontSize:13,cursor:'pointer',
          fontFamily:t.fontBody}}>
        {i.steckbriefSkip}
      </button>
      <Btn t={t} onClick={save} disabled={busy} style={{flex:2}}>
        {i.steckbriefDone} ✓
      </Btn>
    </div>
  </div>;
}

/* ─── COUNTDOWN OVERLAY ──────────────────────────── */
function CountdownOverlay({t, lang, onDone}) {
  const i = UI[lang]||UI.de;
  const [count, setCount] = React.useState(3);
  const [phase, setPhase] = React.useState('count'); // count | go

  React.useEffect(()=>{
    if(phase==='go'){
      const t = setTimeout(onDone, 800);
      return ()=>clearTimeout(t);
    }
    if(count > 0){
      const t = setTimeout(()=>setCount(c=>c-1), 900);
      return ()=>clearTimeout(t);
    } else {
      setPhase('go');
    }
  },[count, phase]);

  const isGo = phase==='go';
  return <div style={{position:'fixed',inset:0,zIndex:500,
    background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',
    justifyContent:'center',flexDirection:'column',gap:8}}>
    <div key={isGo?'go':count} style={{
      fontSize:isGo?80:120,fontWeight:900,
      color:isGo?'#39d98a':count===1?'#e8360a':count===2?'#ff8c2a':'#f2ece6',
      fontFamily:'Arial Black,sans-serif',lineHeight:1,
      animation:'popIn .3s ease both'}}>
      {isGo?'GO!':count}
    </div>
    {!isGo&&<p style={{fontSize:16,color:'#6e5e54',letterSpacing:2}}>
      {i.countdownReady}
    </p>}
  </div>;
}

function HomeScreen({onHost,onJoin,lang,onSetLang,isAnonymous=true,userName=null,onShowLogin=null,onSignOut=null,onShowOnboarding=null,onMyQuestions=null,onAdmin=null,onA11y=null,onTeam=null,profile=null,onOpenColors=null,onOpenBusiness=null}){
  const i=UI[lang]||UI.de;
  const[tab,setTab]=useState(()=>new URLSearchParams(location.search).get("room")?"join":location.search.includes("daily")?"daily":"landing");
  const[name,setName]=useState("");
  const[spitzname,setSpitzname]=useState("");
  const[funfact,setFunfact]=useState("");
  const[selfieHome,setSelfieHome]=useState(null);
  // Account-Profil in leere Felder einspielen (nur eingeloggte Nutzer – kommt vorbefüllt rein, bleibt änderbar)
  React.useEffect(()=>{
    if(!profile) return;
    if(profile.name)      setName(v=>v||profile.name);
    if(profile.kampfname) setSpitzname(v=>v||profile.kampfname);
    if(profile.fact)      setFunfact(v=>v||profile.fact);
    if(profile.selfie)    setSelfieHome(v=>v||profile.selfie);
  },[profile]);
  const[streamHome,setStreamHome]=useState(null);
  const videoRefHome=React.useRef(null);
  const[code,setCode]=useState(()=>new URLSearchParams(location.search).get("room")||"");
  const[mode,setMode]=useState("adult");
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);
  const[a11yOpen,setA11yOpen]=useState(false);
  const t=applyA11y(mode==="kids"?KIDS:ADULT);
  const menuRow={display:'flex',alignItems:'center',gap:12,width:'100%',
    padding:'13px 16px',borderRadius:t.radius,background:t.surface,
    border:`1px solid ${t.border}`,color:t.text,fontSize:14,fontWeight:600,
    cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'};
  useEffect(()=>{inject(globalCSS(tab==="landing"?applyA11y(ADULT):t));},[t,tab]);

  async function submit(){
    if(!name.trim()){setError(i.enterName);return;}
    setError("");
    if(tab==="host"){localStorage.setItem('em_lastname',name.trim());onHost(name.trim(),mode,{kampfname:spitzname.trim(),fact:funfact.trim(),selfie:selfieHome});}
    else{
      const c=code.trim().toUpperCase();
      if(!c){setError(i.enterCode);return;}
      setBusy(true);
      // Auf (anonyme) Anmeldung warten – sonst lehnen die Rules den Read ab (auth===null)
      let waited=0;
      while(!auth?.currentUser && waited<6000){ await new Promise(r=>setTimeout(r,150)); waited+=150; }
      if(!auth?.currentUser){ setBusy(false); setError(i.roomNotFound); return; }
      let room;
      try {
        room=await dbGet(c);
      } catch(e){
        console.error('join read failed:',e);
        setBusy(false);
        const perm = e?.code==='PERMISSION_DENIED' || /permission/i.test(e?.message||'');
        setError(perm
          ? (lang==='en'?'Access denied – check Firebase rules (rooms .read).'
            :lang==='es'?'Acceso denegado – revisa las reglas (rooms .read).'
            :'Zugriff verweigert – Firebase-Rules prüfen (rooms .read).')
          : i.roomNotFound);
        return;
      }
      setBusy(false);
      if(!room){setError(i.roomNotFound);return;}
      // Allow joining mid-game - player will catch up from current state
      if((room.order||[]).length>=50){setError(i.roomFull);return;}
      localStorage.setItem('em_lastname', name.trim());
      onJoin(c,name.trim(),room.mode,room.lang||"de",{kampfname:spitzname.trim(),fact:funfact.trim(),selfie:selfieHome});
    }
  }

  if(tab==="landing"){
    const li=UI[lang]||UI.de;
    const lt=applyA11y(ADULT);
    const landingMenuBtn={width:'100%',display:'flex',alignItems:'center',gap:10,
      justifyContent:'flex-start',background:lt.surface,
      border:`1.5px solid ${lt.border}`,borderRadius:100,padding:'11px 22px',
      color:lt.text,fontSize:14,cursor:'pointer',fontFamily:ADULT.fontBody,fontWeight:600};
    inject(globalCSS(lt));
    const pills={
      de:["4.800+ Fragen","Echtzeit","Joker"],
      en:["4,800+ Questions","Real-time","Jokers"],
      es:["4.800+ Preguntas","Tiempo real","Comodines"],
    };
    return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:lt.bg,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:`radial-gradient(circle,${lt.accent}2e,transparent 65%)`,top:-200,left:"50%",transform:"translateX(-50%)",filter:"blur(50px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",maxWidth:460,width:"100%",position:"relative",animation:"fu .4s ease both"}}>
        {/* Top row: Sprache · Account · Demo */}
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",gap:8,marginBottom:32,width:"100%",maxWidth:400,marginLeft:'auto',marginRight:'auto'}}>
          <select value={lang} onChange={e=>onSetLang(e.target.value)}
            style={{padding:"0 12px",height:38,boxSizing:"border-box",
              background:lt.surface,
              border:`1.5px solid ${lt.border}`,
              borderRadius:100,color:lt.text,
              fontWeight:700,fontSize:13,cursor:"pointer",
              fontFamily:ADULT.fontBody,
              appearance:"none",
              paddingRight:28,flexShrink:0,
              backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236e5e54' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat:"no-repeat",
              backgroundPosition:"right 10px center"}}>
            <option value="de">🇩🇪 DE</option>
            <option value="en">🇬🇧 EN</option>
            <option value="es">🇪🇸 ES</option>
          </select>
          {/* Account – mittig */}
          <div style={{flex:1,display:'flex',justifyContent:'center',minWidth:0}}>
            {isAnonymous
              ? <button onClick={onShowLogin}
                  style={{display:'flex',alignItems:'center',gap:6,maxWidth:'100%',height:38,boxSizing:'border-box',
                    padding:'0 14px',background:lt.surface,border:`1.5px solid ${lt.border}`,
                    borderRadius:100,color:lt.text,fontSize:13,cursor:'pointer',
                    fontFamily:ADULT.fontBody,fontWeight:600,overflow:'hidden'}}>
                  🔐 <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lang==='en'?'Sign in':lang==='es'?'Entrar':'Anmelden'}</span>
                </button>
              : <div style={{display:'flex',alignItems:'center',gap:6,maxWidth:'100%',height:38,boxSizing:'border-box',
                  padding:'0 14px',background:lt.surface,border:`1.5px solid ${lt.border}`,
                  borderRadius:100,overflow:'hidden'}}>
                  <span style={{fontSize:13,color:lt.text,fontWeight:600,overflow:'hidden',
                    textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✅ {userName||(lang==='en'?'Signed in':lang==='es'?'Conectado':'Angemeldet')}</span>
                  <button onClick={onSignOut} title={lang==='en'?'Sign out':lang==='es'?'Salir':'Abmelden'}
                    style={{background:'none',border:'none',color:lt.muted,fontSize:14,
                      cursor:'pointer',flexShrink:0,padding:0,lineHeight:1}}>↩</button>
                </div>}
          </div>
          {onShowOnboarding&&<button onClick={onShowOnboarding}
            title={i.demoLabel||"Demo"}
            style={{padding:"0 14px",height:38,boxSizing:"border-box",background:lt.surface,
              border:`1.5px solid ${lt.muted}55`,
              borderRadius:100,color:lt.text,fontSize:13,flexShrink:0,
              cursor:"pointer",fontFamily:ADULT.fontBody,fontWeight:600}}>
            {i.demoLabel||"Demo"}
          </button>}
        </div>
        <Logo t={lt} size="xl"/>
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:44}}>
          <Btn t={lt} onClick={()=>{setTab("host");setMode("adult");}} style={{minWidth:150}}>{li.createRoom}</Btn>
          <Btn t={lt} variant="secondary" onClick={()=>setTab("join")} style={{minWidth:150,background:lt.surface}}>{li.join}</Btn>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:36}}>
          {(pills[lang]||pills.de).map(x=><Pill key={x} t={lt} color={lt.muted}>{x}</Pill>)}
        </div>
        {/* Menü auf Landing */}
        <div style={{marginTop:28,display:'flex',flexDirection:'column',gap:10,
          alignItems:'center',width:'100%',maxWidth:300,marginLeft:'auto',marginRight:'auto'}}>
          {onMyQuestions&&<button onClick={onMyQuestions} style={landingMenuBtn}>
            <span style={{fontSize:17,width:22,textAlign:'center'}}>📝</span>
            <span style={{flex:1,textAlign:'left'}}>{lang==='en'?'My questions':lang==='es'?'Mis preguntas':'Meine Fragen'}</span>
            <span style={{color:lt.muted}}>›</span>
          </button>}
          {onTeam&&<button onClick={onTeam} style={landingMenuBtn}>
            <span style={{fontSize:17,width:22,textAlign:'center'}}>👥</span>
            <span style={{flex:1,textAlign:'left'}}>{lang==='en'?'Team':lang==='es'?'Equipo':'Team'}</span>
            <span style={{color:lt.muted}}>›</span>
          </button>}
          {onAdmin&&<button onClick={onAdmin} style={{...landingMenuBtn,borderColor:ADULT.accent+'66',color:ADULT.accent,fontWeight:700}}>
            <span style={{fontSize:17,width:22,textAlign:'center'}}>📊</span>
            <span style={{flex:1,textAlign:'left'}}>Admin Dashboard</span>
            <span style={{color:ADULT.accent}}>›</span>
          </button>}
          {onA11y&&<div style={{width:'100%',marginTop:4}}>
            <button onClick={()=>setA11yOpen(o=>!o)} style={{...landingMenuBtn,fontWeight:700}}>
              <span style={{fontSize:17,width:22,textAlign:'center'}}>⚙️</span>
              <span style={{flex:1,textAlign:'left'}}>{lang==='en'?'Settings':lang==='es'?'Ajustes':'Einstellungen'}</span>
              <span style={{color:lt.muted,transform:a11yOpen?'rotate(90deg)':'none',transition:'transform .15s'}}>›</span>
            </button>
            {a11yOpen&&<div style={{marginTop:6,marginLeft:11,paddingLeft:13,
              borderLeft:`2px solid ${lt.gold}55`,display:'flex',flexDirection:'column',gap:8}}>
              <p style={{fontSize:10,color:lt.muted,fontWeight:700,letterSpacing:.6,
                margin:'2px 0 0',textTransform:'uppercase'}}>
                {lang==='en'?'Display & accessibility':lang==='es'?'Pantalla y accesibilidad':'Anzeige & Barrierefreiheit'}
              </p>
              <A11yMenu t={lt} lang={lang} onA11y={onA11y} compact onOpenColors={onOpenColors} onOpenBusiness={onOpenBusiness}/>
            </div>}
          </div>}
        </div>
      </div>
    </div>;
  }

  return <div style={{...page,background:t.bg,animation:"fu .3s ease both"}}>
    <Btn t={t} variant="ghost" onClick={()=>{setTab("landing");inject(globalCSS(applyA11y(ADULT)));}} style={{marginBottom:18,padding:"8px 0"}}>{i.back}</Btn>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:22}}/>
    {tab==="host"&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:12}}>🎮 {i.gameMode||"Spielmodus wählen"}</p>
      <div style={{display:"flex",gap:10}}>
        {[{id:"adult",icon:"🔥",label:i.adultMode,sub:i.adultSub},{id:"kids",icon:"🌈",label:i.kidsMode,sub:i.kidsSub}].map(m=>(
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
        <div style={{width:'100%'}}>
          <p style={{fontSize:13,color:t.text,margin:'0 0 4px',paddingLeft:2,fontWeight:600}}>👤 {lang==="en"?"Your name":lang==="es"?"Tu nombre":"Dein Name"}</p>
          <Inp value={name} onChange={setName} placeholder={t.id==="kids"?"😊 "+i.yourName:i.yourName} t={t} autoFocus/>
        </div>
        {tab==="join"&&<div style={{width:'100%'}}>
          <p style={{fontSize:13,color:t.text,margin:'0 0 4px',paddingLeft:2,fontWeight:600}}>🔑 {lang==="en"?"Room code":lang==="es"?"Código de sala":"Raumcode"}</p>
          <Inp value={code} onChange={v=>setCode(v.toUpperCase())} placeholder={i.roomCode} t={t} style={{letterSpacing:3,fontWeight:700,fontFamily:t.fontMono,width:'100%'}}/>
          <p style={{fontSize:11,color:t.muted,margin:'6px 0 0',paddingLeft:2,lineHeight:1.5}}>
            {lang==='en'?'Tip: scan the QR on the screen with your phone camera — or just type the code.'
             :lang==='es'?'Consejo: escanea el QR de la pantalla con la cámara del móvil — o escribe el código.'
             :'Tipp: Den QR auf dem Bildschirm einfach mit der Handy-Kamera scannen – oder den Code hier eintippen.'}
          </p>
        </div>}
        {(tab==="join"||tab==="host")&&<div style={{display:'flex',flexDirection:'column',gap:8,width:'100%'}}>
            <div>
              <p style={{fontSize:13,color:t.text,margin:'0 0 4px',paddingLeft:2,fontWeight:600}}>✏ {lang==="en"?"Nickname/Battle name":lang==="es"?"Apodo/Nombre":"Spitzname/Kampfname"}</p>
              <Inp value={spitzname} onChange={setSpitzname}
                placeholder={lang==="en"?"e.g. The Guessing King":lang==="es"?"ej. El Rey Estimador":"z.B. Der Schätzkönig"}
                t={t}/>
            </div>
            <div>
              <p style={{fontSize:13,color:t.text,margin:'0 0 4px',paddingLeft:2,fontWeight:600}}>🔥 {lang==="en"?"Fun fact (optional)":lang==="es"?"Dato curioso (opcional)":"Fun Fact (optional)"}</p>
              <Inp value={funfact} onChange={setFunfact}
                placeholder={lang==="en"?"e.g. I sleep standing up":lang==="es"?"ej. Duermo de pie":"z.B. Ich schlafe stehend"}
                t={t}/>
            </div>
            {/* Selfie */}
            <div>
              <p style={{fontSize:13,color:t.text,margin:'0 0 4px',paddingLeft:2,fontWeight:600}}>{lang==="en"?"📷 Profile photo (optional)":lang==="es"?"📷 Foto de perfil (opcional)":"📷 Profilfoto (optional)"}</p>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:64,height:64,borderRadius:'50%',overflow:'hidden',
                  background:t.surface,border:`2px solid ${selfieHome?t.accent:t.border}`,
                  flexShrink:0,position:'relative'}}>
                  {selfieHome
                    ? <img src={selfieHome} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',
                        justifyContent:'center',fontSize:24,color:t.muted}}>👤</div>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,flex:1,alignItems:streamHome?'center':'stretch'}}>
                  <video ref={videoRefHome} autoPlay playsInline muted
                    style={{display:streamHome?'block':'none',width:120,height:120,
                      borderRadius:'50%',objectFit:'cover',
                      border:`2px solid ${t.accent}`,transform:'scaleX(-1)'}}/>
                  {!streamHome
                    ? <button onClick={async()=>{
                        try{
                          const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
                          videoRefHome.current.srcObject=s;
                          setStreamHome(s);
                        }catch(e){console.warn('Camera error',e);}
                      }} style={{padding:'7px',borderRadius:t.radius,background:t.surface,
                        border:`1.5px solid ${t.border}`,color:t.text,fontSize:12,
                        cursor:'pointer',fontFamily:t.fontBody}}>
                        {lang==="en"?"Open camera":lang==="es"?"Abrir cámara":"Kamera öffnen"}
                      </button>
                    : <button onClick={()=>{
                        const v=videoRefHome.current;
                        const c=document.createElement('canvas');
                        c.width=200;c.height=200;
                        const ctx=c.getContext('2d');
                        const size=Math.min(v.videoWidth,v.videoHeight);
                        const sx=(v.videoWidth-size)/2;
                        const sy=(v.videoHeight-size)/2;
                        ctx.drawImage(v,sx,sy,size,size,0,0,200,200);
                        setSelfieHome(c.toDataURL('image/jpeg',0.6));
                        streamHome.getTracks().forEach(tr=>tr.stop());
                        setStreamHome(null);
                      }} style={{padding:'7px',borderRadius:t.radius,background:t.accent,
                        border:'none',color:'#fff',fontSize:12,cursor:'pointer',
                        fontFamily:t.fontBody,fontWeight:700}}>
                        {lang==="en"?"Take photo":lang==="es"?"Tomar foto":"Foto aufnehmen"}
                      </button>}
                  {selfieHome&&<button onClick={()=>{setSelfieHome(null);}}
                    style={{padding:'4px',borderRadius:t.radius,background:'none',
                      border:`1px solid ${t.border}`,color:t.muted,fontSize:11,cursor:'pointer'}}>
                    {lang==="en"?"Remove":lang==="es"?"Quitar":"Entfernen"}
                  </button>}
                </div>
              </div>
            </div>
          </div>}
        {error&&<p style={{color:t.danger,fontSize:13}}>{error}</p>}
        <Btn t={t} onClick={submit} disabled={busy} full>{busy?i.searching:tab==="host"?`${t.emoji} ${i.createRoom}`:i.join+" →"}</Btn>
      </div>
    </Card>
  </div>;
}

/* ─── GAME SETUP (Joker + Speed-Modus) ───────────── */
function JokerSetupScreen({mode, onDone, t, onToggleDebug, debugModeInit, lang, onBack=null}){
  const i=UI[lang]||UI.de;
  const saved=(()=>{try{return JSON.parse(localStorage.getItem('em_lastSetup')||'null')}catch(e){return null}})();
  const[withJokers,setWithJokers]=useState(saved?!!saved.withJokers:false);
  const[enabled,setEnabled]=useState(saved&&Array.isArray(saved.enabled)&&saved.enabled.length?saved.enabled:Object.keys(JOKER_DEFS));
  const[speedMode,setSpeedMode]=useState(saved?!!saved.speedMode:false);
  const[timerSecs,setTimerSecs]=useState(saved?.timerSecs||30);
  const[debugModeLocal,setDebugModeLocal]=useState(debugModeInit!==undefined?!!debugModeInit:false);
  const[withBets,setWithBets]=useState(saved?!!saved.withBets:false);
  const[betModes,setBetModes]=useState(saved&&Array.isArray(saved.betModes)?saved.betModes:["best","worst"]);
  const[withSteckbrief,setWithSteckbrief]=useState(saved?!!saved.withSteckbrief:false);
  function persistSetup(){
    try{localStorage.setItem('em_lastSetup',JSON.stringify({withJokers,enabled,speedMode,timerSecs,withBets,betModes,withSteckbrief}));}catch(e){}
  }
  function toggle(id){setEnabled(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}

  // Reusable toggle row component
  function ToggleRow({label, desc, checked, onChange, color, children}){
    const c=color||t.accent;
    return <div onClick={onChange} style={{display:'flex',alignItems:'center',gap:12,
      padding:'7px 12px',borderRadius:t.radius,cursor:'pointer',
      background:checked?c+'18':t.surface,
      border:`1.5px solid ${checked?c:t.border}`,
      transition:'all .15s',marginBottom:4}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:13,color:checked?c:t.text}}>{label}</div>
        {desc&&<div style={{fontSize:11,color:t.muted,marginTop:1}}>{desc}</div>}
      </div>
      {children}
      <div style={{width:20,height:20,borderRadius:5,flexShrink:0,
        background:checked?c:'transparent',
        border:`2px solid ${checked?c:t.muted}44`,
        display:'flex',alignItems:'center',justifyContent:'center',
        color:'#fff',fontSize:12,fontWeight:700}}>
        {checked?'✓':''}
      </div>
    </div>;
  }

  return <div style={{
    minHeight:'100vh',display:'flex',flexDirection:'column',
    maxWidth:520,margin:'0 auto',padding:'14px 16px 28px',
    background:t.bg,gap:3,
  }}>
    {onBack&&<button onClick={onBack} style={{alignSelf:'flex-start',background:'none',border:'none',
      color:t.muted,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:t.fontBody,padding:'2px 4px',marginBottom:2}}>{i.back}</button>}
    <Logo t={t} size="sm"/>

    {/* ── Speed ── */}
    <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'10px 0 3px'}}>⚡ SPEED-MODUS</p>
    <ToggleRow label={speedMode?i.speed:i.noTimer} desc={speedMode?`Timer: ${timerSecs}s`:'Kein Zeitlimit'}
      checked={speedMode} onChange={()=>setSpeedMode(p=>!p)} color={t.accent}/>
    {speedMode&&<div style={{display:'flex',gap:6,marginTop:-2,marginBottom:4}}>
      {[15,30,60].map(s=>(
        <button key={s} onClick={()=>setTimerSecs(s)}
          style={{flex:1,padding:'8px',borderRadius:t.radius,
            background:timerSecs===s?t.accent:t.surface,
            border:`1.5px solid ${timerSecs===s?t.accent:t.border}`,
            color:timerSecs===s?'#fff':t.muted,
            fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:t.fontMono}}>
          {s}s
        </button>
      ))}
    </div>}

    {/* ── Joker ── */}
    <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'8px 0 4px'}}>🃏 JOKER</p>
    <ToggleRow label='🃏 Joker aktivieren' desc={withJokers?`${enabled.length} Joker ausgewählt`:'Keine Joker im Spiel'}
      checked={withJokers} onChange={()=>setWithJokers(p=>!p)} color={t.gold}/>
    {withJokers&&<div style={{display:'flex',flexDirection:'column',gap:4,paddingLeft:8,borderLeft:`2px solid ${t.gold}44`,marginLeft:6}}>
      {Object.keys(JOKER_DEFS).map(id=>{
        const jk=getJokerDef(id,lang);
        const on=enabled.includes(jk.id);
        const atMax=enabled.length>=3&&!on;
        return <ToggleRow key={jk.id} label={`${jk.icon} ${jk.name}`} desc={jk.desc}
          checked={on} onChange={()=>!atMax&&toggle(jk.id)} color={t.gold}/>;
      })}
      <div style={{padding:'6px 10px',borderRadius:t.radius,background:t.gold+'10',fontSize:10,color:t.muted,lineHeight:1.6}}>{i.jokerHowText}</div>
    </div>}

    {/* ── Wetten ── */}
    <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'8px 0 4px'}}>🏆 WETTEN</p>
    <ToggleRow label={i.bettingSection} desc={withBets?`${betModes.length} Wett-Modus aktiv`:'Keine Wetten'}
      checked={withBets} onChange={()=>setWithBets(p=>!p)} color={t.gold}/>
    {withBets&&<div style={{display:'flex',flexDirection:'column',gap:4,paddingLeft:8,borderLeft:`2px solid ${t.gold}44`,marginLeft:6}}>
      {[{id:'best',label:i.betBest},{id:'worst',label:i.betWorst}].map(({id,label})=>{
        const on=betModes.includes(id);
        return <ToggleRow key={id} label={label} checked={on}
          onChange={()=>setBetModes(prev=>on?prev.filter(x=>x!==id):[...prev,id])} color={t.gold}/>;
      })}
    </div>}

    {/* ── Extras ── */}
    <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'8px 0 4px'}}>⚙ EXTRAS</p>


    <div style={{marginTop:8}}>
      <Btn t={t} full onClick={()=>{persistSetup();onDone(withJokers?enabled:[],speedMode,timerSecs,withBets,betModes,withSteckbrief);}}>
        {i.continueBtn}
      </Btn>
    </div>
  </div>;
}
/* ─── CATEGORY SELECTION ─────────────────────────── */
function CategoryScreen({mode,onStart,t,lang,myId=null,onBack=null}){
  const i=UI[lang]||UI.de;
  const catMeta=Object.entries(QUESTIONS_RAW[mode]).map(([name,{questions,locked}])=>({name,count:questions.length,locked})).sort((a,b)=>a.name.localeCompare(b.name));
  const allCats=catMeta.filter(c=>!c.locked).map(c=>c.name);
  const[customQuestions,setCustomQuestions]=useState([]);
  const[communityQs,setCommunityQs]=useState([]);
  const CUSTOM_CAT = lang==='en'?'⭐ My Questions':lang==='es'?'⭐ Mis Preguntas':'⭐ Meine Fragen';
  const COMMUNITY_CAT = lang==='es'?'🌍 Comunidad':'🌍 Community';

  useEffect(()=>{
    if(!myId) return;
    get(ref(db,`userQuestions/${myId}`)).then(snap=>{
      const data=snap.val()||{};
      const list=Object.entries(data).map(([id,q])=>({id:`custom_${id}`,...q}));
      setCustomQuestions(list);
    }).catch(()=>{});
  },[myId]);

  // Genehmigte Community-Fragen (sprachgefiltert) – für alle Hosts spielbar
  useEffect(()=>{
    get(ref(db,'communityQuestions')).then(snap=>{
      const data=snap.val()||{};
      const list=Object.entries(data)
        .map(([id,q])=>({id:`comm_${id}`,...q}))
        .filter(q=>q.status==='approved' && (q.lang||'de')===lang);
      setCommunityQs(list);
      if(list.length) setSelected(prev=>prev.includes(COMMUNITY_CAT)?prev:[...prev,COMMUNITY_CAT]);
    }).catch(()=>{});
  },[lang]);
  // Team-Packs (live geteilte Daten) als spielbare Kategorien laden
  const[teamPackList,setTeamPackList]=useState([]);
  useEffect(()=>{
    if(!myId) return;
    get(ref(db,`userTeams/${myId}`)).then(async snap=>{
      const ids=Object.keys(snap.val()||{});
      const res=await Promise.all(ids.map(id=>get(ref(db,`teams/${id}`)).then(s=>s.val()).catch(()=>null)));
      const list=[];
      res.forEach(val=>{ if(!val||!val.packs) return;
        Object.values(val.packs).forEach(pk=>{
          const qs=Object.values(pk.questions||{});
          if(qs.length) list.push({key:'👥 '+pk.name, name:pk.name, teamName:val.name, questions:qs});
        });
      });
      setTeamPackList(list);
    }).catch(()=>{});
  },[myId]);
  const[selected,setSelected]=useState(()=>{
    try{
      const sv=JSON.parse(localStorage.getItem('em_lastCats')||'null');
      if(Array.isArray(sv)&&sv.length){
        const valid=sv.filter(c=>allCats.includes(c));
        if(valid.length) return valid;
      }
    }catch(e){}
    return allCats;
  });
  function toggle(c,locked){
    if(locked)return;
    setSelected(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  }
  const allSelected=allCats.every(c=>selected.includes(c));

  // Eigene Fragen nach Pack gruppieren
  const customPacks={};
  customQuestions.forEach(cq=>{ const c=cq.category||CUSTOM_CAT; (customPacks[c]=customPacks[c]||[]).push(cq); });
  const customPackNames=Object.keys(customPacks);
  function toggleCustom(name){
    setSelected(prev=>prev.includes(name)?prev.filter(x=>x!==name):[...prev,name]);
  }
  function startGame(){
    // gewählte eigene Packs host-seitig in den Fragen-Pool injizieren
    customPackNames.forEach(name=>{
      if(selected.includes(name)){
        QUESTIONS[mode]=QUESTIONS[mode]||{};
        QUESTIONS[mode][name]=customPacks[name].map(x=>({id:x.id,q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝'}));
      }
    });
    // genehmigte Community-Fragen injizieren
    if(communityQs.length && selected.includes(COMMUNITY_CAT)){
      QUESTIONS[mode]=QUESTIONS[mode]||{};
      QUESTIONS[mode][COMMUNITY_CAT]=communityQs.map(x=>({id:x.id,q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝'}));
    }
    // geteilte Team-Packs injizieren (live, gemeinsame Daten)
    teamPackList.forEach(tp=>{
      if(selected.includes(tp.key)){
        QUESTIONS[mode]=QUESTIONS[mode]||{};
        QUESTIONS[mode][tp.key]=tp.questions.map((x,i)=>({id:'team_'+i+'_'+Math.random().toString(36).slice(2,6),q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝'}));
      }
    });
    try{localStorage.setItem('em_lastCats',JSON.stringify(selected));}catch(e){}
    onStart(selected);
  }

  return <div style={{
    minHeight:"100vh",display:"flex",flexDirection:"column",
    maxWidth:520,margin:"0 auto",padding:"8px 16px 80px",
    background:t.bg,
  }}>
    {onBack&&<button onClick={onBack} style={{alignSelf:'flex-start',background:'none',border:'none',
      color:t.muted,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:t.fontBody,padding:'2px 4px'}}>{i.back}</button>}
    <Logo t={t} size="xs"/>

    {/* Header row */}
    <div style={{display:"flex",alignItems:"center",
      justifyContent:"space-between",margin:"6px 0 6px"}}>
      <div>
        <p style={{fontSize:15,fontWeight:800}}>Kategorien</p>
        <p style={{fontSize:12,color:t.muted}}>{selected.length} von {allCats.length} gewählt</p>
      </div>
      <button onClick={()=>{
          const customSel=selected.filter(c=>customPackNames.includes(c));
          setSelected(allSelected?customSel:[...allCats,...customSel]);
        }}
        style={{padding:"7px 14px",borderRadius:t.radius,
          background:allSelected?t.accent+"18":t.surface,
          border:`1.5px solid ${allSelected?t.accent:t.border}`,
          color:allSelected?t.accent:t.muted,
          fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:t.fontBody}}>
        {allSelected?i.allOff:i.allOn}
      </button>
    </div>

    {/* Category list – compact rows */}
    <div style={{display:"flex",flexDirection:"column",gap:3,flex:1}}>
      {catMeta.map(({name,count,locked})=>{
        const sel=selected.includes(name);
        return <div key={name} onClick={()=>toggle(name,locked)}
          style={{display:"flex",alignItems:"center",gap:10,
            padding:"5px 10px",borderRadius:t.radius,
            cursor:locked?"not-allowed":"pointer",
            background:sel&&!locked?t.accent+"18":t.surface,
            border:`1.5px solid ${sel&&!locked?t.accent:t.border}`,
            opacity:locked?.4:1,transition:"all .15s"}}>
          <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>
            {locked?"🔒":sel?"✅":"⬜"}
          </span>
          <span style={{flex:1,fontSize:12,fontWeight:600,
            color:sel&&!locked?t.accent:locked?t.muted:t.text}}>
            {name}
          </span>
          <span style={{fontSize:11,color:t.muted,flexShrink:0}}>
            {locked?"bald":count}
          </span>
        </div>;
      })}

      {/* Community (genehmigte Fragen) */}
      {communityQs.length>0&&(()=>{
        const sel=selected.includes(COMMUNITY_CAT);
        return <div onClick={()=>toggleCustom(COMMUNITY_CAT)}
          style={{display:"flex",alignItems:"center",gap:10,marginTop:6,
            padding:"5px 10px",borderRadius:t.radius,cursor:"pointer",
            background:sel?t.green+"18":t.surface,
            border:`1.5px solid ${sel?t.green:t.border}`,transition:"all .15s"}}>
          <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>
            {sel?"✅":"⬜"}
          </span>
          <span style={{flex:1,fontSize:12,fontWeight:600,
            color:sel?t.green:t.text}}>
            {COMMUNITY_CAT}
          </span>
          <span style={{fontSize:11,color:t.muted,flexShrink:0}}>
            {communityQs.length}
          </span>
        </div>;
      })()}

      {/* Eigene Packs */}
      {customPackNames.length>0&&<>
        <p style={{fontSize:11,color:t.muted,fontWeight:700,letterSpacing:.6,
          margin:"10px 0 2px",paddingLeft:2}}>
          {lang==='en'?'YOUR PACKS':lang==='es'?'TUS PAQUETES':'EIGENE PACKS'}
        </p>
        {customPackNames.map(name=>{
          const sel=selected.includes(name);
          return <div key={name} onClick={()=>toggleCustom(name)}
            style={{display:"flex",alignItems:"center",gap:10,
              padding:"5px 10px",borderRadius:t.radius,cursor:"pointer",
              background:sel?t.gold+"18":t.surface,
              border:`1.5px solid ${sel?t.gold:t.border}`,transition:"all .15s"}}>
            <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>
              {sel?"✅":"⬜"}
            </span>
            <span style={{flex:1,fontSize:12,fontWeight:600,
              color:sel?t.gold:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {name}
            </span>
            <span style={{fontSize:9,color:t.muted,flexShrink:0,
              border:`1px solid ${t.border}`,borderRadius:100,padding:"1px 6px"}}>
              🔒 {lang==='en'?'private':lang==='es'?'privado':'privat'}
            </span>
            <span style={{fontSize:11,color:t.muted,flexShrink:0}}>
              {customPacks[name].length}
            </span>
          </div>;
        })}
      </>}

      {teamPackList.length>0&&<>
        <p style={{fontSize:11,color:t.muted,fontWeight:700,letterSpacing:.6,
          margin:"10px 0 2px",paddingLeft:2}}>
          {lang==='en'?'TEAM PACKS':lang==='es'?'PAQUETES DE EQUIPO':'TEAM-PACKS'}
        </p>
        {teamPackList.map(tp=>{
          const sel=selected.includes(tp.key);
          return <div key={tp.key} onClick={()=>toggleCustom(tp.key)}
            style={{display:"flex",alignItems:"center",gap:10,
              padding:"5px 10px",borderRadius:t.radius,cursor:"pointer",
              background:sel?t.gold+"18":t.surface,
              border:`1.5px solid ${sel?t.gold:t.border}`,transition:"all .15s"}}>
            <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>
              {sel?"✅":"⬜"}
            </span>
            <span style={{flex:1,fontSize:12,fontWeight:600,
              color:sel?t.gold:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {tp.name}
            </span>
            <span style={{fontSize:9,color:t.muted,flexShrink:0,
              border:`1px solid ${t.border}`,borderRadius:100,padding:"1px 6px"}}>
              👥 {tp.teamName}
            </span>
            <span style={{fontSize:11,color:t.muted,flexShrink:0}}>
              {tp.questions.length}
            </span>
          </div>;
        })}
      </>}
    </div>

    {/* Fixed bottom button */}
    <div style={{position:"fixed",bottom:0,left:"50%",
      transform:"translateX(-50%)",width:"100%",maxWidth:520,
      padding:"10px 16px",background:t.bg+"ee",
      borderTop:`1px solid ${t.border}`,backdropFilter:"blur(8px)",zIndex:50}}>
      <Btn t={t} full disabled={selected.length===0}
        onClick={startGame}>
        {selected.length===0?(lang==='en'?"Pick a category":lang==='es'?"Elige una categoría":"Wähle eine Kategorie"):
         (lang==='en'?`Start with ${selected.length} ${selected.length===1?"category":"categories"} →`:
          lang==='es'?`Empezar con ${selected.length} ${selected.length===1?"categoría":"categorías"} →`:
          `Starten mit ${selected.length} ${selected.length===1?"Kategorie":i.categories} →`)}
      </Btn>
    </div>
  </div>;
}

/* ─── LOBBY ───────────────────────────────────────── */
function LobbyScreen({room,code,myId,t,onGoJokerSetup,lang,onKick=null,onLeave=null,onQuickStart=null}){
  const i=UI[lang]||UI.de;
  const[copied,setCopied]=useState(false);
  const isHost=room.hostId===myId;
  const hasSavedSetup=(()=>{try{
    const s=JSON.parse(localStorage.getItem('em_lastSetup')||'null');
    const c=JSON.parse(localStorage.getItem('em_lastCats')||'null');
    return !!s && Array.isArray(c) && c.length>0;
  }catch(e){return false;}})();
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const link=inviteUrl(code);
  function copy(){navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}); }
  function addPlayer(){ if(navigator.share){navigator.share({title:'EstiMates',text:'Komm mitspielen!',url:link});}else{copy();} }
  return <div style={{...page,animation:"fu .3s ease both",display:'flex',flexDirection:'column',minHeight:'100vh'}}>
    {onLeave&&<button onClick={onLeave} title={isHost?(lang==='en'?'Close room':lang==='es'?'Cerrar sala':'Raum schließen'):(i.leaveGame||'Verlassen')}
      style={{alignSelf:'flex-start',background:'none',border:'none',color:t.muted,
        fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:t.fontBody,padding:'2px 4px',marginBottom:2}}>{i.back}</button>}
    <Logo t={t} size="sm"/>
    {(room.bizName||room.bizLogo)&&<div style={{marginTop:8}}><PoweredBy name={room.bizName} logo={room.bizLogo} t={t}/></div>}
    <div style={{marginTop:12,marginBottom:4}}><Pill t={t} color={t.green}>{t.id==="kids"?"🎈 LOBBY":"LOBBY"}</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?30:36,marginBottom:8}}>{i.lobbyWaiting}</h2>

    {/* ── Code + Invite + Gastgeber ── kompakt oben */}
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
      <span style={{fontFamily:t.fontMono,fontSize:24,letterSpacing:4,color:t.accent,fontWeight:800}}>{code}</span>
      <button onClick={copy} style={{padding:'5px 10px',borderRadius:t.radius,background:t.surface,
        border:`1px solid ${t.border}`,color:t.muted,fontSize:12,cursor:'pointer',fontFamily:t.fontBody}}>
        {copied?"✓ Kopiert!":"📋 Link"}
      </button>
      <button onClick={addPlayer} style={{padding:'5px 10px',borderRadius:t.radius,background:t.accent,
        border:'none',color:'#fff',fontSize:12,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
        ➕ Einladen
      </button>
      {isHost&&<button onClick={()=>window.open(`${window.location.origin}?mode=display&room=${code}`,'_blank')}
        style={{padding:'5px 10px',borderRadius:t.radius,background:t.surface,
          border:`1px solid ${t.gold}88`,color:t.gold,fontSize:12,cursor:'pointer',
          fontFamily:t.fontBody,fontWeight:600}}>
        📺 Beamer
      </button>}
    </div>

    {/* ── QR Code größer ── */}
    <QRCode url={link} t={t} lang={lang} size={220}/>

    {/* ── Weiter Button ── */}
    {isHost
      ?<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
        <Btn t={t} onClick={onGoJokerSetup} full>{i.continueBtn}</Btn>
        {hasSavedSetup&&onQuickStart&&<button onClick={onQuickStart}
          style={{padding:'11px',borderRadius:t.radius,background:t.gold+'18',
            border:`1.5px solid ${t.gold}66`,color:t.gold,fontSize:15,fontWeight:800,
            cursor:'pointer',fontFamily:t.fontBody,display:'flex',alignItems:'center',
            justifyContent:'center',gap:8}}>
          ⚡ {lang==='en'?'Quick start (last setup)':lang==='es'?'Inicio rápido (último ajuste)':'Schnellstart (letztes Setup)'}
        </button>}
      </div>
      :<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
        <p style={{textAlign:"center",color:t.muted,fontSize:13,margin:0,
          animation:"pulse 1.5s ease infinite"}}>{i.waitingHost}</p>
      </div>}

    {/* ── Spielerliste scrollbar unten ── */}
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.7,margin:'4px 0 8px'}}>
        {i.players} ({pl.length})
      </p>
      <div style={{overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:6}}>
        {pl.map(p=>{
          const sb=(room.steckbriefe||{})[p.id];
          return <div key={p.id} style={{...row,padding:"8px 12px",background:t.surface,borderRadius:t.radius,
            border:`1.5px solid ${p.id===myId?t.accent+"55":t.border}`,flexShrink:0}}>
            {sb?.selfie
              ? <div style={{width:36,height:36,borderRadius:'50%',overflow:'hidden',flexShrink:0,
                  border:`2px solid ${p.id===myId?t.accent:t.border}`}}>
                  <img src={sb.selfie} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
              : <Avatar name={p.name} t={t}/>}
            <div style={{flex:1,minWidth:0}}>
              <span style={{fontWeight:600,fontSize:14}}>{p.name}</span>
              {sb?.kampfname&&<span style={{fontSize:11,color:t.muted,marginLeft:6}}>aka {sb.kampfname}</span>}
            </div>
            {p.id===room.hostId&&<Pill t={t} color={t.gold}>{i.hostLabel}</Pill>}
            {isHost&&p.id!==myId&&onKick&&<button onClick={()=>onKick(p.id)}
              style={{padding:'3px 10px',borderRadius:t.radius,border:`1px solid ${t.danger}44`,
                background:'transparent',color:t.danger,fontSize:11,cursor:'pointer',fontWeight:600}}>
              {i.kickPlayer}
            </button>}
            {p.id===myId&&p.id!==room.hostId&&<Pill t={t}>{i.youLabel}</Pill>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}

/* ─── QUESTION ────────────────────────────────────── */
function QuestionScreen({room,myId,t,onGuess,code,debugMode,onSkip,lang,isHost=false,onKick=null,onPause=null,onToggleDebug=null,onToggleSound=null,onEnd=null,onLeave=null}){
  const i=UI[lang]||UI.de;
  const[val,setVal]=useState("");
  const[allIn,setAllIn]=useState(false);
  const[betClosest,setBetClosest]=useState("");
  const[betFarthest,setBetFarthest]=useState("");
  // KERS All-In: stored in Firebase per player for reliability
  const[timeLeft,setTimeLeft]=useState(null);
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{};
  const myGuess=guesses[myId];
  const afkPlayers=room.afkPlayers||{};
  const activePl=pl.filter(p=>!afkPlayers[p.id]);
  const betBest  = room.betBest  !== undefined ? !!room.betBest  : true;  // Standard: beide an (Legacy)
  const betWorst = room.betWorst !== undefined ? !!room.betWorst : true;
  const bettingActive = room.withBets!==false && (betBest||betWorst) && activePl.length>=3;
  const betOthers = activePl.filter(p=>p.id!==myId);
  // Wette ist OPTIONAL – Tipp kann immer abgegeben werden. Einzige Regel: nicht denselben Spieler für beste & schlechteste.
  const betValid = !(betClosest && betFarthest && betClosest===betFarthest);
  const doneCount=activePl.filter(p=>guesses[p.id]!=null).length;
  const changeAllowed=room.changeAllowed===myId;
  const hintVisible=room.hintVisible;
  const speedMode=room.speedMode;
  const timerSecs=room.timerSecs||30;
  const timerPaused=!!(room.timerPaused);
  const timerPausedRef = React.useRef(timerPaused);
  useEffect(()=>{ timerPausedRef.current = timerPaused; },[timerPaused]);

  const myBoostCharge = (room.boostCharge||{})[myId]||0;
  const myBoostLocked = !!(room.boostLocked||{})[myId];
  const myLastChargedQIdx = (room.boostLastQIdx||{})[myId]??-1;
  const boostAvailable = myBoostCharge >= 100 || (myBoostLocked && myBoostCharge >= 50);
  const chargePercent = myBoostCharge;

  // KERS: charge 25% per new question – idempotent via Firebase
  useEffect(()=>{
    const qIdx = room.qIdx||0;
    if(qIdx === 0) return; // skip first question
    if(myLastChargedQIdx === qIdx) return; // already charged for this question
    if(myBoostLocked) return; // depleting
    if(myBoostCharge >= 100) return; // already full
    const next = Math.min(100, myBoostCharge + 25);
    update(ref(db,`rooms/${code}`),{
      [`boostCharge/${myId}`]: next,
      [`boostLastQIdx/${myId}`]: qIdx,
    });
    setAllIn(false);
  },[room.qIdx, myLastChargedQIdx]);

  // Speed mode timer
  useEffect(()=>{
    if(!speedMode||myGuess!=null)return;
    setTimeLeft(timerSecs);
    const iv=setInterval(()=>{
      setTimeLeft(prev=>{
        if(timerPausedRef.current) return prev; // paused by host
        if(prev<=1){
          clearInterval(iv);
          onGuess(-999999);
          return 0;
        }
        // Play sound on timer ticks
        if(prev<=5) playSound("alarm");
        else if(prev<=10) playSound("tick");
        return prev-1;
      });
    },1000);
    return ()=>clearInterval(iv);
  },[speedMode,q?.id,myGuess]);

  useEffect(()=>{ setBetClosest(""); setBetFarthest(""); },[q?.id]);

  if(!q)return <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner t={t}/></div>;

  async function submit(){
    const n=parseFloat(val.replace(",","."));
    if(isNaN(n))return;
    if(betClosest && betFarthest && betClosest===betFarthest) return; // ungültig: gleicher Spieler für beide Wetten
    if(changeAllowed){
      await update(ref(db,`rooms/${code}/`),{changeAllowed:null});
    }
    onGuess(n, allIn, bettingActive ? {closest: betBest?betClosest:null, farthest: betWorst?betFarthest:null} : null);
    if(allIn){
      const newCharge = myBoostCharge - 50;
      update(ref(db,`rooms/${code}/boostCharge`),{[myId]: Math.max(0, newCharge)});
      update(ref(db,`rooms/${code}/boostLocked`),{[myId]: newCharge > 0 ? true : null});
    }
    setVal("");
    setAllIn(false);
    setBetClosest(""); setBetFarthest("");
  }

  const showInput=myGuess==null||(changeAllowed&&myGuess!=null);
  const isAfkMe = !!(afkPlayers[myId]);

  return <div style={{
    minHeight:"100vh", display:"flex", flexDirection:"column",
    maxWidth:520, margin:"0 auto", padding:"0 14px 80px",
    background:t.bg,
  }}>

    {/* ── TOP BAR ── */}
    <div style={{padding:"12px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <Pill t={t} color={t.green}>{t.id==="kids"?`🎯 ${i.question} ${(room.qIdx||0)+1}`:i.question+" "+((room.qIdx||0)+1)}</Pill>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {(room.doubleJokers||{})[myId]&&<Pill t={t} color={t.gold}>{lang==="es"?"2× PUNTOS":lang==="en"?"2× POINTS":"2× PUNKTE"}</Pill>}
        {/* Player chips inline */}
        {pl.map(p=>{
          const done=guesses[p.id]!=null;
          const isAfk=afkPlayers[p.id];
          return <div key={p.id} style={{
            display:'flex',alignItems:'center',gap:3,
            padding:"3px 7px",borderRadius:100,fontSize:11,fontWeight:700,
            border:`1px solid ${isAfk?t.gold:done?t.green:t.border}`,
            color:isAfk?t.gold:done?t.green:t.muted,
            background:isAfk?t.gold+"18":done?t.green+"18":t.surface,
          }}>
            <span>{p.name[0]} {isAfk?"⏸":done?"✓":"…"}</span>
            {isHost&&p.id!==myId&&onKick&&<button
              onClick={e=>{e.stopPropagation();onKick(p.id);}}
              style={{background:'none',border:'none',color:t.danger,
                fontSize:10,cursor:'pointer',padding:'0 0 0 2px',lineHeight:1,
                opacity:.6}}
              title={`${p.name} kicken`}>✕</button>}
          </div>;
        })}
      </div>
    </div>


        {/* ── Manage Panel (Host only) ── */}
        {isHost&&<details style={{marginTop:8}}>
          <summary style={{fontSize:13,color:t.text,cursor:'pointer',fontWeight:600,
            listStyle:'none',padding:'8px 12px',userSelect:'none',
            background:t.surface,borderRadius:t.radius,
            border:`1.5px solid ${t.border}`,display:'flex',alignItems:'center',gap:6}}>
            ⚙ Spiel verwalten
          </summary>
          <Card t={t} style={{marginTop:6,padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>
            {/* Invite */}
            <div>
              <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'0 0 5px'}}>➕ SPIELER EINLADEN</p>
              <div style={{display:'flex',gap:6}}>
                <code style={{flex:1,fontSize:13,fontWeight:800,color:t.accent,
                  background:t.surface,padding:'4px 8px',borderRadius:t.radius,letterSpacing:2}}>{code}</code>
                <button onClick={()=>{const link=`${window.location.origin}?room=${code}`;if(navigator.share){navigator.share({title:'EstiMates',url:link});}else{navigator.clipboard?.writeText(link);alert('Link kopiert!');}}}
                  style={{background:t.accent,border:'none',borderRadius:t.radius,color:'#fff',fontSize:11,cursor:'pointer',padding:'4px 10px',fontWeight:600}}>
                  📤 Teilen
                </button>
              </div>
            </div>
            {/* Controls */}
            <div>
              <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'0 0 6px'}}>🎮 {lang==='en'?'CONTROLS':lang==='es'?'CONTROLES':'STEUERUNG'}</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {speedMode&&<button onClick={()=>{
                  // Toggle timer pause via Firebase
                  const paused=!!(room.timerPaused);
                  update(ref(db,`rooms/${code}`),{timerPaused:paused?null:true});
                }} style={{padding:'7px 12px',borderRadius:t.radius,
                  background:room.timerPaused?t.gold+'22':t.surface,
                  border:`1.5px solid ${room.timerPaused?t.gold:t.border}`,
                  color:room.timerPaused?t.gold:t.text,
                  fontSize:13,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
                  {room.timerPaused?(lang==='en'?'▶ Resume timer':lang==='es'?'▶ Reanudar':'▶ Timer fortsetzen'):(lang==='en'?'II Pause timer':lang==='es'?'II Pausar':'II Timer pausieren')}
                </button>}
                <button onClick={()=>onSkip&&onSkip()}
                  style={{padding:'7px 12px',borderRadius:t.radius,background:t.surface,border:`1.5px solid ${t.border}`,color:t.text,fontSize:13,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
                  ⏭ {lang==='en'?'Skip':lang==='es'?'Saltar':'Skippen'}
                </button>
                <button onClick={()=>onPause&&onPause()}
                  style={{padding:'7px 12px',borderRadius:t.radius,background:t.surface,border:`1.5px solid ${t.border}`,color:t.text,fontSize:13,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
                  II {lang==='en'?'Pause game':lang==='es'?'Pausar juego':'Spiel pausieren'}
                </button>
                <button onClick={()=>{toggleSound();onToggleSound&&onToggleSound();}}
                  style={{padding:'7px 12px',borderRadius:t.radius,background:t.surface,border:`1.5px solid ${t.border}`,color:t.text,fontSize:13,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
                  {isSoundOn()?'🔊':'🔇'} {lang==='en'?'Sound':lang==='es'?'Sonido':'Sound'}
                </button>

                <button onClick={()=>window.confirm(lang==='en'?'End game?':lang==='es'?'¿Terminar juego?':'Spiel beenden?')&&onEnd&&onEnd()}
                  style={{padding:'7px 12px',borderRadius:t.radius,background:'none',border:`1.5px solid ${t.danger}44`,color:t.danger,fontSize:13,cursor:'pointer',fontFamily:t.fontBody,fontWeight:600}}>
                  🛑 {lang==='en'?'End':lang==='es'?'Terminar':'Beenden'}
                </button>
              </div>
            </div>
            {/* Players – unified host control */}
            <div>
              <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,margin:'0 0 8px'}}>👥 {lang==='en'?'PLAYERS':lang==='es'?'JUGADORES':'SPIELER'}</p>
              {(room.order||[]).map(pid=>{
                const p=room.players?.[pid]; if(!p) return null;
                const isAfk=!!(room.afkPlayers||{})[pid];
                const pJokers=(room.jokers||{})[pid]||[];
                const pts=room.scores?.[pid]||0;
                const isSelf=pid===myId;
                return <div key={pid} style={{borderBottom:`1px solid ${t.border}22`,
                  paddingBottom:10,marginBottom:8}}>
                  {/* Row 1: name + AFK + Kick */}
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:700,flex:1,color:t.text}}>
                      {isSelf?'👑 ':''}{p.name}
                    </span>
                    <button onClick={async()=>await update(ref(db,`rooms/${code}/afkPlayers`),{[pid]:isAfk?null:true})}
                      style={{padding:'3px 8px',borderRadius:t.radius,
                        background:isAfk?t.gold+'22':'none',
                        border:`1.5px solid ${isAfk?t.gold:t.border}`,
                        color:isAfk?t.gold:t.text,fontSize:12,cursor:'pointer',fontWeight:600}}>
                      {isAfk?'↩ Back':'⏸ AFK'}
                    </button>
                    {!isSelf&&onKick&&<button onClick={()=>onKick(pid)}
                      style={{padding:'3px 8px',borderRadius:t.radius,background:'none',
                        border:`1.5px solid ${t.danger}55`,color:t.danger,
                        fontSize:12,cursor:'pointer',fontWeight:600}}>
                      ✕ Kick
                    </button>}
                  </div>
                  {/* Row 2: Joker + Points */}
                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:t.muted,fontWeight:600,minWidth:40}}>Joker:</span>
                    {Object.keys(JOKER_DEFS).map(jid=>{
                      const jk=getJokerDef(jid,'de');
                      return <button key={jid} onClick={async()=>{
                        await update(ref(db,`rooms/${code}/jokers`),{[pid]:[...pJokers,jk.id]});
                      }} style={{padding:'2px 7px',borderRadius:t.radius,
                        background:t.surface,border:`1px solid ${t.border}`,
                        color:t.text,fontSize:11,cursor:'pointer',fontWeight:700}}>
                        {jk.icon}+
                      </button>;
                    })}
                    <button onClick={async()=>await update(ref(db,`rooms/${code}/jokers`),{[pid]:[]})}
                      style={{padding:'2px 7px',borderRadius:t.radius,
                        background:t.danger+'22',border:`1px solid ${t.danger}55`,
                        color:t.danger,fontSize:11,cursor:'pointer',fontWeight:700}}>
                      🗑
                    </button>
                    <span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4}}>
                      <button onClick={async()=>await update(ref(db,`rooms/${code}/scores`),{[pid]:pts-1})}
                        style={{width:24,height:24,borderRadius:4,background:t.danger+'22',
                          border:`1px solid ${t.danger}`,color:t.danger,fontSize:14,
                          cursor:'pointer',fontWeight:700,lineHeight:1}}>−</button>
                      <span style={{fontSize:13,fontFamily:'monospace',color:t.gold,
                        fontWeight:700,minWidth:28,textAlign:'center'}}>{pts}P</span>
                      <button onClick={async()=>await update(ref(db,`rooms/${code}/scores`),{[pid]:pts+1})}
                        style={{width:24,height:24,borderRadius:4,background:t.green+'22',
                          border:`1px solid ${t.green}`,color:t.green,fontSize:14,
                          cursor:'pointer',fontWeight:700,lineHeight:1}}>+</button>
                    </span>
                  </div>
                </div>;
              })}
            </div>
          </Card>
        </details>}
    {/* ── TIMER BAR ── */}
    {speedMode&&myGuess==null&&timeLeft!=null&&
      <div style={{padding:"6px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,fontWeight:700,
            color:timeLeft<=5?t.danger:timeLeft<=10?t.gold:t.green}}
>
          ⏱ {timeLeft}s</span>
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
    <div style={{padding:"8px 0 0",display:"flex",flexDirection:"column",gap:8}}>
      <Card t={t} glow>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <span style={{fontSize:28,fontFamily:"'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"}}>{(q.emoji||"").replace(/\uFE0F/g,"")||"❓"}</span>
          <div style={{flex:1}}>
            <Pill t={t} color={t.muted} style={{marginBottom:6}}>{q.cat}</Pill>
            <p style={{fontSize:t.id==="kids"?18:16,lineHeight:1.55,
              fontWeight:t.id==="kids"?700:500,marginTop:6}}>{q.q}</p>
            <p style={{marginTop:8,color:t.muted,fontSize:13}}>
              {i.tipIn}: <strong style={{color:t.gold}}>{q.unit}</strong>
            </p>
          </div>
        </div>
        {room.hintVisible&&(room.hintFor===myId||!room.hintFor)&&
          <p style={{marginTop:8,padding:"7px 10px",background:t.gold+"18",
            borderRadius:t.radius,fontSize:13,color:t.gold,fontWeight:600}}>
            {i.hintLabel} {q.hint}
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
            {changeAllowed?i.changeTip:i.yourTip} ({q.unit})
          </p>
          <div style={{display:"flex",gap:8}}>
            <Inp type="number" value={val} onChange={setVal}
              placeholder="z.B. 42" t={t} autoFocus
              style={{fontSize:20,fontWeight:700,fontFamily:t.fontMono}}/>
            <Btn t={t} onClick={submit} disabled={!val||!betValid}
              style={{flexShrink:0}}>OK ✓</Btn>
          </div>
          {isHost&&activePl.length>1&&<p style={{fontSize:11,color:t.muted,
            textAlign:'center',margin:'8px 0 0'}}>
            {doneCount} {lang==='en'?'of':lang==='es'?'de':'von'} {activePl.length} {lang==='en'?'submitted':lang==='es'?'enviado':'getippt'}
          </p>}
          {/* KERS All-In Button */}
          <button onClick={()=>boostAvailable&&setAllIn(a=>!a)}
            disabled={!boostAvailable}
            style={{width:'100%',marginTop:8,padding:'8px 12px',borderRadius:t.radius,
              background:allIn?t.accent+'33':boostAvailable?t.surface:'none',
              border:`1.5px solid ${allIn?t.accent:boostAvailable?t.gold:t.border}`,
              color:allIn?t.accent:boostAvailable?t.gold:t.muted,
              fontSize:13,fontWeight:allIn||boostAvailable?700:400,
              cursor:boostAvailable?'pointer':'default',
              fontFamily:t.fontBody,transition:'all .2s',
              opacity:boostAvailable?1:0.6}}>
            <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
              <span>⚡ ALL-IN</span>
              <div style={{width:60,height:6,borderRadius:3,background:t.border,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,
                  background:boostAvailable?t.gold:t.accent,
                  width:`${myBoostCharge}%`,transition:'width .4s ease',
                  boxShadow:boostAvailable?`0 0 6px ${t.gold}`:'none'}}/>
              </div>
              <span style={{fontSize:10,color:boostAvailable?t.gold:t.muted,fontWeight:700,minWidth:28}}>
                {boostAvailable?(myBoostLocked?'×1':'READY'):myBoostCharge+'%'}
              </span>
            </div>
          </button>
          {allIn&&<p style={{fontSize:11,color:t.accent,textAlign:'center',marginTop:4,opacity:.8}}>
            {lang==='en'?'Exact hit = +5pts · Miss = -5pts':
             lang==='es'?'Exacto = +5pts · Fallo = -5pts':
             'Exakter Treffer = +5P · Daneben = -5P'}
          </p>}
          <div style={{display:'none'}}>
          </div>
          {/* Wette – gemeinsam mit dem Tipp abgeben (ab 3 Spielern, wenn Wetten an) */}
          {bettingActive&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${t.border}`}}>
            <p style={{fontSize:11,fontWeight:800,color:t.gold,letterSpacing:.6,margin:'0 0 2px'}}>
              🎲 {lang==='en'?'Your bet (optional)':lang==='es'?'Tu apuesta (opcional)':'Deine Wette (optional)'}
            </p>
            <p style={{fontSize:11,color:t.muted,margin:'0 0 8px'}}>
              {lang==='en'?'Bonus point for each correct guess':lang==='es'?'Punto extra por cada acierto':'Bonuspunkt für jeden Treffer'}
            </p>
            {[
              ...(betBest ?[{lab:i.closestLabel, col:t.green, val:betClosest, set:setBetClosest}]:[]),
              ...(betWorst?[{lab:i.farthestLabel,col:t.danger,val:betFarthest,set:setBetFarthest}]:[]),
            ].map((g,gi)=>(
              <div key={gi} style={{marginBottom:8}}>
                <p style={{fontSize:11,color:g.col,fontWeight:700,margin:'0 0 4px'}}>{g.lab}</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {betOthers.map(p=>{const sel=g.val===p.id;return(
                    <button key={p.id} onClick={()=>g.set(sel?"":p.id)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:100,
                        background:sel?g.col+'22':t.surface,border:`1.5px solid ${sel?g.col:t.border}`,
                        color:t.text,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:t.fontBody}}>
                      <Avatar name={p.name} t={t} size={20}/>{p.name}
                    </button>);})}
                </div>
              </div>
            ))}
            {betBest&&betWorst&&betClosest&&betFarthest&&betClosest===betFarthest&&
              <p style={{fontSize:11,color:t.danger,margin:'2px 0 0'}}>
                {lang==='en'?'Pick two different players':lang==='es'?'Elige dos jugadores distintos':'Bitte zwei verschiedene Spieler wählen'}
              </p>}
          </div>}
          <p style={{marginTop:8,color:t.muted,fontSize:12}}>
            {i.discuss}
          </p>
        </Card>
        :<Card t={t} style={{textAlign:"center"}}>
          <div style={{fontSize:36,fontFamily:t.fontMono,color:t.accent,
            fontWeight:800,marginBottom:4}}>{fmtNum(myGuess)} {q.unit}</div>
          <p style={{color:t.green,fontWeight:700,marginBottom:10}}>{i.tipSubmitted}</p>
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
        {/* ── Leave button (non-host only) ── */}
        {!isHost&&onLeave&&<button onClick={onLeave}
          style={{marginTop:8,width:'100%',padding:'7px',borderRadius:t.radius,
            background:'transparent',border:`1px solid ${t.danger}33`,
            color:t.danger,fontSize:12,cursor:'pointer',fontFamily:t.fontBody,opacity:.7}}>
          🚪 {(UI[lang]||UI.de).leaveGame||'Spiel verlassen'}
        </button>}

    </div>

    {/* ── JOKER BAR ── */}
    {room.enabledJokers?.length>0&&
      <JokerBar room={room} myId={myId} code={code} t={t} onSkip={onSkip} lang={lang}/>}

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
        {isAfkMe?i.afkBack:i.afkAway}
      </button>
    </div>
  </div>;
}


/* ─── BETTING ─────────────────────────────────────── */
function BettingScreen({room,myId,t,onBet,code,lang}){
  const i=UI[lang]||UI.de;
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
    <Pill t={t} color={t.gold}>{i.betting}</Pill>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?32:38,margin:"8px 0 5px"}}>Wer trifft's am besten?</h2>
    <p style={{color:t.muted,marginBottom:18,fontSize:14}}>{i.betCorrect}</p>
    {myBet
      ?<Card t={t} style={{textAlign:"center"}}><div style={{fontSize:52,animation:"bop 1.2s ease infinite",marginBottom:10}}>🎲</div><p style={{fontWeight:700,fontSize:17}}>{i.betSet}</p><p style={{color:t.muted,marginTop:7,animation:"pulse 1.5s ease infinite"}}>{i.waitRevealBet}</p></Card>
      :<>
        <RG label={i.closestLabel} color={t.green} val={closest} setVal={setClosest}/>
        {!soloOther&&<RG label={i.farthestLabel} color={t.danger} val={farthest} setVal={setFarthest}/>}
        {soloOther&&<p style={{color:t.muted,fontSize:13,marginBottom:12,textAlign:"center"}}>{i.twoPlayers}</p>}
        <Btn t={t} full disabled={!canSubmit} onClick={submitBet}>{i.submitBet}</Btn>
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
        {(room.afkPlayers||{})[myId]?i.afkBack:i.afkAway}
      </button>
    </div>
  </div>;
}

/* ─── RESULTS ─────────────────────────────────────── */
/* ─── REVEAL-MOMENT (Welle 2 + 5) ───────────────── */
function CountUp({value, unit, t, dur=1100, style}){
  const[disp,setDisp]=useState(0);
  useEffect(()=>{
    const to=Number(value)||0;
    let raf, start=null;
    const step=(ts)=>{
      if(start==null) start=ts;
      const p=Math.min(1,(ts-start)/dur);
      const eased=1-Math.pow(1-p,3);
      setDisp(to*eased);
      if(p<1) raf=requestAnimationFrame(step); else setDisp(to);
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[value,dur]);
  const dec=(String(value).split('.')[1]||'').length;
  const f=Math.pow(10,Math.min(dec,2));
  const shown=Math.round(disp*f)/f;
  return <span style={style}>{fmtNum(shown)}{unit?` ${unit}`:''}</span>;
}

function wtfComment(ranked, q, lang){
  const L=(de,en,es)=>lang==='en'?en:lang==='es'?es:de;
  if(!ranked||!ranked.length) return L('Niemand hat getippt – mutig! 🙈','Nobody guessed – bold! 🙈','¡Nadie adivinó! 🙈');
  const ans=q.a;
  const exact=ranked.filter(r=>r.diff===0);
  if(exact.length){ const n=exact.map(r=>r.name).join(' & ');
    return L(`Punktlandung von ${n}! 🎯`,`Bullseye by ${n}! 🎯`,`¡${n} clavó! 🎯`); }
  const closest=ranked[0];
  const farthest=ranked[ranked.length-1];
  const gs=ranked.map(r=>r.guess);
  const minG=Math.min(...gs), maxG=Math.max(...gs);
  const relClose=ans!==0?closest.diff/Math.abs(ans):closest.diff;
  // Übermut: wer am weitesten daneben lag UND den extremsten Tipp hatte
  if(ranked.length>=3 && farthest.id!==closest.id){
    const extremeFar=Math.abs(farthest.guess-ans)/Math.max(1,Math.abs(ans));
    if(extremeFar>0.8)
      return L(`${farthest.name} hat es mit ${fmtNum(farthest.guess)} etwas übertrieben 😅`,
               `${farthest.name} went a bit wild with ${fmtNum(farthest.guess)} 😅`,
               `${farthest.name} se pasó con ${fmtNum(farthest.guess)} 😅`);
  }
  if(relClose<=0.02) return L(`${closest.name} war hauchdünn dran! 🔥`,`${closest.name} was razor-close! 🔥`,`¡${closest.name} casi! 🔥`);
  if((maxG-minG)>Math.abs(ans||1)*4&&ranked.length>=3)
    return L(`Von ${fmtNum(minG)} bis ${fmtNum(maxG)} – da wurde wild geraten 😅`,`From ${fmtNum(minG)} to ${fmtNum(maxG)} – wild guesses 😅`,`De ${fmtNum(minG)} a ${fmtNum(maxG)} 😅`);
  if(relClose>1) return L('Niemand war auch nur in der Nähe… 💀','Nobody was even close… 💀','Nadie estuvo cerca… 💀');
  if(relClose<=0.1) return L(`${closest.name} richtig nah dran! 👏`,`${closest.name} got really close! 👏`,`¡${closest.name} muy cerca! 👏`);
  return L(`${closest.name} am nächsten dran.`,`${closest.name} got closest.`,`${closest.name} más cerca.`);
}

function RevealStrip({ranked, answer, unit, t}){
  if(!ranked||!ranked.length) return null;
  const gs=ranked.map(r=>r.guess);
  const lo=Math.min(answer, ...gs), hi=Math.max(answer, ...gs);
  const pad=((hi-lo)||Math.abs(answer)||1)*0.1;
  const a=lo-pad, b=hi+pad, span=(b-a)||1;
  const pos=v=>Math.max(0,Math.min(100,((v-a)/span)*100));
  const minDiff=ranked[0].diff;
  return <div style={{position:'relative',height:96,margin:'4px 2px 14px'}}>
    <div style={{position:'absolute',left:8,right:8,top:60,height:2,background:t.border}}/>
    {/* Antwort-Markierung */}
    <div style={{position:'absolute',top:40,left:`calc(8px + (100% - 16px) * ${pos(answer)/100})`,
      width:2,height:34,background:t.green,zIndex:1,transform:'translateX(-1px)'}}>
      <div style={{position:'absolute',top:-17,left:'50%',transform:'translateX(-50%)',
        fontSize:11,color:t.green,fontWeight:800,whiteSpace:'nowrap'}}>🎯</div>
    </div>
    {/* Avatare nach Tipp positioniert */}
    {ranked.map((r,idx)=>{
      const close=r.diff===minDiff;
      return <div key={r.id} title={`${r.name}: ${fmtNum(r.guess)}`}
        style={{position:'absolute',top:44,left:`calc(8px + (100% - 16px) * ${pos(r.guess)/100})`,
          zIndex:close?3:2,animation:`revealSlide .55s ${0.15+idx*0.09}s ease both`}}>
        <div style={{borderRadius:'50%',
          ...(close?{animation:'pulseGold 1.3s ease-in-out infinite'}:{})}}>
          <Avatar name={r.name} t={t} size={26}/>
        </div>
      </div>;
    })}
  </div>;
}

function ResultsScreen({room,myId,t,onNext,onEnd,lang,code=null,onKick=null,onLeave=null}){
  const i=UI[lang]||UI.de;
  const myNewJoker=(room.newJokersThisRound||{})[myId];
  useEffect(()=>{
    playSound("reveal");
    if(myNewJoker) setTimeout(()=>playSound("joker"),600);
    // Konfetti bei exaktem Treffer
    const gs=room.guesses||{};
    const anyExact=room.q?.a!=null && Object.values(gs).some(v=>v!=null&&v!==-999999&&v===room.q.a);
    if(anyExact){ try{ setTimeout(launchConfetti,400); }catch(e){} }
    // Save global stats for this player
    const guesses=room.guesses||{};
    const myGuess=guesses[myId];
    if(myGuess!=null&&myGuess!==-999999&&room.q?.a!=null){
      const diff=Math.abs(myGuess-room.q.a);
      const exact=diff===0;
      const history=room.history||[];
      const groupSize=(room.order||[]).length;
      const isAllInPlayer=!!(room.allIn||{})[myId];
      saveGlobalStats({
        diff,exact,
        isNewGame:history.length<=1,
        mode:room.mode,
        category:room.q?.category,
        groupSize,
        allIn:isAllInPlayer,
      }, room.lang||"de");
      // Save guess + question stats for histogram & Wisdom of Crowds
      if(room.q?.id){
        (async()=>{
          const qId=room.q.id;
          const qref=ref(db,`globalStats/questions/${qId}`);
          const qsnap=await get(qref);
          const qprev=qsnap.val()||{count:0,sum:0,sumSq:0};
          const newCount=(qprev.count||0)+1;
          const newSum=(qprev.sum||0)+myGuess;
          const newSumSq=(qprev.sumSq||0)+(myGuess*myGuess);
          const avg=newSum/newCount;
          const variance=Math.max(0,(newSumSq/newCount)-(avg*avg));
          const stdDev=Math.sqrt(variance);
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';
          const region = tz.split('/')[0]||'unknown';
          const ts=Date.now().toString(36)+Math.random().toString(36).slice(2,6);

          // Difficulty score: 0-100
          // Based on: avg relative error (diff/answer), exact hit rate, stdDev
          const relError = room.q.a > 0 ? Math.abs(myGuess - room.q.a) / room.q.a : 0;
          const newExactHits = (qprev.exactHits||0) + (myGuess===room.q.a?1:0);
          const exactRate = newExactHits / newCount;
          // High relError + low exactRate = hard question
          const difficulty = Math.min(100, Math.round(
            (Math.min(relError, 2) / 2) * 70 +  // 70% weight: how far off
            ((1 - exactRate) * 30)                // 30% weight: exact hit rate
          ));

          await update(qref,{
            count:newCount, sum:newSum, sumSq:newSumSq,
            avg:Math.round(avg*100)/100,
            stdDev:Math.round(stdDev*100)/100,
            answer:room.q.a,
            exactHits:newExactHits,
            difficulty,  // 0=easy, 100=impossible
            [`guesses/${ts}`]:myGuess,
            [`byRegion/${region}/count`]:newCount,
            [`byRegion/${region}/sum`]:newSum,
            [`byLang/${room.lang||'de'}/count`]:newCount,
            [`byLang/${room.lang||'de'}/sum`]:newSum,
            [`byLang/${room.lang||'de'}/avg`]:Math.round(avg*100)/100,
          });
        })().catch(()=>{});
      }
    }
  },[]);
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

  // myNewJoker declared above in useEffect

  return <div style={page}>

    <div style={{textAlign:"center",marginBottom:14,animation:"fu .3s ease both"}}>
      <div style={{fontSize:26,marginBottom:4,lineHeight:1,
        fontFamily:"'Twemoji Mozilla','Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"}}>
        {(q.emoji||"").replace(/\uFE0F/g,"")||"❓"}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
        <Pill t={t}>{i.reveal}</Pill>
        {room.speedMode&&<Pill t={t} color={t.accent}>⚡ Speed</Pill>}
      </div>
      {doubleActive&&<div style={{marginTop:8}}><Pill t={t} color={t.gold}>🎯 {i.doubleActive}</Pill></div>}
      {room.usedJokerThisRound&&room.usedJokerThisRound!=="double"&&room.usedJokerThisRound!=="hint"&&<div style={{marginTop:8,fontSize:13,color:t.gold}}>{getJokerDef(room.usedJokerThisRound,lang)?.icon} {jokerUsedName}: {getJokerDef(room.usedJokerThisRound,lang)?.name}</div>}
      <p style={{fontSize:t.id==="kids"?17:15,lineHeight:1.5,color:t.muted,maxWidth:380,margin:"9px auto 3px"}}>{q.q}</p>
      <div style={{fontFamily:t.fontTitle,fontSize:"clamp(40px,10vw,64px)",color:t.accent,lineHeight:1,marginTop:2,animation:"pop .5s ease both"}}><CountUp value={q.a} unit={q.unit} t={t}/></div>
      <p style={{color:t.muted,fontSize:14,lineHeight:1.5,maxWidth:380,margin:"7px auto 0"}}>{q.hint}</p>
      <RevealStrip ranked={ranked} answer={q.a} unit={q.unit} t={t}/>
      <p style={{fontSize:15,fontWeight:700,color:t.text,margin:"0 auto",maxWidth:400,lineHeight:1.4,animation:"fu .4s .5s ease both"}}>{wtfComment(ranked,q,lang)}</p>
    </div>
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:8}}>{i.roundScores}</p>
      {ranked.map((p,i)=>{const exact=p.diff===0,win=!exact&&closestIdsR.includes(p.id),pts=rs[p.id]||0,wasSabotaged=(room.sabotaged||{})[p.id]||null;return <div key={p.id} style={{...row,padding:"8px 12px",borderRadius:t.radius,marginBottom:6,background:exact?t.green+"18":win?t.accent+"14":wasSabotaged?t.danger+"10":t.surface,border:`1.5px solid ${exact?t.green:win?t.accent+"44":wasSabotaged?t.danger+"44":t.border}`,animation:`fu .3s ${i*.07}s ease both`}}><span style={{fontSize:13,minWidth:20,fontWeight:800,
              color:i===0?t.gold:i===1?"#c0c0c0":i===2?"#cd7f32":"#6e5e54",
              flexShrink:0}}>{i+1}.</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}{wasSabotaged&&<span style={{color:t.danger,fontSize:11,marginLeft:6}}>
  {i.sabotaged} {room.players?.[wasSabotaged]?.name||"?"}
</span>}</span><span style={{fontFamily:t.fontMono,fontSize:13,color:win||exact?t.accent:t.text}}>{fmtNum(p.guess)} {q.unit}</span><span style={{fontFamily:t.fontMono,fontSize:11,color:t.muted,minWidth:44,textAlign:"right"}}>Δ{fmtNum(p.diff)}</span>
            <Pill t={t} color={pts>0?(exact?t.green:t.gold):pts<0?t.danger:t.muted}>
              {pts>0?'+':''}{pts}P
            </Pill></div>;})}
      {noAnswer&&noAnswer.map(p=><div key={p.id} style={{...row,padding:"8px 12px",borderRadius:t.radius,marginBottom:6,background:t.danger+"10",border:`1.5px solid ${t.danger}33`,opacity:.7}}><span style={{fontSize:18,minWidth:20}}>–</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}</span><span style={{color:t.danger,fontSize:13,fontWeight:700}}>{i.tooSlow}</span><Pill t={t} color={t.danger}>0P</Pill></div>)}
    </Card>
    {Object.keys(bets).length>0&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:8}}>{i.betting}</p>
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
    {/* New joker notification – animated */}
    {myNewJoker&&<div style={{
      marginBottom:12,padding:"14px 16px",
      borderRadius:t.radius,textAlign:"center",
      background:t.gold+"22",
      border:`2px solid ${t.gold}`,
      animation:"pop .4s ease both",
    }}>
      <div style={{fontSize:32,marginBottom:4,animation:"bop .8s ease infinite"}}>🎁</div>
      <p style={{fontWeight:800,color:t.gold,fontSize:15}}>{i.jokerWon}</p>
      <p style={{color:t.text,fontSize:18,fontWeight:700,marginTop:4}}>
        {getJokerDef(myNewJoker,lang)?.icon} {getJokerDef(myNewJoker,lang)?.name}
      </p>
    </div>}
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:8}}>GESAMTPUNKTE</p>
      {[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<pl.length-1?`1px solid ${t.border}`:"none"}}><span style={{fontFamily:t.fontTitle,fontSize:20,color:i===0?t.gold:t.muted,minWidth:20}}>{i+1}</span><Avatar name={p.name} t={t} size={30}/><span style={{flex:1,fontWeight:p.id===myId?800:400}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:12}}> (Du)</span>}</span><span style={{fontFamily:t.fontTitle,fontSize:32,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span></div>)}
    </Card>
    {isHost?<div style={{display:"flex",gap:10}}><Btn t={t} onClick={onNext} full>{i.nextQ}</Btn><Btn t={t} variant="secondary" onClick={onEnd}>{i.endGame}</Btn></div>:<div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'center'}}><p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{i.waitingHost}</p>{onLeave&&<button onClick={onLeave} style={{padding:'6px 14px',borderRadius:t.radius,background:'transparent',border:`1px solid ${t.danger}33`,color:t.danger,fontSize:12,cursor:'pointer',fontFamily:t.fontBody,opacity:.7}}>🚪 {i.leaveGame||'Verlassen'}</button>}</div>}
    {q&&<div style={{textAlign:'center',marginTop:10}}><BugReportButton t={t} lang={lang} question={q}/></div>}
  </div>;
}


/* ─── WINNER PHOTO CAPTURE ───────────────────────── */
function WinnerPhotoCapture({t, lang, onCapture, onSkip}) {
  const i = UI[lang]||UI.de;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [camError, setCamError] = useState(false);

  useEffect(()=>{
    startCamera();
    return ()=>{ if(stream) stream.getTracks().forEach(t=>t.stop()); };
  },[]);

  async function startCamera(){
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user', width:{ideal:400}, height:{ideal:400}},audio:false
      });
      setStream(s);
      if(videoRef.current){ videoRef.current.srcObject=s; videoRef.current.play(); }
    } catch(e){ setCamError(true); }
  }

  function capture(){
    const v=videoRef.current, c=canvasRef.current;
    if(!v||!c)return;
    const size=Math.min(v.videoWidth,v.videoHeight);
    const ox=(v.videoWidth-size)/2, oy=(v.videoHeight-size)/2;
    c.width=400; c.height=400;
    const ctx=c.getContext('2d');
    // Mirror for selfie feel
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(v,-400,oy,400,size); ctx.restore();
    c.toBlob(blob=>{ const img=new Image(); img.onload=()=>setPhoto(img); img.src=URL.createObjectURL(blob); },'image/jpeg',0.92);
    if(stream) stream.getTracks().forEach(t=>t.stop());
  }

  function retake(){
    setPhoto(null);
    startCamera();
  }

  if(camError){
    return <div style={{textAlign:'center',padding:24}}>
      <div style={{fontSize:40,marginBottom:12}}>📵</div>
      <p style={{color:t.muted,fontSize:14,marginBottom:16}}>{i.camUnavailable}</p>
      <Btn t={t} full onClick={onSkip}>{i.skipPhoto}</Btn>
    </div>;
  }

  return <div style={{textAlign:'center'}}>
    <canvas ref={canvasRef} style={{display:'none'}}/>
    {!photo ? <>
      <div style={{position:'relative',width:220,height:220,margin:'0 auto 16px',borderRadius:'50%',overflow:'hidden',border:`4px solid ${t.gold}`}}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}}/>
      </div>
      <p style={{color:t.muted,fontSize:13,marginBottom:12}}>{i.photoHint}</p>
      <Btn t={t} full onClick={capture} style={{marginBottom:8}}>
        {i.takePhoto}
      </Btn>
      <Btn t={t} variant="secondary" full onClick={onSkip}>
        {i.skipPhoto}
      </Btn>
    </> : <>
      <div style={{position:'relative',width:220,height:220,margin:'0 auto 16px',borderRadius:'50%',overflow:'hidden',border:`4px solid ${t.gold}`}}>
        <img src={photo.src} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        <div style={{position:'absolute',top:8,right:8,fontSize:28}}>🏆</div>
      </div>
      <Btn t={t} full onClick={()=>onCapture(photo)} style={{marginBottom:8}}>
        {i.usePhoto}
      </Btn>
      <Btn t={t} variant="secondary" full onClick={retake}>
        {i.retakePhoto}
      </Btn>
    </>}
  </div>;
}


/* ─── GASTGEBER / DISPLAY MODE ─────────────────────────── */

/* ─── CHAT FEED (Display Mode) ─────────────────────── */
function ChatFeed({room, pl, gold, jokerIcon, i, t}) {
  t = t || {bg:'#0f0a06',surface:'#1a120a',card:'#181310',border:'#2a1a0e',text:'#f2ece6',muted:'#6e5e54'};
  const [events, setEvents] = useState([]);
  const feedRef = useRef(null);
  const prevRoom = useRef(null);

  useEffect(()=>{
    if(!room||!prevRoom.current) { prevRoom.current=room; return; }
    const prev = prevRoom.current;
    const newEvents = [];
    const now = Date.now();
    const curG=room.guesses||{}, prevG=prev.guesses||{};
    const answer=room.q?.a;
    const isReveal = room.phase==='results'||room.phase==='reveal';

    // Joker used – ROT (bedrohlich/aggressiv)
    const curJokers = room.jokers||{}, prevJokers = prev.jokers||{};
    pl.forEach(p=>{
      const cur=(curJokers[p.id]||[]).length;
      const prv=(prevJokers[p.id]||[]).length;
      if(cur<prv){
        const used=(prevJokers[p.id]||[]).find(j=>!(curJokers[p.id]||[]).includes(j)||
          (prevJokers[p.id]||[]).filter(x=>x===j).length>(curJokers[p.id]||[]).filter(x=>x===j).length);
        if(used){
          const colors={sabotage:'#ff3355',skip:'#ff8855',hint:t.muted,
                        double:'#55ffaa',change:t.muted,extra:t.muted};
          const verbs=i?.jokerVerbs||{};
          let text;
          if(used==='sabotage'){
            const sabEntries=Object.entries(room?.sabotaged||{});
            const targetId=sabEntries[sabEntries.length-1]?.[0];
            const targetName=pl.find(x=>x.id===targetId)?.name;
            text=targetName
              ? p.name+' '+(verbs.sabotage||'sabotiert')+' '+targetName+'!'
              : p.name+' sabotiert!';
          } else {
            text=p.name+' '+(verbs[used]||used)+'!';
          }
          newEvents.push({id:now+Math.random(),type:'joker_used',
            emoji:jokerIcon(used),text,
            color:colors[used]||'#ff8855',ts:now});
        }
      }
    });

    // Joker earned – ORANGE (positiv/belohnend)
    const newJk=room.newJokersThisRound||{}, prevJk=prev.newJokersThisRound||{};
    pl.forEach(p=>{
      if(newJk[p.id]&&!prevJk[p.id])
        newEvents.push({id:now+Math.random(),type:'joker_earned',
          emoji:'🎁',
          text:p.name+' '+i.dispEarned+': '+(i.jokerNames?.[newJk[p.id]]||newJk[p.id]),
          color:'#ff8c2a',ts:now});
    });

    // All-In gesetzt – GOLD (riskant/aufregend)
    const curAllIn=room.allIn||{}, prevAllIn=prev.allIn||{};
    pl.forEach(p=>{
      if(curAllIn[p.id]&&!prevAllIn[p.id])
        newEvents.push({id:now+Math.random(),type:'allin',
          emoji:'⚡',
          text:p.name+' '+(i.dispAllIn||'setzt ALL-IN!')+'',
          color:'#ffd700',ts:now});
    });

    // All-In Ergebnis – bei Auflösung
    if(isReveal){
      pl.forEach(p=>{
        if(curAllIn[p.id]&&curG[p.id]!=null&&answer!=null){
          const diff=Math.abs(curG[p.id]-answer);
          const rs=room.roundScores||{};
          const pts=rs[p.id]||0;
          if(diff===0){
            newEvents.push({id:now+Math.random(),type:'allin_win',
              emoji:'⚡',
              text:p.name+' '+(i.dispAllInWin||'ALL-IN getroffen!')+' +'+pts+'P',
              color:'#ffd700',ts:now});
          } else {
            newEvents.push({id:now+Math.random(),type:'allin_lose',
              emoji:'⚡',
              text:p.name+' '+(i.dispAllInLose||'ALL-IN verzockt!')+' '+pts+'P',
              color:'#ff3355',ts:now});
          }
        }
      });
    }
    if(isReveal){
      pl.forEach(p=>{
        if(curG[p.id]!=null&&answer!=null)
          if(Math.abs(curG[p.id]-answer)===0)
            newEvents.push({id:now+Math.random(),type:'exact',
              emoji:'🎯',
              text:p.name+' '+i.dispExact,
              color:'#39d98a',ts:now});
      });
    }

    // Tipp eingegangen – GRAU (neutral/info)
    pl.forEach(p=>{
      if(curG[p.id]!=null&&curG[p.id]!==-999999&&prevG[p.id]==null&&answer!=null)
        if(Math.abs(curG[p.id]-answer)!==0) // kein Exact (der hat eigenen Event)
          newEvents.push({id:now+Math.random(),type:'guess',
            emoji:'✏',
            text:p.name+' '+i.dispGuessed,
            color:t.muted,ts:now});
    });

    // Sabotage Ziel – DUNKELROT
    const curSab=room.sabotaged||{}, prevSab=prev.sabotaged||{};
    pl.forEach(p=>{
      if(curSab[p.id]&&!prevSab[p.id]){
        const saboteur=pl.find(x=>x.id===curSab[p.id]);
        newEvents.push({id:now+Math.random(),type:'joker_used',
          emoji:'💥',
          text:p.name+' '+(i?.dispSabotaged||'sabotaged')+(saboteur?' '+(i?.dispSaboteur||'by')+' '+saboteur.name:'')+'!',
          color:'#ff3355',ts:now});
      }
    });

    // Phase change – WEISS FETT (strukturgebend)
    if(room.phase!==prev.phase){
      const labels={
        question:'─── Neue Runde ───',
        results:'─── Auflösung ───',
        betting:'─── Wetten ───',
        final:'─── Spiel beendet ───'
      };
      const emojis={question:'🎮',results:'📊',betting:'🎲',final:'🏆'};
      if(labels[room.phase])
        newEvents.push({id:now+Math.random(),type:'phase',
          emoji:emojis[room.phase]||'🔔',
          text:labels[room.phase],
          color:t.text,ts:now});
    }

    if(newEvents.length>0){
      setEvents(prev=>[...newEvents,...prev].slice(0,30));
    }
    prevRoom.current=room;
  },[room]);

  // Auto-scroll to top
  useEffect(()=>{
    if(feedRef.current) feedRef.current.scrollTop=0;
  },[events]);

  return <div ref={feedRef} style={{flex:1,overflowY:'auto',display:'flex',
    flexDirection:'column',gap:5}}>
    {events.length===0&&<p style={{fontSize:11,color:t.border,textAlign:'center',
      marginTop:12}}>Noch keine Events...</p>}
    {events.map(ev=>(
      <div key={ev.id} style={{display:'flex',alignItems:'flex-start',gap:7,
        background:ev.type==='phase'?t.surface:ev.type==='exact'?t.card:
                   ev.type==='joker_earned'?t.card:ev.type==='joker_used'?t.card:t.card,
        borderRadius:8,padding:'7px 10px',
        borderLeft:`3px solid ${ev.color}`,
        animation:'slideUp .3s ease both',flexShrink:0}}>
        <span style={{fontSize:ev.type==='phase'?20:16,flexShrink:0,marginTop:1}}>{ev.emoji}</span>
        <span style={{
          fontSize:ev.type==='phase'?14:12,
          fontWeight:ev.type==='phase'?800:ev.type==='exact'?700:400,
          color:ev.color,
          lineHeight:1.4,
          letterSpacing:ev.type==='phase'?.5:0
        }}>{ev.text}</span>
      </div>
    ))}
  </div>;
}


/* ─── HISTOGRAM ─────────────────────────────────── */
function TippHistogram({room, t, lang, gold}) {
  t = t || {bg:'#0f0a06',surface:'#1a120a',card:'#181310',border:'#2a1a0e',text:'#f2ece6',muted:'#6e5e54',gold:gold};
  const q = room.q;
  const guesses = room.guesses||{};
  const players = room.players||{};
  const answer = q?.a;
  const [globalVals, setGlobalVals] = React.useState([]);

  const [crowdsAvg, setCrowdsAvg] = React.useState(null);
  const [crowdsCount, setCrowdsCount] = React.useState(0);

  // Load global historical answers + Wisdom of Crowds avg
  React.useEffect(()=>{
    if(!q?.id) return;
    get(ref(db, `globalStats/questions/${q.id}`)).then(snap=>{
      const data = snap.val();
      if(data?.guesses) setGlobalVals(Object.values(data.guesses).map(Number).filter(v=>!isNaN(v)));
      if(data?.avg && data?.count > 4) {
        setCrowdsAvg(data.avg);
        setCrowdsCount(data.count);
      }
    }).catch(()=>{});
  },[q?.id]);

  if(!q || !answer) return null;

  const roundVals = Object.entries(guesses)
    .filter(([,v])=>v!=null&&v!==-999999)
    .map(([id,v])=>({id, val:parseFloat(v), name:(players[id]?.name||'?')}));

  if(roundVals.length < 1) return null;

  // Determine range from all values
  const allNums = [...roundVals.map(v=>v.val), ...globalVals, answer];
  const rawMin = Math.min(...allNums);
  const rawMax = Math.max(...allNums);
  const pad = (rawMax - rawMin) * 0.3 || rawMax * 0.5 || 1;
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;
  const BINS = 10;
  const binW = (max - min) / BINS;

  function getBin(v){ return Math.min(Math.floor((v - min) / binW), BINS-1); }

  // Global bins (background)
  const globalBins = Array(BINS).fill(0);
  globalVals.forEach(v=>{ const b=getBin(v); if(b>=0) globalBins[b]++; });

  // Round bins
  const roundBins = Array(BINS).fill(null).map(()=>[]);
  roundVals.forEach(p=>{ const b=getBin(p.val); if(b>=0) roundBins[b].push(p); });

  const maxGlobal = Math.max(...globalBins, 1);
  const maxRound = Math.max(...roundBins.map(b=>b.length), 1);
  const answerPct = Math.min(100, Math.max(0, ((answer - min) / (max - min)) * 100));

  return <div style={{padding:'12px 14px',background:t.bg,
    borderRadius:12,border:`1px solid ${t.border}`,marginBottom:8}}>
    <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:1,
      margin:'0 0 10px',textTransform:'uppercase'}}>
      📊 Tipp-Verteilung
      {globalVals.length>0&&<span style={{fontWeight:400,marginLeft:6,color:t.border}}>
        ({globalVals.length} globale Tipps)
      </span>}
    </p>
    <div style={{display:'flex',alignItems:'flex-end',gap:2,height:90,position:'relative'}}>
      {Array(BINS).fill(0).map((_,i)=>{
        const gH = (globalBins[i]/maxGlobal)*100;
        const rH = (roundBins[i].length/maxRound)*100;
        const isAnswerBin = answer>=min+i*binW && answer<min+(i+1)*binW;
        return <div key={i} style={{flex:1,position:'relative',height:'100%',
          display:'flex',alignItems:'flex-end'}}>
          {/* Global historical bar (background, subtle) */}
          {globalBins[i]>0&&<div style={{
            position:'absolute',bottom:0,left:0,right:0,
            height:`${Math.max(gH,3)}%`,
            background:t.border,borderRadius:'3px 3px 0 0',
          }}/>}
          {/* Round bar (foreground, colored) */}
          {roundBins[i].length>0&&<div style={{
            position:'absolute',bottom:0,left:'10%',right:'10%',
            height:`${Math.max(rH,6)}%`,
            background:isAnswerBin?'#39d98a':t.gold+'cc',
            borderRadius:'3px 3px 0 0',
            transition:'height .6s ease',
          }}>
            <div style={{position:'absolute',top:-16,left:'50%',transform:'translateX(-50%)',
              fontSize:9,color:isAnswerBin?'#39d98a':gold,fontWeight:700,whiteSpace:'nowrap'}}>
              {roundBins[i].map(p=>p.name[0]).join('')}
            </div>
          </div>}
        </div>;
      })}
      {/* Answer line */}
      <div style={{position:'absolute',bottom:0,left:`${answerPct}%`,
        transform:'translateX(-50%)',width:2,height:'100%',
        background:'#39d98a',zIndex:3,
        boxShadow:'0 0 6px #39d98a'}}>
        <div style={{position:'absolute',top:-18,left:'50%',transform:'translateX(-50%)',
          fontSize:9,color:'#39d98a',fontWeight:700,whiteSpace:'nowrap'}}>
          ✓
        </div>
      </div>
      {/* Wisdom of Crowds line */}
      {crowdsAvg!=null&&(()=>{
        const crowdPct=Math.min(100,Math.max(0,((crowdsAvg-min)/(max-min))*100));
        return <div style={{position:'absolute',bottom:0,left:`${crowdPct}%`,
          transform:'translateX(-50%)',width:1.5,height:'100%',
          background:'#a78bfa',zIndex:2,opacity:.8}}>
          <div style={{position:'absolute',top:-18,left:'50%',transform:'translateX(-50%)',
            fontSize:9,color:'#a78bfa',fontWeight:700,whiteSpace:'nowrap'}}>
            👥
          </div>
        </div>;
      })()}
    </div>
    {/* Legend */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
      <span style={{fontSize:10,color:t.muted}}>{fmtNum(Math.round(min))}</span>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        {globalVals.length>0&&<span style={{fontSize:9,color:t.border,display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:10,height:8,background:t.border,borderRadius:2}}/> Historisch
        </span>}
        <span style={{fontSize:9,color:gold,display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:10,height:8,background:t.gold+'cc',borderRadius:2}}/> Diese Runde
        </span>
        <span style={{fontSize:9,color:'#39d98a',display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:2,height:10,background:'#39d98a'}}/> Antwort
        </span>
        {crowdsAvg!=null&&<span style={{fontSize:9,color:'#a78bfa',display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:2,height:10,background:'#a78bfa'}}/> Schwarmintelligenz ({crowdsCount})
        </span>}
      </div>
      <span style={{fontSize:10,color:t.muted}}>{fmtNum(Math.round(max))}</span>
    </div>
  </div>;
}

function BeamerCountUp({value, gold, fontTitle}){
  const[disp,setDisp]=React.useState(0);
  React.useEffect(()=>{
    const to=Number(value)||0; let raf,start=null;
    const step=(ts)=>{ if(start==null)start=ts; const p=Math.min(1,(ts-start)/1200);
      setDisp(to*(1-Math.pow(1-p,3))); if(p<1)raf=requestAnimationFrame(step); else setDisp(to); };
    raf=requestAnimationFrame(step); return()=>cancelAnimationFrame(raf);
  },[value]);
  return <span style={{fontSize:'clamp(28px,4vw,48px)',fontWeight:900,color:gold,fontFamily:fontTitle}}>{fmtNum(Math.round(disp))}</span>;
}
function BeamerRevealStrip({ranked, answer, gold, t}){
  t = t || {bg:'#0f0a06',surface:'#1a120a',card:'#181310',border:'#2a1a0e',text:'#f2ece6',muted:'#6e5e54'};
  if(!ranked||!ranked.length) return null;
  const gs=ranked.map(r=>r.guess);
  const lo=Math.min(answer,...gs),hi=Math.max(answer,...gs);
  const pad=((hi-lo)||Math.abs(answer)||1)*0.1;
  const a=lo-pad,b=hi+pad,span=(b-a)||1;
  const pos=v=>Math.max(0,Math.min(100,((v-a)/span)*100));
  const minDiff=ranked[0].diff;
  return <div style={{position:'relative',height:80,margin:'4px 2px 10px'}}>
    <div style={{position:'absolute',left:8,right:8,top:50,height:2,background:t.border}}/>
    <div style={{position:'absolute',top:30,left:`calc(8px + (100% - 16px) * ${pos(answer)/100})`,
      width:2,height:28,background:'#39d98a',zIndex:1,transform:'translateX(-1px)'}}>
      <div style={{position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',
        fontSize:10,color:'#39d98a',fontWeight:800}}>🎯</div>
    </div>
    {ranked.map((r,idx)=>{
      const close=r.diff===minDiff;
      return <div key={r.id} style={{position:'absolute',top:34,
        left:`calc(8px + (100% - 16px) * ${pos(r.guess)/100})`,
        zIndex:close?3:2,animation:`revealSlide .55s ${0.15+idx*0.09}s ease both`}}>
        <div style={{width:28,height:28,borderRadius:'50%',background:close?gold:t.border,
          border:`2px solid ${close?gold:t.muted}`,display:'flex',alignItems:'center',
          justifyContent:'center',fontSize:11,fontWeight:800,color:close?t.bg:t.text,
          ...(close?{animation:'pulseGold 1.3s ease-in-out infinite'}:{})}}>
          {(r.name||'?')[0].toUpperCase()}
        </div>
      </div>;
    })}
  </div>;
}

function DisplayScreen({room, code, t, lang, onKick=null}) {
  const i = UI[lang]||UI.de;
  const q = room?.q;
  const pl = (room?.order||[]).map(id=>room?.players?.[id]).filter(Boolean);
  const guesses = room?.guesses||{};
  const scores = room?.scores||{};
  const rs = room?.roundScores||{};
  const bets = room?.bets||{};
  const phase = room?.phase||'lobby';
  const afkPlayers = room?.afkPlayers||{};
  const tippedCount = pl.filter(p=>guesses[p.id]!=null).length;
  const[timerDisplaySecs,setTimerDisplaySecs]=useState(room.timerSecs||30);
  const timerPausedDispRef = React.useRef(!!(room.timerPaused));
  useEffect(()=>{ timerPausedDispRef.current = !!(room.timerPaused); },[room.timerPaused]);
  useEffect(()=>{
    if(phase!=='question'||!room.timerSecs) return;
    setTimerDisplaySecs(room.timerSecs);
    const iv=setInterval(()=>{
      if(timerPausedDispRef.current) return;
      setTimerDisplaySecs(prev=>Math.max(0,prev-1));
    },1000);
    return()=>clearInterval(iv);
  },[room.q?.id]);
  const sorted = [...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const medals = ['🥇','🥈','🥉'];

  // Vom Host synchronisierte Custom-Farben (CI) – liegen über der Hell/Dunkel-Basis
  const ct = (room?.theme && typeof room.theme==='object') ? room.theme : {};
  const lightBeamer = !!room?.lightMode;
  const baseD = lightBeamer
    ? {bg:'#f3ece2', surface:'#ffffff', card:'#fbf6ee', border:'#e4d8c7', text:'#2b211a', muted:'#9b8b7b'}
    : {bg:'#0f0a06', surface:'#1a120a', card:'#181310', border:'#2a1a0e', text:'#f2ece6', muted:'#6e5e54'};
  const D = {
    bg:     ct.bg     || baseD.bg,
    surface:ct.surface|| baseD.surface,
    card:   ct.card   || baseD.card,
    border: ct.border || baseD.border,
    text:   ct.text   || baseD.text,
    muted:  ct.muted  || baseD.muted,
  };
  const gold   = ct.gold   || t.gold;
  const accent = ct.accent || t.accent;
  const beamerT={...t, border:D.border, green: ct.green||t.green, gold, accent, danger: ct.danger||t.danger, surface:D.surface, text:D.text, muted:D.muted};

  const ranked = q ? pl.filter(p=>guesses[p.id]!=null&&guesses[p.id]!==-999999&&!afkPlayers[p.id])
    .map(p=>({...p,guess:guesses[p.id],diff:Math.abs(guesses[p.id]-q.a)}))
    .sort((a,b)=>a.diff-b.diff) : [];
  const minDiff = ranked[0]?.diff??Infinity;
  const closestIds = ranked.filter(r=>r.diff===minDiff).map(r=>r.id);

  // Global session stats
  const history = room?.history||[];
  const exactHits = {}, diffTotals = {}, diffCounts = {}, jokerTotals = {};
  pl.forEach(p=>{
    exactHits[p.id]=0; diffTotals[p.id]=0; diffCounts[p.id]=0; jokerTotals[p.id]=0;
  });
  history.forEach(round=>{
    const rGuesses=round.guesses||{}, rAnswer=round.answer;
    pl.forEach(p=>{
      const g=rGuesses[p.id];
      if(g!=null&&g!==-999999&&rAnswer!=null){
        const d=Math.abs(g-rAnswer);
        diffTotals[p.id]+=d; diffCounts[p.id]++;
        if(d===0) exactHits[p.id]++;
      }
    });
    const rJokers=round.jokerUsed||{};
    pl.forEach(p=>{ if(rJokers[p.id]) jokerTotals[p.id]++; });
  });

  // QR
  const [qr, setQr] = useState(null);
  useEffect(()=>{
    if(!code) return;
    const link = inviteUrl(code);
    import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js').then(()=>{
      window.QRCode.toDataURL(link,{width:140,margin:1,color:{dark:D.text,light:D.surface}})
        .then(url=>setQr(url)).catch(()=>{});
    }).catch(()=>{});
  },[code]);

  // Joker animation overlay
  const [jokerAnim, setJokerAnim] = useState(null);
  const prevJokers = useRef({});
  useEffect(()=>{
    const cur = room?.jokers||{};
    pl.forEach(p=>{
      const prev = prevJokers.current[p.id]||[];
      const curr = cur[p.id]||[];
      if(prev.length > curr.length){
        const used = prev.find(j=>!curr.includes(j)||
          prev.filter(x=>x===j).length > curr.filter(x=>x===j).length);
        if(used){
          const sabotageTarget = used==='sabotage' ?
            pl.find(x=>x.id!==(room?.sabotaged&&Object.entries(room.sabotaged||{}).slice(-1)[0]?.[0])) : null;
          setJokerAnim({type:used, from:p.name, to:sabotageTarget?.name});
          setTimeout(()=>setJokerAnim(null), 3500);
        }
      }
    });
    prevJokers.current = JSON.parse(JSON.stringify(cur));
  },[JSON.stringify(room?.jokers)]);

  // Reveal animation
  const [revealed, setRevealed] = useState(false);
  useEffect(()=>{
    if(phase==='reveal'||phase==='results'){ setTimeout(()=>setRevealed(true),400); }
    else setRevealed(false);
  },[phase]);

  const jokerIcon = j=>j==='skip'?'⏭':j==='hint'?'💡':j==='double'?'✖2':j==='sabotage'?'💣':j==='change'?'🔄':'🃏';
  const jokerColor = j=>j==='sabotage'?'#cc2244':j==='double'?'#39d98a':gold;

  const css = `
    @keyframes flyIn{from{transform:translateX(-40px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes glow{0%,100%{box-shadow:0 0 0 0 ${gold}44}50%{box-shadow:0 0 20px 6px ${gold}88}}
    @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}
    @keyframes pulse2{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes bomb{0%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(80px,-30px) rotate(180deg) scale(1.5)}100%{transform:translate(160px,0) rotate(360deg) scale(0.5);opacity:0}}
  `;

  return <div style={{minHeight:'100vh',background:D.bg,color:D.text,
    fontFamily:t.fontBody,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <style>{css}</style>

    {/* Joker Overlay */}
    {jokerAnim&&<div style={{position:'fixed',inset:0,zIndex:200,pointerEvents:'none',
      display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)'}}>
      <div style={{background:D.bg,border:`3px solid ${jokerColor(jokerAnim.type)}`,
        borderRadius:24,padding:'32px 56px',textAlign:'center',
        animation:'popIn .4s ease both',
        boxShadow:`0 0 60px ${jokerColor(jokerAnim.type)}66`}}>
        <div style={{fontSize:72,marginBottom:12,
          animation:jokerAnim.type==='sabotage'?'bomb .8s ease 0.5s both':'none'}}>
          {jokerIcon(jokerAnim.type)}
        </div>
        <p style={{fontSize:28,fontWeight:900,color:jokerColor(jokerAnim.type),margin:'0 0 6px'}}>
          {jokerAnim.from} spielt einen Joker!
        </p>
        {jokerAnim.to&&<p style={{fontSize:22,color:D.text,margin:0,
          animation:'shake .5s ease 1s both'}}>
          💣 → <strong>{jokerAnim.to}</strong>
        </p>}
      </div>
    </div>}

    {/* Header */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding: room.bizLogo ? '22px 32px' : '14px 28px',borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:room.bizLogo?22:14}}>
        {room.bizLogo && <img src={room.bizLogo} alt="" style={{height:82,width:'auto',maxWidth:300,objectFit:'contain'}}/>}
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
          <div style={{display:'flex',alignItems:'baseline',gap:4}}>
            <span style={{fontSize:room.bizLogo?40:32,fontWeight:900,color:accent,fontFamily:t.fontTitle}}>Esti</span>
            <span style={{fontSize:room.bizLogo?40:32,fontWeight:900,color:gold,fontFamily:t.fontTitle}}>Mates</span>
          </div>
          {room.bizName
            ? <span style={{fontSize:room.bizLogo?15:12,color:D.muted,letterSpacing:.4}}>powered by <span style={{color:D.text,fontWeight:800}}>{room.bizName}</span></span>
            : <span style={{fontSize:11,color:D.muted,letterSpacing:.5,fontStyle:'italic'}}>the pocket party game to prove your mates wrong!</span>}
        </div>
      </div>
      {phase==='question'&&<div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:140,height:5,background:D.border,borderRadius:3,overflow:'hidden'}}>
          <div style={{height:'100%',background:gold,borderRadius:3,transition:'width .4s',
            width:`${(tippedCount/Math.max(pl.length,1))*100}%`}}/>
        </div>
        <span style={{fontSize:12,color:D.muted}}>{tippedCount}/{pl.length} {i.dispTipped}</span>
        {room.timerSecs&&<span style={{
          fontSize:14,fontWeight:800,
          color:room.timerPaused?D.muted:timerDisplaySecs<=5?'#ff3355':timerDisplaySecs<=10?gold:D.muted,
          fontFamily:'monospace',minWidth:32}}>
          {room.timerPaused?'II':timerDisplaySecs+'s'}
        </span>}
      </div>}
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:16,fontWeight:800,color:gold,letterSpacing:2}}>#{code}</span>
        {qr&&<img src={qr} style={{width:48,height:48,borderRadius:5,opacity:.6}}/>}
      </div>
    </div>

    {/* Two-column body */}
    <div style={{flex:1,display:'flex',overflow:'hidden'}}>

      {/* ── LEFT: Live content ── */}
      <div style={{flex:'0 0 58%',padding:'16px 24px',display:'flex',flexDirection:'column',
        gap:16,borderRight:`1px solid ${D.border}`,overflow:'hidden'}}>

        {/* LOBBY */}
        {(phase==='lobby'||phase==='jokerSetup'||phase==='categories')&&
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
            justifyContent:'center',gap:16}}>
            <div style={{fontSize:40,animation:'pulse2 2s ease infinite'}}>🎮</div>
            <p style={{fontSize:24,fontWeight:900,margin:0}}>{i.dispReady}</p>
            <p style={{fontSize:14,color:D.muted,margin:0}}>{i.dispHostPrep}</p>
            {/* QR Code für Beamer */}
            <div style={{background:D.surface,borderRadius:16,padding:16,
              border:`1.5px solid ${D.border}`,textAlign:'center'}}>
              <p style={{fontSize:11,fontWeight:700,color:D.muted,letterSpacing:1,margin:'0 0 10px'}}>
                📱 BEITRETEN
              </p>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${typeof window!=='undefined'?window.location.origin:'https://playestimates.app'}?room=${room.code}`)}&bgcolor=${D.surface.replace('#','')}&color=${accent.replace('#','')}`}
                alt="QR" style={{width:300,height:300,borderRadius:8}}/>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
              {pl.map((p,idx)=><div key={p.id} style={{background:D.surface,
                border:`1.5px solid ${D.border}`,borderRadius:12,padding:'6px 14px',
                fontSize:13,fontWeight:600,animation:`flyIn .4s ease ${idx*0.1}s both`}}>
                👤 {p.name}
              </div>)}
            </div>
          </div>}

        {/* QUESTION */}
        {phase==='question'&&q&&<>
          <div style={{background:D.surface,borderRadius:12,padding:'14px 18px',
            border:`1.5px solid ${gold}33`}}>
            <p style={{fontSize:11,fontWeight:700,color:D.muted,letterSpacing:1,margin:'0 0 12px'}}>{i.dispQuestion}</p>
            <p style={{fontSize:'clamp(14px,1.8vw,20px)',fontWeight:800,lineHeight:1.4,margin:'0 0 10px'}}>{q.q}</p>
            {q.unit&&<span style={{background:gold+'22',border:`1px solid ${gold}55`,
              borderRadius:8,padding:'4px 12px',color:gold,fontWeight:700,fontSize:14}}>
              {i.tipIn}: {q.unit}
            </span>}
          </div>
          {/* Live ranking - one row per player */}
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:5,overflowY:'auto'}}>
            {sorted.map((p,rank)=>{
              const g=guesses[p.id]; const tipped=g!=null; const timedOut=g===-999999;
              const pts=scores[p.id]||0;
              const medals=['🥇','🥈','🥉'];
              const sb=(room.steckbriefe||{})[p.id];
              const displayName=sb?.kampfname?`${p.name} aka ${sb.kampfname}`:p.name;
              return <div key={p.id} style={{
                display:'flex',alignItems:'center',gap:8,
                background:tipped?gold+'1a':D.surface,
                border:`1.5px solid ${rank===0?gold:tipped?gold+'66':D.border}`,
                borderRadius:10,padding:'7px 10px',
                transition:'all .6s',
                animation:tipped?'glow .8s ease':'none'}}>
                {/* Rank */}
                <span style={{fontSize:13,width:22,flexShrink:0,textAlign:'center',
                  fontWeight:800,fontFamily:'monospace',
                  color:rank===0?gold:rank===1?'#c0c0c0':rank===2?'#cd7f32':D.muted}}>
                  {rank+1}.
                </span>
                {/* Selfie */}
                <div style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',
                  flexShrink:0,border:`2px solid ${tipped?gold:D.border}`}}>
                  {sb?.selfie
                    ? <img src={sb.selfie} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <div style={{width:'100%',height:'100%',background:D.border,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:14,color:tipped?gold:D.muted}}>
                        {timedOut?'–':tipped?'✓':'?'}
                      </div>}
                </div>
                {/* Name */}
                <div style={{flex:1,fontSize:13,fontWeight:700,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                  color:rank===0?gold:D.text}}>{displayName}</div>
                {/* Tip value */}
                <div style={{fontSize:14,fontWeight:800,color:tipped?gold:'#3a2a1e',
                  flexShrink:0,minWidth:40,textAlign:'right'}}>
                  {tipped&&!timedOut?fmtNum(g):'—'}
                </div>
                {/* Points */}
                <div style={{fontSize:12,color:rank===0?gold:D.muted,fontWeight:700,
                  flexShrink:0,minWidth:32,textAlign:'right'}}>
                  {pts}P
                </div>
                {/* Kick button - host only */}
                {onKick&&<button onClick={()=>onKick(p.id)}
                  title="Spieler kicken"
                  style={{background:'none',border:'none',color:'#ff3355',
                    fontSize:12,cursor:'pointer',padding:'2px 4px',
                    opacity:.5,flexShrink:0}}
                  onMouseEnter={e=>e.target.style.opacity=1}
                  onMouseLeave={e=>e.target.style.opacity=.5}>
                  ✕
                </button>}
              </div>;
            })}
          </div>
        </>}

        {/* RESULTS / REVEAL */}
        {(phase==='results'||phase==='reveal')&&q&&<>
          {/* Question + Answer + Hint */}
          <div style={{background:gold+'22',borderRadius:12,padding:'14px 20px',
            border:`2px solid ${gold}`,animation:revealed?'popIn .5s ease both':'none',flexShrink:0}}>
            <p style={{fontSize:13,color:'#c8b8a8',margin:'0 0 8px',lineHeight:1.4}}>{q.q}</p>
            <p style={{fontSize:11,fontWeight:700,color:D.muted,letterSpacing:1,margin:'0 0 4px'}}>{i.dispAnswer}</p>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:q.hint?10:0}}>
              {/* Inline Count-up für Beamer */}
              <BeamerCountUp value={q.a} gold={gold} fontTitle={t.fontTitle}/>
              <span style={{fontSize:16,color:D.muted}}>{q.unit}</span>
            </div>
            {q.hint&&<div style={{background:D.surface,borderRadius:8,padding:'8px 12px',
              borderLeft:`3px solid ${gold}`}}>
              <span style={{fontSize:12,color:gold,fontWeight:600}}>💡 </span>
              <span style={{fontSize:12,color:'#c8b8a8'}}>{q.hint}</span>
            </div>}
          </div>

          {/* Avatar-Zahlenstrahl */}
          <BeamerRevealStrip ranked={ranked} answer={q.a} gold={gold} t={{bg:D.bg,surface:D.surface,card:D.card,border:D.border,text:D.text,muted:D.muted}}/>

          {/* WTF-Kommentar */}
          <p style={{fontSize:15,fontWeight:700,color:D.text,margin:'0 0 6px',
            lineHeight:1.4,animation:'fu .4s .5s ease both'}}>
            {wtfComment(ranked,q,lang)}
          </p>

          {/* Histogram */}
          <TippHistogram room={room} t={{bg:D.bg,surface:D.surface,card:D.card,border:D.border,text:D.text,muted:D.muted,gold:gold,radius:12}} lang={lang} gold={gold}/>

          {/* Full results table */}
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:6,overflowY:'auto'}}>
            {ranked.map((p,idx)=>{
              const isClosest=closestIds.includes(p.id);
              const roundPts=rs[p.id]||0;
              const rowAnim=isClosest&&p.diff!==0?'pulseGold 1.4s ease-in-out infinite':`slideUp .4s ease ${idx*0.08}s both`;
              return <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,
                background:p.diff===0?'#39d98a22':isClosest?gold+'18':D.surface,
                border:`1px solid ${p.diff===0?'#39d98a':isClosest?gold+'66':D.border}`,
                borderRadius:10,padding:'10px 14px',
                animation:rowAnim}}>                <span style={{fontSize:14,width:26,flexShrink:0,fontWeight:800,
                  fontFamily:'monospace',
                  color:idx===0?gold:idx===1?'#c0c0c0':idx===2?'#cd7f32':D.muted}}>
                  {idx+1}.
                </span>
                <span style={{flex:1,fontWeight:isClosest?700:400,fontSize:14}}>{p.name}</span>
                <span style={{fontFamily:t.fontMono,fontSize:13,color:D.muted,minWidth:50,textAlign:'right'}}>
                  {fmtNum(p.guess)}
                </span>
                <span style={{fontFamily:t.fontMono,fontSize:13,minWidth:56,textAlign:'right',
                  color:p.diff===0?'#39d98a':p.diff<q.a*.05?gold:'#b0a090',
                  fontWeight:p.diff===0?800:600}}>
                  {p.diff===0?'🎯 EXAKT':'±'+fmtNum(p.diff)}
                </span>
                {roundPts>0&&<div style={{background:gold+'33',border:`1px solid ${gold}`,
                  borderRadius:6,padding:'2px 8px',color:gold,fontWeight:800,fontSize:13,flexShrink:0}}>
                  +{roundPts}P
                </div>}
              </div>;
            })}
          </div>
        </>}

        {/* FINAL */}
        {phase==='final'&&<div style={{flex:1,display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:12,padding:'8px 8px',overflow:'hidden'}}>
          <div style={{fontSize:52,lineHeight:1}}>🏆</div>
          <p style={{fontSize:30,fontWeight:900,color:gold,margin:0,textAlign:'center',
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%'}}>
            {sorted[0]?.name} {i.dispWins}
          </p>
          {/* Endstand – alle Plätze mit Punkten + Treffer */}
          <div style={{width:'100%',maxWidth:600,display:'flex',flexDirection:'column',gap:8,
            overflow:'auto',marginTop:4}}>
            {sorted.map((p,idx)=>{
              const isWin=idx===0;
              const avg=diffCounts[p.id]>0?Math.round(diffTotals[p.id]/diffCounts[p.id]):null;
              return <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,
                background:isWin?gold+'1a':D.surface,border:`1.5px solid ${isWin?gold:D.border}`,
                borderRadius:14,padding:'11px 16px'}}>
                <span style={{fontSize:22,width:38,textAlign:'center',flexShrink:0}}>{medals[idx]||`${idx+1}.`}</span>
                <Avatar name={p.name} t={beamerT} size={38}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:19,fontWeight:700,color:D.text,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                  <div style={{fontSize:12,color:D.muted,display:'flex',gap:12,marginTop:1}}>
                    <span>🎯 {exactHits[p.id]||0}</span>
                    <span>Ø {avg!=null?fmtNum(avg):'–'}</span>
                    <span>🃏 {jokerTotals[p.id]||0}</span>
                  </div>
                </div>
                <span style={{fontSize:26,fontWeight:900,color:isWin?gold:D.text,
                  minWidth:54,textAlign:'right',flexShrink:0}}>{scores[p.id]||0}</span>
              </div>;
            })}
          </div>
          <p style={{fontSize:12,color:D.muted,margin:'2px 0 0'}}>{i.pts}</p>
        </div>}
      </div>

      {/* ── RIGHT: Scoreboard + Live Stats ── */}
      <div style={{flex:'0 0 42%',padding:'16px 20px',display:'flex',flexDirection:'column',
        gap:0,overflow:'hidden',minWidth:0}}>

        {/* ── QR Code – always visible ── */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,
          background:D.surface,borderRadius:12,padding:'10px 14px',
          border:`1px solid ${D.border}`,flexShrink:0}}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${typeof window!=='undefined'?window.location.origin:'https://playestimates.app'}?room=${room.code}`)}&bgcolor=${D.surface.replace('#','')}&color=${accent.replace('#','')}`}
            alt="QR" style={{width:116,height:116,borderRadius:6,flexShrink:0}}/>
          <div>
            <p style={{fontSize:11,color:D.muted,fontWeight:700,letterSpacing:1,margin:'0 0 4px'}}>📱 BEITRETEN</p>
            <p style={{fontSize:13,color:D.muted,margin:0}}>{i.dispScanJoin}</p>
          </div>
        </div>



        {/* ── Live Statistiken ── */}
        {history.length>0&&<>
          <p style={{fontSize:11,fontWeight:700,color:D.muted,letterSpacing:1.2,
            margin:'0 0 10px',textTransform:'uppercase',borderTop:`1px solid ${D.border}`,
            paddingTop:10}}>{i.dispStats}</p>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
            {sorted.map(p=>{
              const avg=diffCounts[p.id]>0?Math.round(diffTotals[p.id]/diffCounts[p.id]):null;
              return <div key={p.id} style={{background:D.card,borderRadius:10,
                padding:'10px 14px',border:`1px solid ${D.border}`}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:5,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                  color:D.text}}>{p.name}</div>
                <div style={{display:'flex',gap:14,color:D.muted,fontSize:13}}>
                  <span title="Exakte Treffer">🎯 {exactHits[p.id]||0}</span>
                  <span title="Ø Abweichung">Ø {avg!=null?fmtNum(avg):'–'}</span>
                  <span title="Joker gespielt">🃏 {jokerTotals[p.id]||0}</span>
                </div>
              </div>;
            })}
          </div>
        </>}

        {/* ── Joker Inventar ── */}
        <div style={{borderTop:`1px solid ${D.border}`,paddingTop:10,marginBottom:10,flexShrink:0}}>
          <p style={{fontSize:11,fontWeight:700,color:D.muted,letterSpacing:1.2,
            margin:'0 0 10px',textTransform:'uppercase'}}>{i.dispJoker}</p>
          {pl.map(p=>{
            const jk=(room?.jokers||{})[p.id]||[];
            const newJk=(room?.newJokersThisRound||{})[p.id];
            return <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,
              marginBottom:8,background:newJk?gold+'18':'transparent',
              borderRadius:8,padding:'4px 8px',transition:'background .4s'}}>
              <span style={{fontSize:13,color:'#c8b8a8',flex:1,fontWeight:500,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
              <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                {jk.length>0
                  ? jk.map((j,ii)=><span key={ii} style={{fontSize:16}}>{jokerIcon(j)}</span>)
                  : <span style={{fontSize:13,color:'#3a2a1e'}}>—</span>}
                {newJk&&<span style={{fontSize:12,color:gold,fontWeight:800,
                  background:gold+'33',borderRadius:5,padding:'2px 7px',
                  animation:'popIn .4s ease both'}}>+{jokerIcon(newJk)}</span>}
              </div>
            </div>;
          })}
        </div>

        {/* ── Event Feed ── */}
        <div style={{borderTop:`1px solid ${D.border}`,paddingTop:10,flex:1,
          display:'flex',flexDirection:'column',minHeight:0}}>
          <p style={{fontSize:11,fontWeight:700,color:D.muted,letterSpacing:1.2,
            margin:'0 0 10px',textTransform:'uppercase',flexShrink:0}}>{i.dispEvents}</p>
          <ChatFeed room={room} pl={pl} gold={gold} jokerIcon={jokerIcon} i={i} t={{bg:D.bg,surface:D.surface,card:D.card,border:D.border,text:D.text,muted:D.muted}}/>
        </div>

        {/* ── QR ── */}
        {qr&&<div style={{textAlign:'center',opacity:.5,paddingTop:12,flexShrink:0,
          borderTop:`1px solid ${D.border}`,marginTop:8}}>
          <img src={qr} style={{width:72,height:72,borderRadius:6}}/>
          <p style={{fontSize:11,color:D.muted,margin:'4px 0 0'}}>{i.dispScanJoin}</p>
        </div>}
      </div>
    </div>
  </div>;
}



/* ─── FEEDBACK WIDGET ───────────────────────────── */
function FeedbackWidget({t, lang, currentQuestion=null}) {
  const i = UI[lang]||UI.de;
  const [state, setState] = React.useState('idle'); // idle | thanks

  const SUPPORT_EMAIL = 'support@playestimates.app';
  const STORE_URL_IOS = 'https://apps.apple.com/app/estimatesapp';
  const STORE_URL_ANDROID = 'https://play.google.com/store/apps/details?id=app.playestimates';

  function rateApp() {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    window.open(isIOS ? STORE_URL_IOS : STORE_URL_ANDROID, '_blank');
    setState('thanks');
  }

  function openFeedback() {
    const subject = encodeURIComponent(i.feedbackBugSubject||'Feedback EstiMates');
    const body = encodeURIComponent((i.feedbackBugBody||'').replace('Frage: ', 'Frage: '+(currentQuestion||'')));
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setState('thanks');
  }

  function reportBug() {
    const subject = encodeURIComponent(i.feedbackBugSubject||'Fehler EstiMates');
    const body = encodeURIComponent((i.feedbackBugBody||'').replace('Frage: ', 'Frage: '+(currentQuestion||'')));
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setState('thanks');
  }

  if(state==='thanks') return (
    <div style={{padding:'14px 16px',borderRadius:t.radius,
      background:t.gold+'11',border:`1px solid ${t.gold}44`,textAlign:'center'}}>
      <p style={{fontSize:13,color:t.gold,fontWeight:700,margin:'0 0 4px'}}>
        ✅ {i.feedbackThanks}
      </p>
      {i.feedbackReward&&<p style={{fontSize:12,color:t.muted,margin:0}}>
        {i.feedbackReward}
      </p>}
    </div>
  );

  return (
    <div style={{padding:'14px 16px',borderRadius:t.radius,
      background:t.surface,border:`1px solid ${t.border}`,textAlign:'center'}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,margin:'0 0 12px'}}>
        {i.feedbackTitle}
      </p>
      <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
        <button onClick={rateApp}
          style={{padding:'8px 14px',borderRadius:t.radius,border:`1px solid ${t.gold}`,
            background:t.gold+'22',color:t.gold,fontSize:13,fontWeight:600,
            cursor:'pointer',fontFamily:t.fontBody}}>
          {i.feedbackYes}
        </button>
        <button onClick={openFeedback}
          style={{padding:'8px 14px',borderRadius:t.radius,border:`1px solid ${t.border}`,
            background:t.surface,color:t.muted,fontSize:13,
            cursor:'pointer',fontFamily:t.fontBody}}>
          {i.feedbackNo}
        </button>
      </div>
    </div>
  );
}

/* ─── BUG REPORT BUTTON ─────────────────────────── */
function BugReportButton({t, lang, question}) {
  const i = UI[lang]||UI.de;
  const [sent, setSent] = React.useState(false);

  async function report() {
    if(sent) return;
    setSent(true); // optimistic – kein mailto-Sprung mitten im Spiel
    try {
      const id = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      await update(ref(db,`bugReports/${id}`), {
        qId:        question?.id != null ? question.id : null,
        q:          question?.q || null,
        a:          question?.a != null ? question.a : null,
        unit:       question?.unit || null,
        lang:       lang || 'de',
        reporterId: auth?.currentUser?.uid || null,
        ts:         Date.now(),
        status:     'open',
      });
    } catch(e) { console.error('bug report failed:', e); }
  }

  if(sent) return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,
      fontSize:13,fontWeight:700,color:t.green,
      border:`1.5px solid ${t.green}`,borderRadius:t.radius,
      padding:'9px 16px',background:t.green+'18'}}>
      ✅ {i.feedbackThanks||'Danke, gemeldet!'}
    </span>
  );

  return (
    <button onClick={report}
      style={{display:'inline-flex',alignItems:'center',gap:6,
        background:t.surface,border:`1.5px solid ${t.danger}`,
        color:t.danger,fontSize:13,fontWeight:700,
        cursor:'pointer',fontFamily:t.fontBody,
        borderRadius:t.radius,padding:'9px 16px'}}>
      {i.feedbackBug||'🐛 Fehler melden'}
    </button>
  );
}

/* ─── FINAL ───────────────────────────────────────── */
function FinalScreen({room,myId,t,onRestart,lang,isAnonymous=true,onShowLogin=null,userName=null,onKick=null}){
  const i=UI[lang]||UI.de;
  const[globalRank,setGlobalRank]=useState(null);
  const[showCamera,setShowCamera]=useState(false);
  const[winnerPhoto,setWinnerPhoto]=useState(null);
  const[rating,setRating]=useState(null);       // 1-5 stars
  const[nps,setNps]=useState(null);             // 0-10
  const[ratingDone,setRatingDone]=useState(false);
  const[ratingSkipped,setRatingSkipped]=useState(false);
  const[ratingComment,setRatingComment]=useState('');
  const isHost = room.hostId===myId;

  async function submitRating(stars, npsScore, skipped=false){
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';
      const region = tz.split('/')[0]||'unknown';
      const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
      const ts = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      await update(ref(db,`globalStats/ratings/${ts}`),{
        stars:        skipped?null:stars,
        nps:          skipped?null:npsScore,
        comment:      (!skipped&&ratingComment.trim())?ratingComment.trim():null,
        skipped:      skipped?true:false,
        role:         isHost?'host':'guest',
        lang:         lang||'de',
        region,
        groupSize:    pl.length,
        rounds:       (room.history||[]).length,
        ts:           Date.now(),
      });
    } catch(e){ console.warn('Rating save failed',e); }
    setRatingDone(true);
  }
  useEffect(()=>{
    const history=room.history||[];
    if(!history.length)return;
    const myGuesses=history.filter(r=>r.guesses?.[myId]!=null&&r.guesses[myId]!==-999999);
    if(!myGuesses.length)return;
    const totalDiff=myGuesses.reduce((s,r)=>s+Math.abs(r.guesses[myId]-r.answer),0);
    const avg=totalDiff/myGuesses.length;
    getGlobalRank(avg).then(rank=>{if(rank!=null)setGlobalRank(rank);});
  },[]);
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

  // Wildester Tipp – größter einzelner Ausreißer
  let wildest=null;
  history.forEach(r=>{
    if(!r.guesses||r.answer==null)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g==null||g===-999999)return;
      const rel=Math.abs(g-r.answer)/Math.max(1,Math.abs(r.answer));
      if(!wildest||rel>wildest.rel) wildest={pid,rel,g,ans:r.answer};
    });
  });
  const wildestPlayer=wildest&&pl.find(p=>p.id===wildest.pid);

  // Optimist – tippt am häufigsten über der Antwort
  const overCount={};
  history.forEach(r=>{
    if(!r.guesses||r.answer==null)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g==null||g===-999999)return;
      if(g>r.answer) overCount[pid]=(overCount[pid]||0)+1;
    });
  });
  const optimistId=pl.reduce((best,p)=>(overCount[p.id]||0)>(overCount[best]||0)?p.id:best,pl[0]?.id);
  const optimist=pl.find(p=>p.id===optimistId);

  const statCards=[
    betKing&&{icon:"🎲",label:i.betKing,name:betKing.name,sub:`${i.betSub(betWins[betKingId],betTotal[betKingId])} (${betKingRate}%)`,color:t.gold},
    bestPlayer&&sorted.length>1&&{icon:"🎯",label:i.bestGuesser,name:bestPlayer.name,sub:`${i.avgDeviation}: ${fmtNum(bestAvg)}`,color:t.green},
    room.betWorst!==false&&worstPlayer&&sorted.length>1&&bestId!==worstId&&{icon:"🙈",label:i.worstGuesser,name:worstPlayer.name,sub:`${i.avgDeviation}: ${fmtNum(worstAvg)}`,color:t.danger},
    exactKing&&(exactHits[exactKingId]||0)>0&&{icon:"💥",label:i.exactHits,name:exactKing.name,sub:i.exactCount(exactHits[exactKingId]),color:t.accent},
    jokerKing&&(jokerTotals[jokerKingId]||0)>0&&{icon:"🃏",label:i.jokerKing,name:jokerKing.name,sub:i.jokerPlayed(jokerTotals[jokerKingId]),color:t.gold},
    sabotageKing&&{icon:"💣",label:i.sabotageKing,name:sabotageKing.name,sub:i.sabotageCount(sabotageStats[sabotageKingId]),color:t.danger},
    wildestPlayer&&totalRounds>=1&&wildest.rel>1&&{icon:"🌪",label:(lang==='en'?'Wildest guess':lang==='es'?'Tiro más loco':'Wildester Tipp'),name:wildestPlayer.name,sub:`${fmtNum(wildest.g)} (${lang==='en'?'answer':lang==='es'?'respuesta':'Antwort'} ${fmtNum(wildest.ans)})`,color:t.accent},
    optimist&&sorted.length>1&&(overCount[optimistId]||0)>=2&&{icon:"📈",label:(lang==='en'?'The optimist':lang==='es'?'El optimista':'Der Optimist'),name:optimist.name,sub:(lang==='en'?`${overCount[optimistId]}× too high`:lang==='es'?`${overCount[optimistId]}× demasiado alto`:`${overCount[optimistId]}× zu hoch`),color:t.gold},
  ].filter(Boolean);

  return <div style={{...page,textAlign:"center",paddingTop:36}}>

    {/* ── RATING CARD ── */}
    {!ratingDone&&!ratingSkipped&&<Card t={t} style={{marginBottom:16,textAlign:'left'}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:12}}>
        ⭐ {lang==='en'?'How was the game?':lang==='es'?'¿Cómo fue el juego?':'Wie war die Runde?'}
      </p>
      {/* Stars */}
      <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:14}}>
        {['1','2','3','4','5'].map((num,idx)=>(
          <button key={idx} onClick={()=>setRating(idx+1)}
            style={{width:36,height:36,borderRadius:'50%',
              background:rating===idx+1?t.accent:t.surface,
              border:`1.5px solid ${rating===idx+1?t.accent:t.border}`,
              color:rating===idx+1?'#fff':t.muted,
              fontSize:14,fontWeight:800,cursor:'pointer',
              transform:rating===idx+1?'scale(1.2)':'scale(1)',
              transition:'all .15s'}}>
            {num}
          </button>
        ))}
        <span style={{fontSize:12,color:t.muted,alignSelf:'center',marginLeft:4}}>
          {rating?['😞','😐','🙂','😄','🤩'][rating-1]:''}
        </span>
      </div>
      {/* NPS */}
      <p style={{fontSize:12,color:t.muted,marginBottom:8,textAlign:'center'}}>
        {lang==='en'?'Recommend EstiMates? (0–10)':lang==='es'?'¿Recomendarías EstiMates? (0–10)':'EstiMates weiterempfehlen? (0–10)'}
      </p>
      <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap',marginBottom:14}}>
        {[0,1,2,3,4,5,6,7,8,9,10].map(n=>(
          <button key={n} onClick={()=>setNps(n)}
            style={{width:30,height:30,borderRadius:6,fontSize:12,fontWeight:700,
              cursor:'pointer',border:`1.5px solid ${nps===n?t.accent:t.border}`,
              background:nps===n?t.accent:'none',
              color:nps===n?'#fff':t.text,transition:'all .15s'}}>
            {n}
          </button>
        ))}
      </div>
      {/* Comment field – immer sichtbar, sobald bewertet wurde (auch positiv) */}
      {(rating||nps!==null)&&<div>
        <p style={{fontSize:12,color:t.muted,margin:'0 0 4px'}}>
          {(!((rating&&rating<4)||(nps!==null&&nps<7)))
            ? (lang==='en'?'What did you love? (optional)':lang==='es'?'¿Qué te encantó? (opcional)':'Was hat dir besonders gefallen? (optional)')
            : (lang==='en'?'What can we improve? (optional)':lang==='es'?'¿Qué podemos mejorar? (opcional)':'Was können wir verbessern? (optional)')}
        </p>
        <textarea value={ratingComment} onChange={e=>setRatingComment(e.target.value)}
          rows={2} placeholder={lang==='en'?'Your feedback...':lang==='es'?'Tu opinión...':'Dein Feedback...'}
          style={{width:'100%',background:t.surface,border:`1.5px solid ${t.border}`,
            borderRadius:t.radius,color:t.text,fontSize:13,padding:'8px 10px',
            fontFamily:t.fontBody,resize:'none',boxSizing:'border-box'}}/>
      </div>}
      {/* Buttons */}
      <div style={{display:'flex',gap:8}}>
        <button onClick={()=>{submitRating(null,null,true);setRatingSkipped(true);}}
          style={{flex:1,padding:'8px',borderRadius:t.radius,background:'none',
            border:`1px solid ${t.border}`,color:t.muted,fontSize:12,cursor:'pointer'}}>
          {lang==='en'?'Skip':lang==='es'?'Omitir':'Überspringen'}
        </button>
        <button onClick={()=>{if(rating||nps!==null)submitRating(rating,nps);}}
          disabled={!rating&&nps===null}
          style={{flex:2,padding:'8px',borderRadius:t.radius,
            background:rating||nps!==null?t.accent:t.surface,
            border:'none',color:'#fff',fontSize:13,fontWeight:700,
            cursor:rating||nps!==null?'pointer':'default',
            opacity:rating||nps!==null?1:0.5}}>
          {lang==='en'?'Submit ✓':lang==='es'?'Enviar ✓':'Abschicken ✓'}
        </button>
      </div>
    </Card>}

    {ratingDone&&<div style={{textAlign:'center',marginBottom:16,fontSize:13,color:t.green,fontWeight:600}}>
      ✓ {lang==='en'?'Thanks for your feedback!':lang==='es'?'¡Gracias!':'Danke für dein Feedback!'}
    </div>}
    <div style={{fontSize:68,animation:"pop .7s ease both"}}>{t.id==="kids"?"🏆🎉🌟":"🏆"}</div>
    <div style={{fontFamily:t.fontTitle,fontSize:50,color:t.gold,marginTop:6,animation:"pop .7s .1s ease both",lineHeight:1}}>{winner?.name||"?"}</div>
    <p style={{color:t.muted,fontSize:16,margin:"5px 0 12px"}}>{scores[winner?.id]||0} {i.pts}! 🎊</p>
    {globalRank!=null&&<div style={{
      padding:"8px 16px",borderRadius:t.radius,marginBottom:12,
      background:globalRank<=25?t.gold+"22":globalRank<=50?t.green+"18":t.surface,
      border:`1.5px solid ${globalRank<=25?t.gold:globalRank<=50?t.green:t.border}`,
      fontSize:13,textAlign:"center",
    }}>
      <span style={{color:globalRank<=25?t.gold:globalRank<=50?t.green:t.muted,fontWeight:700}}>
        {i.globalRank(100-globalRank)}
        {globalRank<=10?" 🏆":globalRank<=25?" 🥇":globalRank<=50?" 🎯":""}
      </span>
    </div>}
    <Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:14}}>{i.finalStand}</p>
      {sorted.map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<sorted.length-1?`1px solid ${t.border}`:"none",animation:`fu .4s ${i*.08}s ease both`}}>
        <span style={{fontSize:20,minWidth:26}}>{medals[i]||`${i+1}.`}</span>
        <Avatar name={p.name} t={t}/>
        <span style={{flex:1,fontWeight:p.id===myId?800:400,fontSize:15,textAlign:"left"}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:11}}> (Du)</span>}</span>
        <span style={{fontFamily:t.fontTitle,fontSize:36,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span>
        {onKick&&p.id!==myId&&<button onClick={()=>onKick(p.id)}
          title="Spieler kicken"
          style={{background:'none',border:'none',color:t.danger,
            fontSize:13,cursor:'pointer',padding:'4px 6px',opacity:.4,
            marginLeft:4}}
          onMouseEnter={e=>e.target.style.opacity=1}
          onMouseLeave={e=>e.target.style.opacity=.4}>✕</button>}
      </div>)}
    </Card>
    {statCards.length>0&&<Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.8,marginBottom:14}}>{i.stats}</p>
      {statCards.map((s,i)=><div key={i} style={{...row,padding:"10px 12px",borderRadius:t.radius,background:s.color+"14",border:`1px solid ${s.color}33`,marginBottom:8}}>
        <div style={{fontSize:26,minWidth:34}}>{s.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:s.color,fontWeight:700,letterSpacing:.5,marginBottom:1}}>{s.label.toUpperCase()}</div>
          <div style={{fontWeight:800,fontSize:15}}>{s.name}</div>
          <div style={{fontSize:12,color:t.muted,marginTop:1}}>{s.sub}</div>
        </div>
      </div>)}
    </Card>}
    {/* Camera modal */}
    {showCamera&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <Card t={t} style={{width:'100%',maxWidth:340,padding:24}}>
        <WinnerPhotoCapture t={t} lang={lang}
          onCapture={photo=>{setWinnerPhoto(photo);setShowCamera(false);setTimeout(()=>shareResult(room,t,lang,photo),100);}}
          onSkip={()=>{setShowCamera(false);shareResult(room,t,lang,null);}}
        />
      </Card>
    </div>}
    {/* Share button */}
    <Btn t={t} variant="secondary" full onClick={()=>setShowCamera(true)} style={{marginBottom:12}}>
      {i.shareBtn}
    </Btn>
    {onShowLogin&&<div style={{marginBottom:12,padding:'14px 16px',
      borderRadius:t.radius,border:`1.5px solid ${t.gold}44`,
      background:t.gold+'11',textAlign:'center'}}>
      {isAnonymous
        ? <>
          <p style={{fontSize:13,color:t.gold,fontWeight:700,margin:'0 0 6px'}}>
            🏆 Statistiken dauerhaft speichern
          </p>
          <p style={{fontSize:12,color:t.muted,margin:'0 0 10px'}}>
            Streak & Rangliste geräteübergreifend sichern
          </p>
          <button onClick={()=>onShowLogin()}
            style={{width:'100%',padding:'11px',borderRadius:t.radius,
              background:t.gold+'33',border:`1.5px solid ${t.gold}`,
              color:t.gold,fontWeight:700,fontSize:14,cursor:'pointer',
              fontFamily:t.fontBody}}>
            🔐 Mit Google anmelden
          </button>
        </>
        : <div>
            <p style={{fontSize:13,color:t.gold,fontWeight:700,margin:'0 0 6px'}}>
              ✅ Angemeldet{userName?' als '+userName:''}
            </p>
            <button onClick={async()=>{
              await signOut(auth);
              await signInAnonymously(auth);
            }} style={{background:'none',border:'none',color:t.muted,
              fontSize:11,cursor:'pointer',textDecoration:'underline',padding:0,
              fontFamily:t.fontBody}}>
              Abmelden
            </button>
          </div>
      }
    </div>}
    <Btn t={t} onClick={onRestart} full style={{marginBottom:16}}>🔄 Nochmal spielen!</Btn>
  </div>;
}

/* ─── ROOT APP ────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null,info:null};}
  static getDerivedStateFromError(e){return{error:e};}
  componentDidCatch(e,info){console.error("🔴 EstiMates Error:",e,info);this.setState({info});}
  render(){
    if(this.state.error)return <div style={{padding:20,color:"red",fontFamily:"monospace",background:"#fff",minHeight:"100vh"}}>
      <h2>🔴 Fehler – bitte Screenshot machen:</h2>
      <pre style={{fontSize:12,whiteSpace:"pre-wrap"}}>{this.state.error?.message}</pre>
      <pre style={{fontSize:11,whiteSpace:"pre-wrap",color:"#666"}}>{this.state.error?.stack}</pre>
      {this.state.info&&<pre style={{fontSize:10,whiteSpace:"pre-wrap",color:"#999"}}>{this.state.info?.componentStack}</pre>}
      <button onClick={()=>this.setState({error:null})} style={{marginTop:16,padding:"8px 16px"}}>Retry</button>
    </div>;
    return this.props.children;
  }
}

/* ─── DISPLAY APP (Gastgeber-Modus – eigenständig) ─── */
export function DisplayApp() {
  const params = new URLSearchParams(location.search);
  const roomCode = params.get('room');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(false);
  const lang = localStorage.getItem('em_lang')||'de';
  // Heller Modus vom Host per URL (?light=1) oder aus dem Raum übernehmen
  const wantLight = params.get('light')==='1';
  if(wantLight && !A11Y.light){ A11Y={...A11Y, light:true}; }
  const t = applyA11y(ADULT);

  useEffect(()=>{
    if(!roomCode){ setError(true); return; }
    const roomRef = ref(db,`rooms/${roomCode}`);
    const unsub = onValue(roomRef, snap=>{
      if(snap.exists()) setRoom(snap.val());
      else setError(true);
    });
    return ()=>unsub();
  },[roomCode]);

  if(error) return <div style={{minHeight:'100vh',background:'#0f0a06',color:'#f2ece6',
    display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
    <div style={{fontSize:48}}>📺</div>
    <p style={{fontSize:18,fontWeight:700}}>Raum nicht gefunden</p>
    <p style={{fontSize:14,color:'#6e5e54'}}>URL: ?mode=display&room=RAUMCODE</p>
  </div>;

  if(!room) return <div style={{minHeight:'100vh',background:'#0f0a06',color:'#f2ece6',
    display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
    <div style={{fontSize:48}}>⏳</div>
    <p style={{fontSize:18,color:'#6e5e54'}}>Verbinde mit Raum #{roomCode}...</p>
  </div>;

  return <ErrorBoundary><DisplayScreen room={room} code={roomCode} t={t} lang={lang} onKick={async(pid)=>{ if(!window.confirm((room?.players?.[pid]?.name||"?")+" kicken?")) return; const newOrder=(room.order||[]).filter(id=>id!==pid); await update(ref(db),{[`rooms/${roomCode}/order`]:newOrder,[`rooms/${roomCode}/kicked/${pid}`]:true,[`rooms/${roomCode}/players/${pid}`]:null}); }}/></ErrorBoundary>;
}

/* ─── LOGIN PROMPT ──────────────────────────────── */
function LoginPrompt({t, lang, onClose, onSuccess}) {
  const i = UI[lang]||UI.de;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Popup-first: result comes back in the same promise, so it does NOT rely on
  // cross-domain (firebaseapp.com) third-party storage – which mobile browsers block.
  // Redirect is kept only as a fallback if the popup is blocked.
  async function loginWith(provider) {
    console.log("loginWith called, auth:", !!auth, "currentUser:", auth?.currentUser?.uid);
    setBusy(true); setError(null);
    if(!auth){ setError("Auth nicht verfügbar"); setBusy(false); return; }
    const currentUser = auth.currentUser;

    const credFromError = (e) => {
      try { return GoogleAuthProvider.credentialFromError(e) || OAuthProvider.credentialFromError(e); }
      catch { return null; }
    };

    try {
      let result;
      if(currentUser && currentUser.isAnonymous) {
        // Upgrade the anonymous account → Google/Apple
        try {
          result = await linkWithPopup(currentUser, provider);
        } catch(e) {
          // This provider account already belongs to an existing EstiMates user.
          // Sign into that existing account instead (anon progress is dropped).
          if(e.code === 'auth/credential-already-in-use') {
            const cred = credFromError(e);
            if(cred) { result = await signInWithCredential(auth, cred); }
            else throw e;
          } else throw e;
        }
      } else {
        result = await signInWithPopup(auth, provider);
      }
      if(result?.user) {
        setBusy(false);
        onSuccess && onSuccess(result.user);
        onClose && onClose();
      }
    } catch(e) {
      console.error("loginWith error:", e.code, e.message);
      // Popup blocked / unsupported / interrupted → fall back to redirect
      const popupFailed = ['auth/popup-blocked',
        'auth/operation-not-supported-in-environment']
        .includes(e.code);
      if(popupFailed) {
        try {
          if(currentUser && currentUser.isAnonymous) await linkWithRedirect(currentUser, provider);
          else await signInWithRedirect(auth, provider);
          return; // page navigates away; result handled by getRedirectResult on return
        } catch(re) {
          setError(`Anmeldung fehlgeschlagen: ${re.code||re.message}`);
          setBusy(false);
        }
      } else if(e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        // user closed it on purpose – no error message
        setBusy(false);
      } else {
        setError(`Anmeldung fehlgeschlagen: ${e.code||e.message}`);
        setBusy(false);
      }
    }
  }

  return <div style={{position:'fixed',inset:0,zIndex:999,
    background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center'}}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:t.card,borderRadius:20,padding:'28px 24px',
      maxWidth:340,width:'90%',border:`1.5px solid ${t.border}`}}>
      <p style={{fontSize:18,fontWeight:800,margin:'0 0 6px',color:t.text}}>
        🏆 Statistiken speichern
      </p>
      <p style={{fontSize:13,color:t.muted,margin:'0 0 20px',lineHeight:1.5}}>
        Melde dich an um deinen Streak, Rangliste und Statistiken geräteübergreifend zu speichern.
      </p>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <button onClick={()=>loginWith(googleProvider)} disabled={busy}
          style={{padding:'12px 16px',borderRadius:t.radius,border:`1.5px solid ${t.border}`,
            background:t.surface,color:t.text,fontWeight:700,fontSize:14,
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            fontFamily:t.fontBody}}>
          <span style={{fontSize:18}}>G</span> Mit Google anmelden
        </button>
        <button onClick={()=>loginWith(appleProvider)} disabled={busy}
          style={{padding:'12px 16px',borderRadius:t.radius,border:`1.5px solid ${t.border}`,
            background:t.surface,color:t.text,fontWeight:700,fontSize:14,
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            fontFamily:t.fontBody}}>
          <span style={{fontSize:18}}></span> Mit Apple anmelden
        </button>
      </div>
      {error&&<p style={{color:t.danger,fontSize:12,marginTop:10,textAlign:'center'}}>{error}</p>}
      <button onClick={onClose}
        style={{width:'100%',marginTop:12,padding:'10px',borderRadius:t.radius,
          border:'none',background:'transparent',color:t.muted,fontSize:13,
          cursor:'pointer',fontFamily:t.fontBody}}>
        Später – anonym weiter spielen
      </button>
    </div>
  </div>;
}



/* ─── ADMIN DASHBOARD ──────────────────────────────────── */
function AdminDashboard({t, lang, onBack}){
  const gold=t.gold||'#ff8c2a';
  const green=t.green||'#39d98a';
  const accent=t.accent||'#e8360a';
  const muted=t.muted||'#6e5e54';
  const surface=t.surface||'#1a120a';
  const border=t.border||'#2a1a0e';
  const[stats,setStats]=useState(null);
  const[loading,setLoading]=useState(true);
  const[tab,setTab]=useState('overview'); // overview|accounts|ratings|feedback|community|bugs|categories|questions|regions
  const[qSort,setQSort]=useState('played'); // played|hard|easy|ambiguous
  const[range,setRange]=useState('14d'); // 14d|30d|6m|1y|all – Zeitraum des Verlaufs-Charts
  const[commFilter,setCommFilter]=useState('pending'); // pending|approved|rejected|all
  const[fbSort,setFbSort]=useState('newest'); // newest|oldest|best|worst|region
  const[fbStarFilter,setFbStarFilter]=useState(0); // 0=alle, 1..5
  const[fbNpsFilter,setFbNpsFilter]=useState('all'); // all|promoter|passive|detractor
  const[editComm,setEditComm]=useState(null); // {id,q,a,unit}
  const[busyId,setBusyId]=useState(null);
  const[cleanupBusy,setCleanupBusy]=useState(false);

  useEffect(()=>{
    async function loadStats(){
      setLoading(true);
      try {
        const safe = p => p.then(s=>s.val()||null).catch(()=>null);
        const [ratingsV, sessionsV, catsV, pairsV, questionsV, communityV, bugsV, usersV] = await Promise.all([
          safe(get(ref(db,'globalStats/ratings'))),
          safe(get(ref(db,'globalStats/sessions'))),
          safe(get(ref(db,'globalStats/categories'))),
          safe(get(ref(db,'globalStats/categoryPairs'))),
          safe(get(ref(db,'globalStats/questions'))),
          safe(get(ref(db,'communityQuestions'))),
          safe(get(ref(db,'bugReports'))),
          safe(get(ref(db,'globalStats/users'))),
        ]);

        const ratings = Object.values(ratingsV||{});
        const sessions = Object.values(sessionsV||{});
        const catsList = Object.entries(catsV||{}).map(([k,v])=>({name:k,...v}))
          .sort((a,b)=>(b.plays||0)-(a.plays||0));
        const pairs = Object.entries(pairsV||{})
          .map(([k,v])=>({pair:k.replace('__',' + '),...v}))
          .sort((a,b)=>(b.count||0)-(a.count||0));
        const questions = Object.entries(questionsV||{})
          .map(([k,v])=>({id:k,...v}))
          .sort((a,b)=>(b.count||0)-(a.count||0));

        // Ratings analysis
        const rated = ratings.filter(r=>!r.skipped&&r.stars!=null);
        const avgStars = rated.length>0
          ? (rated.reduce((s,r)=>s+(r.stars||0),0)/rated.length).toFixed(1) : '-';
        const npsRatings = ratings.filter(r=>!r.skipped&&r.nps!=null);
        const promoters = npsRatings.filter(r=>r.nps>=9).length;
        const detractors = npsRatings.filter(r=>r.nps<=6).length;
        const nps = npsRatings.length>0
          ? Math.round((promoters-detractors)/npsRatings.length*100) : null;
        const skipRate = ratings.length>0
          ? Math.round(ratings.filter(r=>r.skipped).length/ratings.length*100) : 0;
        const byRole = {host:rated.filter(r=>r.role==='host'), guest:rated.filter(r=>r.role==='guest')};
        const avgHost = byRole.host.length>0
          ? (byRole.host.reduce((s,r)=>s+r.stars,0)/byRole.host.length).toFixed(1) : '-';
        const avgGuest = byRole.guest.length>0
          ? (byRole.guest.reduce((s,r)=>s+r.stars,0)/byRole.guest.length).toFixed(1) : '-';

        // Sessions analysis
        const totalSessions = sessions.length;
        const byLang = {};
        const byRegion = {};
        const byPlatform = {};
        const byGroupSize = {};
        sessions.forEach(s=>{
          byLang[s.lang||'de'] = (byLang[s.lang||'de']||0)+1;
          const tz = s.tz||'unknown';
          const region = tz.split('/')[0]||'unknown';
          byRegion[region] = (byRegion[region]||0)+1;
          byPlatform[s.platform||'unknown'] = (byPlatform[s.platform||'unknown']||0)+1;
          const gs = Math.min(s.groupSize||1,10);
          byGroupSize[gs] = (byGroupSize[gs]||0)+1;
        });
        const avgGroupSize = sessions.length>0
          ? (sessions.reduce((s,r)=>s+(r.groupSize||1),0)/sessions.length).toFixed(1) : '-';

        // #3 Zeitverlauf – Sessions pro Tag (letzte 14 Tage) + 7d-Vergleich
        const DAY=86400000;
        const dayStart=new Date(); dayStart.setHours(0,0,0,0);
        const todayMs=dayStart.getTime();
        const sparkDays=[];
        for(let k=13;k>=0;k--){
          const d0=todayMs-k*DAY;
          sparkDays.push({day:d0, count:sessions.filter(s=>s.ts>=d0&&s.ts<d0+DAY).length});
        }
        const last7  = sessions.filter(s=>s.ts>=todayMs-6*DAY).length;
        const prev7  = sessions.filter(s=>s.ts>=todayMs-13*DAY&&s.ts<todayMs-6*DAY).length;
        const delta7 = prev7>0 ? Math.round((last7-prev7)/prev7*100) : null;

        // #5 Accounts
        const users = Object.values(usersV||{});
        const totalUsers  = users.length;
        const registered  = users.filter(u=>!u.anon).length;
        const anonUsers    = users.filter(u=>u.anon).length;
        const returning    = users.filter(u=>(u.opens||1)>1).length;
        const newUsers7    = users.filter(u=>(u.firstSeen||0)>=todayMs-6*DAY).length;
        const active7      = users.filter(u=>(u.lastSeen||0)>=todayMs-6*DAY).length;
        const usersByLang  = {};
        users.forEach(u=>{ const l=u.lang||'de'; usersByLang[l]=(usersByLang[l]||0)+1; });
        // #2 Login-Methoden (Google/Apple/anonym/…)
        const usersByMethod = {};
        users.forEach(u=>{
          let m = u.method;
          if(!m) m = u.anon ? 'anonymous' : 'other';
          if(m==='google.com') m='google';
          else if(m==='apple.com') m='apple';
          else if(m==='password') m='email';
          usersByMethod[m] = (usersByMethod[m]||0)+1;
        });

        // #1 Community-Fragen
        const community = Object.entries(communityV||{})
          .map(([k,v])=>({id:k,...v}))
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        const communityPending  = community.filter(q=>(q.status||'pending')==='pending');
        const communityApproved = community.filter(q=>q.status==='approved');
        const communityRejected = community.filter(q=>q.status==='rejected');

        // #2 Bug-Reports
        const bugs = Object.entries(bugsV||{})
          .map(([k,v])=>({id:k,...v}))
          .sort((a,b)=>(b.ts||0)-(a.ts||0));
        const bugsOpen = bugs.filter(b=>(b.status||'open')==='open').length;

        // Feedback comments – bad ratings only
        const feedbacks = ratings
          .filter(r=>r.comment&&r.comment.trim()&&!r.skipped)
          .sort((a,b)=>(b.ts||0)-(a.ts||0));

        setStats({
          ratings, rated, avgStars, nps, skipRate,
          promoters, detractors, npsRatings,
          avgHost, avgGuest, totalRatings:ratings.length,
          sessions, totalSessions, byLang, byRegion, byPlatform, byGroupSize, avgGroupSize,
          categories: catsList, pairs: pairs.slice(0,20),
          questions: questions.slice(0,50), questionsAll: questions,
          feedbacks,
          sparkDays, last7, prev7, delta7,
          totalUsers, registered, anonUsers, returning, newUsers7, active7, usersByLang, usersByMethod,
          community, communityPending, communityApproved, communityRejected,
          bugs, bugsOpen,
        });
      } catch(e){ console.error('Admin stats error:', e); }
      setLoading(false);
    }
    loadStats();
  },[]);

  // ── Re-derive community status buckets after a local mutation ──
  const rebucket = (community)=>({
    community,
    communityPending:  community.filter(q=>(q.status||'pending')==='pending'),
    communityApproved: community.filter(q=>q.status==='approved'),
    communityRejected: community.filter(q=>q.status==='rejected'),
  });
  async function setCommStatus(id,status){
    setBusyId(id);
    try { await update(ref(db,`communityQuestions/${id}`),{status}); }
    catch(e){ console.error('community status failed:',e); }
    setStats(p=>p?{...p,...rebucket(p.community.map(q=>q.id===id?{...q,status}:q))}:p);
    setBusyId(null);
  }
  async function delComm(id){
    setBusyId(id);
    try { await remove(ref(db,`communityQuestions/${id}`)); }
    catch(e){ console.error('community delete failed:',e); }
    setStats(p=>p?{...p,...rebucket(p.community.filter(q=>q.id!==id))}:p);
    setBusyId(null);
  }
  async function saveCommEdit(){
    if(!editComm) return;
    const {id,q,a,unit}=editComm;
    const patch={q,a:a===''?null:Number(a),unit};
    setBusyId(id);
    try { await update(ref(db,`communityQuestions/${id}`),patch); }
    catch(e){ console.error('community edit failed:',e); }
    setStats(p=>p?{...p,...rebucket(p.community.map(x=>x.id===id?{...x,...patch}:x))}:p);
    setBusyId(null); setEditComm(null);
  }
  async function setBugStatus(id,status){
    setBusyId(id);
    try { await update(ref(db,`bugReports/${id}`),{status}); }
    catch(e){ console.error('bug status failed:',e); }
    setStats(p=>{ if(!p) return p;
      const bugs=p.bugs.map(b=>b.id===id?{...b,status}:b);
      return {...p,bugs,bugsOpen:bugs.filter(b=>(b.status||'open')==='open').length}; });
    setBusyId(null);
  }
  async function delBug(id){
    setBusyId(id);
    try { await remove(ref(db,`bugReports/${id}`)); }
    catch(e){ console.error('bug delete failed:',e); }
    setStats(p=>{ if(!p) return p;
      const bugs=p.bugs.filter(b=>b.id!==id);
      return {...p,bugs,bugsOpen:bugs.filter(b=>(b.status||'open')==='open').length}; });
    setBusyId(null);
  }

  // Look up the playable question text for a given community/stats id (for bug context)
  const lookupQ = (id)=>{
    const allQs = Object.values(QUESTIONS_RAW?.adult||{}).flatMap(c=>c.questions||[])
      .concat(Object.values(QUESTIONS_RAW?.kids||{}).flatMap(c=>c.questions||[]));
    return allQs.find(x=>x.id===id);
  };

  const StatCard = ({label,value,sub,color})=>(
    <div style={{background:surface,borderRadius:12,padding:'14px 16px',
      border:`1px solid ${border}`,flex:1,minWidth:120}}>
      <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 6px'}}>{label}</p>
      <p style={{fontSize:28,fontWeight:900,color:color||t.text,margin:0,fontFamily:t.fontTitle}}>{value}</p>
      {sub&&<p style={{fontSize:11,color:muted,margin:'4px 0 0'}}>{sub}</p>}
    </div>
  );

  const Bar = ({label,value,max,color})=>(
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:12,color:t.text}}>{label}</span>
        <span style={{fontSize:12,color:color||accent,fontWeight:700}}>{value}</span>
      </div>
      <div style={{height:6,background:border,borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',background:color||accent,borderRadius:3,
          width:`${Math.min(100,(value/Math.max(max,1))*100)}%`,transition:'width .4s'}}/>
      </div>
    </div>
  );

  const actBtn = (c)=>({padding:'6px 11px',borderRadius:8,border:`1px solid ${c}`,
    background:c+'18',color:c,fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:t.fontBody});
  const inpStyle = {background:'#0d0805',color:t.text,border:`1px solid ${border}`,
    borderRadius:8,padding:'8px',fontSize:13,fontFamily:t.fontBody};

  // ── #3 Zeitverlauf: Sessions in Buckets passend zum gewählten Zeitraum ──
  const DAY=86400000;
  const startOfDay=(d)=>{const x=new Date(d);x.setHours(0,0,0,0);return x.getTime();};
  function buildSeries(sessions, range){
    const now=Date.now();
    let buckets=[]; let unit='day';
    if(range==='14d'||range==='30d'){
      unit='day';
      const n=range==='14d'?14:30; const today=startOfDay(now);
      for(let k=n-1;k>=0;k--){const t0=today-k*DAY; buckets.push({t0,t1:t0+DAY,count:0,label:new Date(t0)});}
    } else if(range==='6m'){
      unit='week';
      const today=startOfDay(now);
      for(let k=25;k>=0;k--){const t0=today-k*7*DAY; buckets.push({t0,t1:t0+7*DAY,count:0,label:new Date(t0)});}
    } else if(range==='1y'){
      unit='month';
      const base=new Date(now); base.setDate(1); base.setHours(0,0,0,0);
      for(let k=11;k>=0;k--){
        const m=new Date(base.getFullYear(),base.getMonth()-k,1);
        const m1=new Date(base.getFullYear(),base.getMonth()-k+1,1);
        buckets.push({t0:m.getTime(),t1:m1.getTime(),count:0,label:m});
      }
    } else { // all – Monatsbuckets ab erster Session
      unit='month';
      if(!sessions.length) return {buckets:[],unit};
      const minTs=sessions.reduce((m,s)=>Math.min(m,s.ts||now),now);
      let cur=new Date(minTs); cur=new Date(cur.getFullYear(),cur.getMonth(),1);
      const end=new Date(now);
      while(cur<=end){
        const next=new Date(cur.getFullYear(),cur.getMonth()+1,1);
        buckets.push({t0:cur.getTime(),t1:next.getTime(),count:0,label:new Date(cur)});
        cur=next;
      }
    }
    for(const s of sessions){
      const ts=s.ts; if(ts==null) continue;
      for(const b of buckets){ if(ts>=b.t0&&ts<b.t1){b.count++;break;} }
    }
    return {buckets,unit};
  }
  const fmtTick=(date,unit)=>{
    if(unit==='month') return date.toLocaleDateString('de-DE',{month:'short',year:'2-digit'});
    return date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
  };

  async function cleanupRooms(){
    const HOURS=6;
    if(!window.confirm(`Alle Spielräume löschen, die älter als ${HOURS} Stunden sind?\n(Laufende/aktuelle Räume bleiben erhalten.)`)) return;
    setCleanupBusy(true);
    try{
      const snap=await get(ref(db,'rooms'));
      const rooms=snap.val()||{};
      const cutoff=Date.now()-HOURS*3600*1000;
      const updates={}; let n=0, total=0;
      Object.entries(rooms).forEach(([id,r])=>{
        total++;
        const created=(r&&r.createdAt)?r.createdAt:0; // ohne createdAt = Altbestand → löschen
        if(created<cutoff){ updates['rooms/'+id]=null; n++; }
      });
      if(n>0) await update(ref(db),updates);
      window.alert(`${n} von ${total} Räumen gelöscht (älter als ${HOURS}h).`);
    }catch(e){
      console.error('room cleanup failed:',e);
      window.alert('Aufräumen fehlgeschlagen. Sind die aktuellen Firebase-Rules deployed?');
    }
    setCleanupBusy(false);
  }

  return <div style={{...page,paddingBottom:40,animation:'fu .3s ease both'}}>
    {/* Header */}
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:muted,
        fontSize:20,cursor:'pointer',padding:0}}>←</button>
      <div style={{flex:1}}>
        <h2 style={{fontFamily:t.fontTitle,fontSize:28,margin:0,color:t.text}}>
          Admin Dashboard
        </h2>
        <p style={{fontSize:11,color:muted,margin:0}}>EstiMates Analytics</p>
      </div>
      <button onClick={cleanupRooms} disabled={cleanupBusy}
        title="Alte Spielräume aus der Datenbank löschen"
        style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:100,
          background:'none',border:`1.5px solid ${accent}66`,color:accent,fontSize:12,fontWeight:700,
          cursor:cleanupBusy?'default':'pointer',opacity:cleanupBusy?.5:1,fontFamily:t.fontBody,flexShrink:0}}>
        🧹 {cleanupBusy?'Räume…':'Räume aufräumen'}
      </button>
    </div>

    {/* Tab bar */}
    <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
      {[
        {id:'overview',label:'Übersicht'},
        {id:'accounts',label:'Accounts'},
        {id:'community',label:'Community'+(stats?.communityPending?.length?` (${stats.communityPending.length})`:'')},
        {id:'bugs',label:'Bugs'+(stats?.bugsOpen?` (${stats.bugsOpen})`:'')},
        {id:'ratings',label:'Bewertungen'},
        {id:'feedback',label:'Feedback'},
        {id:'categories',label:'Kategorien'},
        {id:'questions',label:'Fragen'},
        {id:'regions',label:'Regionen'},
      ].map(tb=>(
        <button key={tb.id} onClick={()=>setTab(tb.id)}
          style={{padding:'6px 14px',borderRadius:100,fontSize:12,fontWeight:700,
            cursor:'pointer',border:`1.5px solid ${tab===tb.id?accent:border}`,
            background:tab===tb.id?accent+'22':'none',
            color:tab===tb.id?accent:muted,fontFamily:t.fontBody}}>
          {tb.label}
        </button>
      ))}
    </div>

    {loading&&<div style={{textAlign:'center',padding:40}}><Spinner t={t}/></div>}

    {!loading&&stats&&<>

      {/* ── ÜBERSICHT ── */}
      {tab==='overview'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <StatCard label="SESSIONS TOTAL" value={stats.totalSessions} color={accent}/>
          <StatCard label="AVG GRUPPE" value={stats.avgGroupSize+'P'} color={t.gold}/>
          <StatCard label="BEWERTUNGEN" value={stats.totalRatings} color={green}/>
        </div>

        {/* #3 Traktion + #5 Account-Headline */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <StatCard label="SESSIONS 7 TAGE" value={stats.last7} color={accent}
            sub={stats.delta7!=null?`${stats.delta7>=0?'▲':'▼'} ${Math.abs(stats.delta7)}% vs. Vorwoche`:'keine Vorwoche'}/>
          <StatCard label="ACCOUNTS" value={stats.totalUsers} color={t.gold}
            sub={`${stats.registered} registriert · ${stats.anonUsers} anon`}/>
          <StatCard label="AKTIV 7 TAGE" value={stats.active7} color={green}
            sub={`${stats.newUsers7} neu · ${stats.returning} wiederkehrend`}/>
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            flexWrap:'wrap',gap:8,marginBottom:12}}>
            <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:0}}>
              SESSIONS · VERLAUF
            </p>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {[
                {id:'14d',label:'14 T.'},
                {id:'30d',label:'1 Mon.'},
                {id:'6m',label:'6 Mon.'},
                {id:'1y',label:'1 Jahr'},
                {id:'all',label:'Total'},
              ].map(r=>(
                <button key={r.id} onClick={()=>setRange(r.id)}
                  style={{padding:'4px 9px',borderRadius:100,fontSize:10,fontWeight:700,cursor:'pointer',
                    border:`1.5px solid ${range===r.id?accent:border}`,
                    background:range===r.id?accent+'22':'none',
                    color:range===r.id?accent:muted,fontFamily:t.fontBody}}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {(()=>{
            const {buckets,unit}=buildSeries(stats.sessions||[],range);
            if(!buckets.length) return <p style={{fontSize:12,color:muted,margin:0}}>Noch keine Daten.</p>;
            const mx=Math.max(1,...buckets.map(b=>b.count));
            const total=buckets.reduce((s,b)=>s+b.count,0);
            const unitLbl=unit==='day'?'Tag':unit==='week'?'Woche':'Monat';
            // bis zu 6 X-Achsen-Ticks gleichmäßig verteilt
            const tickN=Math.min(6,buckets.length);
            const tickIdx=new Set();
            for(let k=0;k<tickN;k++) tickIdx.add(Math.round(k*(buckets.length-1)/Math.max(1,tickN-1)));
            return <>
              <p style={{fontSize:10,color:muted,margin:'0 0 8px'}}>
                {total} Sessions · pro {unitLbl} · {buckets.length} Balken
              </p>
              <div style={{display:'flex',alignItems:'flex-end',gap:buckets.length>40?1:3,height:64}}>
                {buckets.map((b,idx)=>(
                  <div key={idx} title={fmtTick(b.label,unit)+': '+b.count}
                    style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',height:'100%'}}>
                    <div style={{height:`${Math.max(2,(b.count/mx)*100)}%`,
                      background:idx===buckets.length-1?accent:accent+'88',
                      borderRadius:'2px 2px 0 0',transition:'height .3s'}}/>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',marginTop:6}}>
                {buckets.map((b,idx)=>(
                  <div key={idx} style={{flex:1,textAlign:'center',overflow:'visible'}}>
                    {tickIdx.has(idx)&&<span style={{fontSize:9,color:muted,whiteSpace:'nowrap'}}>
                      {fmtTick(b.label,unit)}
                    </span>}
                  </div>
                ))}
              </div>
            </>;
          })()}
        </div>

        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <StatCard label="AVG STERNE" value={stats.avgStars+'★'} color={t.gold}
            sub={`Host: ${stats.avgHost}★ · Guest: ${stats.avgGuest}★`}/>
          <StatCard label="NPS SCORE"
            value={stats.nps!=null?stats.nps:'–'}
            color={stats.nps>=50?green:stats.nps>=0?gold:accent}
            sub={`${stats.promoters} Prom. · ${stats.detractors} Det.`}/>
          <StatCard label="SKIP RATE" value={stats.skipRate+'%'} color={muted}
            sub={`${stats.totalRatings-stats.rated.length} übersprungen`}/>
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            PLATTFORM
          </p>
          {Object.entries(stats.byPlatform).map(([k,v])=>(
            <Bar key={k} label={k} value={v}
              max={Math.max(...Object.values(stats.byPlatform))}/>
          ))}
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            GRUPPENGRÖSSE
          </p>
          {Object.entries(stats.byGroupSize).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>(
            <Bar key={k} label={k+'P'} value={v}
              max={Math.max(...Object.values(stats.byGroupSize))} color={t.gold}/>
          ))}
        </div>
      </div>}

      {/* ── BEWERTUNGEN ── */}
      {tab==='ratings'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <StatCard label="AVG STERNE" value={stats.avgStars+'★'} color={t.gold}/>
          <StatCard label="NPS" value={stats.nps!=null?stats.nps:'–'}
            color={stats.nps>=50?green:stats.nps>=0?gold:accent}/>
        </div>
        {/* Stars distribution */}
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            STERNE VERTEILUNG
          </p>
          {[5,4,3,2,1].map(s=>{
            const count=stats.rated.filter(r=>r.stars===s).length;
            return <Bar key={s} label={'★'.repeat(s)} value={count}
              max={stats.rated.length} color={s>=4?gold:s>=3?accent:muted}/>;
          })}
        </div>
        {/* NPS distribution */}
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            NPS VERTEILUNG
          </p>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            <div style={{flex:1,background:green+'22',borderRadius:8,padding:'8px',textAlign:'center'}}>
              <p style={{fontSize:20,fontWeight:900,color:green,margin:0}}>{stats.promoters}</p>
              <p style={{fontSize:10,color:muted,margin:0}}>Promotoren (9-10)</p>
            </div>
            <div style={{flex:1,background:t.gold+'22',borderRadius:8,padding:'8px',textAlign:'center'}}>
              <p style={{fontSize:20,fontWeight:900,color:gold,margin:0}}>{stats.npsRatings.filter(r=>r.nps>=7&&r.nps<=8).length}</p>
              <p style={{fontSize:10,color:muted,margin:0}}>Passive (7-8)</p>
            </div>
            <div style={{flex:1,background:accent+'22',borderRadius:8,padding:'8px',textAlign:'center'}}>
              <p style={{fontSize:20,fontWeight:900,color:accent,margin:0}}>{stats.detractors}</p>
              <p style={{fontSize:10,color:muted,margin:0}}>Detraktoren (0-6)</p>
            </div>
          </div>
          {[...Array(11)].map((_,n)=>{
            const count=stats.npsRatings.filter(r=>r.nps===n).length;
            return <Bar key={n} label={String(n)} value={count}
              max={stats.npsRatings.length}
              color={n>=9?green:n>=7?gold:accent}/>;
          })}
        </div>
        {/* By role */}
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            HOST vs. GAST
          </p>
          <div style={{display:'flex',gap:10}}>
            <StatCard label="HOST AVG" value={stats.avgHost+'★'} color={t.gold}/>
            <StatCard label="GAST AVG" value={stats.avgGuest+'★'} color={accent}/>
          </div>
        </div>
      </div>}

      {/* ── REGIONEN ── */}
      {tab==='regions'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            NACH SPRACHE
          </p>
          {Object.entries(stats.byLang).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
            <Bar key={k} label={k.toUpperCase()} value={v}
              max={Math.max(...Object.values(stats.byLang))} color={accent}/>
          ))}
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            NACH REGION (TIMEZONE)
          </p>
          {Object.entries(stats.byRegion).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
            <Bar key={k} label={k} value={v}
              max={Math.max(...Object.values(stats.byRegion))} color={t.gold}/>
          ))}
        </div>
      </div>}

      {/* ── KATEGORIEN ── */}
      {tab==='categories'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            BELIEBTESTE KATEGORIEN
          </p>
          {stats.categories.map(c=>(
            <Bar key={c.name} label={c.name} value={c.plays||0}
              max={stats.categories[0]?.plays||1} color={accent}/>
          ))}
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            BELIEBTESTE KOMBINATIONEN
          </p>
          {stats.pairs.map(p=>(
            <Bar key={p.pair} label={p.pair} value={p.count||0}
              max={stats.pairs[0]?.count||1} color={t.gold}/>
          ))}
        </div>
      </div>}

      {/* ── FEEDBACK ── */}
      {tab==='feedback'&&(()=>{
        const fbFiltered=stats.feedbacks.filter(f=>{
          if(fbStarFilter && f.stars!==fbStarFilter) return false;
          if(fbNpsFilter!=='all'){
            if(f.nps==null) return false;
            if(fbNpsFilter==='promoter' && f.nps<9) return false;
            if(fbNpsFilter==='passive' && !(f.nps>=7&&f.nps<=8)) return false;
            if(fbNpsFilter==='detractor' && f.nps>6) return false;
          }
          return true;
        });
        const fbSorted=[...fbFiltered].sort((a,b)=>{
          switch(fbSort){
            case 'oldest': return (a.ts||0)-(b.ts||0);
            case 'best':   return (b.stars||0)-(a.stars||0) || (b.ts||0)-(a.ts||0);
            case 'worst':  return (a.stars||0)-(b.stars||0) || (b.ts||0)-(a.ts||0);
            case 'region': return String(a.region||'').localeCompare(String(b.region||'')) || (b.ts||0)-(a.ts||0);
            default:       return (b.ts||0)-(a.ts||0);
          }
        });
        return <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',margin:'0 0 4px'}}>
          <p style={{fontSize:11,color:muted,margin:0}}>
            {fbFiltered.length===stats.feedbacks.length
              ? `${stats.feedbacks.length} ${stats.feedbacks.length===1?'Bewertung':'Bewertungen'} gesamt`
              : `${fbFiltered.length} von ${stats.feedbacks.length} Bewertungen`}
          </p>
          <select value={fbSort} onChange={e=>setFbSort(e.target.value)}
            style={{padding:'6px 10px',background:surface,border:`1.5px solid ${border}`,
              borderRadius:8,color:t.text,fontSize:12,fontWeight:600,cursor:'pointer',
              fontFamily:t.fontBody,appearance:'none',paddingRight:26,
              backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236e5e54' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center'}}>
            <option value="newest">Neueste zuerst</option>
            <option value="oldest">Älteste zuerst</option>
            <option value="best">Beste zuerst (★)</option>
            <option value="worst">Schlechteste zuerst (★)</option>
            <option value="region">Nach Region</option>
          </select>
        </div>
        {/* Filter: Sterne */}
        <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:10,color:muted,fontWeight:700,marginRight:2}}>★</span>
          {[{v:0,l:'Alle'},{v:5,l:'5★'},{v:4,l:'4★'},{v:3,l:'3★'},{v:2,l:'2★'},{v:1,l:'1★'}].map(o=>(
            <button key={o.v} onClick={()=>setFbStarFilter(o.v)}
              style={{padding:'4px 9px',borderRadius:100,fontSize:10,fontWeight:700,cursor:'pointer',
                border:`1.5px solid ${fbStarFilter===o.v?gold:border}`,
                background:fbStarFilter===o.v?gold+'22':'none',
                color:fbStarFilter===o.v?gold:muted,fontFamily:t.fontBody}}>{o.l}</button>
          ))}
        </div>
        {/* Filter: NPS */}
        <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:10,color:muted,fontWeight:700,marginRight:2}}>NPS</span>
          {[{v:'all',l:'Alle'},{v:'promoter',l:'Promotoren 9–10'},{v:'passive',l:'Passive 7–8'},{v:'detractor',l:'Detraktoren 0–6'}].map(o=>{
            const c=o.v==='promoter'?green:o.v==='detractor'?accent:muted;
            return <button key={o.v} onClick={()=>setFbNpsFilter(o.v)}
              style={{padding:'4px 9px',borderRadius:100,fontSize:10,fontWeight:700,cursor:'pointer',
                border:`1.5px solid ${fbNpsFilter===o.v?c:border}`,
                background:fbNpsFilter===o.v?c+'22':'none',
                color:fbNpsFilter===o.v?c:muted,fontFamily:t.fontBody}}>{o.l}</button>;
          })}
        </div>
        {fbSorted.length===0&&<div style={{background:surface,borderRadius:10,
          padding:'20px',textAlign:'center',border:`1px solid ${border}`}}>
          <p style={{color:muted,fontSize:13}}>{stats.feedbacks.length===0?'Noch keine Feedback-Kommentare.':'Keine Bewertungen für diesen Filter.'}</p>
        </div>}
        {fbSorted.map((f,idx)=>{
          const date=f.ts?new Date(f.ts).toLocaleDateString('de-DE',{
            day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
          }):'–';
          return <div key={idx} style={{background:surface,borderRadius:10,
            padding:'12px 14px',border:`1px solid ${f.stars&&f.stars<3?accent+'55':border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {f.stars&&<span style={{color:gold,fontSize:13,fontWeight:700}}>
                  {'★'.repeat(f.stars)}{'☆'.repeat(5-f.stars)}
                </span>}
                {f.nps!=null&&<span style={{fontSize:11,color:f.nps>=7?green:accent,
                  fontWeight:700,background:f.nps>=7?green+'22':accent+'22',
                  padding:'2px 6px',borderRadius:100}}>
                  NPS {f.nps}
                </span>}
                <span style={{fontSize:10,color:muted,background:border,
                  padding:'2px 6px',borderRadius:100}}>
                  {f.role||'?'}
                </span>
              </div>
              <span style={{fontSize:10,color:muted}}>{date}</span>
            </div>
            <p style={{fontSize:13,color:t.text,margin:0,lineHeight:1.5,
              fontStyle:'italic'}}>"{f.comment}"</p>
            <div style={{display:'flex',gap:8,marginTop:6}}>
              {f.lang&&<span style={{fontSize:10,color:muted}}>{f.lang.toUpperCase()}</span>}
              {f.region&&<span style={{fontSize:10,color:muted}}>{f.region}</span>}
              {f.groupSize&&<span style={{fontSize:10,color:muted}}>{f.groupSize}P</span>}
            </div>
          </div>;
        })}
      </div>;
      })()}

      {/* ── FRAGEN ── */}
      {/* ── #1 COMMUNITY-MODERATION ── */}
      {tab==='community'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[
            {id:'pending',label:`Offen (${stats.communityPending.length})`,c:t.gold},
            {id:'approved',label:`Frei (${stats.communityApproved.length})`,c:green},
            {id:'rejected',label:`Abgelehnt (${stats.communityRejected.length})`,c:accent},
            {id:'all',label:`Alle (${stats.community.length})`,c:muted},
          ].map(f=>(
            <button key={f.id} onClick={()=>setCommFilter(f.id)}
              style={{padding:'5px 12px',borderRadius:100,fontSize:11,fontWeight:700,cursor:'pointer',
                border:`1.5px solid ${commFilter===f.id?f.c:border}`,
                background:commFilter===f.id?f.c+'22':'none',
                color:commFilter===f.id?f.c:muted,fontFamily:t.fontBody}}>
              {f.label}
            </button>
          ))}
        </div>
        {(()=>{
          const list = commFilter==='pending'?stats.communityPending
            : commFilter==='approved'?stats.communityApproved
            : commFilter==='rejected'?stats.communityRejected
            : stats.community;
          if(!list.length) return <div style={{background:surface,borderRadius:10,padding:'20px',
            textAlign:'center',border:`1px solid ${border}`}}>
            <p style={{color:muted,fontSize:13,margin:0}}>Keine Fragen in dieser Ansicht.</p></div>;
          return list.map(q=>{
            const st=q.status||'pending';
            const stColor=st==='approved'?green:st==='rejected'?accent:t.gold;
            const busy=busyId===q.id;
            const date=q.createdAt?new Date(q.createdAt).toLocaleDateString('de-DE',
              {day:'2-digit',month:'2-digit',year:'numeric'}):'–';
            if(editComm&&editComm.id===q.id){
              return <div key={q.id} style={{background:surface,borderRadius:10,padding:'12px 14px',
                border:`1px solid ${t.gold}55`}}>
                <textarea value={editComm.q} onChange={e=>setEditComm({...editComm,q:e.target.value})}
                  rows={2} style={{...inpStyle,width:'100%',boxSizing:'border-box',resize:'vertical'}}/>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <input value={editComm.a} onChange={e=>setEditComm({...editComm,a:e.target.value})}
                    placeholder="Antwort" inputMode="decimal" style={{...inpStyle,flex:1,minWidth:0}}/>
                  <input value={editComm.unit} onChange={e=>setEditComm({...editComm,unit:e.target.value})}
                    placeholder="Einheit" style={{...inpStyle,flex:1,minWidth:0}}/>
                </div>
                <div style={{display:'flex',gap:8,marginTop:10}}>
                  <button onClick={saveCommEdit} disabled={busy}
                    style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:green,color:'#04210f',
                      fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:t.fontBody}}>Speichern</button>
                  <button onClick={()=>setEditComm(null)} disabled={busy}
                    style={{flex:1,padding:'8px',borderRadius:8,border:`1px solid ${border}`,background:'none',
                      color:muted,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:t.fontBody}}>Abbrechen</button>
                </div>
              </div>;
            }
            return <div key={q.id} style={{background:surface,borderRadius:10,padding:'12px 14px',
              border:`1px solid ${st==='pending'?t.gold+'44':border}`,opacity:busy?.5:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:10,fontWeight:700,color:stColor,background:stColor+'22',
                  padding:'2px 8px',borderRadius:100,textTransform:'uppercase'}}>{st}</span>
                <span style={{fontSize:10,color:muted}}>{date}{q.lang?' · '+q.lang.toUpperCase():''}</span>
              </div>
              <p style={{fontSize:13,color:t.text,margin:'0 0 4px',fontWeight:600,lineHeight:1.4}}>
                {q.emoji?q.emoji+' ':''}{q.q}
              </p>
              <p style={{fontSize:12,color:accent,fontWeight:700,margin:'0 0 2px'}}>
                Antwort: {q.a!=null?q.a:'–'} {q.unit||''}
              </p>
              {q.hint&&<p style={{fontSize:11,color:muted,margin:'2px 0 0',fontStyle:'italic'}}>{q.hint}</p>}
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
                {st!=='approved'&&<button onClick={()=>setCommStatus(q.id,'approved')} disabled={busy} style={actBtn(green)}>✓ Freigeben</button>}
                {st!=='rejected'&&<button onClick={()=>setCommStatus(q.id,'rejected')} disabled={busy} style={actBtn(accent)}>✕ Ablehnen</button>}
                <button onClick={()=>setEditComm({id:q.id,q:q.q||'',a:q.a!=null?String(q.a):'',unit:q.unit||''})} disabled={busy} style={actBtn(t.gold)}>✎ Bearbeiten</button>
                <button onClick={()=>delComm(q.id)} disabled={busy} style={actBtn(muted)}>🗑</button>
              </div>
            </div>;
          });
        })()}
      </div>}

      {/* ── #2 BUG-REPORTS ── */}
      {tab==='bugs'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
        <p style={{fontSize:11,color:muted,margin:'0 0 4px'}}>
          {stats.bugsOpen} offen · {stats.bugs.length} gesamt
        </p>
        {!stats.bugs.length&&<div style={{background:surface,borderRadius:10,padding:'20px',
          textAlign:'center',border:`1px solid ${border}`}}>
          <p style={{color:muted,fontSize:13,margin:0}}>Keine Bug-Reports.</p></div>}
        {stats.bugs.map(b=>{
          const busy=busyId===b.id;
          const open=(b.status||'open')==='open';
          const date=b.ts?new Date(b.ts).toLocaleDateString('de-DE',
            {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'–';
          const qObj=b.qId?lookupQ(b.qId):null;
          return <div key={b.id} style={{background:surface,borderRadius:10,padding:'12px 14px',
            border:`1px solid ${open?accent+'44':border}`,opacity:busy?.5:1}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:10,fontWeight:700,color:open?accent:green,
                background:(open?accent:green)+'22',padding:'2px 8px',borderRadius:100,
                textTransform:'uppercase'}}>{open?'offen':'erledigt'}</span>
              <span style={{fontSize:10,color:muted}}>{date}{b.lang?' · '+b.lang.toUpperCase():''}</span>
            </div>
            <p style={{fontSize:13,color:t.text,margin:'0 0 4px',fontWeight:600,lineHeight:1.4}}>
              {b.q||qObj?.q||'(ohne Fragetext)'}
            </p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:8}}>
              {b.a!=null&&<span style={{fontSize:11,color:accent}}>App-Antwort: {b.a} {b.unit||''}</span>}
              {b.qId&&<span style={{fontSize:10,color:muted,fontFamily:'monospace'}}>{b.qId}</span>}
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setBugStatus(b.id,open?'resolved':'open')} disabled={busy}
                style={actBtn(open?green:t.gold)}>{open?'✓ Erledigt':'↩ Wieder öffnen'}</button>
              <button onClick={()=>delBug(b.id)} disabled={busy} style={actBtn(muted)}>🗑</button>
            </div>
          </div>;
        })}
      </div>}

      {/* ── #5 ACCOUNTS ── */}
      {tab==='accounts'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <StatCard label="ACCOUNTS" value={stats.totalUsers} color={t.gold}/>
          <StatCard label="REGISTRIERT" value={stats.registered} color={green}
            sub={stats.totalUsers?Math.round(stats.registered/stats.totalUsers*100)+'%':'–'}/>
          <StatCard label="ANONYM" value={stats.anonUsers} color={muted}/>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <StatCard label="AKTIV 7T" value={stats.active7} color={accent}/>
          <StatCard label="NEU 7T" value={stats.newUsers7} color={green}/>
          <StatCard label="WIEDERKEHREND" value={stats.returning} color={t.gold}
            sub={stats.totalUsers?Math.round(stats.returning/stats.totalUsers*100)+'%':'–'}/>
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            ACCOUNTS NACH SPRACHE
          </p>
          {Object.entries(stats.usersByLang).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
            <Bar key={k} label={k.toUpperCase()} value={v}
              max={Math.max(1,...Object.values(stats.usersByLang))} color={t.gold}/>
          ))}
          {!Object.keys(stats.usersByLang).length&&<p style={{fontSize:12,color:muted,margin:0}}>
            Noch keine Account-Daten.</p>}
        </div>
        <div style={{background:surface,borderRadius:12,padding:'14px 16px',border:`1px solid ${border}`}}>
          <p style={{fontSize:11,color:muted,fontWeight:700,letterSpacing:.8,margin:'0 0 10px'}}>
            ANMELDUNG NACH METHODE
          </p>
          {(()=>{
            const labels={google:'🔵 Google',apple:'🍎 Apple',email:'✉ E-Mail',anonymous:'👤 Anonym',other:'• Sonstige',unknown:'• Unbekannt'};
            const order=['google','apple','email','anonymous','other','unknown'];
            const entries=Object.entries(stats.usersByMethod||{})
              .sort((a,b)=>(order.indexOf(a[0])-order.indexOf(b[0]))||(b[1]-a[1]));
            const max=Math.max(1,...Object.values(stats.usersByMethod||{}));
            return entries.length
              ? entries.map(([k,v])=><Bar key={k} label={labels[k]||k} value={v} max={max}
                  color={k==='anonymous'?muted:k==='apple'?t.text:green}/>)
              : <p style={{fontSize:12,color:muted,margin:0}}>Noch keine Login-Daten.</p>;
          })()}
        </div>
        <p style={{fontSize:10,color:muted,margin:0,lineHeight:1.5}}>
          Hinweis: Account-Daten werden erst seit diesem Update erfasst (Heartbeat beim App-Start) –
          die Werte wachsen ab Deploy. Login-Methode wird pro Account beim Anmelden gespeichert.
        </p>
      </div>}

      {tab==='questions'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:4}}>
          {[
            {id:'played',label:'Meistgespielt'},
            {id:'hard',label:'Schwerste'},
            {id:'ambiguous',label:'Mehrdeutigste'},
            {id:'easy',label:'Leichteste'},
          ].map(s=>(
            <button key={s.id} onClick={()=>setQSort(s.id)}
              style={{padding:'5px 12px',borderRadius:100,fontSize:11,fontWeight:700,
                cursor:'pointer',border:`1.5px solid ${qSort===s.id?gold:border}`,
                background:qSort===s.id?t.gold+'22':'none',
                color:qSort===s.id?gold:muted,fontFamily:t.fontBody}}>
              {s.label}
            </button>
          ))}
        </div>
        <p style={{fontSize:11,color:muted,margin:'0 0 4px'}}>
          {qSort==='hard'&&'Höchster Difficulty-Score zuerst – Kandidaten zum Entschärfen.'}
          {qSort==='ambiguous'&&'Höchste Streuung (σ/Ø) zuerst – Frage evtl. unklar formuliert.'}
          {qSort==='easy'&&'Niedrigster Difficulty-Score zuerst.'}
          {qSort==='played'&&'Top 50 meistgespielte Fragen.'}
        </p>
        {(()=>{
          const arr=[...(stats.questionsAll||[])];
          let sorted;
          if(qSort==='hard') sorted=arr.filter(q=>q.difficulty!=null).sort((a,b)=>b.difficulty-a.difficulty);
          else if(qSort==='easy') sorted=arr.filter(q=>q.difficulty!=null).sort((a,b)=>a.difficulty-b.difficulty);
          else if(qSort==='ambiguous') sorted=arr.filter(q=>q.stdDev!=null&&q.avg).sort((a,b)=>(b.stdDev/Math.abs(b.avg))-(a.stdDev/Math.abs(a.avg)));
          else sorted=arr.sort((a,b)=>(b.count||0)-(a.count||0));
          return sorted.slice(0,50).map((q,idx)=>{
            const qObj=lookupQ(q.id);
            const cv=(q.stdDev!=null&&q.avg)?(q.stdDev/Math.abs(q.avg)):null;
            return <div key={q.id} style={{background:surface,borderRadius:10,
              padding:'10px 12px',border:`1px solid ${border}`}}>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{fontSize:11,color:muted,minWidth:24,fontFamily:'monospace',
                  flexShrink:0}}>{idx+1}.</span>
                <div style={{flex:1}}>
                  {qObj&&<p style={{fontSize:12,color:t.text,margin:'0 0 3px',fontWeight:600,
                    lineHeight:1.4}}>{qObj.q}</p>}
                  <p style={{fontSize:10,color:muted,margin:'0 0 4px',fontFamily:'monospace'}}>
                    {q.id}
                  </p>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:accent,fontWeight:700}}>
                      Ø {q.avg!=null?q.avg:'–'} {q.unit||qObj?.unit||''}
                    </span>
                    <span style={{fontSize:11,color:qSort==='ambiguous'?gold:muted,
                      fontWeight:qSort==='ambiguous'?700:400}}>
                      σ {q.stdDev!=null?q.stdDev:'–'}{cv!=null?` (cv ${cv.toFixed(2)})`:''}
                    </span>
                    <span style={{fontSize:11,color:t.gold}}>
                      {q.count||0}x
                    </span>
                    {q.difficulty!=null&&<span style={{fontSize:11,fontWeight:700,
                      color:q.difficulty>70?accent:q.difficulty>40?gold:green}}>
                      {q.difficulty}% schwer
                    </span>}
                  </div>
                </div>
              </div>
            </div>;
          });
        })()}
      </div>}

    </>}
  </div>;
}

/* ─── ANLASS-VORLAGEN ──────────────────────────────────── */
var OCCASION_TEMPLATES = {
  de: {
    geburtstag: { icon:'🎂', name:'🎂 Geburtstag', questions:[
      {q:'Wie viele Gäste sind heute hier?',a:30,unit:'Gäste',hint:'Zählt mal durch!',emoji:'🎉'},
      {q:'Wie alt wird das Geburtstagskind heute?',a:30,unit:'Jahre',hint:'Kein Schummeln!',emoji:'🎂'},
      {q:'Wie viele Kerzen stecken auf der Torte?',a:30,unit:'Kerzen',hint:'Feuergefahr!',emoji:'🕯️'},
      {q:'Wie viele Geschenke hat das Geburtstagskind bekommen?',a:12,unit:'Geschenke',hint:'Auspacken!',emoji:'🎁'},
      {q:'In welchem Jahr wurde das Geburtstagskind geboren?',a:1994,unit:'Jahr',hint:'Rechnen erlaubt',emoji:'📅'},
      {q:'Wie viel wog das Geburtstagskind bei der Geburt?',a:3400,unit:'Gramm',hint:'Ein Brocken!',emoji:'⚖️'},
      {q:'Wie viele Länder hat das Geburtstagskind schon bereist?',a:14,unit:'Länder',hint:'Fernweh',emoji:'✈️'},
      {q:'Wie viele Haustiere hatte das Geburtstagskind im Leben?',a:4,unit:'Haustiere',hint:'Inkl. Goldfisch',emoji:'🐾'},
      {q:'Wie viele Umzüge hat das Geburtstagskind hinter sich?',a:7,unit:'Umzüge',hint:'Kistenpacken',emoji:'📦'},
      {q:'Wie viele Jahre kennen sich Gastgeber und Geburtstagskind schon?',a:10,unit:'Jahre',hint:'Lange her',emoji:'🤝'},
      {q:'Wie viele Stücke Kuchen werden heute verputzt?',a:35,unit:'Stücke',hint:'Schätzt großzügig',emoji:'🍰'},
      {q:'Wie viele Luftballons hängen im Raum?',a:24,unit:'Ballons',hint:'Pust pust',emoji:'🎈'},
      {q:'Wie viele Geburtstagsnachrichten kamen heute aufs Handy?',a:47,unit:'Nachrichten',hint:'Ping ping ping',emoji:'📱'},
      {q:'Wie viele Geschwister hat das Geburtstagskind?',a:2,unit:'Geschwister',hint:'Familienbande',emoji:'👨‍👩‍👧‍👦'},
      {q:'Wie viele verschiedene Wohnungen hatte das Geburtstagskind schon?',a:6,unit:'Wohnungen',hint:'',emoji:'🏠'},
      {q:'Wie viele Tassen Kaffee trinkt das Geburtstagskind pro Tag?',a:4,unit:'Tassen',hint:'Wachmacher',emoji:'☕'},
      {q:'Wie viele Jahre ist das Geburtstagskind schon im aktuellen Job?',a:5,unit:'Jahre',hint:'',emoji:'💼'},
      {q:'Wie viele Paar Schuhe besitzt das Geburtstagskind?',a:18,unit:'Paar',hint:'Schrank voll',emoji:'👟'},
      {q:'Wie viele Kilometer ist das Geburtstagskind heute zur Party gereist?',a:0,unit:'km',hint:'Heimspiel?',emoji:'🚗'},
      {q:'Wie viele Stunden Schlaf hatte das Geburtstagskind letzte Nacht?',a:6,unit:'Stunden',hint:'Aufregung!',emoji:'😴'},
      {q:'Wie viel kostet die Geburtstagstorte heute?',a:45,unit:'Euro',hint:'Süße Investition',emoji:'💶'},
      {q:'Wie viele Minuten dauerte das längste Geburtstagsständchen?',a:3,unit:'Minuten',hint:'Happy Birthdaaay',emoji:'🎵'},
    ]},
    hochzeit: { icon:'💍', name:'💍 Hochzeit', questions:[
      {q:'Wie viele Gäste sind heute hier?',a:80,unit:'Gäste',hint:'Zählt durch!',emoji:'🥂'},
      {q:'In welchem Jahr haben sich die Brautleute kennengelernt?',a:2018,unit:'Jahr',hint:'Ein besonderer Tag',emoji:'💑'},
      {q:'Wie viele Monate hat die Hochzeitsplanung gedauert?',a:14,unit:'Monate',hint:'Stress pur',emoji:'📋'},
      {q:'Wie viele Kilometer liegen zwischen den Heimatorten der Brautleute?',a:120,unit:'km',hint:'Fernbeziehung?',emoji:'🗺️'},
      {q:'Wie viel kostet die Hochzeit insgesamt?',a:18000,unit:'Euro',hint:'Lieber nicht fragen',emoji:'💸'},
      {q:'Wie viele Gäste tanzen heute Abend auf der Tanzfläche?',a:45,unit:'Gäste',hint:'Party!',emoji:'💃'},
      {q:'Wie viele Stunden brauchte das Brautpaar heute für die Vorbereitung?',a:5,unit:'Stunden',hint:'Frühaufsteher',emoji:'⏰'},
      {q:'Wie viele Reden werden heute gehalten?',a:6,unit:'Reden',hint:'Taschentücher bereit',emoji:'🎤'},
      {q:'Wie viele Jahre sind die Brautleute schon zusammen?',a:7,unit:'Jahre',hint:'Lange her',emoji:'❤️'},
      {q:'Wie viele Blumen stecken im Brautstrauß?',a:24,unit:'Blumen',hint:'Duftend',emoji:'💐'},
      {q:'Wie viele Etagen hat die Hochzeitstorte?',a:4,unit:'Etagen',hint:'Süßer Turm',emoji:'🎂'},
      {q:'Wie viele Gäste reisen von weiter als 200 km an?',a:18,unit:'Gäste',hint:'Weltreisende',emoji:'✈️'},
      {q:'Wie viele Fotos werden heute geschossen?',a:1200,unit:'Fotos',hint:'Dauerblitz',emoji:'📸'},
      {q:'Wie viele Flaschen Sekt werden heute geleert?',a:60,unit:'Flaschen',hint:'Prost!',emoji:'🍾'},
      {q:'Wie viele Kinder sind unter den Gästen?',a:9,unit:'Kinder',hint:'Wuselig',emoji:'🧒'},
      {q:'Wie viele gemeinsame Reisen hatten die Brautleute schon?',a:15,unit:'Reisen',hint:'Weltenbummler',emoji:'🧳'},
      {q:'Wie viele Anläufe brauchte der Heiratsantrag?',a:1,unit:'Versuche',hint:'Volltreffer?',emoji:'💍'},
      {q:'Wie viele Lieder umfasst die Party-Playlist?',a:85,unit:'Lieder',hint:'Bis zum Morgen',emoji:'🎶'},
      {q:'Wie viele Minuten dauerte die Trauung?',a:35,unit:'Minuten',hint:'Ja-Wort inklusive',emoji:'⛪'},
      {q:'Wie viele Trauzeugen hat das Paar zusammen?',a:4,unit:'Trauzeugen',hint:'Vertrauenssache',emoji:'🤝'},
      {q:'Wie viele Jahre wollen die Brautleute mindestens zusammenbleiben?',a:70,unit:'Jahre',hint:'Optimistisch!',emoji:'👵'},
      {q:'Wie viele Tortenstücke bleiben am Ende übrig?',a:8,unit:'Stücke',hint:'Für morgen',emoji:'🍰'},
    ]},
    teamevent: { icon:'🏢', name:'🏢 Team-Event', questions:[
      {q:'Wie viele Mitarbeiter hat unser Unternehmen?',a:340,unit:'Mitarbeiter',hint:'Tendenz steigend',emoji:'🏢'},
      {q:'In welchem Jahr wurde das Unternehmen gegründet?',a:2008,unit:'Jahr',hint:'Der Anfang',emoji:'📅'},
      {q:'In wie vielen Ländern sind wir aktiv?',a:12,unit:'Länder',hint:'Global',emoji:'🌍'},
      {q:'Wie viele Tassen Kaffee trinkt das Team pro Woche?',a:210,unit:'Tassen',hint:'Koffein-Motor',emoji:'☕'},
      {q:'Wie viele E-Mails verschickt das Team an einem Tag?',a:480,unit:'E-Mails',hint:'Posteingang voll',emoji:'📧'},
      {q:'Wie viele Meetings hatte das Team letzte Woche?',a:27,unit:'Meetings',hint:'Hätte eine Mail sein können',emoji:'📆'},
      {q:'Wie viele Jahre ist der dienstälteste Kollege schon dabei?',a:16,unit:'Jahre',hint:'Urgestein',emoji:'🏅'},
      {q:'Wie viele verschiedene Nationalitäten arbeiten im Team?',a:8,unit:'Nationalitäten',hint:'Bunt gemischt',emoji:'🌐'},
      {q:'Wie viele Kilometer pendelt das Team zusammen pro Tag?',a:640,unit:'km',hint:'Stau garantiert',emoji:'🚗'},
      {q:'Wie viele Kekse verschwinden pro Woche aus der Küche?',a:150,unit:'Kekse',hint:'Heißhunger',emoji:'🍪'},
      {q:'Wie viele Projekte hat das Team dieses Jahr abgeschlossen?',a:23,unit:'Projekte',hint:'Geschafft',emoji:'✅'},
      {q:'Wie viele Bildschirme stehen im Büro?',a:95,unit:'Bildschirme',hint:'Doppelt sieht besser',emoji:'🖥️'},
      {q:'Wie viele Stockwerke hat unser Bürogebäude?',a:6,unit:'Stockwerke',hint:'Treppe oder Lift?',emoji:'🏬'},
      {q:'Wie viele Stunden verbringt das Team pro Woche in Calls?',a:88,unit:'Stunden',hint:'Mute-Taste',emoji:'🎧'},
      {q:'Wie viele Pflanzen stehen im Büro?',a:34,unit:'Pflanzen',hint:'Grünes Büro',emoji:'🪴'},
      {q:'Wie viele Kollegen haben heute Homeoffice?',a:11,unit:'Kollegen',hint:'Pyjama-Modus',emoji:'🏠'},
      {q:'Wie viele Geburtstage feiert das Team pro Jahr?',a:38,unit:'Geburtstage',hint:'Kuchen-Alarm',emoji:'🎂'},
      {q:'Wie viele Kaffeemaschinen gibt es im Gebäude?',a:5,unit:'Maschinen',hint:'Lebensader',emoji:'☕'},
      {q:'Wie viele Schritte geht das Team zusammen an einem Tag?',a:95000,unit:'Schritte',hint:'Marathon',emoji:'👟'},
      {q:'Wie viele Jahre Berufserfahrung hat das Team zusammen?',a:420,unit:'Jahre',hint:'Geballtes Wissen',emoji:'🧠'},
      {q:'Wie viele verschiedene Tools nutzt das Team täglich?',a:14,unit:'Tools',hint:'Tab-Chaos',emoji:'🛠️'},
      {q:'Wie viele Minuten dauert die längste tägliche Mittagspause?',a:75,unit:'Minuten',hint:'Wohlverdient',emoji:'🍽️'},
    ]},
    jga: { icon:'🍻', name:'🍻 Junggesellenabschied', questions:[
      {q:'Wie viele Leute sind heute beim JGA dabei?',a:12,unit:'Leute',hint:'Crew komplett',emoji:'🎉'},
      {q:'In welchem Jahr lernten sich die Hauptperson und der Partner kennen?',a:2017,unit:'Jahr',hint:'Lang her',emoji:'💑'},
      {q:'Wie viele Stunden dauert der heutige JGA insgesamt?',a:14,unit:'Stunden',hint:'Marathon',emoji:'⏱️'},
      {q:'Wie viele Drinks wird die Hauptperson heute trinken?',a:11,unit:'Drinks',hint:'Wasser nicht vergessen',emoji:'🍹'},
      {q:'Wie viele Kilometer legt die Gruppe heute zurück?',a:25,unit:'km',hint:'Tour de Stadt',emoji:'🚕'},
      {q:'Wie viel Geld gibt die Gruppe heute insgesamt aus?',a:850,unit:'Euro',hint:'Aua, Konto',emoji:'💸'},
      {q:'Wie viele Jahre kennen sich die besten Freunde schon?',a:18,unit:'Jahre',hint:'Dicke',emoji:'🤝'},
      {q:'Wie viele peinliche Aufgaben muss die Hauptperson heute erfüllen?',a:7,unit:'Aufgaben',hint:'Augen zu',emoji:'😳'},
      {q:'Wie viele Fremde werden heute angesprochen?',a:20,unit:'Fremde',hint:'Mutprobe',emoji:'🗣️'},
      {q:'Wie viele Selfies entstehen heute?',a:95,unit:'Selfies',hint:'Dauergrinsen',emoji:'🤳'},
      {q:'Wie viele Stunden Schlaf hatte die Hauptperson letzte Nacht?',a:5,unit:'Stunden',hint:'Vorfreude',emoji:'😴'},
      {q:'Wie viele verschiedene Locations besucht die Gruppe heute?',a:6,unit:'Locations',hint:'Hopping',emoji:'📍'},
      {q:'Wie viele Lieder werden heute lautstark mitgesungen?',a:14,unit:'Lieder',hint:'Schief, aber laut',emoji:'🎤'},
      {q:'Wie viele Shots gehen heute auf die Hauptperson?',a:9,unit:'Shots',hint:'Prost',emoji:'🥃'},
      {q:'Wie viele Tage sind es noch bis zur Hochzeit?',a:21,unit:'Tage',hint:'Countdown',emoji:'📆'},
      {q:'Wie viele Kostüm-Teile trägt die Hauptperson heute?',a:5,unit:'Teile',hint:'Verkleidet',emoji:'🎭'},
      {q:'Wie viele Nachrichten kommen heute in den Gruppen-Chat?',a:130,unit:'Nachrichten',hint:'Ping',emoji:'📱'},
      {q:'Wie viele Jahre ist die Hauptperson schon mit dem Partner zusammen?',a:6,unit:'Jahre',hint:'Bald für immer',emoji:'❤️'},
      {q:'Wie viele Tänze legt die Gruppe heute aufs Parkett?',a:12,unit:'Tänze',hint:'Moves',emoji:'💃'},
      {q:'Wie viele Bilder sind am Ende zu peinlich für Social Media?',a:15,unit:'Bilder',hint:'Geheimsache',emoji:'🙈'},
      {q:'Wie viele Kilometer ist die am weitesten angereiste Person gefahren?',a:320,unit:'km',hint:'Echter Freund',emoji:'🚗'},
      {q:'Wie viele Stunden bis die erste Person umfällt?',a:8,unit:'Stunden',hint:'Wer hält durch?',emoji:'🛌'},
    ]},
  },
  en: {
    geburtstag: { icon:'🎂', name:'🎂 Birthday', questions:[
      {q:'How many guests are here today?',a:30,unit:'guests',hint:'Count them!',emoji:'🎉'},
      {q:'How old is the birthday person turning today?',a:30,unit:'years',hint:'No cheating!',emoji:'🎂'},
      {q:'How many candles are on the cake?',a:30,unit:'candles',hint:'Fire hazard!',emoji:'🕯️'},
      {q:'How many gifts did the birthday person get?',a:12,unit:'gifts',hint:'Unwrap them!',emoji:'🎁'},
      {q:'In what year was the birthday person born?',a:1994,unit:'year',hint:'Math allowed',emoji:'📅'},
      {q:'How much did the birthday person weigh at birth?',a:3400,unit:'grams',hint:'A chunky one!',emoji:'⚖️'},
      {q:'How many countries has the birthday person visited?',a:14,unit:'countries',hint:'Wanderlust',emoji:'✈️'},
      {q:'How many pets has the birthday person had in life?',a:4,unit:'pets',hint:'Goldfish included',emoji:'🐾'},
      {q:'How many times has the birthday person moved house?',a:7,unit:'moves',hint:'Box packing',emoji:'📦'},
      {q:'How many years have the host and birthday person known each other?',a:10,unit:'years',hint:'A while',emoji:'🤝'},
      {q:'How many slices of cake will be eaten today?',a:35,unit:'slices',hint:'Estimate big',emoji:'🍰'},
      {q:'How many balloons are in the room?',a:24,unit:'balloons',hint:'Puff puff',emoji:'🎈'},
      {q:'How many birthday messages arrived on the phone today?',a:47,unit:'messages',hint:'Ping ping ping',emoji:'📱'},
      {q:'How many siblings does the birthday person have?',a:2,unit:'siblings',hint:'Family ties',emoji:'👨‍👩‍👧‍👦'},
      {q:'How many different homes has the birthday person lived in?',a:6,unit:'homes',hint:'',emoji:'🏠'},
      {q:'How many cups of coffee does the birthday person drink per day?',a:4,unit:'cups',hint:'Wake-up juice',emoji:'☕'},
      {q:'How many years has the birthday person been in their current job?',a:5,unit:'years',hint:'',emoji:'💼'},
      {q:'How many pairs of shoes does the birthday person own?',a:18,unit:'pairs',hint:'Full closet',emoji:'👟'},
      {q:'How many kilometers did the birthday person travel to the party today?',a:0,unit:'km',hint:'Home game?',emoji:'🚗'},
      {q:'How many hours of sleep did the birthday person get last night?',a:6,unit:'hours',hint:'Too excited!',emoji:'😴'},
      {q:'How much does the birthday cake cost today?',a:45,unit:'euros',hint:'Sweet investment',emoji:'💶'},
      {q:'How many minutes did the longest birthday song last?',a:3,unit:'minutes',hint:'Happy Birthdaaay',emoji:'🎵'},
    ]},
    hochzeit: { icon:'💍', name:'💍 Wedding', questions:[
      {q:'How many guests are here today?',a:80,unit:'guests',hint:'Count them!',emoji:'🥂'},
      {q:'In what year did the couple first meet?',a:2018,unit:'year',hint:'A special day',emoji:'💑'},
      {q:'How many months did the wedding planning take?',a:14,unit:'months',hint:'Pure stress',emoji:'📋'},
      {q:'How many kilometers lie between the couple\u2019s hometowns?',a:120,unit:'km',hint:'Long distance?',emoji:'🗺️'},
      {q:'How much does the wedding cost in total?',a:18000,unit:'euros',hint:'Better not ask',emoji:'💸'},
      {q:'How many guests will hit the dance floor tonight?',a:45,unit:'guests',hint:'Party!',emoji:'💃'},
      {q:'How many hours did the couple need to get ready today?',a:5,unit:'hours',hint:'Early birds',emoji:'⏰'},
      {q:'How many speeches will be given today?',a:6,unit:'speeches',hint:'Tissues ready',emoji:'🎤'},
      {q:'How many years has the couple been together?',a:7,unit:'years',hint:'A while',emoji:'❤️'},
      {q:'How many flowers are in the bridal bouquet?',a:24,unit:'flowers',hint:'Fragrant',emoji:'💐'},
      {q:'How many tiers does the wedding cake have?',a:4,unit:'tiers',hint:'Sweet tower',emoji:'🎂'},
      {q:'How many guests traveled more than 200 km?',a:18,unit:'guests',hint:'World travelers',emoji:'✈️'},
      {q:'How many photos will be taken today?',a:1200,unit:'photos',hint:'Constant flash',emoji:'📸'},
      {q:'How many bottles of sparkling wine will be emptied today?',a:60,unit:'bottles',hint:'Cheers!',emoji:'🍾'},
      {q:'How many children are among the guests?',a:9,unit:'children',hint:'Lively',emoji:'🧒'},
      {q:'How many trips has the couple taken together?',a:15,unit:'trips',hint:'Globetrotters',emoji:'🧳'},
      {q:'How many attempts did the proposal take?',a:1,unit:'attempts',hint:'Bullseye?',emoji:'💍'},
      {q:'How many songs are on the party playlist?',a:85,unit:'songs',hint:'Until morning',emoji:'🎶'},
      {q:'How many minutes did the ceremony last?',a:35,unit:'minutes',hint:'Vows included',emoji:'⛪'},
      {q:'How many witnesses does the couple have together?',a:4,unit:'witnesses',hint:'A matter of trust',emoji:'🤝'},
      {q:'How many years do the couple want to stay together at least?',a:70,unit:'years',hint:'Optimistic!',emoji:'👵'},
      {q:'How many cake slices will be left at the end?',a:8,unit:'slices',hint:'For tomorrow',emoji:'🍰'},
    ]},
    teamevent: { icon:'🏢', name:'🏢 Team Event', questions:[
      {q:'How many employees does our company have?',a:340,unit:'employees',hint:'Growing',emoji:'🏢'},
      {q:'In what year was the company founded?',a:2008,unit:'year',hint:'The beginning',emoji:'📅'},
      {q:'In how many countries are we active?',a:12,unit:'countries',hint:'Global',emoji:'🌍'},
      {q:'How many cups of coffee does the team drink per week?',a:210,unit:'cups',hint:'Caffeine engine',emoji:'☕'},
      {q:'How many emails does the team send in one day?',a:480,unit:'emails',hint:'Inbox full',emoji:'📧'},
      {q:'How many meetings did the team have last week?',a:27,unit:'meetings',hint:'Could\u2019ve been an email',emoji:'📆'},
      {q:'How many years has the longest-serving colleague been here?',a:16,unit:'years',hint:'Veteran',emoji:'🏅'},
      {q:'How many different nationalities work in the team?',a:8,unit:'nationalities',hint:'Diverse mix',emoji:'🌐'},
      {q:'How many kilometers does the team commute together per day?',a:640,unit:'km',hint:'Traffic guaranteed',emoji:'🚗'},
      {q:'How many cookies disappear from the kitchen per week?',a:150,unit:'cookies',hint:'Cravings',emoji:'🍪'},
      {q:'How many projects did the team finish this year?',a:23,unit:'projects',hint:'Done',emoji:'✅'},
      {q:'How many screens are in the office?',a:95,unit:'screens',hint:'Double is better',emoji:'🖥️'},
      {q:'How many floors does our office building have?',a:6,unit:'floors',hint:'Stairs or lift?',emoji:'🏬'},
      {q:'How many hours per week does the team spend in calls?',a:88,unit:'hours',hint:'Mute button',emoji:'🎧'},
      {q:'How many plants are in the office?',a:34,unit:'plants',hint:'Green office',emoji:'🪴'},
      {q:'How many colleagues work from home today?',a:11,unit:'colleagues',hint:'Pyjama mode',emoji:'🏠'},
      {q:'How many birthdays does the team celebrate per year?',a:38,unit:'birthdays',hint:'Cake alert',emoji:'🎂'},
      {q:'How many coffee machines are in the building?',a:5,unit:'machines',hint:'Lifeline',emoji:'☕'},
      {q:'How many steps does the team walk together in one day?',a:95000,unit:'steps',hint:'Marathon',emoji:'👟'},
      {q:'How many years of work experience does the team have combined?',a:420,unit:'years',hint:'Brain power',emoji:'🧠'},
      {q:'How many different tools does the team use daily?',a:14,unit:'tools',hint:'Tab chaos',emoji:'🛠️'},
      {q:'How many minutes is the longest daily lunch break?',a:75,unit:'minutes',hint:'Well deserved',emoji:'🍽️'},
    ]},
    jga: { icon:'🍻', name:'🍻 Stag/Hen Party', questions:[
      {q:'How many people are at the party today?',a:12,unit:'people',hint:'Crew complete',emoji:'🎉'},
      {q:'In what year did the guest of honor and their partner meet?',a:2017,unit:'year',hint:'Long ago',emoji:'💑'},
      {q:'How many hours will today\u2019s party last in total?',a:14,unit:'hours',hint:'Marathon',emoji:'⏱️'},
      {q:'How many drinks will the guest of honor have today?',a:11,unit:'drinks',hint:'Don\u2019t forget water',emoji:'🍹'},
      {q:'How many kilometers will the group cover today?',a:25,unit:'km',hint:'City tour',emoji:'🚕'},
      {q:'How much money will the group spend in total today?',a:850,unit:'euros',hint:'Ouch, the account',emoji:'💸'},
      {q:'How many years have the best friends known each other?',a:18,unit:'years',hint:'Tight crew',emoji:'🤝'},
      {q:'How many embarrassing tasks must the guest of honor complete today?',a:7,unit:'tasks',hint:'Eyes closed',emoji:'😳'},
      {q:'How many strangers will be approached today?',a:20,unit:'strangers',hint:'Dare',emoji:'🗣️'},
      {q:'How many selfies will be taken today?',a:95,unit:'selfies',hint:'Endless grins',emoji:'🤳'},
      {q:'How many hours of sleep did the guest of honor get last night?',a:5,unit:'hours',hint:'Too excited',emoji:'😴'},
      {q:'How many different locations will the group visit today?',a:6,unit:'locations',hint:'Hopping',emoji:'📍'},
      {q:'How many songs will be sung out loud today?',a:14,unit:'songs',hint:'Off-key but loud',emoji:'🎤'},
      {q:'How many shots will the guest of honor take today?',a:9,unit:'shots',hint:'Cheers',emoji:'🥃'},
      {q:'How many days until the wedding?',a:21,unit:'days',hint:'Countdown',emoji:'📆'},
      {q:'How many costume pieces is the guest of honor wearing today?',a:5,unit:'pieces',hint:'In disguise',emoji:'🎭'},
      {q:'How many messages land in the group chat today?',a:130,unit:'messages',hint:'Ping',emoji:'📱'},
      {q:'How many years has the guest of honor been with their partner?',a:6,unit:'years',hint:'Soon forever',emoji:'❤️'},
      {q:'How many dances will the group bust out today?',a:12,unit:'dances',hint:'Moves',emoji:'💃'},
      {q:'How many photos end up too embarrassing for social media?',a:15,unit:'photos',hint:'Top secret',emoji:'🙈'},
      {q:'How many kilometers did the person who traveled farthest drive?',a:320,unit:'km',hint:'True friend',emoji:'🚗'},
      {q:'How many hours until the first person taps out?',a:8,unit:'hours',hint:'Who lasts?',emoji:'🛌'},
    ]},
  },
  es: {
    geburtstag: { icon:'🎂', name:'🎂 Cumpleaños', questions:[
      {q:'¿Cuántos invitados hay hoy aquí?',a:30,unit:'invitados',hint:'¡A contar!',emoji:'🎉'},
      {q:'¿Cuántos años cumple hoy la persona homenajeada?',a:30,unit:'años',hint:'¡Sin trampas!',emoji:'🎂'},
      {q:'¿Cuántas velas hay en la tarta?',a:30,unit:'velas',hint:'¡Peligro de fuego!',emoji:'🕯️'},
      {q:'¿Cuántos regalos ha recibido la persona homenajeada?',a:12,unit:'regalos',hint:'¡A abrir!',emoji:'🎁'},
      {q:'¿En qué año nació la persona homenajeada?',a:1994,unit:'año',hint:'Se permite calcular',emoji:'📅'},
      {q:'¿Cuánto pesó la persona homenajeada al nacer?',a:3400,unit:'gramos',hint:'¡Buen tamaño!',emoji:'⚖️'},
      {q:'¿Cuántos países ha visitado la persona homenajeada?',a:14,unit:'países',hint:'Ganas de viajar',emoji:'✈️'},
      {q:'¿Cuántas mascotas ha tenido en su vida?',a:4,unit:'mascotas',hint:'Pez incluido',emoji:'🐾'},
      {q:'¿Cuántas mudanzas ha hecho la persona homenajeada?',a:7,unit:'mudanzas',hint:'A empacar cajas',emoji:'📦'},
      {q:'¿Cuántos años se conocen el anfitrión y la persona homenajeada?',a:10,unit:'años',hint:'Hace tiempo',emoji:'🤝'},
      {q:'¿Cuántas porciones de tarta se comerán hoy?',a:35,unit:'porciones',hint:'Calcula generoso',emoji:'🍰'},
      {q:'¿Cuántos globos hay en la sala?',a:24,unit:'globos',hint:'Sopla sopla',emoji:'🎈'},
      {q:'¿Cuántos mensajes de cumpleaños llegaron hoy al móvil?',a:47,unit:'mensajes',hint:'Ping ping ping',emoji:'📱'},
      {q:'¿Cuántos hermanos tiene la persona homenajeada?',a:2,unit:'hermanos',hint:'Lazos familiares',emoji:'👨‍👩‍👧‍👦'},
      {q:'¿En cuántas viviendas distintas ha vivido?',a:6,unit:'viviendas',hint:'',emoji:'🏠'},
      {q:'¿Cuántas tazas de café bebe al día?',a:4,unit:'tazas',hint:'Para despertar',emoji:'☕'},
      {q:'¿Cuántos años lleva en su trabajo actual?',a:5,unit:'años',hint:'',emoji:'💼'},
      {q:'¿Cuántos pares de zapatos tiene?',a:18,unit:'pares',hint:'Armario lleno',emoji:'👟'},
      {q:'¿Cuántos kilómetros viajó hoy hasta la fiesta?',a:0,unit:'km',hint:'¿Partido en casa?',emoji:'🚗'},
      {q:'¿Cuántas horas durmió anoche?',a:6,unit:'horas',hint:'¡Qué emoción!',emoji:'😴'},
      {q:'¿Cuánto cuesta la tarta de hoy?',a:45,unit:'euros',hint:'Dulce inversión',emoji:'💶'},
      {q:'¿Cuántos minutos duró la canción de cumpleaños más larga?',a:3,unit:'minutos',hint:'Cumpleaños feliz',emoji:'🎵'},
    ]},
    hochzeit: { icon:'💍', name:'💍 Boda', questions:[
      {q:'¿Cuántos invitados hay hoy aquí?',a:80,unit:'invitados',hint:'¡A contar!',emoji:'🥂'},
      {q:'¿En qué año se conocieron los novios?',a:2018,unit:'año',hint:'Un día especial',emoji:'💑'},
      {q:'¿Cuántos meses duró la planificación de la boda?',a:14,unit:'meses',hint:'Puro estrés',emoji:'📋'},
      {q:'¿Cuántos kilómetros hay entre los pueblos de los novios?',a:120,unit:'km',hint:'¿A distancia?',emoji:'🗺️'},
      {q:'¿Cuánto cuesta la boda en total?',a:18000,unit:'euros',hint:'Mejor no preguntar',emoji:'💸'},
      {q:'¿Cuántos invitados bailarán esta noche?',a:45,unit:'invitados',hint:'¡Fiesta!',emoji:'💃'},
      {q:'¿Cuántas horas necesitaron hoy los novios para prepararse?',a:5,unit:'horas',hint:'Madrugadores',emoji:'⏰'},
      {q:'¿Cuántos discursos se darán hoy?',a:6,unit:'discursos',hint:'Pañuelos listos',emoji:'🎤'},
      {q:'¿Cuántos años llevan juntos los novios?',a:7,unit:'años',hint:'Hace tiempo',emoji:'❤️'},
      {q:'¿Cuántas flores tiene el ramo de novia?',a:24,unit:'flores',hint:'Aromático',emoji:'💐'},
      {q:'¿Cuántos pisos tiene la tarta de boda?',a:4,unit:'pisos',hint:'Torre dulce',emoji:'🎂'},
      {q:'¿Cuántos invitados vienen de más de 200 km?',a:18,unit:'invitados',hint:'Viajeros',emoji:'✈️'},
      {q:'¿Cuántas fotos se harán hoy?',a:1200,unit:'fotos',hint:'Flash sin parar',emoji:'📸'},
      {q:'¿Cuántas botellas de cava se vaciarán hoy?',a:60,unit:'botellas',hint:'¡Salud!',emoji:'🍾'},
      {q:'¿Cuántos niños hay entre los invitados?',a:9,unit:'niños',hint:'Movidos',emoji:'🧒'},
      {q:'¿Cuántos viajes han hecho juntos los novios?',a:15,unit:'viajes',hint:'Trotamundos',emoji:'🧳'},
      {q:'¿Cuántos intentos necesitó la pedida de mano?',a:1,unit:'intentos',hint:'¿Diana?',emoji:'💍'},
      {q:'¿Cuántas canciones tiene la lista de la fiesta?',a:85,unit:'canciones',hint:'Hasta el amanecer',emoji:'🎶'},
      {q:'¿Cuántos minutos duró la ceremonia?',a:35,unit:'minutos',hint:'Sí, quiero',emoji:'⛪'},
      {q:'¿Cuántos testigos tienen los novios juntos?',a:4,unit:'testigos',hint:'Cuestión de confianza',emoji:'🤝'},
      {q:'¿Cuántos años quieren estar juntos como mínimo?',a:70,unit:'años',hint:'¡Optimistas!',emoji:'👵'},
      {q:'¿Cuántas porciones de tarta sobrarán al final?',a:8,unit:'porciones',hint:'Para mañana',emoji:'🍰'},
    ]},
    teamevent: { icon:'🏢', name:'🏢 Evento de Equipo', questions:[
      {q:'¿Cuántos empleados tiene nuestra empresa?',a:340,unit:'empleados',hint:'En crecimiento',emoji:'🏢'},
      {q:'¿En qué año se fundó la empresa?',a:2008,unit:'año',hint:'El comienzo',emoji:'📅'},
      {q:'¿En cuántos países estamos activos?',a:12,unit:'países',hint:'Global',emoji:'🌍'},
      {q:'¿Cuántas tazas de café bebe el equipo por semana?',a:210,unit:'tazas',hint:'Motor de cafeína',emoji:'☕'},
      {q:'¿Cuántos correos envía el equipo en un día?',a:480,unit:'correos',hint:'Bandeja llena',emoji:'📧'},
      {q:'¿Cuántas reuniones tuvo el equipo la semana pasada?',a:27,unit:'reuniones',hint:'Podría haber sido un email',emoji:'📆'},
      {q:'¿Cuántos años lleva el colega más veterano?',a:16,unit:'años',hint:'Veterano',emoji:'🏅'},
      {q:'¿Cuántas nacionalidades distintas hay en el equipo?',a:8,unit:'nacionalidades',hint:'Mezcla diversa',emoji:'🌐'},
      {q:'¿Cuántos kilómetros recorre el equipo junto al día?',a:640,unit:'km',hint:'Atasco garantizado',emoji:'🚗'},
      {q:'¿Cuántas galletas desaparecen de la cocina por semana?',a:150,unit:'galletas',hint:'Antojos',emoji:'🍪'},
      {q:'¿Cuántos proyectos terminó el equipo este año?',a:23,unit:'proyectos',hint:'Logrado',emoji:'✅'},
      {q:'¿Cuántas pantallas hay en la oficina?',a:95,unit:'pantallas',hint:'Doble es mejor',emoji:'🖥️'},
      {q:'¿Cuántos pisos tiene nuestro edificio de oficinas?',a:6,unit:'pisos',hint:'¿Escaleras o ascensor?',emoji:'🏬'},
      {q:'¿Cuántas horas por semana pasa el equipo en llamadas?',a:88,unit:'horas',hint:'Botón de silencio',emoji:'🎧'},
      {q:'¿Cuántas plantas hay en la oficina?',a:34,unit:'plantas',hint:'Oficina verde',emoji:'🪴'},
      {q:'¿Cuántos colegas teletrabajan hoy?',a:11,unit:'colegas',hint:'Modo pijama',emoji:'🏠'},
      {q:'¿Cuántos cumpleaños celebra el equipo al año?',a:38,unit:'cumpleaños',hint:'Alerta de tarta',emoji:'🎂'},
      {q:'¿Cuántas cafeteras hay en el edificio?',a:5,unit:'cafeteras',hint:'Cuerda de vida',emoji:'☕'},
      {q:'¿Cuántos pasos da el equipo junto en un día?',a:95000,unit:'pasos',hint:'Maratón',emoji:'👟'},
      {q:'¿Cuántos años de experiencia tiene el equipo en total?',a:420,unit:'años',hint:'Mucho saber',emoji:'🧠'},
      {q:'¿Cuántas herramientas distintas usa el equipo a diario?',a:14,unit:'herramientas',hint:'Caos de pestañas',emoji:'🛠️'},
      {q:'¿Cuántos minutos dura la pausa de comida más larga?',a:75,unit:'minutos',hint:'Bien merecida',emoji:'🍽️'},
    ]},
    jga: { icon:'🍻', name:'🍻 Despedida de Soltero/a', questions:[
      {q:'¿Cuántas personas hay hoy en la despedida?',a:12,unit:'personas',hint:'Equipo completo',emoji:'🎉'},
      {q:'¿En qué año se conocieron el protagonista y su pareja?',a:2017,unit:'año',hint:'Hace tiempo',emoji:'💑'},
      {q:'¿Cuántas horas durará hoy la despedida en total?',a:14,unit:'horas',hint:'Maratón',emoji:'⏱️'},
      {q:'¿Cuántas copas beberá hoy el protagonista?',a:11,unit:'copas',hint:'No olvides el agua',emoji:'🍹'},
      {q:'¿Cuántos kilómetros recorrerá hoy el grupo?',a:25,unit:'km',hint:'Tour por la ciudad',emoji:'🚕'},
      {q:'¿Cuánto dinero gastará hoy el grupo en total?',a:850,unit:'euros',hint:'Ay, la cuenta',emoji:'💸'},
      {q:'¿Cuántos años se conocen los mejores amigos?',a:18,unit:'años',hint:'Inseparables',emoji:'🤝'},
      {q:'¿Cuántas tareas vergonzosas debe cumplir hoy el protagonista?',a:7,unit:'tareas',hint:'Ojos cerrados',emoji:'😳'},
      {q:'¿A cuántos desconocidos se abordará hoy?',a:20,unit:'desconocidos',hint:'Reto',emoji:'🗣️'},
      {q:'¿Cuántos selfies se harán hoy?',a:95,unit:'selfies',hint:'Sonrisas sin fin',emoji:'🤳'},
      {q:'¿Cuántas horas durmió anoche el protagonista?',a:5,unit:'horas',hint:'Demasiada emoción',emoji:'😴'},
      {q:'¿Cuántos lugares distintos visitará hoy el grupo?',a:6,unit:'lugares',hint:'De bar en bar',emoji:'📍'},
      {q:'¿Cuántas canciones se cantarán a grito pelado hoy?',a:14,unit:'canciones',hint:'Desafinado pero alto',emoji:'🎤'},
      {q:'¿Cuántos chupitos se tomará hoy el protagonista?',a:9,unit:'chupitos',hint:'Salud',emoji:'🥃'},
      {q:'¿Cuántos días faltan para la boda?',a:21,unit:'días',hint:'Cuenta atrás',emoji:'📆'},
      {q:'¿Cuántas piezas de disfraz lleva hoy el protagonista?',a:5,unit:'piezas',hint:'Disfrazado',emoji:'🎭'},
      {q:'¿Cuántos mensajes llegan hoy al chat del grupo?',a:130,unit:'mensajes',hint:'Ping',emoji:'📱'},
      {q:'¿Cuántos años lleva el protagonista con su pareja?',a:6,unit:'años',hint:'Pronto para siempre',emoji:'❤️'},
      {q:'¿Cuántos bailes se marcará hoy el grupo?',a:12,unit:'bailes',hint:'Pasos',emoji:'💃'},
      {q:'¿Cuántas fotos acaban siendo demasiado vergonzosas para redes?',a:15,unit:'fotos',hint:'Alto secreto',emoji:'🙈'},
      {q:'¿Cuántos kilómetros condujo la persona que vino de más lejos?',a:320,unit:'km',hint:'Amigo de verdad',emoji:'🚗'},
      {q:'¿Cuántas horas hasta que caiga la primera persona?',a:8,unit:'horas',hint:'¿Quién aguanta?',emoji:'🛌'},
    ]},
  },
};

/* ─── TEAM / BUSINESS-ACCOUNT (Slice A: Mitglieder & Rollen) ── */
function TeamScreen({myId, t, lang, onBack, onThemeApplied=null}){
  const L=(de,en,es)=>lang==='en'?en:lang==='es'?es:de;
  const[teamsMap,setTeamsMap]=useState({});
  const teams=Object.values(teamsMap).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[name,setName]=useState('');
  const[joinCode,setJoinCode]=useState('');
  const[msg,setMsg]=useState('');
  const[err,setErr]=useState('');
  const[openTeamPacks,setOpenTeamPacks]=useState({});
  const[newPackMenu,setNewPackMenu]=useState(null); // team-Objekt für Vorlagen-Auswahl
  const[qEdit,setQEdit]=useState(null); // {teamId,packId,qId|null,q,a,unit,hint,emoji}
  const[pendingMap,setPendingMap]=useState({}); // teamId -> {name} (eigene ausstehende Anfragen)
  const[ciNames,setCiNames]=useState({}); // teamId -> Eingabe-Name fürs Speichern eines CI
  const myName=(typeof localStorage!=='undefined'&&localStorage.getItem('em_lastname'))||'—';

  const roleLabel=r=>r==='owner'?L('Inhaber','Owner','Propietario'):r==='viewer'?L('Betrachter','Viewer','Lector'):L('Editor','Editor','Editor');

  function reload(){ /* Live-Listener unten hält alles aktuell */ }
  useEffect(()=>{
    if(!myId){ setLoading(false); return; }
    const subs={}; // id -> {type:'member'|'pending', unsub}
    function ensureSub(id,type){
      if(subs[id]&&subs[id].type===type) return;
      if(subs[id]){ subs[id].unsub(); delete subs[id]; }
      if(type==='member'){
        const u=onValue(ref(db,`teams/${id}`),s=>{
          const val=s.val();
          if(val&&val.ownerId&&val.members&&val.members[myId]) setTeamsMap(p=>({...p,[id]:{id,...val}}));
          else { setTeamsMap(p=>{const n={...p};delete n[id];return n;}); remove(ref(db,`userTeams/${myId}/${id}`)).catch(()=>{}); }
        },()=>{ setTeamsMap(p=>{const n={...p};delete n[id];return n;}); remove(ref(db,`userTeams/${myId}/${id}`)).catch(()=>{}); });
        subs[id]={type,unsub:u};
      } else {
        // ausstehend: eigene Anfrage beobachten → verschwindet sie, wurde bestätigt oder abgelehnt
        const u=onValue(ref(db,`teams/${id}/joinRequests/${myId}`),s=>{
          if(s.exists()) return; // noch in Prüfung
          get(ref(db,`teams/${id}`)).then(ts=>{
            const val=ts.val();
            if(val&&val.members&&val.members[myId]) update(ref(db,`userTeams/${myId}`),{[id]:true}).catch(()=>{}); // bestätigt → Mitglied
            else { remove(ref(db,`userTeams/${myId}/${id}`)).catch(()=>{}); setPendingMap(p=>{const n={...p};delete n[id];return n;}); } // abgelehnt
          }).catch(()=>{ remove(ref(db,`userTeams/${myId}/${id}`)).catch(()=>{}); setPendingMap(p=>{const n={...p};delete n[id];return n;}); });
        },()=>{});
        subs[id]={type,unsub:u};
      }
    }
    const utUnsub=onValue(ref(db,`userTeams/${myId}`),snap=>{
      const raw=snap.val()||{};
      const ids=Object.keys(raw);
      const pending={};
      ids.forEach(id=>{ const v=raw[id]; if(v&&typeof v==='object'&&v.status==='pending') pending[id]={name:v.name||'Team'}; });
      setPendingMap(pending);
      Object.keys(subs).forEach(id=>{ if(!ids.includes(id)){ subs[id].unsub(); delete subs[id]; setTeamsMap(p=>{const n={...p};delete n[id];return n;}); } });
      ids.forEach(id=>ensureSub(id, pending[id]?'pending':'member'));
      setLoading(false);
    },()=>setLoading(false));
    return ()=>{ utUnsub(); Object.values(subs).forEach(s=>s.unsub()); };
  },[myId]);

  function genTeamCode(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c=''; for(let i=0;i<6;i++) c+=chars[Math.floor(Math.random()*chars.length)];
    return c;
  }
  function flash(m){ setMsg(m); setTimeout(()=>setMsg(''),2500); }

  async function createTeam(){
    if(!name.trim()){ setErr(L('Bitte einen Teamnamen eingeben.','Please enter a team name.','Introduce un nombre de equipo.')); return; }
    setErr(''); setBusy(true);
    try{
      const teamId='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      const code=genTeamCode();
      const updates={};
      updates[`teams/${teamId}`]={name:name.trim(),code,ownerId:myId,createdAt:Date.now(),
        members:{[myId]:{role:'owner',name:myName,joinedAt:Date.now()}}};
      updates[`teamCodes/${code}`]={teamId,name:name.trim()};
      updates[`userTeams/${myId}/${teamId}`]=true;
      await update(ref(db),updates);
      setName(''); await reload(); flash(L('Team erstellt','Team created','Equipo creado'));
    }catch(e){ console.error('create team failed:',e); setErr(L('Erstellen fehlgeschlagen.','Creating failed.','Error al crear.')); }
    setBusy(false);
  }

  async function requestJoin(){
    const code=joinCode.trim().toUpperCase();
    if(code.length<4){ setErr(L('Bitte einen gültigen Team-Code eingeben.','Please enter a valid team code.','Introduce un código válido.')); return; }
    setErr(''); setBusy(true);
    try{
      const snap=await get(ref(db,`teamCodes/${code}`));
      const v=snap.val();
      const teamId=(v&&typeof v==='object')?v.teamId:v;
      const tName=(v&&typeof v==='object')?(v.name||'Team'):'Team';
      if(!teamId){ setErr(L('Team nicht gefunden.','Team not found.','Equipo no encontrado.')); setBusy(false); return; }
      if(teamsMap[teamId]){ setErr(L('Du bist bereits in diesem Team.','You are already in this team.','Ya estás en este equipo.')); setBusy(false); return; }
      if(pendingMap[teamId]){ setErr(L('Anfrage läuft bereits.','Request already pending.','Solicitud ya pendiente.')); setBusy(false); return; }
      // 1) Anfrage beim Team anlegen – MUSS serverseitig erlaubt sein (Rules!)
      await update(ref(db,`teams/${teamId}/joinRequests/${myId}`),{name:myName,requestedAt:Date.now()});
      // 2) erst nach Erfolg lokal als „ausstehend" vormerken
      await update(ref(db,`userTeams/${myId}`),{[teamId]:{status:'pending',name:tName}});
      setJoinCode(''); flash(L('Anfrage gesendet – warte auf Bestätigung','Request sent – waiting for approval','Solicitud enviada – esperando aprobación'));
    }catch(e){ console.error('request join failed:',e);
      setErr(L('Anfrage fehlgeschlagen – sind die aktuellen Firebase-Rules deployed?','Request failed – are the latest Firebase rules deployed?','Solicitud fallida – ¿están desplegadas las reglas de Firebase?')); }
    setBusy(false);
  }

  async function withdrawRequest(teamId){
    try{
      const updates={};
      updates[`teams/${teamId}/joinRequests/${myId}`]=null;
      updates[`userTeams/${myId}/${teamId}`]=null;
      await update(ref(db),updates);
      setPendingMap(p=>{const n={...p};delete n[teamId];return n;});
    }catch(e){ console.error('withdraw failed:',e); }
  }

  async function approveRequest(team,uid,reqName){
    try{
      const updates={};
      updates[`teams/${team.id}/members/${uid}`]={role:'viewer',name:reqName||'—',joinedAt:Date.now()};
      updates[`teams/${team.id}/joinRequests/${uid}`]=null;
      await update(ref(db),updates);
    }catch(e){ console.error('approve failed:',e); }
  }
  async function denyRequest(team,uid){
    if(!window.confirm(L('Anfrage ablehnen?','Deny request?','¿Rechazar solicitud?'))) return;
    try{ await remove(ref(db,`teams/${team.id}/joinRequests/${uid}`)); }
    catch(e){ console.error('deny failed:',e); }
  }

  async function leaveTeam(team){
    if(!window.confirm(L(`Team „${team.name}" verlassen?`,`Leave team "${team.name}"?`,`¿Salir del equipo "${team.name}"?`))) return;
    try{
      const updates={};
      updates[`teams/${team.id}/members/${myId}`]=null;
      updates[`userTeams/${myId}/${team.id}`]=null;
      await update(ref(db),updates);
      await reload();
    }catch(e){ console.error('leave failed:',e); }
  }

  async function deleteTeam(team){
    if(!window.confirm(L(`Team „${team.name}" endgültig löschen? Alle Mitglieder verlieren den Zugriff.`,`Permanently delete team "${team.name}"? All members lose access.`,`¿Borrar el equipo "${team.name}"? Todos pierden acceso.`))) return;
    try{
      const updates={};
      updates[`teams/${team.id}`]=null;
      updates[`teamCodes/${team.code}`]=null;
      updates[`userTeams/${myId}/${team.id}`]=null;
      await update(ref(db),updates);
      await reload();
    }catch(e){ console.error('delete team failed:',e); }
  }

  async function setRole(team,uid,role){
    try{ await update(ref(db,`teams/${team.id}/members/${uid}`),{role}); await reload(); }
    catch(e){ console.error('set role failed:',e); }
  }
  async function removeMember(team,uid){
    if(!window.confirm(L('Dieses Mitglied entfernen?','Remove this member?','¿Quitar a este miembro?'))) return;
    try{ await remove(ref(db,`teams/${team.id}/members/${uid}`)); await reload(); }
    catch(e){ console.error('remove member failed:',e); }
  }
  function copyCode(code){
    try{ navigator.clipboard.writeText(code); flash(L('Code kopiert','Code copied','Código copiado')+': '+code); }catch(e){}
  }

  // ── Team-Packs LIVE bearbeiten (gemeinsame Daten, keine Kopien) ──
  async function createTeamPack(team, occId){
    let name, questions={};
    if(occId){
      const set=OCCASION_TEMPLATES[lang]||OCCASION_TEMPLATES.de;
      const tpl=set[occId]; if(!tpl||!Array.isArray(tpl.questions)) return;
      name=tpl.name;
      tpl.questions.forEach((x,idx)=>{
        const qId='q'+Date.now().toString(36)+idx.toString(36)+Math.random().toString(36).slice(2,4);
        questions[qId]={q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||tpl.icon||'📝',lang,createdAt:Date.now(),authorId:myId};
      });
    } else {
      const nm=window.prompt(L('Name des neuen Packs:','Name of the new pack:','Nombre del nuevo paquete:'));
      if(!nm||!nm.trim()) return; name=nm.trim();
    }
    try{
      const packId='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
      await update(ref(db,`teams/${team.id}/packs/${packId}`),
        {name,createdAt:Date.now(),createdBy:myId,createdByName:myName,questions});
      setOpenTeamPacks(o=>({...o,[packId]:true}));
      setNewPackMenu(null);
    }catch(e){ console.error('create team pack failed:',e); }
  }
  // Team-Pack → „Meine Fragen" kopieren (nicht-destruktiv)
  async function copyToMine(pk){
    const qs=Object.values(pk.questions||{});
    if(!qs.length){ flash(L('Pack ist leer.','Pack is empty.','El paquete está vacío.')); return; }
    try{
      const updates={};
      qs.forEach((x,idx)=>{
        const qId=Date.now().toString(36)+idx.toString(36)+Math.random().toString(36).slice(2,4);
        updates[`userQuestions/${myId}/${qId}`]={
          q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝',
          category:pk.name,visibility:'private',lang:x.lang||lang,createdAt:Date.now(),authorId:myId,
        };
      });
      await update(ref(db),updates);
      flash(L('In „Meine Fragen" kopiert','Copied to "My questions"','Copiado a "Mis preguntas"')+': '+pk.name);
    }catch(e){ console.error('copy to mine failed:',e); }
  }
  async function deleteTeamPack(team,pid){
    if(!window.confirm(L('Dieses geteilte Pack für ALLE löschen?','Delete this shared pack for EVERYONE?','¿Borrar este paquete para TODOS?'))) return;
    try{ await remove(ref(db,`teams/${team.id}/packs/${pid}`)); }
    catch(e){ console.error('delete team pack failed:',e); }
  }
  async function saveTeamQ(){
    if(!qEdit) return;
    if(!qEdit.q.trim()){ setErr(L('Bitte eine Frage eingeben.','Please enter a question.','Introduce una pregunta.')); return; }
    const num=parseFloat(String(qEdit.a).replace(',','.'));
    if(isNaN(num)){ setErr(L('Antwort muss eine Zahl sein.','Answer must be a number.','La respuesta debe ser un número.')); return; }
    if(!qEdit.unit.trim()){ setErr(L('Bitte eine Einheit angeben.','Please enter a unit.','Introduce una unidad.')); return; }
    setErr('');
    try{
      const qId=qEdit.qId||('q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
      await update(ref(db,`teams/${qEdit.teamId}/packs/${qEdit.packId}/questions/${qId}`),
        {q:qEdit.q.trim(),a:num,unit:qEdit.unit.trim(),hint:(qEdit.hint||'').trim(),emoji:qEdit.emoji||'📝',lang});
      setQEdit(null);
    }catch(e){ console.error('save team question failed:',e); setErr(L('Speichern fehlgeschlagen.','Saving failed.','Error al guardar.')); }
  }
  async function deleteTeamQ(team,pid,qId){
    if(!window.confirm(L('Diese Frage für alle löschen?','Delete this question for everyone?','¿Borrar esta pregunta para todos?'))) return;
    try{ await remove(ref(db,`teams/${team.id}/packs/${pid}/questions/${qId}`)); }
    catch(e){ console.error('delete team question failed:',e); }
  }

  // ── Team-CIs (zentrale Farbkonzepte) ──
  const currentCIColors=()=>({bg:t.bg,surface:t.surface,card:t.card,border:t.border,accent:t.accent,gold:t.gold,green:t.green,danger:t.danger,text:t.text,muted:t.muted});
  async function saveTeamCI(team){
    const nm=((ciNames[team.id]||'').trim());
    if(!nm) return;
    const id='ci'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    try{
      await update(ref(db,`teams/${team.id}/cis/${id}`),{name:nm,colors:currentCIColors(),by:myId,byName:(team.members?.[myId]?.name||''),at:Date.now()});
      setCiNames(m=>({...m,[team.id]:''}));
      setMsg(L('CI gespeichert.','CI saved.','CI guardado.'));
    }catch(e){ console.error('save team CI failed:',e); setErr(L('Speichern fehlgeschlagen (Rules deployen?).','Save failed (deploy rules?).','Error al guardar.')); }
  }
  function applyTeamCI(ci){
    applyColorPreset(ci.colors||{});
    onThemeApplied&&onThemeApplied();
    setMsg(L('CI angewendet.','CI applied.','CI aplicado.'));
  }
  async function deleteTeamCI(team,ciId){
    if(!window.confirm(L('Dieses CI für das ganze Team löschen?','Delete this CI for the whole team?','¿Eliminar este CI para todo el equipo?'))) return;
    try{ await remove(ref(db,`teams/${team.id}/cis/${ciId}`)); }
    catch(e){ console.error('delete team CI failed:',e); }
  }

  const inputStyle={width:'100%',background:t.surface,border:`1.5px solid ${t.border}`,
    borderRadius:t.radius,color:t.text,fontSize:14,padding:'10px 12px',
    fontFamily:t.fontBody,boxSizing:'border-box'};

  return <div style={{...page,animation:'fu .3s ease both'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:t.muted,
        fontSize:20,cursor:'pointer',padding:0}}>←</button>
      <h2 style={{fontFamily:t.fontTitle,fontSize:28,margin:0}}>
        👥 {L('Team','Team','Equipo')}
      </h2>
    </div>

    <p style={{fontSize:12,color:t.muted,margin:'0 0 16px',lineHeight:1.5}}>
      {L('Erstellt ein Team, um Fragenpacks gemeinsam zu nutzen. Mitglieder treten per Team-Code bei. (Geteilte Packs folgen im nächsten Schritt.)',
         'Create a team to share question packs. Members join via team code. (Shared packs coming in the next step.)',
         'Crea un equipo para compartir paquetes de preguntas. Los miembros se unen con un código. (Los paquetes compartidos llegan en el próximo paso.)')}
    </p>

    {msg&&<div style={{background:t.green+'22',border:`1px solid ${t.green}55`,borderRadius:t.radius,
      padding:'9px 12px',marginBottom:12,textAlign:'center'}}>
      <p style={{fontSize:12,color:t.green,fontWeight:700,margin:0}}>✓ {msg}</p></div>}

    {/* Erstellen + Beitreten */}
    <Card t={t} style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
      <span style={{fontSize:13,fontWeight:700,color:t.text}}>➕ {L('Neues Team','New team','Nuevo equipo')}</span>
      <div style={{display:'flex',gap:8}}>
        <input value={name} onChange={e=>setName(e.target.value)}
          placeholder={L('Teamname','Team name','Nombre del equipo')} style={{...inputStyle,flex:1}}/>
        <Btn t={t} onClick={createTeam} disabled={busy}>{L('Erstellen','Create','Crear')}</Btn>
      </div>
      <div style={{height:1,background:t.border,margin:'2px 0'}}/>
      <span style={{fontSize:13,fontWeight:700,color:t.text}}>🔑 {L('Team beitreten','Join team','Unirse a equipo')}</span>
      <div style={{display:'flex',gap:8}}>
        <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
          placeholder={L('Team-Code','Team code','Código')} maxLength={6}
          style={{...inputStyle,flex:1,textTransform:'uppercase',letterSpacing:2,fontWeight:700}}/>
        <Btn t={t} variant="secondary" onClick={requestJoin} disabled={busy}>{L('Anfragen','Request','Solicitar')}</Btn>
      </div>
      <p style={{fontSize:10,color:t.muted,margin:0}}>{L('Der Inhaber muss deine Anfrage bestätigen.','The owner must approve your request.','El propietario debe aprobar tu solicitud.')}</p>
      {err&&<p style={{color:t.danger,fontSize:12,margin:0}}>{err}</p>}
    </Card>

    {loading&&<div style={{textAlign:'center',padding:20}}><Spinner t={t}/></div>}

    {!loading&&teams.length===0&&Object.keys(pendingMap).length===0&&<Card t={t} style={{textAlign:'center',padding:28}}>
      <div style={{fontSize:38,marginBottom:10}}>👥</div>
      <p style={{color:t.muted,fontSize:14,margin:0}}>
        {L('Noch in keinem Team. Erstelle eins oder tritt mit einem Code bei.',
           'Not in any team yet. Create one or join with a code.',
           'Aún sin equipo. Crea uno o únete con un código.')}
      </p>
    </Card>}

    {teams.map(team=>{
      const myRole=team.members?.[myId]?.role;
      const isOwner=team.ownerId===myId;
      const roleRank={owner:0,editor:1,viewer:2};
      const members=Object.entries(team.members||{}).map(([uid,m])=>({uid,...m}))
        .sort((a,b)=>((roleRank[a.role]==null?9:roleRank[a.role])-(roleRank[b.role]==null?9:roleRank[b.role]))
          || String(a.name||'').localeCompare(String(b.name||'')));
      return <Card key={team.id} t={t} style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
          <div style={{minWidth:0}}>
            <p style={{fontSize:16,fontWeight:800,color:t.text,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{team.name}</p>
            <p style={{fontSize:11,color:t.muted,margin:'2px 0 0'}}>{roleLabel(myRole)} · {members.length} {L('Mitglieder','members','miembros')}</p>
          </div>
          <button onClick={()=>copyCode(team.code)}
            style={{background:t.gold+'18',border:`1.5px solid ${t.gold}66`,borderRadius:100,
              color:t.gold,fontSize:13,fontWeight:800,cursor:'pointer',padding:'7px 13px',
              whiteSpace:'nowrap',fontFamily:t.fontBody,letterSpacing:1.5,flexShrink:0}}>
            {team.code} 📋
          </button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {members.map(m=>(
            <div key={m.uid} style={{display:'flex',alignItems:'center',gap:8,
              padding:'7px 0',borderTop:`1px solid ${t.border}`}}>
              <Avatar name={m.name} t={t} size={26}/>
              <span style={{flex:1,fontSize:13,color:t.text,fontWeight:m.uid===myId?800:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {m.name}{m.uid===myId&&<span style={{color:t.accent,fontSize:11}}> ({L('Du','You','Tú')})</span>}
              </span>
              {/* Rollensteuerung: nur Inhaber, nicht für sich selbst */}
              {isOwner&&m.role!=='owner'
                ? <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
                    <button onClick={()=>setRole(team,m.uid,m.role==='viewer'?'editor':'viewer')}
                      style={{background:'none',border:`1px solid ${t.border}`,borderRadius:100,
                        color:t.text,fontSize:11,fontWeight:700,cursor:'pointer',padding:'4px 9px',fontFamily:t.fontBody}}>
                      {roleLabel(m.role)} ⇅
                    </button>
                    <button onClick={()=>removeMember(team,m.uid)}
                      style={{background:'none',border:`1px solid ${t.danger}44`,borderRadius:100,
                        color:t.danger,fontSize:11,cursor:'pointer',padding:'4px 8px'}}>✕</button>
                  </div>
                : <span style={{fontSize:11,color:t.muted,flexShrink:0,
                    background:m.role==='owner'?t.gold+'22':t.surface,
                    border:`1px solid ${m.role==='owner'?t.gold+'55':t.border}`,
                    borderRadius:100,padding:'3px 9px',fontWeight:700}}>{roleLabel(m.role)}</span>}
            </div>
          ))}
        </div>

        {/* Beitrittsanfragen (nur Inhaber) */}
        {isOwner&&team.joinRequests&&Object.keys(team.joinRequests).length>0&&
          <div style={{marginTop:12,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
            <p style={{fontSize:12,fontWeight:800,color:t.gold,margin:'0 0 8px'}}>
              🙋 {L('Beitrittsanfragen','Join requests','Solicitudes')} ({Object.keys(team.joinRequests).length})
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {Object.entries(team.joinRequests).map(([uid,req])=>(
                <div key={uid} style={{display:'flex',alignItems:'center',gap:8,
                  background:t.gold+'10',border:`1px solid ${t.gold}44`,borderRadius:t.radius,padding:'7px 10px'}}>
                  <Avatar name={req.name} t={t} size={26}/>
                  <span style={{flex:1,fontSize:13,color:t.text,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{req.name||'—'}</span>
                  <button onClick={()=>approveRequest(team,uid,req.name)}
                    style={{background:t.green+'22',border:`1px solid ${t.green}66`,borderRadius:100,
                      color:t.green,fontSize:11,fontWeight:800,cursor:'pointer',padding:'5px 11px',fontFamily:t.fontBody,flexShrink:0}}>
                    ✓ {L('Annehmen','Approve','Aceptar')}
                  </button>
                  <button onClick={()=>denyRequest(team,uid)}
                    style={{background:'none',border:`1px solid ${t.danger}44`,borderRadius:100,
                      color:t.danger,fontSize:11,cursor:'pointer',padding:'5px 8px',flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          </div>}

        {/* Team-CIs (zentrale Farbkonzepte – alle Mitglieder nutzbar) */}
        <div style={{marginTop:12,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
          <p style={{fontSize:12,fontWeight:800,color:t.text,margin:'0 0 8px'}}>
            🎨 {L('Team-CIs','Team CIs','CIs del equipo')} ({Object.keys(team.cis||{}).length})
          </p>
          {Object.keys(team.cis||{}).length===0&&<p style={{fontSize:11,color:t.muted,margin:'0 0 8px'}}>
            {L('Noch keine CIs. Lege im Farb-Editor ein Konzept an und speichere es hier fürs Team.',
               'No CIs yet. Build a concept in the color editor and save it here for the team.',
               'Aún sin CIs. Crea un concepto en el editor de color y guárdalo aquí.')}
          </p>}
          {Object.keys(team.cis||{}).length>0&&<div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,marginBottom:8,WebkitOverflowScrolling:'touch'}}>
            {Object.entries(team.cis||{}).map(([cid,ci])=>{
              const cols=ci.colors||{};
              const active=Object.keys(cols).length>0 && Object.keys(cols).every(k=>(CUSTOM_COLORS[k]||'').toLowerCase()===(cols[k]||'').toLowerCase());
              return <div key={cid} style={{flex:'0 0 auto',position:'relative',display:'flex',flexDirection:'column',gap:7,
                padding:'9px 11px',borderRadius:t.radius,background:t.surface,
                border:`2px solid ${active?t.accent:t.border}`,minWidth:110}}>
                {myRole!=='viewer'&&<button onClick={()=>deleteTeamCI(team,cid)} title={L('Löschen','Delete','Eliminar')}
                  style={{position:'absolute',top:-7,right:-7,width:20,height:20,borderRadius:'50%',
                    background:t.danger,color:'#fff',border:'none',fontSize:12,lineHeight:1,cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',fontFamily:t.fontBody}}>×</button>}
                <div onClick={()=>applyTeamCI(ci)} style={{cursor:'pointer'}}>
                  <div style={{display:'flex',gap:3,marginBottom:7}}>
                    {[cols.bg,cols.accent,cols.gold,cols.green].map((col,ci2)=>(
                      <span key={ci2} style={{width:17,height:17,borderRadius:5,background:col||t.border,
                        border:`1px solid ${t.border}`,display:'inline-block'}}/>
                    ))}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:active?t.accent:t.text,whiteSpace:'nowrap',
                    overflow:'hidden',textOverflow:'ellipsis',maxWidth:130,display:'block'}}>{ci.name||'CI'}</span>
                </div>
              </div>;
            })}
          </div>}
          {myRole!=='viewer'&&<div style={{display:'flex',gap:8}}>
            <input value={ciNames[team.id]||''} onChange={e=>setCiNames(m=>({...m,[team.id]:e.target.value.slice(0,30)}))}
              onKeyDown={e=>{ if(e.key==='Enter') saveTeamCI(team); }}
              placeholder={L('Aktuelle Farben als CI speichern …','Save current colors as CI …','Guardar colores como CI …')}
              style={{flex:1,minWidth:0,boxSizing:'border-box',padding:'8px 11px',borderRadius:t.radius,
                background:t.surface,border:`1.5px solid ${t.border}`,color:t.text,fontSize:12,fontFamily:t.fontBody,outline:'none'}}/>
            <button onClick={()=>saveTeamCI(team)} disabled={!(ciNames[team.id]||'').trim()}
              style={{flexShrink:0,padding:'8px 13px',borderRadius:t.radius,
                background:(ciNames[team.id]||'').trim()?t.accent:t.surface,
                border:`1.5px solid ${(ciNames[team.id]||'').trim()?t.accent:t.border}`,
                color:(ciNames[team.id]||'').trim()?'#fff':t.muted,fontSize:12,fontWeight:700,
                cursor:(ciNames[team.id]||'').trim()?'pointer':'default',fontFamily:t.fontBody}}>💾</button>
          </div>}
        </div>

        {/* Geteilte Packs (live, gemeinsame Daten) */}
        <div style={{marginTop:12,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <p style={{fontSize:12,fontWeight:800,color:t.text,margin:0}}>
              📦 {L('Geteilte Packs','Shared packs','Paquetes compartidos')} ({Object.keys(team.packs||{}).length})
            </p>
            {myRole!=='viewer'&&<button onClick={()=>setNewPackMenu(team)}
              style={{background:'none',border:`1px solid ${t.accent}55`,borderRadius:100,color:t.accent,
                fontSize:11,fontWeight:700,cursor:'pointer',padding:'4px 10px',fontFamily:t.fontBody}}>
              ➕ {L('Neues Pack','New pack','Nuevo paquete')}
            </button>}
          </div>
          {Object.keys(team.packs||{}).length===0&&<p style={{fontSize:11,color:t.muted,margin:0}}>
            {L('Noch keine Packs. Lege eins an oder teile eins aus „Meine Fragen".','No packs yet. Create one or share from "My questions".','Aún sin paquetes. Crea uno o comparte desde "Mis preguntas".')}
          </p>}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {Object.entries(team.packs||{}).map(([pid,pk])=>{
              const qList=Object.entries(pk.questions||{}).map(([qid,q])=>({qid,...q}));
              const pOpen=!!openTeamPacks[pid];
              return <div key={pid} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:t.radius,overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px'}}>
                  <button onClick={()=>setOpenTeamPacks(o=>({...o,[pid]:!o[pid]}))}
                    style={{flex:1,display:'flex',alignItems:'center',gap:8,background:'none',border:'none',
                      cursor:'pointer',fontFamily:t.fontBody,textAlign:'left',padding:0,minWidth:0}}>
                    <span style={{color:t.muted,fontSize:14,transform:pOpen?'rotate(90deg)':'none',transition:'transform .15s'}}>›</span>
                    <span style={{flex:1,minWidth:0}}>
                      <span style={{display:'block',fontSize:13,fontWeight:700,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pk.name}</span>
                      <span style={{display:'block',fontSize:10,color:t.muted}}>{qList.length} {L('Fragen','questions','preguntas')}{pk.createdByName?` · ${pk.createdByName}`:''}</span>
                    </span>
                  </button>
                  <button onClick={()=>copyToMine(pk)} title={L('In „Meine Fragen" kopieren','Copy to "My questions"','Copiar a "Mis preguntas"')}
                    style={{background:'none',border:`1px solid ${t.gold}55`,borderRadius:100,color:t.gold,fontSize:13,cursor:'pointer',padding:'5px 8px',flexShrink:0}}>📥</button>
                  {myRole!=='viewer'&&<button onClick={()=>deleteTeamPack(team,pid)} title={L('Pack löschen','Delete pack','Borrar paquete')}
                    style={{background:'none',border:`1px solid ${t.danger}44`,borderRadius:100,color:t.danger,fontSize:13,cursor:'pointer',padding:'5px 8px',flexShrink:0}}>🗑</button>}
                </div>
                {pOpen&&<div style={{padding:'0 10px 10px',display:'flex',flexDirection:'column',gap:6}}>
                  {qList.map(q=>(
                    <div key={q.qid} style={{display:'flex',alignItems:'flex-start',gap:8,background:t.bg,borderRadius:t.radius,padding:'8px 10px'}}>
                      <span style={{fontSize:18,flexShrink:0}}>{q.emoji||'📝'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:600,color:t.text,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.q}</p>
                        <p style={{fontSize:11,color:t.accent,fontWeight:700,margin:0}}>{q.a} {q.unit}</p>
                      </div>
                      {myRole!=='viewer'&&<div style={{display:'flex',gap:4,flexShrink:0}}>
                        <button onClick={()=>{setErr('');setQEdit({teamId:team.id,packId:pid,qId:q.qid,q:q.q,a:String(q.a),unit:q.unit,hint:q.hint||'',emoji:q.emoji||'📝'});}}
                          style={{background:'none',border:`1px solid ${t.border}`,borderRadius:t.radius,color:t.text,fontSize:11,cursor:'pointer',padding:'3px 8px'}}>✏</button>
                        <button onClick={()=>deleteTeamQ(team,pid,q.qid)}
                          style={{background:'none',border:`1px solid ${t.danger}44`,borderRadius:t.radius,color:t.danger,fontSize:11,cursor:'pointer',padding:'3px 8px'}}>✕</button>
                      </div>}
                    </div>
                  ))}
                  {qList.length===0&&<p style={{fontSize:11,color:t.muted,margin:0}}>{L('Noch keine Fragen.','No questions yet.','Aún sin preguntas.')}</p>}
                  {myRole!=='viewer'&&<button onClick={()=>{setErr('');setQEdit({teamId:team.id,packId:pid,qId:null,q:'',a:'',unit:'',hint:'',emoji:'📝'});}}
                    style={{alignSelf:'flex-start',background:'none',border:`1px dashed ${t.border}`,borderRadius:t.radius,color:t.muted,fontSize:12,fontWeight:700,cursor:'pointer',padding:'6px 11px',fontFamily:t.fontBody}}>
                    ➕ {L('Frage hinzufügen','Add question','Añadir pregunta')}
                  </button>}
                  {myRole==='viewer'&&<p style={{fontSize:10,color:t.muted,margin:0,fontStyle:'italic'}}>{L('Nur-Lesen (Betrachter)','Read-only (viewer)','Solo lectura (lector)')}</p>}
                </div>}
              </div>;
            })}
          </div>
        </div>

        <div style={{display:'flex',gap:8,marginTop:12}}>
          {isOwner
            ? <button onClick={()=>deleteTeam(team)}
                style={{flex:1,padding:'8px',borderRadius:t.radius,background:'none',
                  border:`1.5px solid ${t.danger}55`,color:t.danger,fontSize:12,fontWeight:700,
                  cursor:'pointer',fontFamily:t.fontBody}}>
                🗑 {L('Team löschen','Delete team','Borrar equipo')}
              </button>
            : <button onClick={()=>leaveTeam(team)}
                style={{flex:1,padding:'8px',borderRadius:t.radius,background:'none',
                  border:`1.5px solid ${t.danger}44`,color:t.danger,fontSize:12,fontWeight:700,
                  cursor:'pointer',fontFamily:t.fontBody}}>
                🚪 {L('Team verlassen','Leave team','Salir del equipo')}
              </button>}
        </div>
      </Card>;
    })}

    {/* Eigene ausstehende Beitrittsanfragen */}
    {Object.entries(pendingMap).map(([tid,p])=>(
      <Card key={'pending_'+tid} t={t} style={{marginBottom:12,borderStyle:'dashed'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:22}}>⏳</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:15,fontWeight:800,color:t.text,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
            <p style={{fontSize:11,color:t.muted,margin:'2px 0 0'}}>
              {L('Anfrage gesendet – wartet auf Bestätigung','Request sent – awaiting approval','Solicitud enviada – esperando aprobación')}
            </p>
          </div>
          <button onClick={()=>withdrawRequest(tid)}
            style={{background:'none',border:`1px solid ${t.danger}44`,borderRadius:100,color:t.danger,
              fontSize:11,fontWeight:700,cursor:'pointer',padding:'5px 11px',fontFamily:t.fontBody,flexShrink:0}}>
            {L('Zurückziehen','Withdraw','Retirar')}
          </button>
        </div>
      </Card>
    ))}

    {/* Vorlagen-Auswahl für neues Team-Pack */}
    {newPackMenu&&<div onClick={()=>setNewPackMenu(null)}
      style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,.6)',
        display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:520,background:t.card,
        borderTopLeftRadius:18,borderTopRightRadius:18,padding:'16px 16px 28px',
        maxHeight:'80vh',overflowY:'auto'}}>
        <p style={{fontSize:15,fontWeight:800,color:t.text,margin:'0 0 4px'}}>
          {L('Neues Pack','New pack','Nuevo paquete')} · {newPackMenu.name}
        </p>
        <p style={{fontSize:12,color:t.muted,margin:'0 0 14px'}}>
          {L('Leer starten oder eine Anlass-Vorlage nutzen','Start empty or use an occasion template','Empieza vacío o usa una plantilla')}
        </p>
        <button onClick={()=>createTeamPack(newPackMenu)}
          style={{width:'100%',display:'flex',alignItems:'center',gap:10,marginBottom:8,
            padding:'12px 14px',borderRadius:t.radius,background:t.surface,
            border:`1.5px solid ${t.border}`,color:t.text,fontSize:14,fontWeight:700,
            cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'}}>
          <span style={{fontSize:20}}>📄</span>
          <span style={{flex:1}}>{L('Leeres Pack','Empty pack','Paquete vacío')}</span>
          <span style={{color:t.muted}}>›</span>
        </button>
        {Object.entries(OCCASION_TEMPLATES[lang]||OCCASION_TEMPLATES.de).map(([occId,occ])=>(
          <button key={occId} onClick={()=>createTeamPack(newPackMenu,occId)}
            style={{width:'100%',display:'flex',alignItems:'center',gap:10,marginBottom:8,
              padding:'12px 14px',borderRadius:t.radius,background:t.surface,
              border:`1.5px solid ${t.gold}44`,color:t.text,fontSize:14,fontWeight:700,
              cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'}}>
            <span style={{fontSize:20}}>{occ.icon||'📋'}</span>
            <span style={{flex:1}}>{occ.name}</span>
            <span style={{fontSize:11,color:t.muted}}>{(occ.questions||[]).length} {L('Fragen','Q','preg.')}</span>
          </button>
        ))}
        <button onClick={()=>setNewPackMenu(null)}
          style={{width:'100%',marginTop:6,padding:'10px',borderRadius:t.radius,background:'none',
            border:`1px solid ${t.border}`,color:t.muted,fontSize:13,cursor:'pointer',fontFamily:t.fontBody}}>
          {L('Abbrechen','Cancel','Cancelar')}
        </button>
      </div>
    </div>}

    {/* Team-Frage bearbeiten/hinzufügen (live, gemeinsame Daten) */}
    {qEdit&&<div onClick={()=>setQEdit(null)}
      style={{position:'fixed',inset:0,zIndex:620,background:'rgba(0,0,0,0.72)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:18}}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:t.radius,
        border:`1.5px solid ${t.border}`,maxWidth:400,width:'100%',maxHeight:'88vh',overflowY:'auto',
        padding:'20px',animation:'fu .25s ease both'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <h3 style={{fontFamily:t.fontTitle,fontSize:19,margin:0,color:t.text}}>
            {qEdit.qId?L('Frage bearbeiten','Edit question','Editar pregunta'):L('Neue Frage','New question','Nueva pregunta')}
          </h3>
          <button onClick={()=>setQEdit(null)} style={{background:'none',border:'none',color:t.muted,fontSize:24,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <input value={qEdit.q} onChange={e=>setQEdit(s=>({...s,q:e.target.value}))}
            placeholder={L('Frage','Question','Pregunta')} style={inputStyle}/>
          <div style={{display:'flex',gap:8}}>
            <input value={qEdit.a} onChange={e=>setQEdit(s=>({...s,a:e.target.value}))}
              placeholder={L('Antwort (Zahl)','Answer (number)','Respuesta (número)')} inputMode="decimal" style={{...inputStyle,flex:1}}/>
            <input value={qEdit.unit} onChange={e=>setQEdit(s=>({...s,unit:e.target.value}))}
              placeholder={L('Einheit','Unit','Unidad')} style={{...inputStyle,flex:1}}/>
          </div>
          <input value={qEdit.hint} onChange={e=>setQEdit(s=>({...s,hint:e.target.value}))}
            placeholder={L('Hinweis (optional)','Hint (optional)','Pista (opcional)')} style={inputStyle}/>
          <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2}}>
            {['📝','🎯','🔢','💡','🌍','🏆','🎲','⭐','🍔','🎵','🚀','💰'].map(em=>(
              <button key={em} onClick={()=>setQEdit(s=>({...s,emoji:em}))}
                style={{fontSize:18,padding:'5px 7px',borderRadius:t.radius,cursor:'pointer',flexShrink:0,
                  background:qEdit.emoji===em?t.accent+'22':'none',
                  border:`1.5px solid ${qEdit.emoji===em?t.accent:t.border}`}}>{em}</button>
            ))}
          </div>
          {err&&<p style={{color:t.danger,fontSize:12,margin:0}}>{err}</p>}
          <div style={{display:'flex',gap:8}}>
            <Btn t={t} variant="secondary" onClick={()=>setQEdit(null)} style={{flex:1}}>{L('Abbrechen','Cancel','Cancelar')}</Btn>
            <Btn t={t} onClick={saveTeamQ} style={{flex:1}}>{L('Speichern','Save','Guardar')}</Btn>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── MY QUESTIONS SCREEN ──────────────────────────────── */
function MyQuestionsScreen({myId, t, lang, onBack, onTeam=null}){
  const i=UI[lang]||UI.de;
  const DEFAULT_PACK = lang==='en'?'⭐ My Questions':lang==='es'?'⭐ Mis Preguntas':'⭐ Meine Fragen';
  const[questions,setQuestions]=useState([]);
  const[loading,setLoading]=useState(true);
  const[editing,setEditing]=useState(null); // null=list, 'new'=new, {id,...}=edit
  const[shareMsg,setShareMsg]=useState('');
  const[openPacks,setOpenPacks]=useState({});
  const[showOccasions,setShowOccasions]=useState(false);
  const[myTeams,setMyTeams]=useState([]);
  const[pushTarget,setPushTarget]=useState(null); // {name, questions}
  const myName=(typeof localStorage!=='undefined'&&localStorage.getItem('em_lastname'))||'—';
  useEffect(()=>{
    if(!myId) return;
    get(ref(db,`userTeams/${myId}`)).then(async snap=>{
      const ids=Object.keys(snap.val()||{});
      const res=await Promise.all(ids.map(id=>get(ref(db,`teams/${id}`)).then(s=>({id,val:s.val()})).catch(()=>({id,val:null}))));
      setMyTeams(res.filter(x=>x.val&&x.val.ownerId).map(x=>({id:x.id,name:x.val.name,role:x.val.members?.[myId]?.role})));
    }).catch(()=>{});
  },[myId]);
  const fileRef=React.useRef(null);

  useEffect(()=>{
    if(!myId) return;
    const qRef=ref(db,`userQuestions/${myId}`);
    const unsub=onValue(qRef,snap=>{
      const data=snap.val()||{};
      const list=Object.entries(data).map(([id,q])=>({id,...q}))
        .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setQuestions(list);
      setLoading(false);
    });
    return()=>unsub();
  },[myId]);

  const existingPacks=[...new Set(questions.map(q=>q.category).filter(Boolean))];

  async function sharePack(name, qs){
    try{
      const packId=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      await update(ref(db,`sharedPacks/${packId}`),{
        name, ownerId:myId, createdAt:Date.now(), lang,
        questions: qs.map(x=>({q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝'})),
      });
      const url=`${location.origin}${location.pathname}?pack=${packId}`;
      if(navigator.share){
        await navigator.share({title:name, text:(lang==='en'?'Question pack: ':lang==='es'?'Paquete: ':'Fragen-Pack: ')+name, url});
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg((lang==='en'?'Link copied: ':lang==='es'?'Enlace copiado: ':'Link kopiert: ')+name); setTimeout(()=>setShareMsg(''),2500);
      }
    }catch(e){ if(e?.name!=='AbortError') console.error('share pack failed:',e); }
  }

  async function importPack(){
    const input=window.prompt(lang==='en'?'Paste the pack link or code:'
      :lang==='es'?'Pega el enlace o código del paquete:':'Pack-Link oder Code einfügen:');
    if(!input) return;
    let packId=input.trim();
    const m=packId.match(/[?&]pack=([^&\s]+)/);
    if(m) packId=m[1];
    try{
      const snap=await get(ref(db,`sharedPacks/${packId}`));
      const pack=snap.val();
      if(!pack||!Array.isArray(pack.questions)||!pack.questions.length){
        window.alert(lang==='en'?'Pack not found.':lang==='es'?'Paquete no encontrado.':'Pack nicht gefunden.');
        return;
      }
      const name=pack.name||(lang==='en'?'Shared pack':'Geteiltes Pack');
      if(!window.confirm(lang==='en'?`Import "${name}" (${pack.questions.length} questions)?`
        :lang==='es'?`¿Importar "${name}" (${pack.questions.length})?`
        :`„${name}" (${pack.questions.length} Fragen) importieren?`)) return;
      const updates={};
      pack.questions.forEach((x,idx)=>{
        const qId=Date.now().toString(36)+idx.toString(36)+Math.random().toString(36).slice(2,4);
        updates[`userQuestions/${myId}/${qId}`]={
          q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝',
          category:name,visibility:'private',lang:pack.lang||lang,createdAt:Date.now(),authorId:myId,
        };
      });
      await update(ref(db),updates);
      setShareMsg(name); setTimeout(()=>setShareMsg(''),2500);
    }catch(e){ console.error('import failed:',e);
      window.alert(lang==='en'?'Import failed.':lang==='es'?'Error al importar.':'Import fehlgeschlagen.'); }
  }

  // ── CSV / Excel-Import ───────────────────────────────
  function parseCSVLine(line, delim){
    const out=[]; let cur=''; let inQ=false;
    for(let k=0;k<line.length;k++){
      const ch=line[k];
      if(inQ){
        if(ch==='"'){ if(line[k+1]==='"'){cur+='"';k++;} else inQ=false; }
        else cur+=ch;
      }else{
        if(ch==='"') inQ=true;
        else if(ch===delim){ out.push(cur); cur=''; }
        else cur+=ch;
      }
    }
    out.push(cur);
    return out.map(s=>s.trim());
  }
  function parseCSV(text){
    text=String(text||'').replace(/^\uFEFF/,''); // BOM entfernen
    const lines=text.split(/\r?\n/).filter(l=>l.trim()!=='' && !l.trim().startsWith('#'));
    if(!lines.length) return [];
    // Trennzeichen erkennen (deutsches Excel nutzt oft ;)
    const head=lines[0];
    const delim=(head.split(';').length>head.split(',').length)?';':',';
    const header=parseCSVLine(head, delim).map(h=>h.toLowerCase());
    const col=(...names)=>{ for(const n of names){ const idx=header.indexOf(n); if(idx>=0) return idx; } return -1; };
    const iF=col('frage','question'), iA=col('antwort','answer'), iE=col('einheit','unit'),
          iH=col('hint','tipp','hinweis'), iEm=col('emoji');
    if(iF<0||iA<0||iE<0) return []; // Pflichtspalten fehlen
    const rows=[];
    for(let k=1;k<lines.length;k++){
      const c=parseCSVLine(lines[k], delim);
      const q=(c[iF]||'').trim();
      const a=parseFloat((c[iA]||'').replace(',','.'));
      const unit=(c[iE]||'').trim();
      if(!q||isNaN(a)||!unit) continue;
      rows.push({q,a,unit,hint:iH>=0?(c[iH]||'').trim():'',emoji:(iEm>=0&&(c[iEm]||'').trim())||'📝'});
    }
    return rows;
  }
  function onCSVFile(e){
    const file=e.target.files&&e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const rows=parseCSV(reader.result);
        if(!rows.length){
          window.alert(lang==='en'?'No valid rows found. Check columns: frage/question, antwort/answer, einheit/unit.'
            :'Keine gültigen Zeilen gefunden. Spalten prüfen: frage, antwort, einheit (hint/emoji optional).');
          return;
        }
        const capped=rows.slice(0,50);
        const defName=file.name.replace(/\.(csv|txt|xlsx?|tsv)$/i,'');
        const name=(window.prompt(lang==='en'?'Pack name:':lang==='es'?'Nombre del paquete:':'Pack-Name:', defName)||defName).trim()||defName;
        const updates={};
        capped.forEach((x,idx)=>{
          const qId=Date.now().toString(36)+idx.toString(36)+Math.random().toString(36).slice(2,4);
          updates[`userQuestions/${myId}/${qId}`]={
            q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||'📝',
            category:name,visibility:'private',lang,createdAt:Date.now(),authorId:myId,
          };
        });
        await update(ref(db),updates);
        const more=rows.length>50?` (${lang==='en'?'first 50 of':'erste 50 von'} ${rows.length})`:'';
        setShareMsg(`${capped.length} → ${name}${more}`); setTimeout(()=>setShareMsg(''),3000);
      }catch(err){ console.error('csv import failed:',err);
        window.alert(lang==='en'?'CSV import failed.':'CSV-Import fehlgeschlagen.'); }
      finally{ e.target.value=''; }
    };
    reader.readAsText(file,'utf-8');
  }
  function downloadTemplate(){
    const rows = lang==='en' ? [
      ['question','answer','unit','hint','emoji'],
      ['How many guests are here today?','80','guests','Count them!','🥂'],
      ['In what year did we first meet?','2019','year','A special evening','❤️'],
      ['How many countries have I visited?','12','countries','Europe and beyond','✈️'],
      ['How many cups of coffee do I drink per week?','21','cups','Mondays are rough','☕'],
      ['How many songs are on my phone?','740','songs','A long playlist','🎵'],
      ['How many books did I read last year?','9','books','Cozy evenings','📚'],
      ['How many steps do I walk on an average day?','7500','steps','Roughly','👟'],
      ['How many plants are in my home?','14','plants','Slowly taking over','🪴'],
    ] : [
      ['frage','antwort','einheit','hint','emoji'],
      ['Wie viele Gäste sind heute hier?','80','Gäste','Zählt mal durch!','🥂'],
      ['In welchem Jahr haben wir uns kennengelernt?','2019','Jahr','Ein besonderer Abend','❤️'],
      ['Wie viele Länder habe ich bereist?','12','Länder','Europa und mehr','✈️'],
      ['Wie viele Tassen Kaffee trinke ich pro Woche?','21','Tassen','Montags besonders','☕'],
      ['Wie viele Songs sind auf meinem Handy?','740','Songs','Eine lange Playlist','🎵'],
      ['Wie viele Bücher habe ich letztes Jahr gelesen?','9','Bücher','Gemütliche Abende','📚'],
      ['Wie viele Schritte gehe ich an einem Tag?','7500','Schritte','Ungefähr','👟'],
      ['Wie viele Pflanzen stehen bei mir zuhause?','14','Pflanzen','Es werden mehr','🪴'],
    ];
    const esc=v=>{ v=String(v); return /[",;\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
    const csv=rows.map(r=>r.map(esc).join(',')).join('\r\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}); // BOM -> Excel zeigt Umlaute korrekt
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='estimates_vorlage.csv'; document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  // Anlass-Vorlage laden → editierbares Pack in „Meine Fragen"
  async function loadOccasion(occId){
    const set=OCCASION_TEMPLATES[lang]||OCCASION_TEMPLATES.de;
    const tpl=set[occId];
    if(!tpl||!Array.isArray(tpl.questions)) return;
    const packName=tpl.name;
    if(existingPacks.includes(packName) &&
       !window.confirm(lang==='en'?`A pack "${packName}" already exists. Add these questions anyway?`
        :lang==='es'?`Ya existe un paquete "${packName}". ¿Añadir estas preguntas igualmente?`
        :`Ein Pack „${packName}" existiert bereits. Fragen trotzdem hinzufügen?`)) return;
    const updates={};
    tpl.questions.forEach((x,idx)=>{
      const qId=Date.now().toString(36)+idx.toString(36)+Math.random().toString(36).slice(2,4);
      updates[`userQuestions/${myId}/${qId}`]={
        q:x.q,a:x.a,unit:x.unit,hint:x.hint||'',emoji:x.emoji||tpl.icon||'📝',
        category:packName,visibility:'private',lang,createdAt:Date.now(),authorId:myId,
      };
    });
    try{
      await update(ref(db),updates);
      setShowOccasions(false);
      setOpenPacks(o=>({...o,[packName]:true}));
      setShareMsg(`${tpl.questions.length} → ${packName}`); setTimeout(()=>setShareMsg(''),3500);
    }catch(e){ console.error('load occasion failed:',e);
      window.alert(lang==='en'?'Loading failed.':lang==='es'?'Error al cargar.':'Laden fehlgeschlagen.'); }
  }

  // Pack ins Team teilen (Slice B)
  async function pushPackToTeam(teamId, pack){
    const qs=pack.questions||[];
    if(!qs.length) return;
    try{
      const packId='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
      const qObj={};
      qs.forEach((q,i)=>{ const qId='q'+i.toString(36)+Math.random().toString(36).slice(2,5);
        qObj[qId]={q:q.q,a:q.a,unit:q.unit,hint:q.hint||'',emoji:q.emoji||'📝',lang:q.lang||lang}; });
      await update(ref(db,`teams/${teamId}/packs/${packId}`),
        {name:pack.name,createdAt:Date.now(),createdBy:myId,createdByName:myName,questions:qObj});
      setPushTarget(null);
      setShareMsg((lang==='en'?'Shared to team: ':lang==='es'?'Compartido al equipo: ':'Ins Team geteilt: ')+pack.name); setTimeout(()=>setShareMsg(''),3000);
    }catch(e){ console.error('push pack failed:',e);
      window.alert(lang==='en'?'Sharing failed.':lang==='es'?'Error al compartir.':'Teilen fehlgeschlagen.'); }
  }
  function openPushPicker(packName){
    if(!myTeams.length){ window.alert(lang==='en'?'Create or join a team first (button "Team").':lang==='es'?'Crea o únete a un equipo primero (botón "Equipo").':'Erst ein Team erstellen oder beitreten (Button „Team").'); return; }
    if(!myTeams.some(tm=>tm.role!=='viewer')){ window.alert(lang==='en'?'You only have viewer rights in your team(s).':lang==='es'?'Solo tienes permisos de lector en tu(s) equipo(s).':'In deinen Teams hast du nur Betrachter-Rechte.'); return; }
    setPushTarget({name:packName,questions:packs[packName]});
  }

  // Ganzes Pack löschen
  async function deletePack(packName){
    const qs=packs[packName]||[];
    if(!qs.length) return;
    if(!window.confirm(lang==='en'?`Delete the whole pack "${packName}" with ${qs.length} questions? This cannot be undone.`
      :lang==='es'?`¿Borrar todo el paquete "${packName}" con ${qs.length} preguntas? No se puede deshacer.`
      :`Das ganze Pack „${packName}" mit ${qs.length} Fragen löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    const updates={};
    qs.forEach(q=>{ updates[`userQuestions/${myId}/${q.id}`]=null; });
    try{
      await update(ref(db),updates);
      qs.forEach(q=>{ remove(ref(db,`communityQuestions/${q.id}`)).catch(()=>{}); });
      setOpenPacks(o=>{ const n={...o}; delete n[packName]; return n; });
      setShareMsg((lang==='en'?'Deleted: ':lang==='es'?'Borrado: ':'Gelöscht: ')+packName); setTimeout(()=>setShareMsg(''),2500);
    }catch(e){ console.error('delete pack failed:',e);
      window.alert(lang==='en'?'Delete failed.':lang==='es'?'Error al borrar.':'Löschen fehlgeschlagen.'); }
  }

  if(editing!==null){
    return <QuestionEditorScreen
      myId={myId} t={t} lang={lang}
      existingPacks={existingPacks}
      initial={editing==='new'?null:editing}
      onSave={async(q)=>{
        const qId=editing==='new'?Date.now().toString(36):editing.id;
        const qData={...q, createdAt:editing==='new'?Date.now():editing.createdAt, authorId:myId};
        await update(ref(db,`userQuestions/${myId}/${qId}`),qData);
        if(q.visibility==='submit'){
          // Opt-in: anonymisiert zur Moderation vorschlagen
          await update(ref(db,`communityQuestions/${qId}`),{
            ...qData, authorId:null,
            upvotes:0, downvotes:0, plays:0,
            status:'pending'
          });
        } else {
          // Privat: evtl. früher eingereichte Version aus dem Pool zurückziehen
          await remove(ref(db,`communityQuestions/${qId}`)).catch(()=>{});
        }
        setEditing(null);
      }}
      onCancel={()=>setEditing(null)}
    />;
  }

  // Gruppierung nach Pack
  const packs={};
  questions.forEach(q=>{ const c=q.category||DEFAULT_PACK; (packs[c]=packs[c]||[]).push(q); });
  const packNames=Object.keys(packs);

  return <div style={{...page,animation:'fu .3s ease both'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:t.muted,
        fontSize:20,cursor:'pointer',padding:0}}>←</button>
      <h2 style={{fontFamily:t.fontTitle,fontSize:28,margin:0}}>
        {lang==='en'?'My Questions':lang==='es'?'Mis Preguntas':'Meine Fragen'}
      </h2>
    </div>

    <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv"
      onChange={onCSVFile} style={{display:'none'}}/>

    <div style={{display:'flex',gap:8,marginBottom:8}}>
      <Btn t={t} onClick={()=>setEditing('new')} style={{flex:2}}>
        + {lang==='en'?'New question':lang==='es'?'Nueva pregunta':'Neue Frage'}
      </Btn>
      <Btn t={t} variant="secondary" onClick={importPack} style={{flex:1}}>
        🔗 {lang==='en'?'Link':lang==='es'?'Enlace':'Link'}
      </Btn>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:8}}>
      <Btn t={t} variant="secondary" onClick={()=>fileRef.current&&fileRef.current.click()} style={{flex:1}}>
        📄 {lang==='en'?'Import CSV':lang==='es'?'Importar CSV':'CSV importieren'}
      </Btn>
      <Btn t={t} variant="secondary" onClick={()=>setShowOccasions(true)} style={{flex:1}}>
        📋 {lang==='en'?'Templates':lang==='es'?'Plantillas':'Vorlagen'}
      </Btn>
    </div>

    {showOccasions&&<div onClick={()=>setShowOccasions(false)}
      style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.72)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:18}}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:t.radius,
        border:`1.5px solid ${t.border}`,maxWidth:420,width:'100%',maxHeight:'85vh',
        overflowY:'auto',padding:'20px',animation:'fu .25s ease both'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <h2 style={{fontFamily:t.fontTitle,fontSize:22,margin:0,color:t.text}}>
            📋 {lang==='en'?'Templates':lang==='es'?'Plantillas':'Vorlagen'}
          </h2>
          <button onClick={()=>setShowOccasions(false)} style={{background:'none',border:'none',
            color:t.muted,fontSize:24,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
        </div>
        <p style={{fontSize:12,color:t.muted,margin:'0 0 14px',lineHeight:1.5}}>
          {lang==='en'?'Ready-made occasion packs (~22 questions each) – or a blank CSV template to fill in yourself. For occasions: adjust the answers to your event!'
            :lang==='es'?'Paquetes por ocasión (~22 preguntas) – o una plantilla CSV en blanco para rellenar. En ocasiones: ¡ajusta las respuestas a tu evento!'
            :'Fertige Anlass-Pakete (~22 Fragen) – oder eine leere CSV-Vorlage zum selbst Ausfüllen. Bei Anlässen: Antworten an euer Event anpassen!'}
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {Object.entries(OCCASION_TEMPLATES[lang]||OCCASION_TEMPLATES.de).map(([occId,occ])=>(
            <button key={occId} onClick={()=>loadOccasion(occId)}
              style={{display:'flex',alignItems:'center',gap:12,width:'100%',
                padding:'14px 16px',borderRadius:t.radius,background:t.surface,
                border:`1.5px solid ${t.border}`,cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'}}>
              <span style={{fontSize:26,flexShrink:0}}>{occ.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:15,fontWeight:800,color:t.text,margin:'0 0 1px'}}>
                  {occ.name.replace(/^[^\s]+\s/,'')}
                </p>
                <p style={{fontSize:11,color:t.muted,margin:0}}>
                  {occ.questions.length} {lang==='en'?'questions':lang==='es'?'preguntas':'Fragen'}
                </p>
              </div>
              <span style={{color:t.gold,fontSize:18,fontWeight:800,flexShrink:0}}>+</span>
            </button>
          ))}
          <div style={{height:1,background:t.border,margin:'2px 0'}}/>
          <button onClick={()=>{ setShowOccasions(false); downloadTemplate(); }}
            style={{display:'flex',alignItems:'center',gap:12,width:'100%',
              padding:'14px 16px',borderRadius:t.radius,background:t.surface,
              border:`1.5px dashed ${t.border}`,cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'}}>
            <span style={{fontSize:26,flexShrink:0}}>📄</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:15,fontWeight:800,color:t.text,margin:'0 0 1px'}}>
                {lang==='en'?'Blank template (CSV)':lang==='es'?'Plantilla en blanco (CSV)':'Leere Vorlage (CSV)'}
              </p>
              <p style={{fontSize:11,color:t.muted,margin:0}}>
                {lang==='en'?'Fill in Excel/Sheets, then import':lang==='es'?'Rellena en Excel/Sheets e importa':'In Excel/Sheets ausfüllen, dann importieren'}
              </p>
            </div>
            <span style={{color:t.muted,fontSize:18,flexShrink:0}}>⬇</span>
          </button>
        </div>
      </div>
    </div>}
    <p style={{fontSize:11,color:t.muted,margin:'-8px 0 16px',lineHeight:1.5}}>
      {lang==='en'?'Tip: "Templates" gives ready-made packs or a blank CSV; "Import CSV" uploads your filled file (max 50 questions).'
        :lang==='es'?'Consejo: "Plantillas" ofrece paquetes listos o un CSV en blanco; "Importar CSV" sube tu archivo (máx. 50 preguntas).'
        :'Tipp: „Vorlagen" liefert fertige Pakete oder eine leere CSV; „CSV importieren" lädt deine ausgefüllte Datei hoch (max. 50 Fragen).'}
    </p>

    {shareMsg&&<div style={{background:t.green+'22',border:`1px solid ${t.green}55`,
      borderRadius:t.radius,padding:'10px 12px',marginBottom:12,textAlign:'center'}}>
      <p style={{fontSize:12,color:t.green,fontWeight:700,margin:0}}>
        ✓ {shareMsg}
      </p>
    </div>}

    {loading&&<div style={{textAlign:'center',padding:20}}><Spinner t={t}/></div>}

    {!loading&&questions.length===0&&<Card t={t} style={{textAlign:'center',padding:32}}>
      <div style={{fontSize:40,marginBottom:12}}>📝</div>
      <p style={{color:t.muted,fontSize:14}}>
        {lang==='en'?'No questions yet – create your first!':
         lang==='es'?'Sin preguntas aún – crea la primera!':
         'Noch keine Fragen – erstelle deine erste!'}
      </p>
    </Card>}

    {packNames.map(packName=>{
      const open=!!openPacks[packName];
      return <div key={packName} style={{marginBottom:10}}>
        {/* Pack-Header (klappt auf/zu) + Teilen */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>setOpenPacks(o=>({...o,[packName]:!o[packName]}))}
            style={{flex:1,display:'flex',alignItems:'center',gap:10,background:t.surface,
              border:`1px solid ${t.border}`,borderRadius:t.radius,padding:'11px 14px',
              cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'}}>
            <span style={{color:t.muted,fontSize:16,transform:open?'rotate(90deg)':'none',
              transition:'transform .15s',flexShrink:0}}>›</span>
            <span style={{flex:1,fontSize:13,fontWeight:800,color:t.text,overflow:'hidden',
              textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{packName}</span>
            <span style={{fontSize:12,color:t.muted,fontWeight:700,background:t.bg,
              borderRadius:100,padding:'2px 9px',flexShrink:0}}>{packs[packName].length}</span>
          </button>
          <button onClick={()=>sharePack(packName,packs[packName])}
            style={{background:'none',border:`1px solid ${t.accent}55`,borderRadius:100,
              color:t.accent,fontSize:11,fontWeight:700,cursor:'pointer',padding:'8px 11px',
              whiteSpace:'nowrap',fontFamily:t.fontBody,flexShrink:0}}>
            🔗 {lang==='en'?'Share':lang==='es'?'Compartir':'Teilen'}
          </button>
          {onTeam&&<button onClick={()=>openPushPicker(packName)}
            title={lang==='en'?'Share to team':lang==='es'?'Compartir al equipo':'Ins Team teilen'}
            style={{background:'none',border:`1px solid ${t.gold}66`,borderRadius:100,
              color:t.gold,fontSize:13,cursor:'pointer',padding:'8px 11px',
              whiteSpace:'nowrap',fontFamily:t.fontBody,flexShrink:0}}>
            👥
          </button>}
          <button onClick={()=>deletePack(packName)}
            title={lang==='en'?'Delete pack':lang==='es'?'Borrar paquete':'Pack löschen'}
            style={{background:'none',border:`1px solid ${t.danger}55`,borderRadius:100,
              color:t.danger,fontSize:13,fontWeight:700,cursor:'pointer',padding:'8px 11px',
              whiteSpace:'nowrap',fontFamily:t.fontBody,flexShrink:0}}>
            🗑
          </button>
        </div>

        {open&&<div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8,marginBottom:8}}>
          {packs[packName].map(q=><Card key={q.id} t={t} style={{padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <span style={{fontSize:22,flexShrink:0}}>{q.emoji||'📝'}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:t.text,margin:'0 0 2px',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.q}</p>
                <p style={{fontSize:12,color:t.accent,margin:0,fontWeight:700}}>
                  {q.a} {q.unit}
                </p>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>setEditing(q)}
                  style={{background:'none',border:`1px solid ${t.border}`,borderRadius:t.radius,
                    color:t.text,fontSize:11,fontWeight:600,cursor:'pointer',padding:'3px 9px',whiteSpace:'nowrap'}}>
                  ✏ {lang==='en'?'Edit':lang==='es'?'Editar':'Bearbeiten'}
                </button>
                <button onClick={async()=>{
                  if(!window.confirm(lang==='en'?'Delete?':lang==='es'?'Borrar?':'Löschen?')) return;
                  await remove(ref(db,`userQuestions/${myId}/${q.id}`));
                  await remove(ref(db,`communityQuestions/${q.id}`)).catch(()=>{});
                }} style={{background:'none',border:`1px solid ${t.danger}44`,borderRadius:t.radius,
                  color:t.danger,fontSize:11,fontWeight:600,cursor:'pointer',padding:'3px 9px',whiteSpace:'nowrap'}}>
                  ✕ {lang==='en'?'Delete':lang==='es'?'Borrar':'Löschen'}
                </button>
              </div>
            </div>
            {q.hint&&<p style={{fontSize:11,color:t.muted,margin:'6px 0 0',paddingLeft:32}}>
              💡 {q.hint}
            </p>}
            <div style={{display:'flex',gap:8,marginTop:8,paddingLeft:32,flexWrap:'wrap'}}>
              {q.plays>0&&<span style={{fontSize:10,color:t.muted}}>🎮 {q.plays}x</span>}
              {q.visibility==='submit'
                ? (q.status==='approved'
                    ? <span style={{fontSize:10,color:t.green,fontWeight:700}}>✓ {lang==='en'?'Approved':lang==='es'?'Aprobada':'Genehmigt'}</span>
                    : q.status==='rejected'
                    ? <span style={{fontSize:10,color:t.danger,fontWeight:700}}>✕ {lang==='en'?'Rejected':lang==='es'?'Rechazada':'Abgelehnt'}</span>
                    : <span style={{fontSize:10,color:t.gold,fontWeight:700}}>🌍 {lang==='en'?'In review':lang==='es'?'En revisión':'In Prüfung'}</span>)
                : <span style={{fontSize:10,color:t.muted}}>🔒 {lang==='en'?'Private':lang==='es'?'Privada':'Privat'}</span>}
            </div>
          </Card>)}
        </div>}
      </div>;
    })}

    {/* Team-Picker zum Teilen eines Packs */}
    {pushTarget&&<div onClick={()=>setPushTarget(null)}
      style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.72)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:18}}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:t.radius,
        border:`1.5px solid ${t.border}`,maxWidth:380,width:'100%',padding:'20px',animation:'fu .25s ease both'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <h3 style={{fontFamily:t.fontTitle,fontSize:19,margin:0,color:t.text}}>
            👥 {lang==='en'?'Share to team':lang==='es'?'Compartir al equipo':'Ins Team teilen'}
          </h3>
          <button onClick={()=>setPushTarget(null)} style={{background:'none',border:'none',
            color:t.muted,fontSize:24,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
        </div>
        <p style={{fontSize:12,color:t.muted,margin:'0 0 14px'}}>
          „{pushTarget.name}" → {lang==='en'?'choose a team:':lang==='es'?'elige un equipo:':'Team wählen:'}
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {myTeams.filter(tm=>tm.role!=='viewer').map(tm=>(
            <button key={tm.id} onClick={()=>pushPackToTeam(tm.id,pushTarget)}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'12px 14px',
                borderRadius:t.radius,background:t.surface,border:`1.5px solid ${t.border}`,
                cursor:'pointer',fontFamily:t.fontBody,textAlign:'left'}}>
              <span style={{fontSize:20}}>👥</span>
              <span style={{flex:1,fontSize:14,fontWeight:700,color:t.text}}>{tm.name}</span>
              <span style={{color:t.accent,fontSize:18,fontWeight:800}}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>}
  </div>;
}

/* ─── EDITOR-HILFE ─────────────────────────────────────── */
function EditorHelpOverlay({t, lang, onClose}){
  const L=(de,en,es)=>lang==='en'?en:lang==='es'?es:de;
  const steps=[
    {icon:'❓', title:L('Eine gute Frage','A good question','Una buena pregunta'),
      body:L('Stelle eine Schätzfrage mit einer eindeutigen Zahl als Antwort. Am besten beginnt sie mit „Wie viele…" oder „Wie lange…". Beispiel: „Wie viele Länder habe ich bereist?"',
             'Ask an estimation question with one clear number as the answer. It works best starting with “How many…” or “How long…”. Example: “How many countries have I visited?”',
             'Haz una pregunta de estimación con un número claro como respuesta. Funciona mejor si empieza con “¿Cuántos…?”. Ejemplo: “¿Cuántos países he visitado?”')},
    {icon:'🔢', title:L('Antwort & Einheit','Answer & unit','Respuesta y unidad'),
      body:L('Die Antwort muss eine Zahl sein (Dezimalstellen mit Punkt, z. B. 3.5). Die Einheit beschreibt, was gezählt wird – z. B. „Länder", „Tage", „€".',
             'The answer must be a number (decimals with a dot, e.g. 3.5). The unit describes what is counted – e.g. “countries”, “days”, “€”.',
             'La respuesta debe ser un número (decimales con punto, p. ej. 3.5). La unidad describe qué se cuenta – p. ej. “países”, “días”, “€”.')},
    {icon:'💡', title:L('Hinweis (optional)','Hint (optional)','Pista (opcional)'),
      body:L('Ein kurzer Fun Fact, der nach dem Auflösen gezeigt wird – macht die Frage persönlicher und unterhaltsamer.',
             'A short fun fact shown after the reveal – it makes the question more personal and entertaining.',
             'Un dato curioso que se muestra tras revelar – hace la pregunta más personal y divertida.')},
    {icon:'📦', title:L('Packs / Kategorien','Packs / categories','Paquetes / categorías'),
      body:L('Sortiere deine Fragen in Packs (z. B. „Lisas Hochzeit"). Ein Pack kannst du später per Link mit anderen teilen oder im Spiel als Kategorie auswählen.',
             'Sort your questions into packs (e.g. “Lisa’s Wedding”). You can share a pack via link or pick it as a category in a game.',
             'Organiza tus preguntas en paquetes (p. ej. “Boda de Lisa”). Puedes compartir un paquete por enlace o elegirlo como categoría en una partida.')},
    {icon:'🌍', title:L('Sichtbarkeit','Visibility','Visibilidad'),
      body:L('„Nur meine Runden" bleibt privat. „Für alle vorschlagen" reicht die Frage zur Prüfung ein – wird sie genehmigt, taucht sie anonym im Community-Pool auf.',
             '“My games only” stays private. “Suggest for all” submits it for review – once approved it appears anonymously in the community pool.',
             '“Solo mis partidas” queda privada. “Proponer para todos” la envía a revisión – si se aprueba aparece de forma anónima en el grupo de la comunidad.')},
    {icon:'📄', title:L('Viele auf einmal (CSV)','Many at once (CSV)','Muchas a la vez (CSV)'),
      body:L('Über „Vorlage" lädst du eine Tabelle herunter, füllst sie in Excel/Sheets aus und importierst sie per „CSV importieren" – bis zu 50 Fragen auf einmal.',
             'Use “Template” to download a sheet, fill it in Excel/Sheets and import it via “Import CSV” – up to 50 questions at once.',
             'Usa “Plantilla” para descargar una hoja, complétala en Excel/Sheets e impórtala con “Importar CSV” – hasta 50 preguntas de una vez.')},
  ];
  return <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:600,
    background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',
    padding:18}}>
    <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:t.radius,
      border:`1.5px solid ${t.border}`,maxWidth:440,width:'100%',maxHeight:'85vh',
      overflowY:'auto',padding:'22px 20px',animation:'fu .25s ease both'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <h2 style={{fontFamily:t.fontTitle,fontSize:24,margin:0,color:t.text}}>
          {L('So erstellst du Fragen','How to create questions','Cómo crear preguntas')}
        </h2>
        <button onClick={onClose} style={{background:'none',border:'none',color:t.muted,
          fontSize:24,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {steps.map((s,idx)=><div key={idx} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <span style={{fontSize:24,flexShrink:0,lineHeight:1.1}}>{s.icon}</span>
          <div>
            <p style={{fontSize:14,fontWeight:800,color:t.text,margin:'0 0 3px'}}>{s.title}</p>
            <p style={{fontSize:13,color:t.muted,margin:0,lineHeight:1.5}}>{s.body}</p>
          </div>
        </div>)}
      </div>
      <Btn t={t} onClick={onClose} full style={{marginTop:20}}>
        {L('Verstanden','Got it','Entendido')}
      </Btn>
    </div>
  </div>;
}

/* ─── QUESTION EDITOR ──────────────────────────────────── */
function QuestionEditorScreen({myId, t, lang, initial, onSave, onCancel, existingPacks=[]}){
  const DEFAULT_PACK = lang==='en'?'⭐ My Questions':lang==='es'?'⭐ Mis Preguntas':'⭐ Meine Fragen';
  const isNew = !initial;
  const[q,setQ]=useState(initial?.q||'');
  const[a,setA]=useState(initial?.a!=null?String(initial.a):'');
  const[unit,setUnit]=useState(initial?.unit||'');
  const[hint,setHint]=useState(initial?.hint||'');
  const[emoji,setEmoji]=useState(initial?.emoji||'📝');
  const[category,setCategory]=useState(initial?.category||DEFAULT_PACK);
  const[visibility,setVisibility]=useState(initial?.visibility||'private');
  const[error,setError]=useState('');
  const[saving,setSaving]=useState(false);
  const[showHelp,setShowHelp]=useState(false);
  const[newCatMode,setNewCatMode]=useState(false);

  const EMOJIS=['📝','🎯','🔢','💡','🌍','🏆','🎲','⭐','🔬','🎭','🍔','🎵','🚀','💰','🏋️','🐾'];
  const packSuggestions=[...new Set([DEFAULT_PACK,...existingPacks])].filter(Boolean);

  async function save(){
    if(!q.trim()){setError(lang==='en'?'Please enter a question.':lang==='es'?'Introduce una pregunta.':'Bitte eine Frage eingeben.');return;}
    const num=parseFloat(a.replace(',','.'));
    if(isNaN(num)){setError(lang==='en'?'Answer must be a number.':lang==='es'?'La respuesta debe ser un número.':'Antwort muss eine Zahl sein.');return;}
    if(!unit.trim()){setError(lang==='en'?'Please enter a unit.':lang==='es'?'Introduce una unidad.':'Bitte eine Einheit angeben.');return;}
    setError('');setSaving(true);
    try {
      await onSave({q:q.trim(),a:num,unit:unit.trim(),
        hint:hint.trim(),emoji,lang,
        category:(category.trim()||DEFAULT_PACK),
        visibility:(visibility==='submit'?'submit':'private')});
      // bei Erfolg unmountet der Screen (onSave setzt editing=null) – kein setSaving nötig
    } catch(e) {
      console.error('save question failed:', e);
      const denied = e?.code==='PERMISSION_DENIED' || /permission/i.test(e?.message||'');
      setError(denied
        ? (lang==='en'?'Saving failed: missing permission. Check the Firebase rules (userQuestions).'
          :lang==='es'?'Error al guardar: faltan permisos. Revisa las reglas de Firebase (userQuestions).'
          :'Speichern fehlgeschlagen: fehlende Berechtigung. Firebase-Rules prüfen (userQuestions).')
        : (lang==='en'?'Saving failed. Please try again.'
          :lang==='es'?'Error al guardar. Inténtalo de nuevo.'
          :'Speichern fehlgeschlagen. Bitte erneut versuchen.'));
      setSaving(false);
    }
  }

  const labelStyle={fontSize:13,color:t.text,fontWeight:600,margin:'0 0 4px',display:'block'};
  const sectionStyle={borderTop:`1px solid ${t.border}`,paddingTop:14,marginTop:2};
  const selectStyle={width:'100%',background:t.surface,border:`1.5px solid ${t.border}`,
    borderRadius:t.radius,color:t.text,fontSize:14,padding:'10px 12px',
    fontFamily:t.fontBody,boxSizing:'border-box',cursor:'pointer',appearance:'none',
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236e5e54' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:32};

  return <div style={{...page,animation:'fu .3s ease both'}}>
    {showHelp&&<EditorHelpOverlay t={t} lang={lang} onClose={()=>setShowHelp(false)}/>}
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
      <button onClick={onCancel} style={{background:'none',border:'none',color:t.muted,
        fontSize:20,cursor:'pointer',padding:0}}>←</button>
      <h2 style={{fontFamily:t.fontTitle,fontSize:28,margin:0,flex:1}}>
        {isNew
          ?(lang==='en'?'New Question':lang==='es'?'Nueva Pregunta':'Neue Frage')
          :(lang==='en'?'Edit Question':lang==='es'?'Editar Pregunta':'Frage bearbeiten')}
      </h2>
      <button onClick={()=>setShowHelp(true)} title={lang==='en'?'How it works':lang==='es'?'Cómo funciona':'So geht\'s'}
        style={{background:'none',border:`1.5px solid ${t.border}`,borderRadius:'50%',
          width:34,height:34,color:t.muted,fontSize:16,fontWeight:800,cursor:'pointer',
          flexShrink:0,fontFamily:t.fontBody}}>?</button>
    </div>

    <Card t={t} style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* 1) Die Frage – das Wichtigste zuerst */}
      <div>
        <span style={labelStyle}>
          {lang==='en'?'Question (start with "How many...")':
           lang==='es'?'Pregunta (empieza con "Cuántos...")':
           'Frage (beginne mit "Wie viele...")'}
        </span>
        <textarea value={q} onChange={e=>setQ(e.target.value)}
          placeholder={lang==='en'?'How many days did...':
            lang==='es'?'Cuántos días duró...':'Wie viele Tage dauerte...'}
          rows={3}
          style={{width:'100%',background:t.surface,border:`1.5px solid ${t.border}`,
            borderRadius:t.radius,color:t.text,fontSize:14,padding:'10px 12px',
            fontFamily:t.fontBody,resize:'none',boxSizing:'border-box'}}/>
      </div>

      {/* 2) Antwort + Einheit */}
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1}}>
          <span style={labelStyle}>
            {lang==='en'?'Answer (number)':lang==='es'?'Respuesta (número)':'Antwort (Zahl)'}
          </span>
          <Inp value={a} onChange={setA} placeholder="42" t={t}
            style={{fontFamily:'monospace',fontWeight:700}}/>
        </div>
        <div style={{flex:1}}>
          <span style={labelStyle}>
            {lang==='en'?'Unit':lang==='es'?'Unidad':'Einheit'}
          </span>
          <Inp value={unit} onChange={setUnit}
            placeholder={lang==='en'?'e.g. days':lang==='es'?'ej. días':'z.B. Tage'} t={t}/>
        </div>
      </div>

      {/* 3) Darstellung: Emoji + Hinweis */}
      <div style={sectionStyle}>
        <span style={labelStyle}>
          {lang==='en'?'Icon':lang==='es'?'Icono':'Symbol'}
        </span>
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,WebkitOverflowScrolling:'touch'}}>
          {EMOJIS.map(em=><button key={em} onClick={()=>setEmoji(em)}
            style={{fontSize:20,background:emoji===em?t.accent+'22':'none',
              border:`1.5px solid ${emoji===em?t.accent:t.border}`,
              borderRadius:t.radius,padding:'3px 7px',cursor:'pointer',flexShrink:0}}>
            {em}
          </button>)}
        </div>
        <span style={{...labelStyle,marginTop:12}}>
          💡 {lang==='en'?'Hint (optional)':lang==='es'?'Pista (opcional)':'Hinweis (optional)'}
        </span>
        <Inp value={hint} onChange={setHint}
          placeholder={lang==='en'?'Fun fact about the answer...':
            lang==='es'?'Dato curioso sobre la respuesta...':
            'Fun Fact zur Antwort...'} t={t}/>
      </div>

      {/* 4) Pack / Kategorie – Dropdown statt Knopf-Wolke */}
      <div style={sectionStyle}>
        <span style={labelStyle}>
          📦 {lang==='en'?'Pack / category':lang==='es'?'Paquete / categoría':'Pack / Kategorie'}
        </span>
        {!newCatMode
          ? <select
              value={packSuggestions.includes(category)?category:'__new__'}
              onChange={e=>{
                if(e.target.value==='__new__'){ setNewCatMode(true); setCategory(''); }
                else setCategory(e.target.value);
              }}
              style={selectStyle}>
              {packSuggestions.map(p=><option key={p} value={p}>{p}</option>)}
              <option value="__new__">➕ {lang==='en'?'New category…':lang==='es'?'Nueva categoría…':'Neue Kategorie…'}</option>
            </select>
          : <div style={{display:'flex',gap:8}}>
              <Inp value={category} onChange={setCategory}
                placeholder={lang==='en'?'e.g. Anna\'s Wedding':lang==='es'?'p.ej. Boda de Ana':'z.B. Lisas Hochzeit'} t={t} style={{flex:1}}/>
              <button onClick={()=>{ setNewCatMode(false); setCategory(DEFAULT_PACK); }}
                title={lang==='en'?'Cancel':lang==='es'?'Cancelar':'Abbrechen'}
                style={{background:'none',border:`1.5px solid ${t.border}`,borderRadius:t.radius,
                  color:t.muted,fontSize:18,cursor:'pointer',padding:'0 12px',flexShrink:0}}>×</button>
            </div>}
      </div>

      {/* 5) Sichtbarkeit */}
      <div style={sectionStyle}>
        <span style={labelStyle}>
          {lang==='en'?'Visibility':lang==='es'?'Visibilidad':'Sichtbarkeit'}
        </span>
        <div style={{display:'flex',gap:8}}>
          {[
            {id:'private',icon:'🔒',label:lang==='en'?'My games only':lang==='es'?'Solo mis partidas':'Nur meine Runden'},
            {id:'submit',icon:'🌍',label:lang==='en'?'Suggest for all':lang==='es'?'Proponer para todos':'Für alle vorschlagen'},
          ].map(v=>(
            <button key={v.id} onClick={()=>setVisibility(v.id)}
              style={{flex:1,padding:'9px 10px',borderRadius:t.radius,cursor:'pointer',
                border:`1.5px solid ${visibility===v.id?t.accent:t.border}`,
                background:visibility===v.id?t.accent+'18':t.surface,
                color:visibility===v.id?t.accent:t.muted,fontWeight:700,fontSize:12,
                fontFamily:t.fontBody,textAlign:'center'}}>
              <span style={{fontSize:16,display:'block',marginBottom:2}}>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>
        <p style={{fontSize:11,color:t.muted,margin:'6px 0 0',lineHeight:1.4}}>
          {visibility==='submit'
            ?(lang==='en'?'Will be sent to the team for review before it can appear for everyone.'
              :lang==='es'?'Se enviará al equipo para revisión antes de aparecer para todos.'
              :'Wird zur Prüfung eingereicht, bevor sie für alle erscheinen kann.')
            :(lang==='en'?'Stays private – usable in your games and shareable via pack link.'
              :lang==='es'?'Queda privada – usable en tus partidas y compartible por enlace.'
              :'Bleibt privat – nutzbar in deinen Runden und per Pack-Link teilbar.')}
        </p>
      </div>

      {/* Vorschau */}
      {q&&a&&unit&&<div style={{background:t.surface,borderRadius:t.radius,
        padding:'12px',border:`1.5px solid ${t.border}`}}>
        <p style={{fontSize:11,color:t.muted,margin:'0 0 8px',fontWeight:700,letterSpacing:.8}}>
          {lang==='en'?'PREVIEW':lang==='es'?'VISTA PREVIA':'VORSCHAU'}
        </p>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:28,marginBottom:4}}>{emoji}</div>
          <p style={{fontSize:14,color:t.text,margin:'0 0 8px'}}>{q}</p>
          <p style={{fontSize:28,fontFamily:t.fontTitle,color:t.accent,fontWeight:900,margin:0}}>
            {a} {unit.toUpperCase()}
          </p>
          {hint&&<p style={{fontSize:12,color:t.muted,marginTop:8}}>{hint}</p>}
        </div>
      </div>}

      {error&&<p style={{color:t.danger,fontSize:13,margin:0}}>{error}</p>}

      <div style={{display:'flex',gap:8}}>
        <Btn t={t} variant="secondary" onClick={onCancel} style={{flex:1}}>
          {lang==='en'?'Cancel':lang==='es'?'Cancelar':'Abbrechen'}
        </Btn>
        <Btn t={t} onClick={save} disabled={saving} style={{flex:2}}>
          {saving?'...':(lang==='en'?'Save question':lang==='es'?'Guardar':'Frage speichern')}
        </Btn>
      </div>
    </Card>
  </div>;
}

function App(){
  const[screen,setScreen]=useState("home");
  const[room,setRoom]=useState(null);
  const[code,setCode]=useState(null);
  const[myId,setMyId]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[showLoginPrompt,setShowLoginPrompt]=useState(false);
  const[showA11y,setShowA11y]=useState(false);
  const[online,setOnline]=useState(true);
  const[showReconnected,setShowReconnected]=useState(false);
  const hasConnectedRef=useRef(false);
  const hasDroppedRef=useRef(false);
  const[showOnboarding,setShowOnboarding]=useState(()=>!localStorage.getItem('em_onboarded'));
  const[showSteckbrief,setShowSteckbrief]=useState(false);
  const[showColorEditor,setShowColorEditor]=useState(false);
  const[showBusiness,setShowBusiness]=useState(false);
  const[bizTick,setBizTick]=useState(0);
  const[gamePaused,setGamePaused]=useState(false);
  const[soundOn,setSoundOn]=useState(isSoundOn());
  const[showCountdown,setShowCountdown]=useState(false);
  const[isAnonymous,setIsAnonymous]=useState(true);
  const[userName,setUserName]=useState(null);
  const[isPro,setIsPro]=useState(false);
  const[profile,setProfile]=useState(null); // Account-Profil (nur eingeloggte Nutzer)

  const[mode,setMode]=useState("adult");
  const[loading,setLoading]=useState(false);
  const[loadTxt,setLoadTxt]=useState("");
  const[debugMode,setDebugMode]=useState(false);
  const[lang,setLangState]=useState(()=>localStorage.getItem("em_lang")||"de");

  function setLang(l){
    setLangState(l);
    localStorage.setItem("em_lang",l);
    QUESTIONS=QUESTIONS_MAP[l]||QUESTIONS_MAP.de;
    QUESTIONS_RAW=QUESTIONS_RAW_MAP[l]||QUESTIONS_RAW_MAP.de;
  }
  // Firebase Auth + App init
  useEffect(()=>{
    QUESTIONS=QUESTIONS_MAP[lang]||QUESTIONS_MAP.de;
    QUESTIONS_RAW=QUESTIONS_RAW_MAP[lang]||QUESTIONS_RAW_MAP.de;

    // Handle redirect result (after Google/Apple redirect login)
    if(auth) {
      getRedirectResult(auth).then(result=>{
        if(result?.user){
          console.log('Redirect result success:', result.user.uid, result.user.isAnonymous);
          setMyId(result.user.uid);
          setIsAnonymous(result.user.isAnonymous);
          setUserName(result.user.displayName||result.user.email||null);
          setShowLoginPrompt(false);
          // Store login success indicator
          sessionStorage.setItem('em_redirect_result', 'success:'+result.user.uid.slice(0,8));
        } else {
          sessionStorage.setItem('em_redirect_result', 'null_result');
        }
      }).catch(async e=>{
        console.log('Redirect result error:', e.code);
        sessionStorage.setItem('em_redirect_result', 'error:'+e.code);
        if(e.code === 'auth/credential-already-in-use') {
          // The Google/Apple account already belongs to an existing user.
          // Reuse the credential from the error to sign into that account –
          // do NOT signOut+redirect again (that drops the credential and loops).
          try {
            const cred = GoogleAuthProvider.credentialFromError(e) || OAuthProvider.credentialFromError(e);
            if(cred){
              const r = await signInWithCredential(auth, cred);
              if(r?.user){
                setMyId(r.user.uid);
                setIsAnonymous(r.user.isAnonymous);
                setUserName(r.user.displayName||r.user.email||null);
                setShowLoginPrompt(false);
              }
            }
          } catch(err) {
            console.error('credential re-use sign in failed:', err);
          }
        }
      });
    }

    // Sign in anonymously on first load
    let lastHeartbeatUid=null;
    const unsubAuth = auth.onAuthStateChanged(user=>{
      if(user){
        console.log('Auth state changed:', user.uid, 'anon:', user.isAnonymous);
        setMyId(user.uid);
        setIsAnonymous(user.isAnonymous);
        setUserName(user.displayName||user.email||null);
        setIsPro(isAdmin(user.uid));
        setAuthReady(true);
        // Auto-close login prompt if user is now logged in with Google
        if(!user.isAnonymous) setShowLoginPrompt(false);
        // Account-Heartbeat für Admin-Statistik (anon vs. registriert, returning)
        if(user.uid!==lastHeartbeatUid){
          lastHeartbeatUid=user.uid;
          const uref=ref(db,`globalStats/users/${user.uid}`);
          get(uref).then(s=>{
            const prev=s.val()||{};
            const method=user.isAnonymous?'anonymous':((user.providerData&&user.providerData[0]&&user.providerData[0].providerId)||'unknown');
            update(uref,{
              anon:user.isAnonymous,
              method,
              lang:(typeof localStorage!=='undefined'&&localStorage.getItem('em_lang'))||'de',
              firstSeen:prev.firstSeen||Date.now(),
              lastSeen:Date.now(),
              opens:(prev.opens||0)+1,
            }).catch(()=>{});
          }).catch(()=>{});
        }
      } else {
        signInAnonymously(auth).catch(err=>console.error('Auth error:',err));
      }
    });

    return ()=>unsubAuth();
  },[]);

  // Pack-Import via ?pack= Link
  useEffect(()=>{
    if(!authReady||!myId) return;
    const packId=new URLSearchParams(location.search).get('pack');
    if(!packId) return;
    get(ref(db,`sharedPacks/${packId}`)).then(snap=>{
      const pack=snap.val();
      if(pack&&Array.isArray(pack.questions)&&pack.questions.length){
        const name=pack.name||(lang==='en'?'Shared pack':'Geteiltes Pack');
        const ok=window.confirm(
          lang==='en'?`Import pack "${name}" (${pack.questions.length} questions) into your questions?`
          :lang==='es'?`¿Importar el paquete "${name}" (${pack.questions.length} preguntas)?`
          :`Fragen-Pack „${name}" (${pack.questions.length} Fragen) zu deinen Fragen hinzufügen?`);
        if(ok){
          const updates={};
          pack.questions.forEach((x,idx)=>{
            const qId=Date.now().toString(36)+idx.toString(36)+Math.random().toString(36).slice(2,4);
            updates[`userQuestions/${myId}/${qId}`]={
              q:x.q, a:x.a, unit:x.unit, hint:x.hint||'', emoji:x.emoji||'📝',
              category:name, visibility:'private',
              lang:pack.lang||lang, createdAt:Date.now(), authorId:myId,
            };
          });
          return update(ref(db),updates);
        }
      }
    }).catch(e=>console.error('pack import failed:',e)).finally(()=>{
      // Param entfernen, damit Reload nicht erneut importiert
      const u=new URL(location.href); u.searchParams.delete('pack');
      window.history.replaceState({},'',u.toString());
    });
  },[authReady,myId]);

  // Auto-reconnect once myId is ready
  const autoJoinedRef = React.useRef(false);
  const prevRoomRef = useRef(null);
  const showSteckbriefShownRef = useRef(false);
  const isHostRef = useRef(false);
  useEffect(()=>{
    if(!myId || autoJoinedRef.current) return;
    let sessionRoom=null; try{ sessionRoom=localStorage.getItem('em_session'); }catch(e){}
    const urlRoom = new URLSearchParams(location.search).get('room');
    const target = sessionRoom || urlRoom;
    if(!target) return;
    // Nur wieder reinkommen, wenn dieser Spieler noch Mitglied des Raums ist (echter Reconnect)
    dbGet(target).then(r => {
      if(r && r.players && r.players[myId] && !(r.kicked||{})[myId]) {
        autoJoinedRef.current = true;
        isHostRef.current = (r.hostId === myId);
        setCode(target);
        setMode(r.mode||'adult');
        listenRoom(target);
      } else if(sessionRoom) {
        // Raum vorbei / kein Mitglied mehr → veraltete Session verwerfen
        try{ localStorage.removeItem('em_session'); }catch(e){}
      }
    }).catch(()=>{});
  },[myId]);
  // Aktive Session merken (für Reload-Schutz) – wird beim Verlassen/Beenden (code=null) geleert
  const sessionInitRef = useRef(false);
  useEffect(()=>{
    if(!sessionInitRef.current){ sessionInitRef.current=true; return; } // ersten Lauf überspringen, sonst wird gespeicherte Session beim Start gelöscht
    try{ if(code) localStorage.setItem('em_session', code); else localStorage.removeItem('em_session'); }catch(e){}
  },[code]);
  // Account-Profil laden (nur eingeloggte Nutzer)
  useEffect(()=>{
    if(!myId || isAnonymous){ setProfile(null); return; }
    get(ref(db,`userProfiles/${myId}`)).then(s=>setProfile(s.val()||null)).catch(()=>{});
  },[myId,isAnonymous]);
  function saveProfile(data){
    if(!myId || isAnonymous) return;
    const clean={}; Object.entries(data||{}).forEach(([k,v])=>{ if(v!==undefined) clean[k]=v; });
    setProfile(p=>({...(p||{}),...clean}));
    update(ref(db,`userProfiles/${myId}`),clean).catch(()=>{});
  }
  const usedIdsRef=useRef([]);
  const selectedCatsRef=useRef([]);
  const enabledJokersRef=useRef([]);
  const unsubRef=useRef(null);
  const advanceGuessPhaseRef=useRef(false);
  const advanceBetPhaseRef=useRef(false);
  const baseTheme=applyA11y(mode==="kids"?KIDS:ADULT);
  const isHostHere = !!(room && room.hostId && myId && room.hostId===myId);
  // CI-Farben des Gastgebers auf alle Teilnehmer-Geräte spielen (Host hat sie lokal schon)
  const t = (room && room.theme && typeof room.theme==='object' && !isHostHere)
    ? {...baseTheme, ...room.theme}
    : baseTheme;
  useEffect(()=>{inject(globalCSS(t));},[t]);
  const[a11yTick,setA11yTick]=useState(0);
  useEffect(()=>{ applyLargeText(); },[]);
  function handleA11y(key,val){ setA11yPref(key,val); setA11yTick(x=>x+1); }
  // Hellen Modus + Custom-Farben (CI) des Hosts in den Raum spiegeln → Beamer übernimmt sie
  useEffect(()=>{
    if(!code || !isHostRef.current) return;
    const hasColors = typeof CUSTOM_COLORS!=='undefined' && CUSTOM_COLORS && Object.keys(CUSTOM_COLORS).length>0;
    update(ref(db,`rooms/${code}`),{
      lightMode: !!(typeof A11Y!=='undefined'&&A11Y.light),
      theme: hasColors ? CUSTOM_COLORS : null,
    }).catch(()=>{});
  },[code,a11yTick,room?.hostId]);
  // Business-CI (Name + Logo) des Hosts in den Raum spiegeln → Beamer & Lobby zeigen "powered by"
  useEffect(()=>{
    if(!code || !isHostRef.current) return;
    const name=(typeof BIZ!=='undefined'&&BIZ.name)?BIZ.name:null;
    const logo=(typeof BIZ!=='undefined'&&BIZ.logo)?BIZ.logo:null;
    update(ref(db,`rooms/${code}`),{bizName:name, bizLogo:logo}).catch(()=>{});
  },[code,bizTick,room?.hostId]);

  // Verbindungsstatus (nahtloser Reconnect-Feedback) – Firebase nimmt Listener selbst wieder auf
  useEffect(()=>{
    let flashTimer=null;
    const cref=ref(db,'.info/connected');
    const unsub=onValue(cref,snap=>{
      const v=snap.val()===true;
      setOnline(v);
      if(v){
        if(hasDroppedRef.current){
          setShowReconnected(true);
          if(flashTimer)clearTimeout(flashTimer);
          flashTimer=setTimeout(()=>setShowReconnected(false),2200);
          hasDroppedRef.current=false;
        }
        hasConnectedRef.current=true;
      } else if(hasConnectedRef.current){
        hasDroppedRef.current=true;
      }
    });
    return()=>{ if(flashTimer)clearTimeout(flashTimer); unsub(); };
  },[]);

  function listenRoom(c){
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=dbListen(c,r=>{
      if(!r)return;
      try{
      setRoom({...r});
      setMode(r.mode||"adult");
      const map={lobby:"lobby",jokerSetup:"jokerSetup",categories:"categories",question:"question",betting:"betting",results:"results",final:"final"};
      const currentUid = auth?.currentUser?.uid || myId;
      // Host-Status autoritativ aus den Raumdaten (überlebt Reload)
      if(r.hostId) isHostRef.current = (r.hostId === currentUid);
      // Non-host players wait in lobby during setup phases
      if(map[r.phase]){
        if(!isHostRef.current && (r.phase==="jokerSetup"||r.phase==="categories")){
          setScreen("lobby");
        } else {
          setScreen(map[r.phase]);
        }
      }
      // Show steckbrief when in lobby and steckbriefEnabled (catches both join and host-enable)
      const prevSteckbrief = prevRoomRef.current?.steckbriefEnabled;
      if(r.steckbriefEnabled&&!showSteckbriefShownRef.current&&r.players?.[currentUid]&&(r.phase==="lobby"||r.phase==="jokerSetup"||r.phase==="categories"||r.phase==="question")){
        showSteckbriefShownRef.current=true;
        setShowSteckbrief(true);
      }
      // Show countdown only on very first question (categories→question transition)
      if(r.phase==="question"&&prevRoomRef.current?.phase==="categories") setShowCountdown(true);
      if(r.phase==="question"){advanceGuessPhaseRef.current=false;advanceBetPhaseRef.current=false;}
      prevRoomRef.current = r;
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
      }catch(err){console.error("🔴 listenRoom error:",err);}
    });
  }

  async function handleHost(name,m,steckbriefData=null){
    // Ensure auth is ready before creating room
    let uid = auth?.currentUser?.uid;
    if(!uid){
      let waited=0;
      while(!auth?.currentUser?.uid && waited<5000){ await new Promise(r=>setTimeout(r,200)); waited+=200; }
      uid = auth?.currentUser?.uid;
      if(!uid){ console.error("Auth timeout in handleHost"); return; }
      setMyId(uid);
    }
    setMode(m);
    const c=genCode();
    setCode(c);
    saveProfile({name, kampfname:steckbriefData?.kampfname||'', fact:steckbriefData?.fact||'', selfie:steckbriefData?.selfie||null});
    setLoadTxt("Raum wird erstellt...");
    setLoading(true);
    isHostRef.current = true;
    await dbSet(c,{code:c,mode:m,lang,hostId:uid,players:{[uid]:{id:uid,name}},order:[uid],phase:"lobby",guesses:{},bets:{},scores:{},roundScores:{},q:null,qIdx:0,history:[],jokers:{},enabledJokers:[],jokerStats:{},sabotageStats:{},farthestStreak:{},afkPlayers:{},createdAt:Date.now()});
    if(steckbriefData){
      await update(ref(db,`rooms/${c}/steckbriefe/${uid}`),{
        name, kampfname:steckbriefData.kampfname||'',
        fact:steckbriefData.fact||'',
        selfie:steckbriefData.selfie||null,
      });
    }
    listenRoom(c);
    setLoading(false);
    setScreen("lobby");
  }

  async function handleJoin(c,name,m,roomLang,steckbriefData=null){
    isHostRef.current = false;
    // Use auth.currentUser.uid directly - don't wait for React state
    let uid = auth?.currentUser?.uid;
    if(!uid){
      // Wait up to 5s for anonymous auth
      let waited = 0;
      while(!auth?.currentUser?.uid && waited < 5000){
        await new Promise(r=>setTimeout(r,200));
        waited += 200;
      }
      uid = auth?.currentUser?.uid;
      if(!uid){ console.error("Auth timeout in handleJoin"); return; }
      setMyId(uid);
    }
    localStorage.setItem('em_lastname', name);
    saveProfile({name, kampfname:steckbriefData?.kampfname||'', fact:steckbriefData?.fact||'', selfie:steckbriefData?.selfie||null});
    setMode(m||"adult");
    if(roomLang&&roomLang!==lang) setLang(roomLang);
    setCode(c);
    setLoadTxt("Betrete Raum...");
    setLoading(true);
    const r=await dbGet(c);
    if(!r){ setLoading(false); return; } // room gone
    // Block kicked players from rejoining
    if((r.kicked||{})[uid]){
      setLoading(false);
      alert((UI[lang]||UI.de).kicked||'Du wurdest vom Host entfernt.');
      return;
    }
    const effectiveId = uid || myId;
    await dbPatch(c,{players:{...r.players,[effectiveId]:{id:effectiveId,name}},order:[...(r.order||[]),effectiveId]});
    listenRoom(c);
    // Save inline steckbrief data if provided (from join form)
    if(steckbriefData&&(steckbriefData.kampfname||steckbriefData.fact||steckbriefData.selfie)){
      const uid2=auth?.currentUser?.uid||uid;
      update(ref(db,`rooms/${c}/steckbriefe/${uid2}`),{
        name, ...steckbriefData
      }).catch(()=>{});
    }
    setLoading(false);
    setScreen("lobby");
  }

  async function handleGoJokerSetup(){
    await dbPatch(code,{phase:"jokerSetup"});
  }

  async function handleJokerSetupDone(enabledJokers, speedMode, timerSecs, withBets=true, betModes=["best","worst"], withSteckbrief=false){
    enabledJokersRef.current=enabledJokers;
    await dbPatch(code,{enabledJokers,speedMode:!!speedMode,timerSecs:speedMode?timerSecs:null,withBets:!!withBets,withBestWorst:betModes.length>0,betBest:betModes.includes("best"),betWorst:betModes.includes("worst"),steckbriefEnabled:!!withSteckbrief,phase:"categories"});
  }

  async function handleGoCategories(){
    await dbPatch(code,{phase:"categories"});
  }

  async function handleStartWithCats(selectedCats){
    selectedCatsRef.current=selectedCats;
    const q=getQuestion(mode,selectedCats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    setShowCountdown(true);
    // Nur Standard-Kategorien in globale Statistik (private Packs ausschließen)
    const stdCats=selectedCats.filter(c=>QUESTIONS_RAW[mode]&&QUESTIONS_RAW[mode][c]);
    // Track session start
    const platform=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?'mobile':'desktop';
    const sessionRef=ref(db,`globalStats/sessions/${Date.now().toString(36)}`);
    update(sessionRef,{
      ts:Date.now(), lang, mode,
      groupSize:(room?.order||[]).length,
      platform,
      tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown',
      categories:stdCats.slice(0,10),
      catCount:stdCats.length,
      customPacks:selectedCats.length-stdCats.length,
    }).catch(()=>{});

    // Track individual category play counts
    const tz2 = Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';
    const region2 = tz2.split('/')[0]||'unknown';
    stdCats.forEach(cat=>{
      const catKey=cat.replace(/[^a-zA-Z0-9_]/g,'_');
      const catRef=ref(db,`globalStats/categories/${catKey}`);
      get(catRef).then(snap=>{
        const prev=snap.val()||{plays:0,totalDiff:0,exactHits:0};
        update(catRef,{
          plays:(prev.plays||0)+1,
          // Region breakdown
          [`byRegion/${region2}`]:(prev.byRegion?.[region2]||0)+1,
          // Language breakdown
          [`byLang/${lang||'de'}`]:(prev.byLang?.[lang||'de']||0)+1,
        }).catch(()=>{});
      }).catch(()=>{});
    });

    // Track category combinations (pairs) – which cats are played together
    if(stdCats.length>1){
      for(let a=0;a<Math.min(stdCats.length,6);a++){
        for(let b=a+1;b<Math.min(stdCats.length,6);b++){
          const pair=[stdCats[a],stdCats[b]]
            .map(c=>c.replace(/[^a-zA-Z0-9_]/g,'_'))
            .sort().join('__');
          const pairRef=ref(db,`globalStats/categoryPairs/${pair}`);
          get(pairRef).then(snap=>{
            const prev=snap.val()||{count:0};
            update(pairRef,{count:(prev.count||0)+1}).catch(()=>{});
          }).catch(()=>{});
        }
      }
    }
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},allIn:{},boostCharge:{},boostLocked:{},boostLastQIdx:{},qIdx:0,selectedCats,usedJokerThisRound:null,hintVisible:false,hintFor:null,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,sabotaged:{},newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1,doubleJokers:{}});
  }

  // Schnellstart: letztes Setup + letzte Kategorien anwenden und direkt loslegen
  async function handleQuickStart(){
    let setup=null, cats=null;
    try{ setup=JSON.parse(localStorage.getItem('em_lastSetup')||'null'); }catch(e){}
    try{ cats=JSON.parse(localStorage.getItem('em_lastCats')||'null'); }catch(e){}
    // Nur Standard-Kategorien, die im aktuellen Modus existieren (custom/community werden hier nicht injiziert)
    const validCats=Array.isArray(cats)?cats.filter(c=>QUESTIONS[mode]&&QUESTIONS[mode][c]):[];
    if(!setup||!validCats.length){ await handleGoJokerSetup(); return; }
    await handleJokerSetupDone(
      setup.withJokers?(Array.isArray(setup.enabled)?setup.enabled:[]):[],
      !!setup.speedMode, setup.timerSecs||30,
      setup.withBets!==false, Array.isArray(setup.betModes)?setup.betModes:["best","worst"],
      !!setup.withSteckbrief
    );
    await handleStartWithCats(validCats);
  }

  async function handleGuess(val, isAllIn=false, bet=null){
    const updates = {[`rooms/${code}/guesses/${myId}`]: val};
    if(isAllIn) updates[`rooms/${code}/allIn/${myId}`] = true;
    if(bet && (bet.closest || bet.farthest)) updates[`rooms/${code}/bets/${myId}`] = {closest:bet.closest||null, farthest:bet.farthest||null};
    await update(ref(db), updates);
  }

  // Auto-advance: all guesses in → betting or results
  useEffect(()=>{
    if(!room||room.phase!=="question")return;
    const order=room.order||[];
    const afk=room.afkPlayers||{};
    const activePlayers=order.filter(id=>!afk[id]);
    const guesses=room.guesses||{};
    // -999999 = timer expired (counts as answered), null = not yet answered
    // Solo: if only 1 active player and they submitted (incl. timer), advance immediately
    const allDone=activePlayers.length>0&&activePlayers.every(id=>
      guesses[id]!=null||!!afk[id]
    );
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
        // -999999 counts as answered (timer expired)
        if(!active.every(id=>g[id]!=null)){await dbPatch(code,{advancing:false});return;}

        // Skip check moved to separate useEffect below

        // Tipp + Wette wurden gemeinsam abgegeben → direkt werten, keine separate Wett-Phase
        const merged={...r,guesses:g};
        const result=calcRound(merged);
        const newJokers=await distributeJokers(r,result,active);
        const histEntry={guesses:g,answer:r.q?.a,bets:r.bets||{},closestId:result.closestId,farthestId:result.farthestId};
        await dbPatch(code,{phase:"results",roundScores:result.roundScores,scores:result.newScores,history:[...(r.history||[]),histEntry],newJokersThisRound:newJokers,advancing:false});
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
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},allIn:{},qIdx:(r.qIdx||0)+1,usedJokerThisRound:null,hintVisible:false,hintFor:null,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1,sabotaged:{},doubleJokers:{}});
  }

  // Host-Tastaturkürzel (Laptop/Beamer): Leertaste = weiter (Auflösung), P = Timer-Pause
  useEffect(()=>{
    function onKey(e){
      if(!isHostRef.current||!code) return;
      const tag=(e.target&&e.target.tagName)||'';
      if(tag==='INPUT'||tag==='TEXTAREA'||(e.target&&e.target.isContentEditable)) return;
      const ph=room?.phase;
      if(e.code==='Space'||e.key===' '){
        if(ph==='results'){ e.preventDefault(); handleNext(); }
      } else if(e.key==='p'||e.key==='P'){
        if(ph==='question'){ e.preventDefault(); const paused=!!(room?.timerPaused); update(ref(db,`rooms/${code}`),{timerPaused:paused?null:true}); }
      }
    }
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[room,code]);

  async function handleKick(playerId){
    if(!room||room.hostId!==myId) return;
    const playerName=room.players?.[playerId]?.name||'?';
    if(!window.confirm(`${playerName} wirklich kicken?`)) return;
    const newOrder=(room.order||[]).filter(id=>id!==playerId);
    const updates={};
    updates[`rooms/${code}/order`]=newOrder;
    updates[`rooms/${code}/kicked/${playerId}`]=true;
    updates[`rooms/${code}/players/${playerId}`]=null;
    // Clean up all player data so they don't appear in rankings/stats
    updates[`rooms/${code}/guesses/${playerId}`]=null;
    updates[`rooms/${code}/bets/${playerId}`]=null;
    updates[`rooms/${code}/scores/${playerId}`]=null;
    updates[`rooms/${code}/roundScores/${playerId}`]=null;
    updates[`rooms/${code}/jokers/${playerId}`]=null;
    updates[`rooms/${code}/steckbriefe/${playerId}`]=null;
    updates[`rooms/${code}/afkPlayers/${playerId}`]=null;
    updates[`rooms/${code}/doubleJokers/${playerId}`]=null;
    await update(ref(db),updates);
  }

  async function handleLeave(){
    const i=UI[lang]||UI.de;
    if(!window.confirm(i.leaveConfirm||'Spiel wirklich verlassen?')) return;
    if(room&&code&&myId){
      const newOrder=(room.order||[]).filter(id=>id!==myId);
      const updates={};
      updates[`rooms/${code}/order`]=newOrder;
      updates[`rooms/${code}/players/${myId}`]=null;
      // Remove guesses/bets to not block game progression
      updates[`rooms/${code}/guesses/${myId}`]=-999999;
      await update(ref(db),updates);
    }
    if(unsubRef.current){unsubRef.current();unsubRef.current=null;}
    setRoom(null);setCode(null);setScreen('home');
  }

  async function handleHostLeave(){
    const i=UI[lang]||UI.de;
    if(!window.confirm(i.closeRoomConfirm||'Raum schließen und zurück zum Start? Der Raum wird für alle beendet.')) return;
    if(code){ try{ await remove(ref(db,`rooms/${code}`)); }catch(e){} }
    if(unsubRef.current){unsubRef.current();unsubRef.current=null;}
    setRoom(null);setCode(null);setScreen('home');
  }

  async function handleSkip(){
    // Fully atomic – re-fetch then write in one patch
    const r=await dbGet(code);
    if(!r||r.phase!=="question")return;
    const cats=r.selectedCats||selectedCatsRef.current||Object.keys(QUESTIONS[r.mode||mode]);
    const q=getQuestion(r.mode||mode,cats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{
      phase:"question",q,
      guesses:{},bets:{},roundScores:{},
      qIdx:(r.qIdx||0)+1,
      usedJokerThisRound:null,jokerUsedBy:null,
      hintVisible:false,hintFor:null,
      extraHint:null,extraHintColor:null,extraHintFor:null,
      skipVotes:{},skipImmediate:false,skipBy:null,
      newJokersThisRound:{},changeAllowed:null,
      advancing:false,jokersDistributedForRound:-1,sabotaged:{},
    });
  }

  async function handleEnd(){
    await dbPatch(code,{phase:"final"});
    // Schedule room deletion after 1 hour to save storage
    setTimeout(async()=>{
      try{ await dbSet(code,null); }catch(e){}
    }, 60*60*1000);
  }

  function handleRestart(){
    if(isHostRef.current && code){ try{ dbSet(code,null); }catch(e){} } // Raum sauber entfernen, wenn der Host das Spiel verlässt
    if(unsubRef.current)unsubRef.current();
    setRoom(null);setCode(null);setScreen("home");
    showSteckbriefShownRef.current=false;
    usedIdsRef.current=[];selectedCatsRef.current=[];enabledJokersRef.current=[];
  }

  const i=UI[lang]||UI.de;
  return <ErrorBoundary>
    {showLoginPrompt&&<LoginPrompt t={t} lang={lang}
      onClose={()=>setShowLoginPrompt(false)}
      onSuccess={()=>setIsAnonymous(false)}/>}

    {/* Floating Gastgeber button – visible for host during entire game */}
    {code&&room&&room.hostId===myId&&screen!=='home'&&screen!=='final'&&
      <button onClick={()=>window.open(`${window.location.origin}?mode=display&room=${code}`,'_blank')}
        title={i.displayMode}
        style={{position:'fixed',bottom:20,right:16,zIndex:99,
          background:t.surface,border:`1.5px solid ${t.gold}88`,
          borderRadius:'50%',width:48,height:48,fontSize:20,cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:`0 2px 12px ${t.gold}44`,transition:'transform .2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        📺
      </button>}
    {loading&&<LoadingOverlay t={t} text={loadTxt}/>}
    {screen==="home"&&showOnboarding&&<OnboardingScreen t={t} lang={lang}
      onDone={()=>setShowOnboarding(false)}/>}
    {screen==="admin"&&isPro&&<AdminDashboard t={t} lang={lang} onBack={()=>setScreen('home')}/>}
    {screen==="myQuestions"&&<MyQuestionsScreen myId={myId} t={t} lang={lang} onBack={()=>setScreen('home')} onTeam={()=>setScreen('team')}/>}
    {screen==="team"&&<TeamScreen myId={myId} t={t} lang={lang} onBack={()=>setScreen('home')} onThemeApplied={()=>setA11yTick(x=>x+1)}/>}
    {screen==="home"&&!showOnboarding&&<HomeScreen onHost={handleHost} onJoin={handleJoin} lang={lang} onSetLang={setLang} isAnonymous={isAnonymous} userName={userName} onShowLogin={()=>setShowLoginPrompt(true)} onSignOut={async()=>{await signOut(auth);await signInAnonymously(auth);setShowLoginPrompt(true);}} onShowOnboarding={()=>setShowOnboarding(true)} onMyQuestions={()=>setScreen('myQuestions')} onTeam={()=>setScreen('team')} onAdmin={isPro?()=>setScreen('admin'):null} onA11y={handleA11y} profile={profile} onOpenColors={()=>setShowColorEditor(true)} onOpenBusiness={()=>setShowBusiness(true)}/>}
    {screen==='lobby'&&!room&&<div style={{minHeight:'100vh',background:t.bg,
      display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <Spinner t={t}/>
      <p style={{color:t.muted,fontSize:14,animation:'pulse 1.5s ease infinite'}}>{lang==='en'?'Connecting to room...':lang==='es'?'Conectando a la sala...':'Verbinde mit Raum...'}</p>
    </div>}
    {/* ── Kicked overlay – shown on any screen ── */}
    {room&&(room.kicked||{})[myId]&&
      <div style={{position:'fixed',inset:0,zIndex:999,background:t.bg,
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,textAlign:'center'}}>
        <div style={{fontSize:56}}>🚪</div>
        <p style={{fontWeight:700,fontSize:18}}>{(UI[lang]||UI.de).kicked}</p>
        <Btn t={t} onClick={()=>{setScreen('home');setRoom(null);setCode(null);}}>{(UI[lang]||UI.de).back}</Btn>
      </div>}
    {screen==='lobby'&&room&&(room.kicked||{})[myId]&&null}
    {screen==='lobby'&&room&&!(room.kicked||{})[myId]&&<LobbyScreen room={room} code={code} myId={myId} t={t} onGoJokerSetup={handleGoJokerSetup} lang={lang} onKick={isHostRef.current?handleKick:null} onLeave={isHostRef.current?handleHostLeave:handleLeave} onQuickStart={isHostRef.current?handleQuickStart:null}/>}
    {screen==="jokerSetup"&&room&&room.hostId===myId&&<JokerSetupScreen mode={mode} onDone={handleJokerSetupDone} t={t} onToggleDebug={setDebugMode} debugModeInit={debugMode} lang={lang} onBack={()=>setScreen('lobby')}/>}
    {screen==="jokerSetup"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Joker-Einstellungen...</p></div>}
    {screen==="categories"&&room&&room.hostId===myId&&<CategoryScreen mode={mode} onStart={handleStartWithCats} t={t} lang={lang} myId={myId} onBack={()=>setScreen('jokerSetup')}/>}
    {screen==="categories"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Kategorien...</p></div>}
    {showSteckbrief&&myId&&code&&<SteckbriefScreen t={t} lang={lang} myId={myId} code={code} playerName={room?.players?.[myId]?.name||''} onDone={()=>setShowSteckbrief(false)} initial={profile} onSaveProfile={isAnonymous?null:saveProfile}/>}
    {showColorEditor&&<ColorEditor t={t} lang={lang} onChange={()=>setA11yTick(x=>x+1)} onClose={()=>setShowColorEditor(false)}/>}
    {showBusiness&&<BusinessScreen t={t} lang={lang} onChange={()=>setBizTick(x=>x+1)} onOpenColors={()=>{setShowBusiness(false);setShowColorEditor(true);}} onClose={()=>setShowBusiness(false)}/>}
    {screen==="question"&&room&&<QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess} code={code} debugMode={debugMode} onSkip={handleSkip} lang={lang} isHost={isHostRef.current} onKick={isHostRef.current?handleKick:null} onPause={isHostRef.current?async()=>{
      // Set all non-host players to AFK
      const updates={};
      (room.order||[]).forEach(pid=>{
        if(pid!==myId) updates[`rooms/${code}/afkPlayers/${pid}`]=true;
      });
      await update(ref(db),updates);
    }:null} onToggleDebug={isHostRef.current?setDebugMode:null} onToggleSound={()=>setSoundOn(isSoundOn())} onEnd={isHostRef.current?handleEnd:null} onLeave={!isHostRef.current?handleLeave:null}/>}
    {screen==="betting"&&room&&(room.order||[]).filter(id=>!(room.afkPlayers||{})[id]).length>1&&<BettingScreen room={room} myId={myId} t={t} onBet={handleBet} code={code} lang={lang}/>}
    {screen==="results"&&room&&<ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd} lang={lang} code={code} onKick={isHostRef.current?handleKick:null} onLeave={!isHostRef.current?handleLeave:null}/>}
    {screen==="final"&&room&&<FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart} lang={lang} isAnonymous={isAnonymous} onShowLogin={()=>setShowLoginPrompt(true)} userName={userName} onKick={room.hostId===myId?handleKick:null}/>}

    {/* Verbindungsstatus-Banner (Reconnect-Feedback) */}
    {code&&screen!=="home"&&!online&&hasConnectedRef.current&&<div style={{position:'fixed',
      top:0,left:0,right:0,zIndex:660,background:'#b8860b',color:'#fff',
      padding:'8px 14px',textAlign:'center',fontSize:13,fontWeight:700,
      fontFamily:t.fontBody,boxShadow:'0 2px 8px rgba(0,0,0,.3)',
      animation:'pulse 1.6s ease infinite'}}>
      ⚠ {lang==='en'?'Connection lost – reconnecting…':lang==='es'?'Conexión perdida – reconectando…':'Verbindung unterbrochen – verbinde neu…'}
    </div>}
    {code&&screen!=="home"&&online&&showReconnected&&<div style={{position:'fixed',
      top:0,left:0,right:0,zIndex:660,background:t.green,color:'#06281a',
      padding:'8px 14px',textAlign:'center',fontSize:13,fontWeight:800,
      fontFamily:t.fontBody,boxShadow:'0 2px 8px rgba(0,0,0,.3)',
      animation:'fu .25s ease both'}}>
      ✓ {lang==='en'?'Reconnected':lang==='es'?'Reconectado':'Wieder verbunden'}
    </div>}

    {/* #8 Einstellungen auch im Spiel erreichbar */}
    {screen!=="home"&&screen!=="admin"&&screen!=="myQuestions"&&<>
      <button onClick={()=>setShowA11y(true)}
        title={lang==='en'?'Settings':lang==='es'?'Ajustes':'Einstellungen'}
        style={{position:'fixed',left:14,bottom:14,zIndex:480,width:42,height:42,
          borderRadius:'50%',background:t.surface,border:`1.5px solid ${t.border}`,
          color:t.text,fontSize:20,cursor:'pointer',boxShadow:'0 2px 10px rgba(0,0,0,.35)',
          display:'flex',alignItems:'center',justifyContent:'center',opacity:.85}}>⚙️</button>
      {showA11y&&<div onClick={()=>setShowA11y(false)}
        style={{position:'fixed',inset:0,zIndex:620,background:'rgba(0,0,0,0.72)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:18}}>
        <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderRadius:t.radius,
          border:`1.5px solid ${t.border}`,maxWidth:360,width:'100%',padding:'20px',
          animation:'fu .25s ease both'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <h3 style={{fontFamily:t.fontTitle,fontSize:20,margin:0,color:t.text}}>
              ⚙️ {lang==='en'?'Settings':lang==='es'?'Ajustes':'Einstellungen'}
            </h3>
            <button onClick={()=>setShowA11y(false)} style={{background:'none',border:'none',
              color:t.muted,fontSize:24,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
          </div>
          <p style={{fontSize:11,color:t.muted,fontWeight:700,letterSpacing:.6,margin:'0 0 8px'}}>
            {lang==='en'?'DISPLAY & ACCESSIBILITY':lang==='es'?'PANTALLA Y ACCESIBILIDAD':'ANZEIGE & BARRIEREFREIHEIT'}
          </p>
          <A11yMenu t={t} lang={lang} onA11y={handleA11y} onOpenColors={()=>setShowColorEditor(true)} onOpenBusiness={()=>setShowBusiness(true)}/>
        </div>
      </div>}
    </>}

  </ErrorBoundary>;
}

export default App;
