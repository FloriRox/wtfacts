// ─────────────────────────────────────────────────────────
// ESTIMATESS – ÍNDICE DE PREGUNTAS – ESPAÑOL
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
    "🎯 Muestra Gratuita":      { questions: adultTest,         locked: false },
    "🔥 Cuerpo y Biología":     { questions: adultKoerper,      locked: false },
    "💀 Récords Bizarros":      { questions: adultRekorde,      locked: false },
    "🐾 Reino Animal":          { questions: adultTiere,        locked: false },
    "🍺 Comida y Bebida":       { questions: adultEssen,        locked: false },
    "🌍 Historia":              { questions: adultHistory,      locked: false },
    "🚀 Astronomía y Física":   { questions: adultAstro,        locked: false },
    "💰 Dinero y Precios":      { questions: adultGeld,         locked: false },
    "🎬 Cine, TV y Cultura":    { questions: adultFilm,         locked: false },
    "🍆 Sexo y Tabúes":         { questions: adultSex,          locked: false },
    "🧪 Ciencia":               { questions: adultWissenschaft, locked: false },
    "🏛️ Política y Poder":      { questions: adultPolitik,      locked: false },
    "💊 Drogas y Vicios":       { questions: adultDrogen,       locked: false },
    "💩 Cuerpo y Asco":         { questions: adultEkel,         locked: false },
    "🐾 Animales y Sexo":       { questions: adultTiersex,      locked: false },
    "🤯 WTF Facts":             { questions: adultWtf,          locked: false },
  },
  kids: {
    "🎯 Muestra Gratuita":      { questions: kidsTest,     locked: false },
    "🐘 Animales":              { questions: kidsTiere,    locked: false },
    "🌍 Geografía":             { questions: kidsGeo,      locked: false },
    "🦕 Dinosaurios":           { questions: kidsDinos,    locked: false },
    "🚀 Espacio":               { questions: kidsWeltraum, locked: false },
    "🏆 Deporte y Récords":     { questions: kidsSport,    locked: false },
    "🏰 Cuentos y Fantasía":    { questions: kidsMaerchen, locked: false },
    "🌊 Océanos y Mar":         { questions: kidsOzeane,   locked: false },
    "🎨 Arte e Inventos":       { questions: kidsKunst,    locked: false },
  },
};

export default QUESTIONS;
