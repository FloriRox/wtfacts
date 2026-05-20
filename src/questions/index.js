// ─────────────────────────────────────────────────────────
// WTFACTS – FRAGEN-INDEX
// ─────────────────────────────────────────────────────────
// Jede Kategorie hat ein `locked` Flag:
//   false = kostenlos (für alle Spieler verfügbar)
//   true  = gesperrt (später für kostenpflichtige Pakete)
//
// Um eine Kategorie zu sperren, einfach `locked: true` setzen.
// Die App zeigt gesperrte Kategorien dann mit einem 🔒 Symbol.
// ─────────────────────────────────────────────────────────

import adultTest    from "./adult_test.js";
import adultKoerper from "./adult_koerper.js";
import adultRekorde from "./adult_rekorde.js";
import adultTiere   from "./adult_tiere.js";
import adultEssen   from "./adult_essen.js";
import adultHistory from "./adult_history.js";
import adultAstro   from "./adult_astro.js";

import kidsTest     from "./kids_test.js";
import kidsTiere    from "./kids_tiere.js";
import kidsGeo      from "./kids_geo.js";
import kidsDinos    from "./kids_dinos.js";
import kidsWeltraum from "./kids_weltraum.js";
import kidsSport    from "./kids_sport.js";

const QUESTIONS = {
  adult: {
    "🎯 Gratis-Test":       { questions: adultTest,    locked: false },
    "🔥 Körper & Biologie": { questions: adultKoerper, locked: false },
    "💀 Bizarre Rekorde":   { questions: adultRekorde, locked: false },
    "🐾 Tierreich":         { questions: adultTiere,   locked: false },
    "🍺 Essen & Trinken":   { questions: adultEssen,   locked: false },
    "🌍 Geschichte":        { questions: adultHistory, locked: false },
    "🚀 Astronomie":        { questions: adultAstro,   locked: false },
  },
  kids: {
    "🎯 Gratis-Test":       { questions: kidsTest,     locked: false },
    "🐘 Tiere":             { questions: kidsTiere,    locked: false },
    "🌍 Geografie":         { questions: kidsGeo,      locked: false },
    "🦕 Dinosaurier":       { questions: kidsDinos,    locked: false },
    "🚀 Weltraum":          { questions: kidsWeltraum, locked: false },
    "🏆 Sport & Rekorde":   { questions: kidsSport,    locked: false },
  },
};

export default QUESTIONS;
