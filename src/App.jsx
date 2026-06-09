import React, { useState, useEffect, useRef } from "react";
import { QUESTIONS_DE, QUESTIONS_EN, QUESTIONS_ES } from "./questions/index.js";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get } from "firebase/database";
import { getAuth, signInAnonymously, signInWithPopup, signInWithRedirect, GoogleAuthProvider, OAuthProvider, linkWithPopup, linkWithRedirect, getRedirectResult, signOut } from "firebase/auth";

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
const ADMIN_UIDS = ['ENjkAgrSN5OF4f9OdRuWJDs7qqM2'];
const isAdmin = (uid) => ADMIN_UIDS.includes(uid);
let auth;
try { auth = getAuth(firebaseApp); } catch(e) { console.error("Auth init failed:", e); }
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
const dbRef    = (c)    => ref(db, `rooms/${c}`);
const dbSet    = (c, v) => set(dbRef(c), v);
const dbPatch  = (c, v) => update(dbRef(c), v);
const dbGet    = (c)    => get(dbRef(c)).then(s => s.val());
const dbListen = (c,fn) => onValue(dbRef(c), s => fn(s.val()));

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

/* ─── UI TRANSLATIONS ────────────────────────────── */
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
    afkAway:"⏸️ Kurz weg",afkBack:"▶️ Ich bin wieder da!",
    jokerWon:"Joker gewonnen!",jokers:"JOKER",jokerUsed:"diese Runde verbraucht",
    speedMode:"⚡ SPEED-MODUS",noTimer:"🐢 Kein Timer",speed:"⚡ Speed!",
    jokerSection:"🃏 JOKER",jokerOn:"An",jokerOff:"Aus",
    jokerHowText:"🎯 Punktlandung → Joker · 🥇 Nächster (25%) · 🎲 Wette (25%) · 💀 3× Letzter → Trost",
    debugMode:"🛠️ Debug-Modus",soundLabel:"🔊 Sound",
    sabotageWho:"💣 Wen sabotieren?",sabotageBtn:"💣 Sabotieren!",
    cancelBtn:"Abbrechen",betKing:"Wettkönig",bestGuesser:"Bester Schätzer",
    worstGuesser:"Schlechtester Schätzer",exactHits:"Punktlandungen",
    jokerKing:"Joker-König",sabotageKing:"Sabotage-König",
    sabotaged:"💣 sabotiert von",tooSlow:"Zu langsam!",
    globalRank:(p)=>"🌍 Du bist besser als "+p+"% aller Spieler weltweit",
    wins:(name,pts)=>name+" gewinnt mit "+pts+" Punkten! 🎊",
    roundsPlayed:"Runden gespielt",lobbyWaiting:"Warte auf Mitspieler",
    hostLabel:"HOST",youLabel:"DU",
    adultMode:"Erwachsene",kidsMode:"Kinder",adultSub:"Witzig · obszön",kidsSub:"Bunt · sicher",
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
    allIn:"💥 Ich weiß es sicher!",allInActive:"💥 All-In aktiv!",allInHint:"Richtig = 2× Punkte · Falsch = Minus",
    countdownReady:"Bereit?",steckbriefTitle:"Stell dich vor!",steckbriefSkip:"Überspringen",steckbriefDone:"Fertig!",steckbriefKampfname:"Kampfname / Spitzname",steckbriefBeruf:"Beruf oder Rolle",steckbriefStaerke:"Deine geheime Stärke",steckbriefHobby:"Hobby",steckbriefFact:"Fun Fact über mich",steckbriefFeind:"Mein größter Feind im Raum",
    feedbackTitle:"Hat dir EstiMates Spaß gemacht?",feedbackYes:"⭐ App bewerten",feedbackNo:"💬 Feedback geben",feedbackBug:"🐛 Fehler melden",feedbackBugSubject:"Fehler in EstiMates",feedbackBugBody:"Frage: \nRichtige Antwort laut App: \nWas stimmt nicht: \n\nVielen Dank! Du erhältst einen Belohnungs-Code per E-Mail.",feedbackThanks:"Danke für dein Feedback!",feedbackReward:"Als Dankeschön senden wir dir einen 2h-Vollzugang-Code per E-Mail 🎁",
    disclaimer:"Alle Fragen dienen der Unterhaltung. Wir übernehmen keine Gewähr für Richtigkeit oder Aktualität der Inhalte.",
    demoLabel:"Demo",demoNext:"Nächste Frage →",demoGuess:"Deine Schätzung...",demoSubmit:"Schätzung abgeben ✓",demoAnswerLabel:"ANTWORT",demoTip:"Dein Tipp",demoDeviation:"Abweichung",
    scanCode:"📷 QR-Code scannen",scanOrType:"oder Code eingeben",
    bettingSection:"🎲 WETTEN",bettingOn:"Wetten aktiv",bettingOff:"Keine Wetten",betBoth:"🎯 Nächster & Weitester",betBest:"🏆 Nur Bester",betWorst:"🙈 Nur Schlechtester",
    scanJoin2:"Scan & mitspielen!",
    dailyChallenge:"🗓️ Tages-Challenge",dailySub:"Eine Frage täglich · Global",dailyPlay:"Heute schätzen!",dailyDone:"Heute bereits gespielt!",dailyRank:(p)=>"Besser als "+p+"% weltweit",dailyStreak:(n)=>"🔥 "+n+" Tage am Stück",kickPlayer:"Kick",kickConfirm:(n)=>n+" wirklich kicken?",kicked:"Du wurdest vom Host entfernt.",displayMode:"Gastgeber-Modus",waitingTips:"Wartet auf Tipps...",dispReady:"Bereit?",dispHostPrep:"Host bereitet das Spiel vor...",dispQuestion:"FRAGE",dispAnswer:"ANTWORT",dispRanking:"RANGLISTE",dispStats:"STATISTIKEN",dispJoker:"JOKER-INVENTAR",dispEvents:"EVENTS",dispScanJoin:"Scan to join",dispNoEvents:"Noch keine Events...",dispPhaseQuestion:"─── Neue Runde ───",dispPhaseResults:"─── Auflösung ───",dispPhaseBetting:"─── Wetten ───",dispPhaseFinal:"─── Spiel beendet ───",dispExact:"trifft EXAKT!",dispGuessed:"hat getippt",dispEarned:"erhält Joker",dispSabotaged:"wurde sabotiert",dispSaboteur:"von",dispJokerLabels:{sabotage:"sabotiert!",skip:"überspringt",hint:"Hint aufgedeckt",double:"Punkte verdoppelt",change:"Tipp geändert",extra:"50/50-Joker"},dispWins:"gewinnt!",jokerNames:{skip:"Skip",hint:"Hinweis",double:"Doppelt",sabotage:"Sabotage",change:"Tipp ändern",extra:"50/50-Joker"},jokerVerbs:{skip:"überspringt die Frage",hint:"deckt einen Hinweis auf",double:"verdoppelt seine Punkte",sabotage:"sabotiert",change:"ändert seinen Tipp",extra:"nutzt den 50/50-Joker"},
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
    afkAway:"⏸️ Taking a break",afkBack:"▶️ I\'m back!",
    jokerWon:"Joker won!",jokers:"JOKERS",jokerUsed:"used this round",
    speedMode:"⚡ SPEED MODE",noTimer:"🐢 No Timer",speed:"⚡ Speed!",
    jokerSection:"🃏 JOKERS",jokerOn:"On",jokerOff:"Off",
    jokerHowText:"🎯 Exact hit → Joker · 🥇 Closest (25%) · 🎲 Correct bet (25%) · 💀 3× Last → Consolation",
    debugMode:"🛠️ Debug Mode",soundLabel:"🔊 Sound",
    sabotageWho:"💣 Who to sabotage?",sabotageBtn:"💣 Sabotage!",
    cancelBtn:"Cancel",betKing:"Bet King",bestGuesser:"Best Guesser",
    worstGuesser:"Worst Guesser",exactHits:"Exact Hits",
    jokerKing:"Joker King",sabotageKing:"Sabotage King",
    sabotaged:"💣 sabotaged by",tooSlow:"Too slow!",
    globalRank:(p)=>"🌍 You are better than "+p+"% of all players worldwide",
    wins:(name,pts)=>name+" wins with "+pts+" points! 🎊",
    roundsPlayed:"rounds played",lobbyWaiting:"Waiting for players",
    hostLabel:"HOST",youLabel:"YOU",
    adultMode:"Adults",kidsMode:"Kids",adultSub:"Funny · edgy",kidsSub:"Colorful · safe",
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
    allIn:"💥 I know this one!",allInActive:"💥 All-In active!",allInHint:"Correct = 2× points · Wrong = minus",
    countdownReady:"Ready?",steckbriefTitle:"Introduce yourself!",steckbriefSkip:"Skip",steckbriefDone:"Done!",steckbriefKampfname:"Nickname / Battle name",steckbriefBeruf:"Job or role",steckbriefStaerke:"Your secret strength",steckbriefHobby:"Hobby",steckbriefFact:"Fun fact about me",steckbriefFeind:"My biggest rival here",
    feedbackTitle:"Did you enjoy EstiMates?",feedbackYes:"⭐ Rate the app",feedbackNo:"💬 Give feedback",feedbackBug:"🐛 Report an error",feedbackBugSubject:"Error in EstiMates",feedbackBugBody:"Question: \nAnswer shown in app: \nWhat is wrong: \n\nThank you! You will receive a reward code by email.",feedbackThanks:"Thanks for your feedback!",feedbackReward:"As a thank you we will send you a 2h full-access code by email 🎁",
    disclaimer:"All questions are for entertainment purposes only. We do not guarantee the accuracy or currentness of any content.",
    demoLabel:"Demo",demoNext:"Next question →",demoGuess:"Your guess...",demoSubmit:"Submit guess ✓",demoAnswerLabel:"ANSWER",demoTip:"Your guess",demoDeviation:"Deviation",
    scanCode:"📷 Scan QR Code",scanOrType:"or enter code",
    bettingSection:"🎲 BETTING",bettingOn:"Betting on",bettingOff:"No betting",betBoth:"🎯 Closest & Farthest",betBest:"🏆 Best only",betWorst:"🙈 Worst only",
    scanJoin2:"Scan to play!",
    dailyChallenge:"🗓️ Daily Challenge",dailySub:"One question daily · Global",dailyPlay:"Play today!",dailyDone:"Already played today!",dailyRank:(p)=>"Better than "+p+"% worldwide",dailyStreak:(n)=>"🔥 "+n+" day streak",kickPlayer:"Kick",kickConfirm:(n)=>"Really kick "+n+"?",kicked:"You were removed by the host.",displayMode:"Host Display Mode",waitingTips:"Waiting for guesses...",dispReady:"Ready?",dispHostPrep:"Host is preparing the game...",dispQuestion:"QUESTION",dispAnswer:"ANSWER",dispRanking:"LEADERBOARD",dispStats:"STATISTICS",dispJoker:"JOKER INVENTORY",dispEvents:"EVENTS",dispScanJoin:"Scan to join",dispNoEvents:"No events yet...",dispPhaseQuestion:"─── New Round ───",dispPhaseResults:"─── Reveal ───",dispPhaseBetting:"─── Betting ───",dispPhaseFinal:"─── Game Over ───",dispExact:"hits EXACT!",dispGuessed:"has guessed",dispEarned:"receives Joker",dispSabotaged:"was sabotaged",dispSaboteur:"by",dispJokerLabels:{sabotage:"sabotages!",skip:"skips",hint:"reveals hint",double:"doubles points",change:"changes guess",extra:"50/50 joker"},dispWins:"wins!",jokerNames:{skip:"Skip",hint:"Hint",double:"Double",sabotage:"Sabotage",change:"Change guess",extra:"50/50 Joker"},jokerVerbs:{skip:"skips the question",hint:"reveals a hint",double:"doubles their points",sabotage:"sabotages",change:"changes their guess",extra:"uses the 50/50 joker"},
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
    afkAway:"⏸️ Un momento",afkBack:"▶️ ¡Ya estoy!",
    jokerWon:"¡Comodín ganado!",jokers:"COMODINES",jokerUsed:"usado esta ronda",
    speedMode:"⚡ MODO RÁPIDO",noTimer:"🐢 Sin tiempo",speed:"⚡ ¡Rápido!",
    jokerSection:"🃏 COMODINES",jokerOn:"Sí",jokerOff:"No",
    jokerHowText:"🎯 Acierto exacto → Comodín · 🥇 Más cerca (25%) · 🎲 Apuesta (25%) · 💀 3× Último → Consuelo",
    debugMode:"🛠️ Modo Debug",soundLabel:"🔊 Sonido",
    sabotageWho:"💣 ¿A quién sabotear?",sabotageBtn:"💣 ¡Sabotear!",
    cancelBtn:"Cancelar",betKing:"Rey de apuestas",bestGuesser:"Mejor estimador",
    worstGuesser:"Peor estimador",exactHits:"Aciertos exactos",
    jokerKing:"Rey de comodines",sabotageKing:"Rey del sabotaje",
    sabotaged:"💣 saboteado por",tooSlow:"¡Demasiado lento!",
    globalRank:(p)=>"🌍 Eres mejor que el "+p+"% de todos los jugadores",
    wins:(name,pts)=>"¡"+name+" gana con "+pts+" puntos! 🎊",
    roundsPlayed:"rondas jugadas",lobbyWaiting:"Esperando jugadores",
    hostLabel:"ANFITRIÓN",youLabel:"TÚ",
    adultMode:"Adultos",kidsMode:"Niños",adultSub:"Divertido · atrevido",kidsSub:"Colorido · seguro",
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
    allIn:"💥 ¡Lo sé seguro!",allInActive:"💥 All-In activo!",allInHint:"Correcto = 2× puntos · Incorrecto = menos",
    countdownReady:"¿Listos?",steckbriefTitle:"¡Preséntate!",steckbriefSkip:"Saltar",steckbriefDone:"¡Listo!",steckbriefKampfname:"Apodo / Nombre de batalla",steckbriefBeruf:"Trabajo o rol",steckbriefStaerke:"Tu fuerza secreta",steckbriefHobby:"Afición",steckbriefFact:"Dato curioso sobre mí",steckbriefFeind:"Mi mayor rival aquí",
    feedbackTitle:"¿Te gustó EstiMates?",feedbackYes:"⭐ Valorar la app",feedbackNo:"💬 Dar feedback",feedbackBug:"🐛 Reportar un error",feedbackBugSubject:"Error en EstiMates",feedbackBugBody:"Pregunta: \nRespuesta en la app: \nQué está mal: \n\n¡Gracias! Recibirás un código de recompensa por email.",feedbackThanks:"¡Gracias por tu feedback!",feedbackReward:"Como agradecimiento te enviaremos un código de acceso completo de 2h por email 🎁",
    disclaimer:"Todas las preguntas son solo para entretenimiento. No garantizamos la exactitud ni actualidad de los contenidos.",
    demoLabel:"Demo",demoNext:"Siguiente pregunta →",demoGuess:"Tu estimación...",demoSubmit:"Enviar estimación ✓",demoAnswerLabel:"RESPUESTA",demoTip:"Tu estimación",demoDeviation:"Desviación",
    scanCode:"📷 Escanear QR",scanOrType:"o introducir código",
    bettingSection:"🎲 APUESTAS",bettingOn:"Apuestas activas",bettingOff:"Sin apuestas",betBoth:"🎯 Cercano y lejano",betBest:"🏆 Solo mejor",betWorst:"🙈 Solo peor",
    scanJoin2:"¡Escanear y jugar!",
    dailyChallenge:"🗓️ Reto Diario",dailySub:"Una pregunta al día · Global",dailyPlay:"¡Jugar hoy!",dailyDone:"¡Ya jugaste hoy!",dailyRank:(p)=>"Mejor que el "+p+"% mundial",dailyStreak:(n)=>"🔥 "+n+" días seguidos",kickPlayer:"Expulsar",kickConfirm:(n)=>"¿Expulsar a "+n+"?",kicked:"El anfitrión te ha eliminado.",displayMode:"Modo Anfitrión",waitingTips:"Esperando respuestas...",dispReady:"¿Listos?",dispHostPrep:"El anfitrión está preparando...",dispQuestion:"PREGUNTA",dispAnswer:"RESPUESTA",dispRanking:"CLASIFICACIÓN",dispStats:"ESTADÍSTICAS",dispJoker:"COMODINES",dispEvents:"EVENTOS",dispScanJoin:"Escanear para unirse",dispNoEvents:"Sin eventos aún...",dispPhaseQuestion:"─── Nueva Ronda ───",dispPhaseResults:"─── Revelación ───",dispPhaseBetting:"─── Apuestas ───",dispPhaseFinal:"─── Fin del Juego ───",dispExact:"¡acierta EXACTO!",dispGuessed:"ha respondido",dispEarned:"recibe Joker",dispSabotaged:"fue saboteado",dispSaboteur:"por",dispJokerLabels:{sabotage:"¡sabotea!",skip:"salta",hint:"revela pista",double:"dobla puntos",change:"cambia respuesta",extra:"comodín 50/50"},dispWins:"¡gana!",jokerNames:{skip:"Saltar",hint:"Pista",double:"Doble",sabotage:"Sabotaje",change:"Cambiar",extra:"50/50"},jokerVerbs:{skip:"salta la pregunta",hint:"revela una pista",double:"dobla sus puntos",sabotage:"sabotea a",change:"cambia su respuesta",extra:"usa el comodín 50/50"},
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
  const icons = {skip:"⏭️",hint:"🔍",double:"🎯",sabotage:"💣",change:"🔄",extra:"📊"};
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
const QUESTIONS_MAP = { de: buildQuestions(QUESTIONS_DE), en: buildQuestions(QUESTIONS_EN), es: buildQuestions(QUESTIONS_ES) };
let QUESTIONS = QUESTIONS_MAP.de; // default, updated when lang changes
const QUESTIONS_RAW_MAP = { de: QUESTIONS_DE, en: QUESTIONS_EN, es: QUESTIONS_ES };
let QUESTIONS_RAW = QUESTIONS_DE; // for CategoryScreen

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
const SOUND_ENABLED_KEY="em_sound";
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
    // All-In: richtig → 2× (zusätzlich zu double), falsch → -1
    const isAllIn = !!(room.allIn||{})[id];
    if(isAllIn){
      if(diff===0||(!anyExact&&closestIds.includes(id))) pts=pts*2;
      else pts=-1;
    }
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
function QRCode({url,t,lang}){
  const bg=t.id==="adult"?"211c18":"ffffff";
  const fg=t.id==="adult"?"e8360a":"ff5c5c";
  const label=(UI[lang]||UI.de).scanJoin;
  return <div style={{textAlign:"center",marginTop:18}}>
    <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:10}}>{(UI[lang]||UI.de).inviteQr}</p>
    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}&bgcolor=${bg}&color=${fg}`} alt="QR" style={{width:130,height:130,borderRadius:t.radius,border:`2px solid ${t.border}`}}/>
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

  return <Card t={t} style={{marginTop:12,padding:"14px 16px"}}>
    <p style={{fontSize:11,fontWeight:700,color:t.gold,letterSpacing:.8,marginBottom:10}}>
      🃏 JOKER ({myJokers.length})
      {usedRound && <span style={{color:t.muted,fontWeight:400}}> · {i.jokerUsed}</span>}
    </p>

    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {enabled.map(jk=>{
        const def      = getJokerDef(jk,lang); if(!def) return null;
        const count    = counts[jk]||0;
        const has      = count > 0;
        const othersGuessed = (room.order||[])
          .filter(id=>id!==myId&&!(room.afkPlayers||{})[id])
          .some(id=>(room.guesses||{})[id]!=null&&(room.guesses||{})[id]!==-999999);
        const canClick = has && !afk && (jk==="skip" || !usedRound) &&
          (jk!=="sabotage" || othersGuessed);
        return(
          <div key={jk} onClick={()=>canClick && useJoker(jk)}
            style={{display:"flex",alignItems:"center",gap:10,
              padding:"9px 12px",borderRadius:t.radius,
              background: flash===jk ? t.gold+"44" : canClick ? t.gold+"18" : t.surface,
              border:`1.5px solid ${flash===jk ? t.gold : canClick ? t.gold : t.border}`,
              opacity: has ? 1 : 0.3,
              cursor: canClick ? "pointer" : "default",
              transform: flash===jk ? "scale(1.02)" : "scale(1)",
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
        <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:8}}>{i.dailyChallenge.toUpperCase()}</p>
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
        <p style={{fontSize:14,color:t.muted}}>Dein Tipp: <strong style={{color:t.text}}>{fmtNum(result.guess)}</strong> · ±<strong style={{color:result.exact?t.green:t.accent}}>{fmtNum(result.diff)}</strong></p>
      </Card>
      {rank!==null&&<Card t={t} style={{marginBottom:16,textAlign:'center',background:t.gold+'18',border:`1.5px solid ${t.gold}44`}}>
        <p style={{fontSize:18,fontWeight:700,color:t.gold,margin:0}}>{i.dailyRank(rank)}</p>
      </Card>}
      {phase==='done'&&<Card t={t} style={{marginBottom:16,textAlign:'center'}}>
        <p style={{color:t.muted,fontSize:14,margin:0}}>{i.dailyDone}</p>
      </Card>}
      <Btn t={t} full variant="secondary" onClick={onBack}>← Zurück</Btn>
    </>}
  </div>;
}

/* ─── HOME ────────────────────────────────────────── */


/* ─── ONBOARDING ────────────────────────────────── */
const SLIDE_COLORS = (t) => [t.accent, t.gold, '#39d98a', t.gold];
const ONBOARDING_SLIDES = (i, t) =>
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
const DEMO_QUESTIONS = (lang) => DEMO_QUESTIONS_I18N[lang]||DEMO_QUESTIONS_I18N.de;

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
        ⚠️ {i.disclaimer}
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
        <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:1,margin:'0 0 8px'}}>{i.demoAnswerLabel}</p>
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
function SteckbriefScreen({t, lang, myId, code, playerName, onDone}) {
  const i = UI[lang]||UI.de;
  const fields = [
    {key:'kampfname', label:i.steckbriefKampfname, emoji:'🏷️', placeholder:'z.B. Der Schätzkönig'},
    {key:'beruf',     label:i.steckbriefBeruf,     emoji:'💼', placeholder:'z.B. Profi-Schätzer'},
    {key:'staerke',   label:i.steckbriefStaerke,   emoji:'🎯', placeholder:'z.B. Bauchgefühl'},
    {key:'hobby',     label:i.steckbriefHobby,     emoji:'🎨', placeholder:'z.B. Zahlen raten'},
    {key:'fact',      label:i.steckbriefFact,       emoji:'🔥', placeholder:'z.B. Ich schlafe stehend'},
    {key:'feind',     label:i.steckbriefFeind,      emoji:'😈', placeholder:'z.B. Niemand... noch'},
  ];
  const [vals, setVals] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [selfie, setSelfie] = React.useState(null);
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
    onDone();
  }

  return <div style={{position:'fixed',inset:0,zIndex:200,background:t.bg,overflowY:'auto',display:'flex',flexDirection:'column',maxWidth:520,margin:'0 auto',padding:'20px 16px 40px'}}>
    <h2 style={{fontSize:20,fontWeight:900,color:t.accent,margin:'0 0 4px',
      fontFamily:t.fontTitle}}>{i.steckbriefTitle}</h2>
    <p style={{fontSize:13,color:t.muted,margin:'0 0 20px'}}>
      {playerName} · {lang==='de'?'wird auf dem Beamer gezeigt':'shown on the big screen'}
    </p>
    {/* Selfie */}
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
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
    <div style={{display:'flex',flexDirection:'column',gap:10,flex:1}}>
      {fields.map(f=>(
        <div key={f.key}>
          <p style={{fontSize:12,color:t.muted,margin:'0 0 4px',fontWeight:600}}>
            {f.emoji} {f.label}
          </p>
          <input value={vals[f.key]||''} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}
            placeholder={f.placeholder}
            style={{width:'100%',padding:'10px 12px',background:t.surface,
              border:`1.5px solid ${t.border}`,borderRadius:t.radius,
              color:t.text,fontSize:14,fontFamily:t.fontBody,boxSizing:'border-box'}}/>
        </div>
      ))}
    </div>
    <div style={{display:'flex',gap:10,marginTop:20}}>
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

function HomeScreen({onHost,onJoin,lang,onSetLang,isAnonymous=true,userName=null,onShowLogin=null,onSignOut=null,onShowOnboarding=null}){
  const i=UI[lang]||UI.de;
  const[tab,setTab]=useState(()=>new URLSearchParams(location.search).get("room")?"join":location.search.includes("daily")?"daily":"landing");
  const[name,setName]=useState("");
  const[code,setCode]=useState(()=>new URLSearchParams(location.search).get("room")||"");
  const[mode,setMode]=useState("adult");
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);
  const t=mode==="kids"?KIDS:ADULT;
  useEffect(()=>{inject(globalCSS(tab==="landing"?ADULT:t));},[t,tab]);

  async function submit(){
    if(!name.trim()){setError(i.enterName);return;}
    setError("");
    if(tab==="host"){localStorage.setItem('em_lastname',name.trim());onHost(name.trim(),mode);}
    else{
      const c=code.trim().toUpperCase();
      if(!c){setError(i.enterCode);return;}
      setBusy(true);
      const room=await dbGet(c);
      setBusy(false);
      if(!room){setError(i.roomNotFound);return;}
      if(room.phase!=="lobby"){setError(i.gameRunning);return;}
      if((room.order||[]).length>=50){setError(i.roomFull);return;}
      onJoin(c,name.trim(),room.mode,room.lang||"de");
    }
  }

  if(tab==="landing"){
    const li=UI[lang]||UI.de;
    inject(globalCSS(ADULT));
    const pills={
      de:["4.800+ Fragen","Echtzeit","Joker"],
      en:["4,800+ Questions","Real-time","Jokers"],
      es:["4.800+ Preguntas","Tiempo real","Comodines"],
    };
    return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:ADULT.bg,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,54,10,.18),transparent 65%)",top:-200,left:"50%",transform:"translateX(-50%)",filter:"blur(50px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",maxWidth:460,width:"100%",position:"relative",animation:"fu .4s ease both"}}>
        {/* Language selector - compact top row with Demo button */}
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:32,width:"100%",maxWidth:400}}>
          <select value={lang} onChange={e=>onSetLang(e.target.value)}
            style={{padding:"8px 14px",
              background:ADULT.surface,
              border:`1.5px solid ${ADULT.border}`,
              borderRadius:100,color:"#f2ece6",
              fontWeight:700,fontSize:14,cursor:"pointer",
              fontFamily:ADULT.fontBody,
              appearance:"none",
              paddingRight:32,
              backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236e5e54' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat:"no-repeat",
              backgroundPosition:"right 12px center"}}>
            <option value="de">🇩🇪 Deutsch</option>
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Español</option>
          </select>
          {onShowOnboarding&&<button onClick={onShowOnboarding}
            title={i.demoLabel||"Demo"}
            style={{padding:"8px 16px",background:"none",
              border:`1.5px solid ${ADULT.muted}55`,
              borderRadius:100,color:"#f2ece6",fontSize:13,
              cursor:"pointer",fontFamily:ADULT.fontBody,fontWeight:600}}>
            {i.demoLabel||"Demo"}
          </button>}
        </div>
        <Logo t={ADULT} size="lg"/>
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:44}}>
          <Btn t={ADULT} onClick={()=>{setTab("host");setMode("adult");}} style={{minWidth:150}}>{li.createRoom}</Btn>
          <Btn t={ADULT} variant="secondary" onClick={()=>setTab("join")} style={{minWidth:150}}>{li.join}</Btn>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:36}}>
          {(pills[lang]||pills.de).map(x=><Pill key={x} t={ADULT} color={ADULT.muted}>{x}</Pill>)}
        </div>
        {/* Account button on landing */}
        <div style={{marginTop:24,textAlign:'center'}}>
          {isAnonymous
            ? <button onClick={onShowLogin}
                style={{background:ADULT.surface,
                  border:`1.5px solid ${ADULT.muted}`,
                  borderRadius:100,
                  padding:'8px 24px',
                  color:'#f2ece6',
                  fontSize:14,cursor:'pointer',
                  fontFamily:ADULT.fontBody,
                  fontWeight:600}}>
                🔐 Anmelden
              </button>
            : <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                <span style={{fontSize:13,color:ADULT.muted}}>✅ {userName||'Angemeldet'}</span>
                <button onClick={onSignOut}
                  style={{background:'none',border:'none',color:ADULT.muted,
                    fontSize:12,cursor:'pointer',textDecoration:'underline',
                    fontFamily:ADULT.fontBody}}>
                  Abmelden
                </button>
              </div>
          }
        </div>
      </div>
    </div>;
  }

  return <div style={{...page,background:t.bg,animation:"fu .3s ease both"}}>
    <Btn t={t} variant="ghost" onClick={()=>{setTab("landing");inject(globalCSS(ADULT));}} style={{marginBottom:18,padding:"8px 0"}}>← Zurück</Btn>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:22}}/>
    {tab==="host"&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{i.gameMode}</p>
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
        <Inp value={name} onChange={setName} placeholder={t.id==="kids"?"😊 "+i.yourName:i.yourName} t={t} autoFocus/>
        {tab==="join"&&<Inp value={code} onChange={v=>setCode(v.toUpperCase())} placeholder={i.roomCode} t={t} style={{letterSpacing:3,fontWeight:700,fontFamily:t.fontMono}}/>}
        {error&&<p style={{color:t.danger,fontSize:13}}>{error}</p>}
        <Btn t={t} onClick={submit} disabled={busy} full>{busy?i.searching:tab==="host"?`${t.emoji} ${i.createRoom}`:i.join+" →"}</Btn>
      </div>
    </Card>
    {/* Account */}
    <div style={{marginTop:16,textAlign:'center'}}>
      {isAnonymous
        ? <button onClick={onShowLogin}
            style={{background:'none',border:`1px solid ${t.border}`,
              borderRadius:t.radius,padding:'8px 20px',color:t.muted,
              fontSize:13,cursor:'pointer',fontFamily:t.fontBody}}>
            🔐 Anmelden / Statistiken speichern
          </button>
        : <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
            <span style={{fontSize:13,color:t.muted}}>✅ {userName||'Angemeldet'}</span>
            <button onClick={onSignOut}
              style={{background:'none',border:'none',color:t.muted,
                fontSize:12,cursor:'pointer',textDecoration:'underline',
                fontFamily:t.fontBody}}>
              Abmelden
            </button>
          </div>
      }
    </div>
  </div>;
}

/* ─── GAME SETUP (Joker + Speed-Modus) ───────────── */
function JokerSetupScreen({mode, onDone, t, onToggleDebug, debugModeInit, lang}){
  const i=UI[lang]||UI.de;
  const[withJokers,setWithJokers]=useState(true);
  const[enabled,setEnabled]=useState(Object.keys(JOKER_DEFS));
  const[speedMode,setSpeedMode]=useState(false);
  const[timerSecs,setTimerSecs]=useState(30);
  const[debugModeLocal,setDebugModeLocal]=useState(debugModeInit!==undefined?!!debugModeInit:true);
  const[withBets,setWithBets]=useState(true);
  const[betModes,setBetModes]=useState(["best","worst"]);
  const[withSteckbrief,setWithSteckbrief]=useState(false);
  function toggle(id){setEnabled(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}

  return <div style={{
    minHeight:"100vh",display:"flex",flexDirection:"column",
    maxWidth:520,margin:"0 auto",padding:"12px 16px 24px",
    background:t.bg,
  }}>
    <Logo t={t} size="sm"/>

    {/* ── Speed ── */}
    <div style={{marginTop:14,marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:8}}>
        ⚡ SPEED-MODUS
      </p>
      <div style={{display:"flex",gap:8,marginBottom:speedMode?8:0}}>
        {[{v:false,label:i.noTimer},{v:true,label:i.speed}].map(o=>(
          <button key={String(o.v)} onClick={()=>setSpeedMode(o.v)}
            style={{flex:1,padding:"10px 6px",borderRadius:t.radius,
              background:speedMode===o.v?t.accent+"22":t.surface,
              border:`2px solid ${speedMode===o.v?t.accent:t.border}`,
              color:speedMode===o.v?t.accent:t.muted,
              fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:t.fontBody}}>
            {o.label}
          </button>
        ))}
      </div>
      {speedMode&&<div style={{display:"flex",gap:8}}>
        {[15,30,60].map(s=>(
          <button key={s} onClick={()=>setTimerSecs(s)}
            style={{flex:1,padding:"9px 6px",borderRadius:t.radius,
              background:timerSecs===s?t.accent:t.surface,
              border:`2px solid ${timerSecs===s?t.accent:t.border}`,
              color:timerSecs===s?"#fff":t.muted,
              fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:t.fontMono}}>
            {s}s
          </button>
        ))}
      </div>}
    </div>

    {/* ── Divider ── */}
    <div style={{height:1,background:t.border,margin:"4px 0 10px"}}/>

    {/* ── Joker ── */}
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8}}>
          🃏 JOKER
        </p>
        <div style={{display:"flex",gap:8}}>
          {[{v:false,label:"Aus"},{v:true,label:"An"}].map(o=>(
            <button key={String(o.v)} onClick={()=>setWithJokers(o.v)}
              style={{padding:"5px 14px",borderRadius:t.radius,
                background:withJokers===o.v?t.gold+"22":t.surface,
                border:`1.5px solid ${withJokers===o.v?t.gold:t.border}`,
                color:withJokers===o.v?t.gold:t.muted,
                fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:t.fontBody}}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {withJokers&&<div style={{display:"flex",flexDirection:"column",gap:5}}>
        {Object.keys(JOKER_DEFS).map(id=>{ const jk=getJokerDef(id,lang);
          const on=enabled.includes(jk.id);
          const atMax=enabled.length>=3&&!on;
          return <div key={jk.id} onClick={()=>!atMax&&toggle(jk.id)}
            style={{display:"flex",alignItems:"center",gap:10,
              padding:"8px 12px",borderRadius:t.radius,cursor:atMax?"not-allowed":"pointer",
              background:on?t.gold+"18":t.surface,
              border:`1.5px solid ${on?t.gold:t.border}`,
              opacity:atMax?.4:1,transition:"all .15s"}}>
            <span style={{fontSize:16}}>{jk.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:12,color:on?t.gold:t.text}}>{getJokerDef(jk.id,lang).name}</div>
              <div style={{fontSize:10,color:t.muted}}>{getJokerDef(jk.id,lang).desc}</div>
            </div>
            <div style={{width:18,height:18,borderRadius:4,
              background:on?t.gold:t.surface,
              border:`1.5px solid ${on?t.gold:t.border}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"#fff",fontSize:11,flexShrink:0}}>
              {on?"✓":""}
            </div>
          </div>;
        })}
        <div style={{padding:"8px 10px",borderRadius:t.radius,
          background:t.gold+"10",border:`1px solid ${t.gold}22`,
          fontSize:10,color:t.muted,lineHeight:1.6}}>
          {i.jokerHowText}
        </div>
      </div>}
    </div>

    {/* ── Divider ── */}
    <div style={{height:1,background:t.border,margin:"4px 0 10px"}}/>

    {/* ── Debug ── */}
    <div onClick={()=>{setDebugModeLocal(p=>!p);onToggleDebug(p=>!p);}}
      style={{display:"flex",alignItems:"center",gap:10,
        padding:"8px 12px",borderRadius:t.radius,cursor:"pointer",
        background:debugModeLocal?t.accent+"18":t.surface,
        border:`1.5px solid ${debugModeLocal?t.accent:t.border}`,
        marginBottom:14,transition:"all .15s"}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:12,color:debugModeLocal?t.accent:t.text}}>{i.debugMode}</div>
      </div>
      <div style={{width:18,height:18,borderRadius:4,flexShrink:0,
        background:debugModeLocal?t.accent:t.surface,
        border:`1.5px solid ${debugModeLocal?t.accent:t.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        color:"#fff",fontSize:11}}>
        {debugModeLocal?"✓":""}
      </div>
    </div>

    {/* ── Steckbrief ── */}
    <div style={{marginBottom:14}}>
      <div onClick={()=>setWithSteckbrief(p=>!p)}
        style={{display:"flex",alignItems:"center",gap:10,
          padding:"8px 12px",borderRadius:t.radius,cursor:"pointer",
          background:withSteckbrief?t.gold+"18":t.surface,
          border:`1.5px solid ${withSteckbrief?t.gold:t.border}`,
          transition:"all .15s"}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:12,color:withSteckbrief?t.gold:t.text}}>
            👤 Spieler-Steckbrief (Gastgeber-Modus)
          </div>
          <div style={{fontSize:10,color:t.muted}}>Spieler stellen sich vor dem Spiel vor</div>
        </div>
        <div style={{width:18,height:18,borderRadius:4,flexShrink:0,
          background:withSteckbrief?t.gold:t.surface,
          border:`1.5px solid ${withSteckbrief?t.gold:t.border}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          color:"#fff",fontSize:11}}>
          {withSteckbrief?"✓":""}
        </div>
      </div>
    </div>

    {/* ── Betting ── */}
    <div style={{marginTop:14,marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:8}}>
        {i.bettingSection}
      </p>
      <div style={{display:"flex",gap:8,marginBottom:withBets?8:0}}>
        {[{v:true,label:i.bettingOn},{v:false,label:i.bettingOff}].map(o=>(
          <button key={String(o.v)} onClick={()=>setWithBets(o.v)}
            style={{flex:1,padding:"10px 6px",borderRadius:t.radius,
              background:withBets===o.v?t.gold+"22":t.surface,
              border:`1.5px solid ${withBets===o.v?t.gold:t.border}`,
              color:withBets===o.v?t.gold:t.muted,
              fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:t.fontBody}}>
            {o.label}
          </button>
        ))}
      </div>
      {withBets&&<div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
        {[{id:"best",label:i.betBest},{id:"worst",label:i.betWorst}].map(({id,label})=>{
          const on=betModes.includes(id);
          function toggleBet(){setBetModes(prev=>on?prev.filter(x=>x!==id):[...prev,id]);}
          return <div key={id} onClick={toggleBet}
            style={{display:"flex",alignItems:"center",gap:10,
              padding:"8px 12px",borderRadius:t.radius,cursor:"pointer",
              background:on?t.gold+"18":t.surface,
              border:`1.5px solid ${on?t.gold:t.border}`,
              transition:"all .15s"}}>
            <div style={{flex:1,fontWeight:700,fontSize:12,color:on?t.gold:t.text}}>{label}</div>
            <div style={{width:18,height:18,borderRadius:4,
              background:on?t.gold:t.surface,
              border:`1.5px solid ${on?t.gold:t.border}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"#fff",fontSize:11,flexShrink:0}}>
              {on?"✓":""}
            </div>
          </div>;
        })}
      </div>}
    </div>

    <Btn t={t} full onClick={()=>onDone(withJokers?enabled:[],speedMode,timerSecs,withBets,betModes,withSteckbrief)}>
      {i.continueBtn}
    </Btn>
  </div>;
}

/* ─── CATEGORY SELECTION ─────────────────────────── */
function CategoryScreen({mode,onStart,t,lang}){
  const i=UI[lang]||UI.de;
  const catMeta=Object.entries(QUESTIONS_RAW[mode]).map(([name,{questions,locked}])=>({name,count:questions.length,locked})).sort((a,b)=>a.name.localeCompare(b.name));
  const allCats=catMeta.filter(c=>!c.locked).map(c=>c.name);
  const[selected,setSelected]=useState(allCats);
  function toggle(c,locked){
    if(locked)return;
    setSelected(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  }
  const allSelected=allCats.every(c=>selected.includes(c));

  return <div style={{
    minHeight:"100vh",display:"flex",flexDirection:"column",
    maxWidth:520,margin:"0 auto",padding:"12px 16px 90px",
    background:t.bg,
  }}>
    <Logo t={t} size="sm"/>

    {/* Header row */}
    <div style={{display:"flex",alignItems:"center",
      justifyContent:"space-between",margin:"12px 0 10px"}}>
      <div>
        <p style={{fontSize:15,fontWeight:800}}>Kategorien</p>
        <p style={{fontSize:12,color:t.muted}}>{selected.length} von {allCats.length} gewählt</p>
      </div>
      <button onClick={()=>setSelected(allSelected?[]:allCats)}
        style={{padding:"7px 14px",borderRadius:t.radius,
          background:allSelected?t.accent+"18":t.surface,
          border:`1.5px solid ${allSelected?t.accent:t.border}`,
          color:allSelected?t.accent:t.muted,
          fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:t.fontBody}}>
        {allSelected?i.allOff:i.allOn}
      </button>
    </div>

    {/* Category list – compact */}
    <div style={{display:"flex",flexDirection:"column",gap:5,flex:1}}>
      {catMeta.map(({name,count,locked})=>{
        const sel=selected.includes(name);
        const isFree=name==="🎯 Gratis-Test";
        return <div key={name} onClick={()=>toggle(name,locked)}
          style={{display:"flex",alignItems:"center",gap:10,
            padding:"9px 12px",borderRadius:t.radius,
            cursor:locked?"not-allowed":"pointer",
            background:locked?t.surface:sel?t.accent+"18":t.surface,
            border:`1.5px solid ${locked?t.border:sel?t.accent:t.border}`,
            opacity:locked?.5:1,transition:"all .15s"}}>
          <span style={{fontSize:18,minWidth:24,textAlign:"center"}}>
            {locked?"🔒":sel?"✅":"⬜"}
          </span>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13}}>{name}</div>
            {isFree&&<div style={{fontSize:10,color:t.green,fontWeight:700}}>Kostenlos</div>}
            {locked&&<div style={{fontSize:10,color:t.muted}}>Kommt bald</div>}
          </div>
          <span style={{fontSize:11,color:t.muted,fontFamily:t.fontMono}}>{count}</span>
        </div>;
      })}
    </div>

    {/* Fixed bottom button */}
    <div style={{position:"fixed",bottom:0,left:"50%",
      transform:"translateX(-50%)",width:"100%",maxWidth:520,
      padding:"10px 16px",background:t.bg+"ee",
      borderTop:`1px solid ${t.border}`,backdropFilter:"blur(8px)",zIndex:50}}>
      <Btn t={t} full disabled={selected.length===0}
        onClick={()=>onStart(selected)}>
        {selected.length===0?"Wähle eine Kategorie":
         `Starten mit ${selected.length} ${selected.length===1?"Kategorie":i.categories} →`}
      </Btn>
    </div>
  </div>;
}

/* ─── LOBBY ───────────────────────────────────────── */
function LobbyScreen({room,code,myId,t,onGoJokerSetup,lang,onKick=null}){
  const i=UI[lang]||UI.de;
  const[copied,setCopied]=useState(false);
  const isHost=room.hostId===myId;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const link=inviteUrl(code);
  function copy(){navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}); }
  function addPlayer(){ if(navigator.share){navigator.share({title:'EstiMates',text:'Komm mitspielen!',url:link});}else{copy();} }
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>{t.id==="kids"?"🎈 LOBBY":"LOBBY"}</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?34:40,marginBottom:6}}>{i.lobbyWaiting}</h2>
    <div style={{...row,marginBottom:16}}>
      <span style={{fontFamily:t.fontMono,fontSize:28,letterSpacing:5,color:t.accent,fontWeight:800}}>{code}</span>
      <Btn t={t} variant="secondary" onClick={copy} style={{padding:"7px 13px",fontSize:13}}>{copied?"✓ Kopiert!":"📋 Link"}</Btn>
    </div>
    <Card t={t} style={{marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.7,marginBottom:12}}>{i.players} ({pl.length})</p>
      <div style={col}>
        {pl.map(p=>(
          <div key={p.id} style={{...row,padding:"10px 12px",background:t.surface,borderRadius:t.radius,border:`1.5px solid ${p.id===myId?t.accent+"55":t.border}`}}>
            <Avatar name={p.name} t={t}/>
            <span style={{flex:1,fontWeight:600}}>{p.name}</span>
            {p.id===room.hostId&&<Pill t={t} color={t.gold}>{i.hostLabel}</Pill>}
            {isHost&&p.id!==myId&&onKick&&<button onClick={()=>onKick(p.id)}
              style={{padding:'3px 10px',borderRadius:t.radius,border:`1px solid ${t.danger}44`,
                background:'transparent',color:t.danger,fontSize:11,cursor:'pointer',fontWeight:600}}>
              {i.kickPlayer}
            </button>}
            {p.id===myId&&p.id!==room.hostId&&<Pill t={t}>{i.youLabel}</Pill>}
          </div>
        ))}
      </div>
      <QRCode url={link} t={t} lang={lang}/>
    </Card>
    <Btn t={t} full onClick={addPlayer} style={{marginBottom:8}}>➕ Spieler einladen</Btn>
    {isHost&&<Btn t={t} full variant="secondary"
      onClick={()=>window.open(`${window.location.origin}?mode=display&room=${code}`,'_blank')}
      style={{marginBottom:8,borderColor:t.gold+'88',color:t.gold}}>
      📺 {i.displayMode}
    </Btn>}
    {isHost
      ?<Btn t={t} onClick={onGoJokerSetup} full>{i.continueBtn}</Btn>
      :<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{i.waitingHost}</p>}
  </div>;
}

/* ─── QUESTION ────────────────────────────────────── */
function QuestionScreen({room,myId,t,onGuess,code,debugMode,onSkip,lang}){
  const i=UI[lang]||UI.de;
  const[val,setVal]=useState("");
  const[allIn,setAllIn]=useState(false);
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

  if(!q)return <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner t={t}/></div>;

  async function submit(){
    const n=parseFloat(val.replace(",","."));
    if(isNaN(n))return;
    // If this was a "change" joker, clear changeAllowed after submit
    if(changeAllowed){
      await update(ref(db,`rooms/${code}/`),{changeAllowed:null});
    }
    onGuess(n, allIn);
    setVal("");
    setAllIn(false);
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
      <Pill t={t} color={t.green}>{t.id==="kids"?`🎯 ${i.question} ${(room.qIdx||0)+1}`:i.question+" "+((room.qIdx||0)+1)}</Pill>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {room.usedJokerThisRound==="double"&&<Pill t={t} color={t.gold}>{lang==="es"?"2× PUNTOS":lang==="en"?"2× POINTS":"2× PUNKTE"}</Pill>}
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
            color:timeLeft<=5?t.danger:timeLeft<=10?t.gold:t.green}}
>
          ⏱️ {timeLeft}s</span>
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
            <Btn t={t} onClick={submit} disabled={!val}
              style={{flexShrink:0}}>OK ✓</Btn>
          </div>
          {/* All-In toggle */}
          <button onClick={()=>setAllIn(a=>!a)}
            style={{width:'100%',marginTop:8,padding:'8px',borderRadius:t.radius,
              background:allIn?t.accent+'33':'none',
              border:`1px solid ${allIn?t.accent:t.border}`,
              color:allIn?t.accent:t.muted,fontSize:13,fontWeight:allIn?700:400,
              cursor:'pointer',fontFamily:t.fontBody,transition:'all .2s'}}>
            {allIn?i.allInActive:i.allIn}
          </button>
          {allIn&&<p style={{fontSize:11,color:t.accent,textAlign:'center',marginTop:4,opacity:.8}}>{i.allInHint}</p>}
          <div style={{display:'none'}}>
          </div>
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

      {/* ── JOKER BAR (collapsed until tapped) ── */}
      {room.enabledJokers?.length>0&&
        <JokerBar room={room} myId={myId} code={code} t={t} onSkip={onSkip} lang={lang}/>}

      {/* ── DEBUG PANEL ── */}
      {debugMode&&<div style={{padding:"12px",borderRadius:t.radius,
        background:t.surface,border:`2px dashed ${t.accent}`}}>
        <p style={{fontSize:10,fontWeight:700,color:t.accent,letterSpacing:.8,marginBottom:8}}>
          🛠️ DEBUG
        </p>
        <p style={{fontSize:10,color:t.muted,fontWeight:700,marginBottom:5}}>JOKER AUFLADEN</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {Object.keys(JOKER_DEFS).map(id=>{
            const jk=getJokerDef(id,"de");
            return <button key={jk.id} onClick={async()=>{
              const cur=(room.jokers||{})[myId]||[];
              await update(ref(db,`rooms/${code}/jokers`),{[myId]:[...cur,jk.id]});
            }} style={{padding:"5px 9px",borderRadius:t.radius,background:t.card,
              border:`1px solid ${t.border}`,color:t.text,fontSize:11,
              fontWeight:700,cursor:"pointer",fontFamily:t.fontBody}}>
              {jk.icon}+
            </button>;
          })}
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
function ResultsScreen({room,myId,t,onNext,onEnd,lang}){
  const i=UI[lang]||UI.de;
  const myNewJoker=(room.newJokersThisRound||{})[myId];
  useEffect(()=>{
    playSound("reveal");
    if(myNewJoker) setTimeout(()=>playSound("joker"),600);
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
        const qId=room.q.id;
        const qref=ref(db,`globalStats/questions/${qId}`);
        const qsnap=await get(qref);
        const qprev=qsnap.val()||{count:0,sum:0,sumSq:0};
        const newCount=(qprev.count||0)+1;
        const newSum=(qprev.sum||0)+myGuess;
        const newSumSq=(qprev.sumSq||0)+(myGuess*myGuess);
        const avg=newSum/newCount;
        // stdDev = sqrt(E[x²] - E[x]²)
        const variance=Math.max(0,(newSumSq/newCount)-(avg*avg));
        const stdDev=Math.sqrt(variance);
        const ts=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        await update(qref,{
          count:newCount, sum:newSum, sumSq:newSumSq,
          avg:Math.round(avg*100)/100,
          stdDev:Math.round(stdDev*100)/100,
          answer:room.q.a,
          [`guesses/${ts}`]:myGuess,
        });
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
    <div style={{textAlign:"center",marginBottom:22,animation:"fu .3s ease both"}}>
      <div style={{fontSize:30,marginBottom:6}}>{q.emoji||"❓"}</div>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
        <Pill t={t}>{i.reveal}</Pill>
        {room.speedMode&&<Pill t={t} color={t.accent}>⚡ Speed</Pill>}
      </div>
      {doubleActive&&<div style={{marginTop:8}}><Pill t={t} color={t.gold}>🎯 {i.doubleActive}</Pill></div>}
      {room.usedJokerThisRound&&room.usedJokerThisRound!=="double"&&room.usedJokerThisRound!=="hint"&&<div style={{marginTop:8,fontSize:13,color:t.gold}}>{getJokerDef(room.usedJokerThisRound,lang)?.icon} {jokerUsedName}: {getJokerDef(room.usedJokerThisRound,lang)?.name}</div>}
      <p style={{marginTop:14,fontSize:t.id==="kids"?17:15,lineHeight:1.55,color:t.muted,maxWidth:380,margin:"14px auto 6px"}}>{q.q}</p>
      <div style={{fontFamily:t.fontTitle,fontSize:"clamp(50px,12vw,82px)",color:t.accent,lineHeight:1,marginTop:4,animation:"pop .5s ease both"}}>{fmtNum(q.a)} {q.unit}</div>
      <p style={{color:t.muted,marginTop:11,fontSize:15,lineHeight:1.6,maxWidth:380,margin:"11px auto 0"}}>{q.hint}</p>
    </div>
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{i.roundScores}</p>
      {ranked.map((p,i)=>{const exact=p.diff===0,win=!exact&&closestIdsR.includes(p.id),pts=rs[p.id]||0,wasSabotaged=(room.sabotaged||{})[p.id]||null;return <div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:exact?t.green+"18":win?t.accent+"14":wasSabotaged?t.danger+"10":t.surface,border:`1.5px solid ${exact?t.green:win?t.accent+"44":wasSabotaged?t.danger+"44":t.border}`,animation:`fu .3s ${i*.07}s ease both`}}><span style={{fontSize:18,minWidth:20}}>{medals[i]||`${i+1}.`}</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}{wasSabotaged&&<span style={{color:t.danger,fontSize:11,marginLeft:6}}>
  {i.sabotaged} {room.players?.[wasSabotaged]?.name||"?"}
</span>}</span><span style={{fontFamily:t.fontMono,fontSize:13,color:win||exact?t.accent:t.text}}>{fmtNum(p.guess)} {q.unit}</span><span style={{fontFamily:t.fontMono,fontSize:11,color:t.muted,minWidth:44,textAlign:"right"}}>Δ{fmtNum(p.diff)}</span>{pts>0&&<Pill t={t} color={exact?t.green:t.gold}>+{pts}P</Pill>}</div>;})}
      {noAnswer&&noAnswer.map(p=><div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:t.danger+"10",border:`1.5px solid ${t.danger}33`,opacity:.7}}><span style={{fontSize:18,minWidth:20}}>⏱️</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}</span><span style={{color:t.danger,fontSize:13,fontWeight:700}}>{i.tooSlow}</span><Pill t={t} color={t.danger}>0P</Pill></div>)}
    </Card>
    {Object.keys(bets).length>0&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{i.betting}</p>
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
    <Card t={t} style={{marginBottom:18}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>GESAMTPUNKTE</p>
      {[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<pl.length-1?`1px solid ${t.border}`:"none"}}><span style={{fontFamily:t.fontTitle,fontSize:20,color:i===0?t.gold:t.muted,minWidth:20}}>{i+1}</span><Avatar name={p.name} t={t} size={30}/><span style={{flex:1,fontWeight:p.id===myId?800:400}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:12}}> (Du)</span>}</span><span style={{fontFamily:t.fontTitle,fontSize:32,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span></div>)}
    </Card>
    {isHost?<div style={{display:"flex",gap:10}}><Btn t={t} onClick={onNext} full>{i.nextQ}</Btn><Btn t={t} variant="secondary" onClick={onEnd}>{i.endGame}</Btn></div>:<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{i.waitingHost}</p>}
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
function ChatFeed({room, pl, gold, jokerIcon, i}) {
  const [events, setEvents] = useState([]);
  const feedRef = useRef(null);
  const prevRoom = useRef(null);

  useEffect(()=>{
    if(!room||!prevRoom.current) { prevRoom.current=room; return; }
    const prev = prevRoom.current;
    const newEvents = [];
    const now = Date.now();

    // Joker used – ROT (bedrohlich/aggressiv)
    const curJokers = room.jokers||{}, prevJokers = prev.jokers||{};
    pl.forEach(p=>{
      const cur=(curJokers[p.id]||[]).length;
      const prv=(prevJokers[p.id]||[]).length;
      if(cur<prv){
        const used=(prevJokers[p.id]||[]).find(j=>!(curJokers[p.id]||[]).includes(j)||
          (prevJokers[p.id]||[]).filter(x=>x===j).length>(curJokers[p.id]||[]).filter(x=>x===j).length);
        if(used){
          const colors={sabotage:'#ff3355',skip:'#ff8855',hint:'#aaaaaa',
                        double:'#55ffaa',change:'#aaaaaa',extra:'#aaaaaa'};
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

    // Exact hit – GRÜN (perfekt)
    const curG=room.guesses||{}, prevG=prev.guesses||{};
    const answer=room.q?.a;
    pl.forEach(p=>{
      if(curG[p.id]!=null&&prevG[p.id]==null&&answer!=null)
        if(Math.abs(curG[p.id]-answer)===0)
          newEvents.push({id:now+Math.random(),type:'exact',
            emoji:'🎯',
            text:p.name+' '+i.dispExact,
            color:'#39d98a',ts:now});
    });

    // Tipp eingegangen – GRAU (neutral/info)
    pl.forEach(p=>{
      if(curG[p.id]!=null&&curG[p.id]!==-999999&&prevG[p.id]==null&&answer!=null)
        if(Math.abs(curG[p.id]-answer)!==0) // kein Exact (der hat eigenen Event)
          newEvents.push({id:now+Math.random(),type:'guess',
            emoji:'✏️',
            text:p.name+' '+i.dispGuessed,
            color:'#6e5e54',ts:now});
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
          color:'#f2ece6',ts:now});
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
    {events.length===0&&<p style={{fontSize:11,color:'#3a2a1e',textAlign:'center',
      marginTop:12}}>Noch keine Events...</p>}
    {events.map(ev=>(
      <div key={ev.id} style={{display:'flex',alignItems:'flex-start',gap:7,
        background:ev.type==='phase'?'#221a0e':ev.type==='exact'?'#0d2218':
                   ev.type==='joker_earned'?'#1f1408':ev.type==='joker_used'?'#1a0a0a':'#181310',
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

  return <div style={{padding:'12px 14px',background:'#0f0a06',
    borderRadius:12,border:`1px solid #2a1a0e`,marginBottom:8}}>
    <p style={{fontSize:11,fontWeight:700,color:'#6e5e54',letterSpacing:1,
      margin:'0 0 10px',textTransform:'uppercase'}}>
      📊 Tipp-Verteilung
      {globalVals.length>0&&<span style={{fontWeight:400,marginLeft:6,color:'#3a2a1e'}}>
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
            background:'#2a1a0e',borderRadius:'3px 3px 0 0',
          }}/>}
          {/* Round bar (foreground, colored) */}
          {roundBins[i].length>0&&<div style={{
            position:'absolute',bottom:0,left:'10%',right:'10%',
            height:`${Math.max(rH,6)}%`,
            background:isAnswerBin?'#39d98a':gold+'cc',
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
      <span style={{fontSize:10,color:'#6e5e54'}}>{fmtNum(Math.round(min))}</span>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        {globalVals.length>0&&<span style={{fontSize:9,color:'#3a2a1e',display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:10,height:8,background:'#2a1a0e',borderRadius:2}}/> Historisch
        </span>}
        <span style={{fontSize:9,color:gold,display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:10,height:8,background:gold+'cc',borderRadius:2}}/> Diese Runde
        </span>
        <span style={{fontSize:9,color:'#39d98a',display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:2,height:10,background:'#39d98a'}}/> Antwort
        </span>
        {crowdsAvg!=null&&<span style={{fontSize:9,color:'#a78bfa',display:'flex',alignItems:'center',gap:3}}>
          <div style={{width:2,height:10,background:'#a78bfa'}}/> Schwarmintelligenz ({crowdsCount})
        </span>}
      </div>
      <span style={{fontSize:10,color:'#6e5e54'}}>{fmtNum(Math.round(max))}</span>
    </div>
  </div>;
}

function DisplayScreen({room, code, t, lang}) {
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
  const sorted = [...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const medals = ['🥇','🥈','🥉'];
  const gold = t.gold; const accent = t.accent;

  // Ranked for results
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
      window.QRCode.toDataURL(link,{width:140,margin:1,color:{dark:'#f2ece6',light:'#1a120a'}})
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

  const jokerIcon = j=>j==='skip'?'⏭️':j==='hint'?'💡':j==='double'?'✖️2':j==='sabotage'?'💣':j==='change'?'🔄':'🃏';
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

  return <div style={{minHeight:'100vh',background:'#0f0a06',color:'#f2ece6',
    fontFamily:t.fontBody,display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <style>{css}</style>

    {/* Joker Overlay */}
    {jokerAnim&&<div style={{position:'fixed',inset:0,zIndex:200,pointerEvents:'none',
      display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)'}}>
      <div style={{background:'#0f0a06',border:`3px solid ${jokerColor(jokerAnim.type)}`,
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
        {jokerAnim.to&&<p style={{fontSize:22,color:'#f2ece6',margin:0,
          animation:'shake .5s ease 1s both'}}>
          💣 → <strong>{jokerAnim.to}</strong>
        </p>}
      </div>
    </div>}

    {/* Header */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'12px 28px',borderBottom:'1px solid #2a1a0e',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'baseline',gap:3}}>
        <span style={{fontSize:22,fontWeight:900,color:accent}}>Esti</span>
        <span style={{fontSize:22,fontWeight:900,color:gold}}>Mates</span>
      </div>
      {phase==='question'&&<div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:140,height:5,background:'#2a1a0e',borderRadius:3,overflow:'hidden'}}>
          <div style={{height:'100%',background:gold,borderRadius:3,transition:'width .4s',
            width:`${(tippedCount/Math.max(pl.length,1))*100}%`}}/>
        </div>
        <span style={{fontSize:12,color:'#6e5e54'}}>{tippedCount}/{pl.length} {i.dispTipped}</span>
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
        gap:16,borderRight:'1px solid #2a1a0e',overflow:'hidden'}}>

        {/* LOBBY */}
        {(phase==='lobby'||phase==='jokerSetup'||phase==='categories')&&
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
            justifyContent:'center',gap:20}}>
            <div style={{fontSize:48,animation:'pulse2 2s ease infinite'}}>🎮</div>
            <p style={{fontSize:26,fontWeight:900,margin:0}}>{i.dispReady}</p>
            <p style={{fontSize:16,color:'#6e5e54',margin:0}}>{i.dispHostPrep}</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center',marginTop:8}}>
              {pl.map((p,idx)=><div key={p.id} style={{background:'#1a120a',
                border:'1.5px solid #2a1a0e',borderRadius:12,padding:'8px 16px',
                fontSize:14,fontWeight:600,animation:`flyIn .4s ease ${idx*0.1}s both`}}>
                👤 {p.name}
              </div>)}
            </div>
          </div>}

        {/* QUESTION */}
        {phase==='question'&&q&&<>
          <div style={{background:'#1a120a',borderRadius:12,padding:'14px 18px',
            border:`1.5px solid ${gold}33`}}>
            <p style={{fontSize:11,fontWeight:700,color:'#6e5e54',letterSpacing:1,margin:'0 0 12px'}}>{i.dispQuestion}</p>
            <p style={{fontSize:'clamp(14px,1.8vw,20px)',fontWeight:800,lineHeight:1.4,margin:'0 0 10px'}}>{q.q}</p>
            {q.unit&&<span style={{background:gold+'22',border:`1px solid ${gold}55`,
              borderRadius:8,padding:'4px 12px',color:gold,fontWeight:700,fontSize:14}}>
              {i.tipIn}: {q.unit}
            </span>}
          </div>
          {/* Live ranking grid - sorted by score, shows tip + points */}
          <div style={{flex:1,display:'grid',
            gridTemplateColumns:`repeat(${Math.min(Math.ceil(pl.length/2),4)},1fr)`,
            gap:8,alignContent:'start'}}>
            {sorted.map((p,rank)=>{
              const g=guesses[p.id]; const tipped=g!=null; const timedOut=g===-999999;
              const pts=scores[p.id]||0;
              const medals=['🥇','🥈','🥉'];
              const sb=(room.steckbriefe||{})[p.id];
              const displayName=sb?.kampfname?`${p.name} aka ${sb.kampfname}`:p.name;
              return <div key={p.id} style={{
                background:tipped?gold+'1a':'#1a120a',
                border:`1.5px solid ${rank===0?gold:tipped?gold+'66':'#2a1a0e'}`,
                borderRadius:12,padding:'8px 6px',textAlign:'center',
                transition:'all .6s',
                animation:tipped?'glow .8s ease':'none',
                position:'relative'}}>
                {/* Rank badge */}
                <div style={{position:'absolute',top:4,left:5,fontSize:10,opacity:.7}}>
                  {medals[rank]||`${rank+1}.`}
                </div>
                {/* Selfie avatar */}
                <div style={{width:36,height:36,borderRadius:'50%',overflow:'hidden',
                  margin:'4px auto 4px',border:`2px solid ${tipped?gold:'#2a1a0e'}`}}>
                  {sb?.selfie
                    ? <img src={sb.selfie} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <div style={{width:'100%',height:'100%',background:'#2a1a0e',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:16,color:tipped?gold:'#6e5e54'}}>
                        {timedOut?'⏱️':tipped?'✅':'⏳'}
                      </div>}
                </div>
                {/* Spitzname */}
                <div style={{fontSize:11,fontWeight:700,marginBottom:2,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                  color:rank===0?gold:'#f2ece6'}}>{displayName}</div>
                {/* Tip value */}
                <div style={{fontSize:14,fontWeight:800,color:gold,marginBottom:1}}>
                  {tipped&&!timedOut?fmtNum(g):'—'}
                </div>
                {/* Points */}
                <div style={{fontSize:11,color:'#6e5e54',fontWeight:600}}>
                  {pts}P
                </div>
              </div>;
            })}
          </div>
        </>}

        {/* RESULTS / REVEAL */}
        {(phase==='results'||phase==='reveal')&&q&&<>
          {/* Question + Answer + Hint */}
          <div style={{background:gold+'22',borderRadius:12,padding:'14px 20px',
            border:`2px solid ${gold}`,animation:revealed?'popIn .5s ease both':'none',flexShrink:0}}>
            {/* Question */}
            <p style={{fontSize:13,color:'#c8b8a8',margin:'0 0 8px',lineHeight:1.4}}>{q.q}</p>
            {/* Answer */}
            <p style={{fontSize:11,fontWeight:700,color:'#6e5e54',letterSpacing:1,margin:'0 0 4px'}}>{i.dispAnswer}</p>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:q.hint?10:0}}>
              <span style={{fontSize:'clamp(28px,4vw,48px)',fontWeight:900,color:gold}}>
                {fmtNum(q.a)}
              </span>
              <span style={{fontSize:16,color:'#6e5e54'}}>{q.unit}</span>
            </div>
            {/* Hint */}
            {q.hint&&<div style={{background:'#1a120a',borderRadius:8,padding:'8px 12px',
              borderLeft:`3px solid ${gold}`}}>
              <span style={{fontSize:12,color:gold,fontWeight:600}}>💡 </span>
              <span style={{fontSize:12,color:'#c8b8a8'}}>{q.hint}</span>
            </div>}
          </div>
          {/* Histogram */}
          <TippHistogram room={room} t={{surface:'#1a120a',border:'#2a1a0e',radius:12,muted:'#6e5e54',text:'#f2ece6'}} lang={lang} gold={gold}/>
          {/* Full results table */}
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:6,overflowY:'auto'}}>
            {ranked.map((p,idx)=>{
              const isClosest=closestIds.includes(p.id);
              const roundPts=rs[p.id]||0;
              return <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,
                background:p.diff===0?'#39d98a22':isClosest?gold+'18':'#1a120a',
                border:`1px solid ${p.diff===0?'#39d98a':isClosest?gold+'66':'#2a1a0e'}`,
                borderRadius:10,padding:'10px 14px',
                animation:`slideUp .4s ease ${idx*0.08}s both`}}>
                <span style={{fontSize:18,width:26,flexShrink:0}}>{medals[idx]||`${idx+1}.`}</span>
                <span style={{flex:1,fontWeight:isClosest?700:400,fontSize:14}}>{p.name}</span>
                <span style={{fontFamily:t.fontMono,fontSize:13,color:'#6e5e54',minWidth:50,textAlign:'right'}}>
                  {fmtNum(p.guess)}
                </span>
                <span style={{fontFamily:t.fontMono,fontSize:13,fontWeight:700,minWidth:56,textAlign:'right',
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
          alignItems:'center',justifyContent:'center',gap:16}}>
          <div style={{fontSize:64}}>🏆</div>
          <p style={{fontSize:32,fontWeight:900,color:gold,margin:0}}>
            {sorted[0]?.name} {i.dispWins}
          </p>
          <p style={{fontSize:20,color:'#6e5e54',margin:0}}>
            {scores[sorted[0]?.id]||0} {i.pts}
          </p>
        </div>}
      </div>

      {/* ── RIGHT: Scoreboard + Live Stats ── */}
      <div style={{flex:'0 0 42%',padding:'16px 20px',display:'flex',flexDirection:'column',
        gap:0,overflow:'hidden',minWidth:0}}>



        {/* ── Live Statistiken ── */}
        {history.length>0&&<>
          <p style={{fontSize:11,fontWeight:700,color:'#6e5e54',letterSpacing:1.2,
            margin:'0 0 10px',textTransform:'uppercase',borderTop:'1px solid #2a1a0e',
            paddingTop:10}}>{i.dispStats}</p>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
            {sorted.map(p=>{
              const avg=diffCounts[p.id]>0?Math.round(diffTotals[p.id]/diffCounts[p.id]):null;
              return <div key={p.id} style={{background:'#181310',borderRadius:10,
                padding:'10px 14px',border:'1px solid #2a1a0e'}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:5,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                  color:'#f2ece6'}}>{p.name}</div>
                <div style={{display:'flex',gap:14,color:'#8e7e6e',fontSize:13}}>
                  <span title="Exakte Treffer">🎯 {exactHits[p.id]||0}</span>
                  <span title="Ø Abweichung">Ø {avg!=null?fmtNum(avg):'–'}</span>
                  <span title="Joker gespielt">🃏 {jokerTotals[p.id]||0}</span>
                </div>
              </div>;
            })}
          </div>
        </>}

        {/* ── Joker Inventar ── */}
        <div style={{borderTop:'1px solid #2a1a0e',paddingTop:10,marginBottom:10,flexShrink:0}}>
          <p style={{fontSize:11,fontWeight:700,color:'#6e5e54',letterSpacing:1.2,
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
        <div style={{borderTop:'1px solid #2a1a0e',paddingTop:10,flex:1,
          display:'flex',flexDirection:'column',minHeight:0}}>
          <p style={{fontSize:11,fontWeight:700,color:'#6e5e54',letterSpacing:1.2,
            margin:'0 0 10px',textTransform:'uppercase',flexShrink:0}}>{i.dispEvents}</p>
          <ChatFeed room={room} pl={pl} gold={gold} jokerIcon={jokerIcon} i={i}/>
        </div>

        {/* ── QR ── */}
        {qr&&<div style={{textAlign:'center',opacity:.5,paddingTop:12,flexShrink:0,
          borderTop:'1px solid #2a1a0e',marginTop:8}}>
          <img src={qr} style={{width:72,height:72,borderRadius:6}}/>
          <p style={{fontSize:11,color:'#6e5e54',margin:'4px 0 0'}}>{i.dispScanJoin}</p>
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
  const SUPPORT_EMAIL = 'support@playestimates.app';

  function report() {
    const subject = encodeURIComponent(i.feedbackBugSubject||'Fehler');
    const qText = question ? `Frage: "${question.q}"\nAntwort laut App: ${question.a} ${question.unit}\nWas stimmt nicht: ` : '';
    const body = encodeURIComponent(qText + '\n\n' + (i.feedbackReward||''));
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <button onClick={report}
      style={{background:'none',border:'none',color:t.muted,fontSize:11,
        cursor:'pointer',fontFamily:t.fontBody,textDecoration:'underline',
        opacity:.6,padding:'4px 0'}}>
      {i.feedbackBug||'🐛 Fehler melden'}
    </button>
  );
}

/* ─── FINAL ───────────────────────────────────────── */
function FinalScreen({room,myId,t,onRestart,lang,isAnonymous=true,onShowLogin=null,userName=null}){
  const i=UI[lang]||UI.de;
  const[globalRank,setGlobalRank]=useState(null);
  const[showCamera,setShowCamera]=useState(false);
  const[winnerPhoto,setWinnerPhoto]=useState(null);
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

  const statCards=[
    betKing&&{icon:"🎲",label:i.betKing,name:betKing.name,sub:`${i.betSub(betWins[betKingId],betTotal[betKingId])} (${betKingRate}%)`,color:t.gold},
    bestPlayer&&sorted.length>1&&{icon:"🎯",label:i.bestGuesser,name:bestPlayer.name,sub:`${i.avgDeviation}: ${fmtNum(bestAvg)}`,color:t.green},
    room.betWorst!==false&&worstPlayer&&sorted.length>1&&bestId!==worstId&&{icon:"🙈",label:i.worstGuesser,name:worstPlayer.name,sub:`${i.avgDeviation}: ${fmtNum(worstAvg)}`,color:t.danger},
    exactKing&&(exactHits[exactKingId]||0)>0&&{icon:"💥",label:i.exactHits,name:exactKing.name,sub:i.exactCount(exactHits[exactKingId]),color:t.accent},
    jokerKing&&(jokerTotals[jokerKingId]||0)>0&&{icon:"🃏",label:i.jokerKing,name:jokerKing.name,sub:i.jokerPlayed(jokerTotals[jokerKingId]),color:t.gold},
    sabotageKing&&{icon:"💣",label:i.sabotageKing,name:sabotageKing.name,sub:i.sabotageCount(sabotageStats[sabotageKingId]),color:t.danger},
  ].filter(Boolean);

  return <div style={{...page,textAlign:"center",paddingTop:36}}>
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
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>{i.finalStand}</p>
      {sorted.map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<sorted.length-1?`1px solid ${t.border}`:"none",animation:`fu .4s ${i*.08}s ease both`}}>
        <span style={{fontSize:20,minWidth:26}}>{medals[i]||`${i+1}.`}</span>
        <Avatar name={p.name} t={t}/>
        <span style={{flex:1,fontWeight:p.id===myId?800:400,fontSize:15,textAlign:"left"}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:11}}> (Du)</span>}</span>
        <span style={{fontFamily:t.fontTitle,fontSize:36,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span>
      </div>)}
    </Card>
    {statCards.length>0&&<Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>{i.stats}</p>
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
  const t = ADULT;

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

  return <ErrorBoundary><DisplayScreen room={room} code={roomCode} t={t} lang={lang}/></ErrorBoundary>;
}

/* ─── LOGIN PROMPT ──────────────────────────────── */
function LoginPrompt({t, lang, onClose, onSuccess}) {
  const i = UI[lang]||UI.de;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loginWith(provider) {
    console.log("loginWith called, auth:", !!auth, "currentUser:", auth?.currentUser?.uid);
    setBusy(true); setError(null);
    if(!auth){ setError("Auth nicht verfügbar"); setBusy(false); return; }
    try {
      const currentUser = auth.currentUser;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if(isMobile) {
        // Use redirect on mobile (more reliable)
        if(currentUser && currentUser.isAnonymous) {
          await linkWithRedirect(currentUser, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
        // Page will redirect - result handled on return
      } else {
        // Use popup on desktop
        if(currentUser && currentUser.isAnonymous) {
          await linkWithPopup(currentUser, provider);
        } else {
          await signInWithPopup(auth, provider);
        }
        onSuccess?.();
        onClose();
      }
    } catch(e) {
      if(e.code !== 'auth/popup-closed-by-user') {
        setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      }
      setBusy(false);
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

function App(){
  const[screen,setScreen]=useState("home");
  const[room,setRoom]=useState(null);
  const[code,setCode]=useState(null);
  const[myId,setMyId]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[showLoginPrompt,setShowLoginPrompt]=useState(false);
  const[showOnboarding,setShowOnboarding]=useState(()=>!localStorage.getItem('em_onboarded'));
  const[showSteckbrief,setShowSteckbrief]=useState(false);
  const[showCountdown,setShowCountdown]=useState(false);
  const[isAnonymous,setIsAnonymous]=useState(true);
  const[userName,setUserName]=useState(null);
  const[isPro,setIsPro]=useState(false);

  const[mode,setMode]=useState("adult");
  const[loading,setLoading]=useState(false);
  const[loadTxt,setLoadTxt]=useState("");
  const[debugMode,setDebugMode]=useState(true);
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
          setMyId(result.user.uid);
          setIsAnonymous(result.user.isAnonymous);
          setShowLoginPrompt(false);
        }
      }).catch(e=>console.log('Redirect result:', e));
    }

    // Sign in anonymously on first load
    const unsubAuth = auth.onAuthStateChanged(user=>{
      if(user){
        setMyId(user.uid);
        setIsAnonymous(user.isAnonymous);
        setUserName(user.displayName||user.email||null);
        setIsPro(isAdmin(user.uid));
        setAuthReady(true);
      } else {
        signInAnonymously(auth).catch(err=>console.error('Auth error:',err));
      }
    });

    return ()=>unsubAuth();
  },[]);

  // Auto-reconnect once myId is ready
  const autoJoinedRef = React.useRef(false);
  const prevRoomRef = useRef(null);
  const showSteckbriefShownRef = useRef(false);
  useEffect(()=>{
    if(!myId || autoJoinedRef.current) return;
    const urlRoom = new URLSearchParams(location.search).get('room');
    const storedName = localStorage.getItem('em_lastname');
    if(urlRoom && storedName) {
      autoJoinedRef.current = true;
      setCode(urlRoom);
      listenRoom(urlRoom);
      setScreen('lobby');
    }
  },[myId]);
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
      try{
      setRoom({...r});
      setMode(r.mode||"adult");
      const map={lobby:"lobby",jokerSetup:"jokerSetup",categories:"categories",question:"question",betting:"betting",results:"results",final:"final"};
      if(map[r.phase])setScreen(map[r.phase]);
      // Show steckbrief when in lobby and steckbriefEnabled (catches both join and host-enable)
      const prevSteckbrief = prevRoomRef.current?.steckbriefEnabled;
      const uid = auth?.currentUser?.uid;
      if(r.steckbriefEnabled&&!showSteckbriefShownRef.current&&r.players?.[uid]&&(r.phase==="lobby"||r.phase==="jokerSetup"||r.phase==="categories"||r.phase==="question")){
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

  async function handleHost(name,m){
    setMode(m);
    const c=genCode();
    setCode(c);
    setLoadTxt("Raum wird erstellt...");
    setLoading(true);
    await dbSet(c,{code:c,mode:m,lang,hostId:myId,players:{[myId]:{id:myId,name}},order:[myId],phase:"lobby",guesses:{},bets:{},scores:{},roundScores:{},q:null,qIdx:0,history:[],jokers:{},enabledJokers:[],jokerStats:{},sabotageStats:{},farthestStreak:{},afkPlayers:{}});
    listenRoom(c);
    setLoading(false);
    setScreen("lobby");
    // Show steckbrief if enabled
  }

  async function handleJoin(c,name,m,roomLang){
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
    setMode(m||"adult");
    if(roomLang&&roomLang!==lang) setLang(roomLang);
    setCode(c);
    setLoadTxt("Betrete Raum...");
    setLoading(true);
    const r=await dbGet(c);
    const effectiveId = uid || myId;
    await dbPatch(c,{players:{...r.players,[effectiveId]:{id:effectiveId,name}},order:[...(r.order||[]),effectiveId]});
    listenRoom(c);
    setLoading(false);
    setScreen("lobby");
    // Show steckbrief if enabled
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
    // Track session start
    const platform=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?'mobile':'desktop';
    const sessionRef=ref(db,`globalStats/sessions/${Date.now().toString(36)}`);
    update(sessionRef,{
      ts:Date.now(), lang, mode,
      groupSize:(room?.order||[]).length,
      platform,
      categories:selectedCats.slice(0,5),
    }).catch(()=>{});
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},allIn:{},qIdx:0,selectedCats,usedJokerThisRound:null,hintVisible:false,hintFor:null,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,sabotaged:{},newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1});
  }

  async function handleGuess(val, isAllIn=false){
    await update(ref(db,`rooms/${code}/guesses`),{[myId]:val});
    if(isAllIn) await update(ref(db,`rooms/${code}/allIn`),{[myId]:true});
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

        if(active.length<3){
          const merged={...r,guesses:g};
          const result=calcRound(merged);
          const newJokers=await distributeJokers(r,result,active);
          const histEntry={guesses:g,answer:r.q?.a,bets:{},closestId:result.closestId,farthestId:result.farthestId};
          await dbPatch(code,{phase:"results",roundScores:result.roundScores,scores:result.newScores,history:[...(r.history||[]),histEntry],newJokersThisRound:newJokers,advancing:false});
        } else {
          if(room.withBets===false){
            await dbPatch(code,{phase:"results",advancing:false});
          } else {
            await dbPatch(code,{phase:"betting",advancing:false});
          }
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
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},allIn:{},qIdx:(r.qIdx||0)+1,usedJokerThisRound:null,hintVisible:false,hintFor:null,extraHint:null,extraHintColor:null,extraHintFor:null,skipVotes:{},skipImmediate:false,skipBy:null,newJokersThisRound:{},changeAllowed:null,advancing:false,jokersDistributedForRound:-1,sabotaged:{}});
  }

  async function handleKick(playerId){
    if(!room||room.hostId!==myId) return;
    const playerName=room.players?.[playerId]?.name||'?';
    if(!window.confirm(`${playerName} wirklich kicken?`)) return;
    const newOrder=(room.order||[]).filter(id=>id!==playerId);
    const updates={};
    updates[`rooms/${code}/order`]=newOrder;
    updates[`rooms/${code}/kicked/${playerId}`]=true;
    updates[`rooms/${code}/players/${playerId}`]=null;
    await update(ref(db),updates);
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

  async function handleEnd(){await dbPatch(code,{phase:"final"});}

  function handleRestart(){
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
    {screen==="home"&&!showOnboarding&&<HomeScreen onHost={handleHost} onJoin={handleJoin} lang={lang} onSetLang={setLang} isAnonymous={isAnonymous} userName={userName} onShowLogin={()=>setShowLoginPrompt(true)} onSignOut={async()=>{await signOut(auth);await signInAnonymously(auth);}} onShowOnboarding={()=>setShowOnboarding(true)}/>}
    {screen==='lobby'&&!room&&<div style={{minHeight:'100vh',background:t.bg,
      display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <Spinner t={t}/>
      <p style={{color:t.muted,fontSize:14,animation:'pulse 1.5s ease infinite'}}>Verbinde mit Raum...</p>
    </div>}
    {screen==='lobby'&&room&&(room.kicked||{})[myId]&&
      <div style={{...page,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,textAlign:'center'}}>
        <div style={{fontSize:56}}>🚪</div>
        <p style={{fontWeight:700,fontSize:18}}>{(UI[lang]||UI.de).kicked}</p>
        <Btn t={t} onClick={()=>{setScreen('home');setRoom(null);setCode(null);}}>← Zurück</Btn>
      </div>}
    {screen==='lobby'&&room&&!(room.kicked||{})[myId]&&<LobbyScreen room={room} code={code} myId={myId} t={t} onGoJokerSetup={handleGoJokerSetup} lang={lang} onKick={handleKick}/>}
    {screen==="jokerSetup"&&room&&room.hostId===myId&&<JokerSetupScreen mode={mode} onDone={handleJokerSetupDone} t={t} onToggleDebug={setDebugMode} debugModeInit={debugMode} lang={lang}/>}
    {screen==="jokerSetup"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Joker-Einstellungen...</p></div>}
    {screen==="categories"&&room&&room.hostId===myId&&<CategoryScreen mode={mode} onStart={handleStartWithCats} t={t} lang={lang}/>}
    {screen==="categories"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Kategorien...</p></div>}
    {showSteckbrief&&myId&&code&&<SteckbriefScreen t={t} lang={lang} myId={myId} code={code} playerName={room?.players?.[myId]?.name||''} onDone={()=>setShowSteckbrief(false)}/>}
    {screen==="question"&&room&&<QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess} code={code} debugMode={debugMode} onSkip={handleSkip} lang={lang}/>}
    {screen==="betting"&&room&&(room.order||[]).filter(id=>!(room.afkPlayers||{})[id]).length>1&&<BettingScreen room={room} myId={myId} t={t} onBet={handleBet} code={code} lang={lang}/>}
    {screen==="results"&&room&&<ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd} lang={lang}/>}
    {screen==="final"&&room&&<FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart} lang={lang} isAnonymous={isAnonymous} onShowLogin={()=>setShowLoginPrompt(true)} userName={userName}/>}

  </ErrorBoundary>;
}

export default App;
