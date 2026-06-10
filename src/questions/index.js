// ─────────────────────────────────────────────────────────
// ESTIMATESS – QUESTIONS INDEX
// Language selected at runtime via LANG parameter
// ─────────────────────────────────────────────────────────

// German
import adultTestDe         from "./de/adult_test.js";
import adultKoerperDe      from "./de/adult_koerper.js";
import adultRekordeDe      from "./de/adult_rekorde.js";
import adultTiereDe        from "./de/adult_tiere.js";
import adultEssenDe        from "./de/adult_essen.js";
import adultHistoryDe      from "./de/adult_history.js";
import adultAstroDe        from "./de/adult_astro.js";
import adultGeldDe         from "./de/adult_geld.js";
import adultFilmDe         from "./de/adult_film.js";
import adultSexDe          from "./de/adult_sex.js";
import adultWissenschaftDe from "./de/adult_wissenschaft.js";
import adultPolitikDe      from "./de/adult_politik.js";
import adultDrogenDe       from "./de/adult_drogen.js";
import adultEkelDe         from "./de/adult_ekel.js";
import adultTiersexDe      from "./de/adult_tiersex.js";
import adultWtfDe          from "./de/adult_wtf.js";
import kidsTestDe          from "./de/kids_test.js";
import kidsTiereDe         from "./de/kids_tiere.js";
import kidsGeoDe           from "./de/kids_geo.js";
import kidsDinosDe         from "./de/kids_dinos.js";
import kidsWeltraumDe      from "./de/kids_weltraum.js";
import kidsSportDe         from "./de/kids_sport.js";
import kidsMaerchenDe      from "./de/kids_maerchen.js";
import kidsOzeaneDe        from "./de/kids_ozeane.js";
import kidsKunstDe         from "./de/kids_kunst.js";

// English
import adultTestEn         from "./en/adult_test.js";
import adultKoerperEn      from "./en/adult_koerper.js";
import adultRekordeEn      from "./en/adult_rekorde.js";
import adultTiereEn        from "./en/adult_tiere.js";
import adultEssenEn        from "./en/adult_essen.js";
import adultHistoryEn      from "./en/adult_history.js";
import adultAstroEn        from "./en/adult_astro.js";
import adultGeldEn         from "./en/adult_geld.js";
import adultFilmEn         from "./en/adult_film.js";
import adultSexEn          from "./en/adult_sex.js";
import adultWissenschaftEn from "./en/adult_wissenschaft.js";
import adultPolitikEn      from "./en/adult_politik.js";
import adultDrogenEn       from "./en/adult_drogen.js";
import adultEkelEn         from "./en/adult_ekel.js";
import adultTiersexEn      from "./en/adult_tiersex.js";
import adultWtfEn          from "./en/adult_wtf.js";
import kidsTestEn          from "./en/kids_test.js";
import kidsTiereEn         from "./en/kids_tiere.js";
import kidsGeoEn           from "./en/kids_geo.js";
import kidsDinosEn         from "./en/kids_dinos.js";
import kidsWeltraumEn      from "./en/kids_weltraum.js";
import kidsSportEn         from "./en/kids_sport.js";
import kidsMaerchenEn      from "./en/kids_maerchen.js";
import kidsOzeaneEn        from "./en/kids_ozeane.js";
import kidsKunstEn         from "./en/kids_kunst.js";

// Spanish
import adultTestEs         from "./es/adult_test.js";
import adultKoerperEs      from "./es/adult_koerper.js";
import adultRekordeEs      from "./es/adult_rekorde.js";
import adultTiereEs        from "./es/adult_tiere.js";
import adultEssenEs        from "./es/adult_essen.js";
import adultHistoryEs      from "./es/adult_history.js";
import adultAstroEs        from "./es/adult_astro.js";
import adultGeldEs         from "./es/adult_geld.js";
import adultFilmEs         from "./es/adult_film.js";
import adultSexEs          from "./es/adult_sex.js";
import adultWissenschaftEs from "./es/adult_wissenschaft.js";
import adultPolitikEs      from "./es/adult_politik.js";
import adultDrogenEs       from "./es/adult_drogen.js";
import adultEkelEs         from "./es/adult_ekel.js";
import adultTiersexEs      from "./es/adult_tiersex.js";
import adultWtfEs          from "./es/adult_wtf.js";
import kidsTestEs          from "./es/kids_test.js";
import kidsTiereEs         from "./es/kids_tiere.js";
import kidsGeoEs           from "./es/kids_geo.js";
import kidsDinosEs         from "./es/kids_dinos.js";
import kidsWeltraumEs      from "./es/kids_weltraum.js";
import kidsSportEs         from "./es/kids_sport.js";
import kidsMaerchenEs      from "./es/kids_maerchen.js";
import kidsOzeaneEs        from "./es/kids_ozeane.js";
import kidsKunstEs         from "./es/kids_kunst.js";

const QUESTIONS_DE = {
  adult: {
    "🎯 Gratis-Test":           { questions: adultTestDe,         locked: false },
    "🔥 Körper & Biologie":     { questions: adultKoerperDe,      locked: false },
    "💀 Bizarre Rekorde":       { questions: adultRekordeDe,      locked: false },
    "🐾 Tierreich":             { questions: adultTiereDe,        locked: false },
    "🍺 Essen & Trinken":       { questions: adultEssenDe,        locked: false },
    "🌍 Geschichte":            { questions: adultHistoryDe,      locked: false },
    "🚀 Astronomie & Physik":   { questions: adultAstroDe,        locked: false },
    "💰 Geld & absurde Preise": { questions: adultGeldDe,         locked: false },
    "🎬 Film, TV & Popkultur":  { questions: adultFilmDe,         locked: false },
    "🍆 Sex & Tabus":           { questions: adultSexDe,          locked: false },
    "🔬 Wissenschaft":          { questions: adultWissenschaftDe, locked: false },
    "📜 Politik & Macht":       { questions: adultPolitikDe,      locked: false },
    "💊 Drogen & Rausch":       { questions: adultDrogenDe,       locked: false },
    "💩 Körper & Ekel":         { questions: adultEkelDe,         locked: false },
    "🐾 Tiere & Sex":           { questions: adultTiersexDe,      locked: false },
    "💥 WTF Facts":             { questions: adultWtfDe,          locked: false },
  },
  kids: {
    "🎯 Gratis-Test":         { questions: kidsTestDe,     locked: false },
    "🐘 Tiere":               { questions: kidsTiereDe,    locked: false },
    "🌍 Geografie":           { questions: kidsGeoDe,      locked: false },
    "🦕 Dinosaurier":         { questions: kidsDinosDe,    locked: false },
    "🚀 Weltraum":            { questions: kidsWeltraumDe, locked: false },
    "🏆 Sport & Rekorde":     { questions: kidsSportDe,    locked: false },
    "🏰 Märchen & Fantasie":  { questions: kidsMaerchenDe, locked: false },
    "🌊 Ozeane & Meere":      { questions: kidsOzeaneDe,   locked: false },
    "🎨 Kunst & Erfindungen": { questions: kidsKunstDe,    locked: false },
  },
};

const QUESTIONS_EN = {
  adult: {
    "🎯 Free Sampler":          { questions: adultTestEn,         locked: false },
    "🔥 Body & Biology":        { questions: adultKoerperEn,      locked: false },
    "💀 Bizarre Records":       { questions: adultRekordeEn,      locked: false },
    "🐾 Animal Kingdom":        { questions: adultTiereEn,        locked: false },
    "🍺 Food & Drink":          { questions: adultEssenEn,        locked: false },
    "🌍 History":               { questions: adultHistoryEn,      locked: false },
    "🚀 Astronomy & Physics":   { questions: adultAstroEn,        locked: false },
    "💰 Money & Prices":        { questions: adultGeldEn,         locked: false },
    "🎬 Film, TV & Pop Culture":{ questions: adultFilmEn,         locked: false },
    "🍆 Sex & Taboos":          { questions: adultSexEn,          locked: false },
    "🔬 Science":               { questions: adultWissenschaftEn, locked: false },
    "📜 Politics & Power":      { questions: adultPolitikEn,      locked: false },
    "💊 Drugs & Highs":         { questions: adultDrogenEn,       locked: false },
    "💩 Body & Gross":          { questions: adultEkelEn,         locked: false },
    "🐾 Animals & Sex":         { questions: adultTiersexEn,      locked: false },
    "💥 WTF Facts":             { questions: adultWtfEn,          locked: false },
  },
  kids: {
    "🎯 Free Sampler":          { questions: kidsTestEn,     locked: false },
    "🐘 Animals":               { questions: kidsTiereEn,    locked: false },
    "🌍 Geography":             { questions: kidsGeoEn,      locked: false },
    "🦕 Dinosaurs":             { questions: kidsDinosEn,    locked: false },
    "🚀 Space":                 { questions: kidsWeltraumEn, locked: false },
    "🏆 Sport & Records":       { questions: kidsSportEn,    locked: false },
    "🏰 Fairy Tales & Fantasy": { questions: kidsMaerchenEn, locked: false },
    "🌊 Oceans & Sea":          { questions: kidsOzeaneEn,   locked: false },
    "🎨 Art & Inventions":      { questions: kidsKunstEn,    locked: false },
  },
};

const QUESTIONS_ES = {
  adult: {
    "🎯 Muestra Gratuita":      { questions: adultTestEs,         locked: false },
    "🔥 Cuerpo y Biología":     { questions: adultKoerperEs,      locked: false },
    "💀 Récords Bizarros":      { questions: adultRekordeEs,      locked: false },
    "🐾 Reino Animal":          { questions: adultTiereEs,        locked: false },
    "🍺 Comida y Bebida":       { questions: adultEssenEs,        locked: false },
    "🌍 Historia":              { questions: adultHistoryEs,      locked: false },
    "🚀 Astronomía y Física":   { questions: adultAstroEs,        locked: false },
    "💰 Dinero y Precios":      { questions: adultGeldEs,         locked: false },
    "🎬 Cine, TV y Cultura":    { questions: adultFilmEs,         locked: false },
    "🍆 Sexo y Tabúes":         { questions: adultSexEs,          locked: false },
    "🔬 Ciencia":               { questions: adultWissenschaftEs, locked: false },
    "📜 Política y Poder":      { questions: adultPolitikEs,      locked: false },
    "💊 Drogas y Vicios":       { questions: adultDrogenEs,       locked: false },
    "💩 Cuerpo y Asco":         { questions: adultEkelEs,         locked: false },
    "🐾 Animales y Sexo":       { questions: adultTiersexEs,      locked: false },
    "💥 WTF Facts":             { questions: adultWtfEs,          locked: false },
  },
  kids: {
    "🎯 Muestra Gratuita":      { questions: kidsTestEs,     locked: false },
    "🐘 Animales":              { questions: kidsTiereEs,    locked: false },
    "🌍 Geografía":             { questions: kidsGeoEs,      locked: false },
    "🦕 Dinosaurios":           { questions: kidsDinosEs,    locked: false },
    "🚀 Espacio":               { questions: kidsWeltraumEs, locked: false },
    "🏆 Deporte y Récords":     { questions: kidsSportEs,    locked: false },
    "🏰 Cuentos y Fantasía":    { questions: kidsMaerchenEs, locked: false },
    "🌊 Océanos y Mar":         { questions: kidsOzeaneEs,   locked: false },
    "🎨 Arte e Inventos":       { questions: kidsKunstEs,    locked: false },
  },
};

export { QUESTIONS_DE, QUESTIONS_EN, QUESTIONS_ES };
export default QUESTIONS_DE; // fallback
