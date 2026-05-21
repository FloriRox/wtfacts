// ─────────────────────────────────────────────────────────
// ESTIMATESS – FRAGEN-INDEX
// Sprache: DE (Deutsch)
// Für Englisch: Pfade auf "./en/" ändern
// ─────────────────────────────────────────────────────────

import adultTest         from "./de/adult_test.js";
import adultKoerper      from "./de/adult_koerper.js";
import adultRekorde      from "./de/adult_rekorde.js";
import adultTiere        from "./de/adult_tiere.js";
import adultEssen        from "./de/adult_essen.js";
import adultHistory      from "./de/adult_history.js";
import adultAstro        from "./de/adult_astro.js";
import adultGeld         from "./de/adult_geld.js";
import adultFilm         from "./de/adult_film.js";
import adultSex          from "./de/adult_sex.js";
import adultWissenschaft from "./de/adult_wissenschaft.js";
import adultPolitik      from "./de/adult_politik.js";
import adultDrogen       from "./de/adult_drogen.js";
import adultEkel         from "./de/adult_ekel.js";
import adultTiersex      from "./de/adult_tiersex.js";

import kidsTest     from "./de/kids_test.js";
import kidsTiere    from "./de/kids_tiere.js";
import kidsGeo      from "./de/kids_geo.js";
import kidsDinos    from "./de/kids_dinos.js";
import kidsWeltraum from "./de/kids_weltraum.js";
import kidsSport    from "./de/kids_sport.js";
import kidsMaerchen from "./de/kids_maerchen.js";
import kidsOzeane   from "./de/kids_ozeane.js";
import kidsKunst    from "./de/kids_kunst.js";

const QUESTIONS = {
  adult: {
    "🎯 Gratis-Test":           { questions: adultTest,         locked: false },
    "🔥 Körper & Biologie":     { questions: adultKoerper,      locked: false },
    "💀 Bizarre Rekorde":       { questions: adultRekorde,      locked: false },
    "🐾 Tierreich":             { questions: adultTiere,        locked: false },
    "🍺 Essen & Trinken":       { questions: adultEssen,        locked: false },
    "🌍 Geschichte":            { questions: adultHistory,      locked: false },
    "🚀 Astronomie & Physik":   { questions: adultAstro,        locked: false },
    "💰 Geld & absurde Preise": { questions: adultGeld,         locked: false },
    "🎬 Film, TV & Popkultur":  { questions: adultFilm,         locked: false },
    "🍆 Sex & Tabus":           { questions: adultSex,          locked: false },
    "🧪 Wissenschaft":          { questions: adultWissenschaft, locked: false },
    "🏛️ Politik & Macht":       { questions: adultPolitik,      locked: false },
    "💊 Drogen & Rausch":       { questions: adultDrogen,       locked: false },
    "💩 Körper & Ekel":         { questions: adultEkel,         locked: false },
    "🐾 Tiere & Sex":           { questions: adultTiersex,      locked: false },
  },
  kids: {
    "🎯 Gratis-Test":        { questions: kidsTest,     locked: false },
    "🐘 Tiere":              { questions: kidsTiere,    locked: false },
    "🌍 Geografie":          { questions: kidsGeo,      locked: false },
    "🦕 Dinosaurier":        { questions: kidsDinos,    locked: false },
    "🚀 Weltraum":           { questions: kidsWeltraum, locked: false },
    "🏆 Sport & Rekorde":    { questions: kidsSport,    locked: false },
    "🏰 Märchen & Fantasie": { questions: kidsMaerchen, locked: false },
    "🌊 Ozeane & Meere":     { questions: kidsOzeane,   locked: false },
    "🎨 Kunst & Erfindungen":{ questions: kidsKunst,    locked: false },
  },
};

export default QUESTIONS;
