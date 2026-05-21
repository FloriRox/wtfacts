// ─────────────────────────────────────────────────────────
// ESTIMATESS – FRAGEN-INDEX
// ─────────────────────────────────────────────────────────

import adultTest         from "./adult_test.js";
import adultKoerper      from "./adult_koerper.js";
import adultRekorde      from "./adult_rekorde.js";
import adultTiere        from "./adult_tiere.js";
import adultEssen        from "./adult_essen.js";
import adultHistory      from "./adult_history.js";
import adultAstro        from "./adult_astro.js";
import adultGeld         from "./adult_geld.js";
import adultFilm         from "./adult_film.js";
import adultSex          from "./adult_sex.js";
import adultWissenschaft from "./adult_wissenschaft.js";
import adultPolitik      from "./adult_politik.js";
import adultDrogen       from "./adult_drogen.js";
import adultEkel         from "./adult_ekel.js";
import adultTiersex      from "./adult_tiersex.js";

import kidsTest     from "./kids_test.js";
import kidsTiere    from "./kids_tiere.js";
import kidsGeo      from "./kids_geo.js";
import kidsDinos    from "./kids_dinos.js";
import kidsWeltraum from "./kids_weltraum.js";
import kidsSport    from "./kids_sport.js";
import kidsMaerchen from "./kids_maerchen.js";
import kidsOzeane   from "./kids_ozeane.js";
import kidsKunst    from "./kids_kunst.js";

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
