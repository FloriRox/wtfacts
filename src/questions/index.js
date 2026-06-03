// ─────────────────────────────────────────────────────────
// ESTIMATESS – QUESTIONS INDEX – ENGLISH
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
import adultWtf          from "./adult_wtf.js";

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
    "🎯 Free Sampler":          { questions: adultTest,         locked: false },
    "🔥 Body & Biology":        { questions: adultKoerper,      locked: false },
    "💀 Bizarre Records":       { questions: adultRekorde,      locked: false },
    "🐾 Animal Kingdom":        { questions: adultTiere,        locked: false },
    "🍺 Food & Drink":          { questions: adultEssen,        locked: false },
    "🌍 History":               { questions: adultHistory,      locked: false },
    "🚀 Astronomy & Physics":   { questions: adultAstro,        locked: false },
    "💰 Money & Prices":        { questions: adultGeld,         locked: false },
    "🎬 Film, TV & Pop Culture":{ questions: adultFilm,         locked: false },
    "🍆 Sex & Taboos":          { questions: adultSex,          locked: false },
    "🧪 Science":               { questions: adultWissenschaft, locked: false },
    "🏛️ Politics & Power":      { questions: adultPolitik,      locked: false },
    "💊 Drugs & Highs":         { questions: adultDrogen,       locked: false },
    "💩 Body & Gross":          { questions: adultEkel,         locked: false },
    "🐾 Animals & Sex":         { questions: adultTiersex,      locked: false },
    "🤯 WTF Facts":             { questions: adultWtf,          locked: false },
  },
  kids: {
    "🎯 Free Sampler":          { questions: kidsTest,     locked: false },
    "🐘 Animals":               { questions: kidsTiere,    locked: false },
    "🌍 Geography":             { questions: kidsGeo,      locked: false },
    "🦕 Dinosaurs":             { questions: kidsDinos,    locked: false },
    "🚀 Space":                 { questions: kidsWeltraum, locked: false },
    "🏆 Sport & Records":       { questions: kidsSport,    locked: false },
    "🏰 Fairy Tales & Fantasy": { questions: kidsMaerchen, locked: false },
    "🌊 Oceans & Sea":          { questions: kidsOzeane,   locked: false },
    "🎨 Art & Inventions":      { questions: kidsKunst,    locked: false },
  },
};

export default QUESTIONS;
