import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA4ylsGv34UhkQJsxSWhmPx2eb5IPhI7SA",
  authDomain: "wtfacts-958c6.firebaseapp.com",
  databaseURL: "https://wtfacts-958c6-default-rtdb.firebaseio.com",
  projectId: "wtfacts-958c6",
  storageBucket: "wtfacts-958c6.firebasestorage.app",
  messagingSenderId: "504687472282",
  appId: "1:504687472282:web:d129a0ddb9b209f2c13923",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const dbRef   = (c)    => ref(db, `rooms/${c}`);
const dbSet   = (c, v) => set(dbRef(c), v);
const dbPatch = (c, v) => update(dbRef(c), v);
const dbGet   = (c)    => get(dbRef(c)).then(s => s.val());
const dbListen= (c,fn) => onValue(dbRef(c), s => fn(s.val()));

/* ─── THEMES ─────────────────────────────────────── */
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

/* ─── QUESTION DATABASE ──────────────────────────── */
const QUESTIONS = {
  adult: {
    "🎯 Gratis-Test": [
      {q:"Wie viele Liter Blut pumpt das menschliche Herz pro Tag?",a:7200,unit:"Liter",hint:"Das Herz schlägt ~100.000 Mal/Tag und pumpt ~70ml pro Schlag.",emoji:"❤️"},
      {q:"Wie viele kg wiegen die Hoden eines Blauwals?",a:70,unit:"kg",hint:"Der Blauwal ist das größte Tier der Erde – da passt das.",emoji:"🐋"},
      {q:"In welchem Jahr wurde das erste Brustimplantat einoperiert?",a:1962,unit:"Jahr",hint:"Timmie Jean Lindsey war die erste Frau weltweit mit Silikonimplantaten.",emoji:"👙"},
      {q:"Wie viele Kalorien hat ein Big Mac?",a:563,unit:"kcal",hint:"Davon kommen allein 257 kcal aus dem Fettgehalt.",emoji:"🍔"},
      {q:"Wie viele Meter kann ein Gepard maximal in 1 Sekunde zurücklegen?",a:31,unit:"Meter",hint:"Er läuft bis zu 112 km/h – aber nur für wenige Sekunden.",emoji:"🐆"},
      {q:"Wie viele Liter Bier wurden beim Oktoberfest 2023 getrunken?",a:7300000,unit:"Liter",hint:"Das Oktoberfest ist das größte Volksfest der Welt.",emoji:"🍺"},
      {q:"Wie lang war der längste jemals gemessene menschliche Bart in cm?",a:570,unit:"cm",hint:"Hans Langseth trug ihn ein Leben lang. Das Smithsonian bewahrt ihn.",emoji:"🧔"},
      {q:"Wie viele Stunden schläft ein Koala pro Tag?",a:22,unit:"Stunden",hint:"Eukalyptus ist schwer verdaulich – daher die extreme Müdigkeit.",emoji:"🐨"},
      {q:"Wie viele Gramm Zucker enthält eine Dose Cola (330ml)?",a:35,unit:"Gramm",hint:"Das sind etwa 7 Teelöffel Zucker in einer einzigen Dose.",emoji:"🥤"},
      {q:"Wie viele Jahre kann ein Grönlandwal leben?",a:211,unit:"Jahre",hint:"Er ist das langlebigste Säugetier der Erde.",emoji:"🐳"},
      {q:"Wie viele Muskeln braucht man zum Lächeln?",a:12,unit:"Muskeln",hint:"Zum Stirnrunzeln braucht man angeblich sogar mehr.",emoji:"😁"},
      {q:"Wie viele Millionen Spermien produziert ein Mann pro Tag?",a:300,unit:"Millionen",hint:"Das sind etwa 1500 neue Spermien pro Sekunde.",emoji:"🔬"},
      {q:"Wie viele Tonnen Schokolade isst Deutschland pro Jahr?",a:900000,unit:"Tonnen",hint:"Deutschland ist Weltmeister im Schokoladenkonsum pro Kopf.",emoji:"🍫"},
      {q:"Wie hoch ist der Wasseranteil in einer Gurke in Prozent?",a:97,unit:"%",hint:"Gurken bestehen fast nur aus Wasser und haben kaum Kalorien.",emoji:"🥒"},
      {q:"Wie alt wurde der älteste jemals lebende Mensch in Jahren?",a:122,unit:"Jahre",hint:"Jeanne Calment aus Frankreich lebte von 1875 bis 1997.",emoji:"👴"},
    ],
    "🔥 Körper & Biologie": [
      {q:"Wie viele Liter Speichel produziert ein Mensch pro Tag?",a:1.5,unit:"Liter",hint:"Speichel hilft bei der Verdauung und schützt Zähne vor Bakterien.",emoji:"💧"},
      {q:"Wie viele Mal schlägt das menschliche Herz pro Tag?",a:100000,unit:"Mal",hint:"Das entspricht etwa 70 Schlägen pro Minute über 24 Stunden.",emoji:"❤️"},
      {q:"Wie lang sind alle Blutgefäße eines Menschen zusammen in km?",a:100000,unit:"km",hint:"Das entspricht der 2,5-fachen Entfernung zum Mond.",emoji:"🩸"},
      {q:"Wie viele Haare verliert ein Mensch durchschnittlich pro Tag?",a:100,unit:"Haare",hint:"Ein gesunder Kopf hat ~100.000 Haare – der Verlust ist normal.",emoji:"💈"},
      {q:"Wie viele Knochen hat ein neugeborenes Baby?",a:270,unit:"Knochen",hint:"Erwachsene haben nur 206 – viele Knochen wachsen zusammen.",emoji:"🦴"},
      {q:"Wie viele m² Oberfläche hat die menschliche Lunge?",a:70,unit:"m²",hint:"Das entspricht etwa der Größe eines Tennisplatzes.",emoji:"🫁"},
      {q:"Wie viele km Nerven hat ein Mensch im Körper?",a:75,unit:"km",hint:"Nervensignale können mit bis zu 400 km/h übertragen werden.",emoji:"⚡"},
      {q:"Wie viel Prozent des Körpergewichts macht Blut aus?",a:8,unit:"%",hint:"Bei 75 kg sind das etwa 6 Liter Blut.",emoji:"🩸"},
      {q:"Wie viele Bakterien leben auf der Haut eines Menschen (Milliarden)?",a:1800,unit:"Milliarden",hint:"Die meisten davon sind harmlos oder sogar nützlich.",emoji:"🦠"},
      {q:"Wie viele Liter Blut pumpt das Herz pro Minute in Ruhe?",a:5,unit:"Liter",hint:"Bei Belastung kann es bis zu 25 Liter pro Minute sein.",emoji:"❤️"},
      {q:"Wie viele Eizellen hat eine Frau bei der Geburt?",a:1000000,unit:"Eizellen",hint:"Bis zur Pubertät sind es nur noch ca. 300.000.",emoji:"🔬"},
      {q:"Wie viele Millionen Spermien produziert ein Mann pro Tag?",a:300,unit:"Millionen",hint:"Das sind ~1500 neue Spermien pro Sekunde.",emoji:"🔬"},
      {q:"Wie lang ist der Dünndarm eines Erwachsenen in Metern?",a:6,unit:"Meter",hint:"Zusammen mit dem Dickdarm ergibt das über 8 Meter Darm.",emoji:"🌀"},
      {q:"Wie viel Gramm wiegt das menschliche Gehirn?",a:1400,unit:"Gramm",hint:"Trotz 2% Körpergewicht verbraucht es 20% unserer Energie.",emoji:"🧠"},
      {q:"Wie viele Liter Luft atmet ein Mensch pro Tag ein?",a:11000,unit:"Liter",hint:"Das entspricht 15–20 Atemzügen pro Minute.",emoji:"💨"},
      {q:"Wie viele Zellen stirbt der Körper pro Sekunde ab?",a:3800000,unit:"Zellen",hint:"Gleichzeitig werden ständig neue Zellen gebildet.",emoji:"🔬"},
      {q:"Wie viele Stunden verbringt ein Mensch pro Jahr auf der Toilette?",a:92,unit:"Stunden",hint:"Im Leben summiert sich das auf fast 3 Jahre.",emoji:"🚽"},
      {q:"Wie viele Milliliter fasst der Magen eines Erwachsenen maximal?",a:1500,unit:"ml",hint:"Im leeren Zustand hat er nur etwa 75 ml Volumen.",emoji:"🫃"},
      {q:"Wie oft blinzelt ein Mensch pro Minute?",a:15,unit:"Mal",hint:"Das macht über 10.000 Mal pro Tag.",emoji:"👁️"},
      {q:"Wie schnell wachsen Fingernägel pro Monat in mm?",a:3,unit:"mm",hint:"Fußnägel wachsen etwa halb so schnell.",emoji:"💅"},
      {q:"Wie viel Prozent des Körpers besteht aus Wasser?",a:60,unit:"%",hint:"Beim Baby sind es 75%, im Alter sinkt der Wasseranteil.",emoji:"💧"},
      {q:"Wie viele Muskeln braucht man zum Lächeln?",a:12,unit:"Muskeln",hint:"Zum Stirnrunzeln braucht man angeblich mehr – bis zu 11.",emoji:"😁"},
      {q:"Wie lang ist die DNA in einer Zelle in Metern?",a:2,unit:"Meter",hint:"Alle DNA zusammen wäre 70x die Strecke Erde-Sonne.",emoji:"🧬"},
      {q:"Wie viele Liter Magensäure produziert der Magen täglich?",a:1.5,unit:"Liter",hint:"Der pH-Wert liegt bei 1-2 – ähnlich wie Batteriesäure.",emoji:"⚗️"},
      {q:"Wie viele Kalorien verbrennt das Gehirn pro Tag?",a:300,unit:"kcal",hint:"Das sind 20% des gesamten Kalorienverbrauchs in Ruhe.",emoji:"🧠"},
      {q:"Wie viele Schweißdrüsen hat ein Mensch am ganzen Körper?",a:3000000,unit:"Drüsen",hint:"Am dichtesten sitzen sie an Fußsohlen und Handflächen.",emoji:"💦"},
      {q:"Wie lang ist der längste Muskel im Körper (Sartorius) in cm?",a:60,unit:"cm",hint:"Er verbindet Hüfte und Knie diagonal.",emoji:"🦵"},
      {q:"Wie viele Gramm wiegt eine durchschnittliche Brust?",a:500,unit:"Gramm",hint:"Der Fettanteil variiert stark je nach Körbchengröße.",emoji:"👙"},
      {q:"Wie viele Kilometer Sehnen und Bänder hat ein Mensch?",a:900,unit:"Meter",hint:"Bänder verbinden Knochen, Sehnen Muskeln mit Knochen.",emoji:"🦴"},
      {q:"Wie viele Liter Blut pumpt das Herz pro Tag?",a:7200,unit:"Liter",hint:"Das Herz schlägt ~100.000 Mal täglich.",emoji:"❤️"},
    ],
    "💀 Bizarre Rekorde": [
      {q:"Wie lang war der längste Fingernagel einer Frau in cm?",a:909,unit:"cm",hint:"Lee Redmond ließ ihre Nägel 30 Jahre wachsen.",emoji:"💅"},
      {q:"Wie viele Hotdogs aß Joey Chestnut als Weltrekord in 10 Minuten?",a:76,unit:"Hotdogs",hint:"Bei der berühmten Nathan's Hot Dog Contest.",emoji:"🌭"},
      {q:"Wie schwer war der schwerste jemals gezüchtete Kürbis in kg?",a:1190,unit:"kg",hint:"Der Riesenkürbis wurde 2021 in Italien gewogen.",emoji:"🎃"},
      {q:"Wie viele Piercings hatte der Mensch mit den meisten?",a:4384,unit:"Piercings",hint:"Rolf Buchholz aus Deutschland hielt diesen Rekord.",emoji:"💎"},
      {q:"Wie lang war der längste jemals gemessene Bart in cm?",a:570,unit:"cm",hint:"Hans Langseth trug ihn ein Leben lang.",emoji:"🧔"},
      {q:"Wie viele Stunden hielt der längste Kuss der Welt?",a:58,unit:"Stunden",hint:"Ein thailändisches Pärchen küsste sich 2013 ununterbrochen.",emoji:"💋"},
      {q:"Wie viele km/h fuhr das schnellste muskelkraftbetriebene Fahrrad?",a:280,unit:"km/h",hint:"Im Windschatten eines Rennwagens aufgestellt.",emoji:"🚴"},
      {q:"Wie alt war die älteste jemals lebende Katze in Jahren?",a:38,unit:"Jahre",hint:"Creme Puff aus Texas lebte von 1967 bis 2005.",emoji:"🐱"},
      {q:"Wie viele Sprachen spricht der Polyglott Ziad Fazah?",a:58,unit:"Sprachen",hint:"Er beherrscht Sprachen aus aller Welt.",emoji:"🗣️"},
      {q:"Wie viele Meter tief ist die Kola-Bohrung in Russland?",a:12262,unit:"Meter",hint:"Das tiefste Loch der Welt – nach 24 Jahren gestoppt.",emoji:"⛏️"},
      {q:"Wie schwer war das schwerste jemals gewogene Schwein in kg?",a:1157,unit:"kg",hint:"Big Bill hieß das Riesenschwein aus den USA (1933).",emoji:"🐷"},
      {q:"Wie viele Meter lang war die längste jemals gebackene Pizza?",a:1930,unit:"Meter",hint:"Gebacken 2017 in Kalifornien.",emoji:"🍕"},
      {q:"Wie alt wurde der älteste Mensch aller Zeiten in Jahren?",a:122,unit:"Jahre",hint:"Jeanne Calment aus Frankreich, 1875–1997.",emoji:"👴"},
      {q:"Wie viele Domino-Steine wurden beim größten Domino-Effekt verwendet?",a:4491863,unit:"Steine",hint:"2009 in den Niederlanden aufgestellt.",emoji:"🎲"},
      {q:"Wie viele Bienen saßen gleichzeitig auf einem Menschen als Rekord?",a:637000,unit:"Bienen",hint:"Das entspricht einem Gewicht von ~63 kg Bienen.",emoji:"🐝"},
      {q:"Wie viele Stockwerke hat der Burj Khalifa?",a:163,unit:"Stockwerke",hint:"828 Meter hoch, steht in Dubai.",emoji:"🏙️"},
      {q:"Wie viele km lief der Weltrekordhalter non-stop?",a:426,unit:"km",hint:"Yiannis Kouros lief 1997 diesen Rekord in Australien.",emoji:"🏃"},
      {q:"Wie viele Meter lang war die längste menschliche Schlange?",a:12000,unit:"Meter",hint:"12 km Menschenkette in Bangladesch.",emoji:"🧑‍🤝‍🧑"},
      {q:"Wie viele Kugeln Eis aß der Weltrekordhalter in einer Stunde?",a:254,unit:"Kugeln",hint:"Der Wettbewerb fand in Italien statt.",emoji:"🍦"},
      {q:"Wie schwer war das schwerste jemals gefangene Krokodil in kg?",a:1075,unit:"kg",hint:"Ein Salzwasserkrokodil von den Philippinen.",emoji:"🐊"},
      {q:"Wie viele Fußballfelder groß war das größte Gemälde in m²?",a:17000,unit:"m²",hint:"Sacha Jafri malte es 2021 in Dubai.",emoji:"🎨"},
      {q:"Wie viele Stockwerke hat das höchste Hotel der Welt (Gevora Dubai)?",a:75,unit:"Stockwerke",hint:"356 Meter hoch mit 528 Zimmern.",emoji:"🏨"},
      {q:"Wie hoch sprang der Weltrekord-Floh in cm?",a:33,unit:"cm",hint:"Flöhe können das 200-fache ihrer Körperlänge springen.",emoji:"🦟"},
      {q:"Wie lang war der längste Bart einer Frau in cm?",a:30,unit:"cm",hint:"Harnaam Kaur aus UK trägt den Rekord.",emoji:"🧔‍♀️"},
      {q:"Wie viele km/h erreichte die schnellste je gemessene Tennisaufschlagsgeschwindigkeit?",a:263,unit:"km/h",hint:"Samuel Groth aus Australien servierte 2012 diesen Rekord.",emoji:"🎾"},
      {q:"Wie viele Meter weit wurde ein Gummistiefel beim Weitwurf geworfen?",a:63,unit:"Meter",hint:"Offizieller Weltrekord im finnischen Stiefelweitwurf.",emoji:"👢"},
      {q:"Wie viele Kerzen standen auf der größten Geburtstagstorte?",a:72585,unit:"Kerzen",hint:"Die Torte wurde 2016 in Indien aufgestellt.",emoji:"🎂"},
      {q:"Wie lang war die längste jemals gemessene Haarlänge einer Frau in cm?",a:570,unit:"cm",hint:"Xie Qiuping aus China ließ sie seit 1973 wachsen.",emoji:"💇"},
      {q:"Wie viele Personen saßen gleichzeitig auf einem Motorrad (Rekord)?",a:58,unit:"Personen",hint:"Aufgestellt von der indischen Armee.",emoji:"🏍️"},
      {q:"Wie viele Meilen fuhr die längste je dokumentierte Taxifahrt?",a:21000,unit:"Meilen",hint:"Ein Brite fuhr von London nach Melbourne.",emoji:"🚕"},
    ],
    "🐾 Tierreich": [
      {q:"Wie viele kg wiegen die Hoden eines Blauwals?",a:70,unit:"kg",hint:"Der Blauwal ist das größte Tier der Erde.",emoji:"🐋"},
      {q:"Wie oft pro Minute schlägt das Herz einer Maus?",a:600,unit:"Mal",hint:"Je kleiner das Tier, desto schneller das Herz.",emoji:"🐭"},
      {q:"Wie viele Tage trägt ein Elefant sein Junges?",a:645,unit:"Tage",hint:"Fast 2 Jahre – längste Schwangerschaft aller Landsäugetiere.",emoji:"🐘"},
      {q:"Wie viele Liter Milch produziert eine Kuh pro Tag?",a:25,unit:"Liter",hint:"Hochleistungskühe können bis zu 50 Liter täglich geben.",emoji:"🐄"},
      {q:"Wie viele Augen hat eine Spinne?",a:8,unit:"Augen",hint:"Trotz 8 Augen sehen viele Spinnen sehr schlecht.",emoji:"🕷️"},
      {q:"Wie schwer kann ein Riesenkalmar-Auge in Gramm werden?",a:250,unit:"Gramm",hint:"Das größte Auge im Tierreich – so groß wie ein Fußball.",emoji:"🦑"},
      {q:"Wie viele km/h läuft ein Gepard maximal?",a:112,unit:"km/h",hint:"Er kann diese Höchstgeschwindigkeit nur kurz halten.",emoji:"🐆"},
      {q:"Wie viele Magen hat eine Kuh?",a:4,unit:"Mägen",hint:"Pansen, Netzmagen, Blättermagen und Labmagen.",emoji:"🐄"},
      {q:"Wie hoch kann ein Känguru springen in Metern?",a:3,unit:"Meter",hint:"Und in der Länge sogar bis zu 9 Meter weit.",emoji:"🦘"},
      {q:"Wie schwer wird ein ausgewachsener Gorilla maximal in kg?",a:270,unit:"kg",hint:"Trotz Größe sind Gorillas überwiegend Vegetarier.",emoji:"🦍"},
      {q:"Wie viele Stunden schläft ein Koala pro Tag?",a:22,unit:"Stunden",hint:"Eukalyptus ist schwer verdaulich – daher die Müdigkeit.",emoji:"🐨"},
      {q:"Wie viele km/h kann ein Schwertschwanz-Marlin schwimmen?",a:110,unit:"km/h",hint:"Der schnellste Fisch im Meer.",emoji:"🐟"},
      {q:"Wie lange lebt eine Königin-Biene in Jahren?",a:5,unit:"Jahre",hint:"Arbeiterinnen leben im Sommer nur 6 Wochen.",emoji:"🐝"},
      {q:"Wie viele Zähne hat ein erwachsenes Krokodil?",a:66,unit:"Zähne",hint:"Krokodile erneuern ihre Zähne bis zu 50 Mal im Leben.",emoji:"🐊"},
      {q:"Wie viele Eier legt eine Königin-Termite pro Tag?",a:30000,unit:"Eier",hint:"Die produktivste Mutter im Insektenreich.",emoji:"🐜"},
      {q:"Wie viele km kann ein Polarfuchs in einer Nacht zurücklegen?",a:40,unit:"km",hint:"Polarfüchse sind unglaublich ausdauernd.",emoji:"🦊"},
      {q:"Wie viele Liter Blut hat ein ausgewachsener Elefant?",a:400,unit:"Liter",hint:"Das Elefantenherz wiegt allein bis zu 30 kg.",emoji:"🐘"},
      {q:"Wie viele Mal kann ein Specht pro Sekunde hämmern?",a:20,unit:"Mal",hint:"Sein Gehirn ist durch Spezialanpassungen geschützt.",emoji:"🐦"},
      {q:"Wie schwer ist das schwerste Vogelei (Strauß) in kg?",a:1.35,unit:"kg",hint:"Strauße legen die größten Eier aller lebenden Vögel.",emoji:"🥚"},
      {q:"Wie lange kann ein Delphin den Atem anhalten in Minuten?",a:15,unit:"Minuten",hint:"Delfine schlafen mit einer Gehirnhälfte.",emoji:"🐬"},
      {q:"Wie viele Jahre kann ein Grönlandwal leben?",a:211,unit:"Jahre",hint:"Das langlebigste Säugetier der Erde.",emoji:"🐳"},
      {q:"Wie schwer ist die Zunge eines Blauwals in kg?",a:2700,unit:"kg",hint:"Die Zunge allein wiegt so viel wie ein Elefant.",emoji:"🐋"},
      {q:"Wie viele Millionen Geruchsrezeptoren hat ein Hund?",a:300,unit:"Millionen",hint:"Menschen haben nur 6 Millionen – Hunde riechen 50x besser.",emoji:"🐕"},
      {q:"Wie viele Meter lang kann ein Bandwurm im Darm werden?",a:25,unit:"Meter",hint:"Bandwürmer können jahrelang unbemerkt leben.",emoji:"🪱"},
      {q:"Wie hoch ist der Blutdruck einer Giraffe in mmHg?",a:280,unit:"mmHg",hint:"Nötig um Blut 2 Meter nach oben ins Gehirn zu pumpen.",emoji:"🦒"},
      {q:"Wie viele kg Bambus frisst ein Pandabär täglich?",a:15,unit:"kg",hint:"Bambus ist sehr nährstoffarm – daher die riesige Menge.",emoji:"🐼"},
      {q:"Wie lange trägt ein Hai seine Jungen in Monaten?",a:24,unit:"Monate",hint:"Hammerhaie haben die längste Tragzeit.",emoji:"🦈"},
      {q:"Wie viele Meter lang ist die Zunge eines Chamäleons im Verhältnis zum Körper?",a:150,unit:"% Körperlänge",hint:"Die Zunge schlägt mit bis zu 26 km/h aus.",emoji:"🦎"},
      {q:"Wie lang ist die Schädelknochendicke eines Spechts in mm?",a:2,unit:"mm",hint:"Schützt das Gehirn vor bis zu 1.000g Aufprallbeschleunigung.",emoji:"🐦"},
      {q:"Wie viele Eizellen produziert ein weiblicher Hai pro Trächtigkeit?",a:40,unit:"Eier",hint:"Haie sind lebendgebärend oder legen Eier – je nach Art.",emoji:"🦈"},
    ],
    "🍺 Essen & Trinken": [
      {q:"Wie viele Kalorien hat ein Big Mac?",a:563,unit:"kcal",hint:"Davon kommen 257 kcal aus dem Fett.",emoji:"🍔"},
      {q:"Wie viele Liter Bier beim Oktoberfest 2023 getrunken?",a:7300000,unit:"Liter",hint:"Das Oktoberfest ist das größte Volksfest der Welt.",emoji:"🍺"},
      {q:"Wie viele Gramm Zucker in einer Dose Cola (330ml)?",a:35,unit:"Gramm",hint:"Das sind etwa 7 Teelöffel Zucker.",emoji:"🥤"},
      {q:"Wie viele Tonnen Schokolade isst Deutschland pro Jahr?",a:900000,unit:"Tonnen",hint:"Weltmeister im Schokoladenkonsum pro Kopf.",emoji:"🍫"},
      {q:"Wie viele Liter Milch braucht man für 1 kg Käse?",a:10,unit:"Liter",hint:"Je nach Sorte 8–12 Liter Milch.",emoji:"🧀"},
      {q:"Wie viele Monate reift ein echter Parmesan mindestens?",a:24,unit:"Monate",hint:"Premium-Parmesan reift bis zu 5 Jahre.",emoji:"🧀"},
      {q:"Wie viele Körner Kaffee braucht man für einen Espresso?",a:50,unit:"Körner",hint:"Ein Kaffeebaum produziert pro Jahr ~500g Kaffee.",emoji:"☕"},
      {q:"Wie viele Liter Wein trinkt ein Franzose pro Jahr?",a:45,unit:"Liter",hint:"Frankreich führt weltweit den Pro-Kopf-Weinkonsum.",emoji:"🍷"},
      {q:"Wie viele kg Pasta isst ein Italiener durchschnittlich pro Jahr?",a:23,unit:"kg",hint:"Italien führt weltweit den Pastakonsum.",emoji:"🍝"},
      {q:"Wie hoch ist der Wasseranteil in einer Gurke in Prozent?",a:97,unit:"%",hint:"Gurken bestehen fast nur aus Wasser.",emoji:"🥒"},
      {q:"Wie viele Liter Kaffee trinken Finnen pro Kopf pro Jahr?",a:12,unit:"kg",hint:"Finnland ist Weltmeister im Kaffeeverbrauch.",emoji:"☕"},
      {q:"Wie viele Gramm Butter enthält ein original Croissant?",a:50,unit:"Gramm",hint:"Der hohe Butteranteil macht die blättrige Textur möglich.",emoji:"🥐"},
      {q:"Wie viele Prozent Fettgehalt hat Gänsestopfleber (Foie Gras)?",a:50,unit:"%",hint:"Eines der kalorienreichsten Lebensmittel.",emoji:"🍴"},
      {q:"Wie viele Liter Wasser braucht man für 1 kg Rindfleisch?",a:15000,unit:"Liter",hint:"Rindfleisch hat den größten Wasserverbrauch aller Nahrungsmittel.",emoji:"🥩"},
      {q:"Wie viele Jahre ist der älteste bekannte Wein alt (Speyer-Wein)?",a:1650,unit:"Jahre",hint:"Die Flasche wurde 1867 in einem römischen Grab gefunden.",emoji:"🍷"},
      {q:"Wie viele Gramm wiegt eine Kaviar-Perle?",a:0.05,unit:"Gramm",hint:"Beluga-Kaviar kostet bis zu 25.000€ pro kg.",emoji:"🐟"},
      {q:"Wie viele Kalorien hat ein Teelöffel Olivenöl?",a:40,unit:"kcal",hint:"Gesund – aber kalorienreich wie alle Fette.",emoji:"🫒"},
      {q:"Wie viele Gramm Salz isst ein Deutscher täglich?",a:10,unit:"Gramm",hint:"Empfohlen werden maximal 6 Gramm.",emoji:"🧂"},
      {q:"Wie scharf ist der Carolina Reaper in Scoville (Millionen)?",a:2.2,unit:"Millionen Scoville",hint:"Das schärfste Chili der Welt hält den Weltrekord.",emoji:"🌶️"},
      {q:"Wie viele Stunden muss Jamon Iberico mindestens reifen?",a:8760,unit:"Stunden",hint:"Das sind mindestens 3 Jahre.",emoji:"🥩"},
      {q:"Wie viele Würste werden beim Nürnberger Christkindlesmarkt gegessen?",a:2000000,unit:"Würste",hint:"Nürnberger Bratwürste sind die kleinsten deutschen Würste.",emoji:"🌭"},
      {q:"Wie alt kann ein Wein maximal werden und noch trinkbar sein in Jahren?",a:200,unit:"Jahre",hint:"Ein 1811er Château d'Yquem wurde als exzellent bewertet.",emoji:"🍷"},
      {q:"Wie viele Gramm hat der teuerste Safran pro kg in Euro?",a:10000,unit:"€/kg",hint:"Safran ist das teuerste Gewürz der Welt.",emoji:"🌺"},
      {q:"Wie viele Pizzen werden täglich weltweit gegessen in Millionen?",a:5,unit:"Millionen",hint:"Die USA essen allein 3 Milliarden Pizzen pro Jahr.",emoji:"🍕"},
      {q:"Wie viele Liter Blut eines Tieres stecken in einer Blutwurst?",a:0.5,unit:"Liter",hint:"Blutwurst ist eines der ältesten Nahrungsmittel.",emoji:"🌭"},
      {q:"Wie viele Prozent des Wasabis im Restaurant ist echt?",a:1,unit:"%",hint:"99% ist gefälschter Wasabi aus Meerrettich und Farbe.",emoji:"🍣"},
      {q:"Wie viele Kalorien hat ein Glas Rotwein (200ml)?",a:170,unit:"kcal",hint:"Wein hat mehr Kalorien als die meisten denken.",emoji:"🍷"},
      {q:"Wie viele Stunden dauert die Herstellung von echtem Champagner mindestens?",a:12960,unit:"Stunden",hint:"Das sind mindestens 18 Monate Reifung.",emoji:"🥂"},
      {q:"Wie viele Minuten pro Tag massiert man Kobe-Rind?",a:60,unit:"Minuten",hint:"Sie werden tatsächlich massiert und mit Bier gefüttert.",emoji:"🥩"},
      {q:"Wie viele Gramm Zucker hat ein Glas Orangensaft (200ml)?",a:20,unit:"Gramm",hint:"Fast so viel wie Cola – oft unterschätzt.",emoji:"🍊"},
    ],
    "🌍 Geschichte & Kuriositäten": [
      {q:"In welchem Jahr wurde das erste Brustimplantat einoperiert?",a:1962,unit:"Jahr",hint:"Timmie Jean Lindsey war die erste Frau weltweit.",emoji:"👙"},
      {q:"Wie viele Frauen hatte König Salomo laut Bibel?",a:700,unit:"Frauen",hint:"Dazu kamen noch 300 Konkubinen.",emoji:"👑"},
      {q:"In welchem Jahr wurde Viagra erfunden?",a:1998,unit:"Jahr",hint:"Ursprünglich als Herzmedikament entwickelt.",emoji:"💊"},
      {q:"Wie viele Millionen Menschen starben beim Schwarzen Tod?",a:50,unit:"Millionen",hint:"Ein Drittel der europäischen Bevölkerung im 14. Jh.",emoji:"💀"},
      {q:"In welchem Jahr wurde die Guillotine in Frankreich abgeschafft?",a:1981,unit:"Jahr",hint:"Letzte Hinrichtung war 1977.",emoji:"⚔️"},
      {q:"Wie viele Jahre war die Berliner Mauer in Betrieb?",a:28,unit:"Jahre",hint:"Von 1961 bis zum Fall am 9. November 1989.",emoji:"🧱"},
      {q:"In welchem Jahr wurde das erste Telefon von Bell patentiert?",a:1876,unit:"Jahr",hint:"Bell erhielt das Patent am 7. März 1876.",emoji:"📞"},
      {q:"Wie viele Sklaven bauten schätzungsweise die Cheops-Pyramide?",a:20000,unit:"Arbeiter",hint:"Neuere Forschung: bezahlte Arbeiter, keine Sklaven.",emoji:"🏛️"},
      {q:"Wie viele Tonnen Gold sind schätzungsweise im Meer gelöst?",a:20000000,unit:"Tonnen",hint:"Genug für 9 Pfund Gold pro Person auf der Erde.",emoji:"⚱️"},
      {q:"In welchem Jahr wurde die erste Kondom-Fabrik eröffnet?",a:1844,unit:"Jahr",hint:"Nach Goodyears Vulkanisierung von Gummi.",emoji:"💊"},
      {q:"Wie viele Konkubinen hatte Kaiser Qianlong von China?",a:3000,unit:"Konkubinen",hint:"Er regierte von 1735 bis 1796.",emoji:"👑"},
      {q:"Wie viele Seiten hatte die Gutenberg-Bibel?",a:1282,unit:"Seiten",hint:"Gedruckt 1452–1454.",emoji:"📖"},
      {q:"In welchem Jahr erschoss Jesse James seine erste Bank?",a:1866,unit:"Jahr",hint:"Der berühmteste Outlaw des Wilden Westens.",emoji:"🤠"},
      {q:"Wie viele Jahre dauerte der Hundertjährige Krieg tatsächlich?",a:116,unit:"Jahre",hint:"Von 1337 bis 1453 – also 116 Jahre, nicht 100.",emoji:"⚔️"},
      {q:"Wie viele Frauen wurden beim Hexenprozess von Salem verurteilt?",a:19,unit:"Personen",hint:"1692 in Massachusetts – 19 wurden hingerichtet.",emoji:"🔥"},
      {q:"In welchem Jahr erfand Napoleon die Konservendose?",a:1810,unit:"Jahr",hint:"Für seine Armee – als Dosenöffner gab es noch keinen.",emoji:"🥫"},
      {q:"Wie viele Minuten dauerte der kürzeste Krieg der Geschichte?",a:38,unit:"Minuten",hint:"Der Anglo-Sansibar-Krieg von 1896.",emoji:"⚔️"},
      {q:"Wie alt war der jüngste Papst in der Geschichte in Jahren?",a:11,unit:"Jahre",hint:"Papst Johannes XII. wurde mit ~18 Jahren Papst – Benedikt IX. mit ~12.",emoji:"⛪"},
      {q:"Wie viele Mal wurde Napoleon verbannt?",a:2,unit:"Mal",hint:"Erst nach Elba, dann nach St. Helena.",emoji:"🏝️"},
      {q:"Wie viele Jahre saß Nelson Mandela im Gefängnis?",a:27,unit:"Jahre",hint:"Von 1964 bis 1990 auf Robben Island.",emoji:"✊"},
      {q:"In welchem Jahr fand die erste Mondlandung statt?",a:1969,unit:"Jahr",hint:"Apollo 11, 20. Juli 1969.",emoji:"🌙"},
      {q:"Wie viele Millionen Juden wurden im Holocaust ermordet?",a:6,unit:"Millionen",hint:"Einer der dunkelsten Momente der Menschheitsgeschichte.",emoji:"✡️"},
      {q:"Wie viele Jahre dauerte der Zweite Weltkrieg?",a:6,unit:"Jahre",hint:"Von 1939 bis 1945.",emoji:"🌍"},
      {q:"In welchem Jahr wurde die Titanic gebaut (Baubeginn)?",a:1909,unit:"Jahr",hint:"Sie sank bei ihrer Jungfernfahrt 1912.",emoji:"🚢"},
      {q:"Wie viele Millionen Menschen starben im Ersten Weltkrieg?",a:20,unit:"Millionen",hint:"Militär und Zivilbevölkerung zusammen.",emoji:"🕊️"},
      {q:"Wie viele Jahre regierte Queen Elizabeth II.?",a:70,unit:"Jahre",hint:"Von 1952 bis zu ihrem Tod 2022.",emoji:"👑"},
      {q:"In welchem Jahr erfand Karl Benz das erste Automobil?",a:1885,unit:"Jahr",hint:"Der Benz Patent-Motorwagen – drei Räder, 0,75 PS.",emoji:"🚗"},
      {q:"Wie viele Sprachen hat die Bibel als meistübersetzte Buch?",a:3000,unit:"Sprachen",hint:"Mehr als jedes andere Buch der Geschichte.",emoji:"📖"},
      {q:"Wie alt war Kleopatra beim Tod Caesars in Jahren?",a:21,unit:"Jahre",hint:"Caesar wurde 44 v.Chr. ermordet, Kleopatra war jung.",emoji:"👑"},
      {q:"Wie viele Stockwerke hatte das World Trade Center?",a:110,unit:"Stockwerke",hint:"Die Zwillingstürme wurden am 11. September 2001 zerstört.",emoji:"🏙️"},
    ],
    "🚀 Astronomie & Physik": [
      {q:"Wie viele Lichtjahre ist die nächste Galaxie (Andromeda) entfernt?",a:2500000,unit:"Lichtjahre",hint:"Sie ist mit bloßem Auge sichtbar – als kleiner Fleck.",emoji:"🌌"},
      {q:"Wie viele Grad Celsius beträgt die Oberflächentemperatur der Sonne?",a:5500,unit:"°C",hint:"Im Kern sind es sogar 15 Millionen Grad.",emoji:"☀️"},
      {q:"Wie viele km/s ist die Lichtgeschwindigkeit?",a:300000,unit:"km/s",hint:"Licht braucht ~8 Minuten von der Sonne zur Erde.",emoji:"💡"},
      {q:"Wie viele Erdmassen hat Jupiter?",a:318,unit:"Erdmassen",hint:"Jupiter ist der größte Planet unseres Sonnensystems.",emoji:"🪐"},
      {q:"Wie viele Monde hat Saturn?",a:146,unit:"Monde",hint:"Saturn hat die meisten Monde aller Planeten.",emoji:"🪐"},
      {q:"Wie viele Grad Celsius ist es auf dem Mond nachts?",a:-170,unit:"°C",hint:"Tagsüber sind es +130°C – extreme Temperaturschwankungen.",emoji:"🌙"},
      {q:"Wie viele km beträgt der Durchmesser der Sonne?",a:1392000,unit:"km",hint:"Die Sonne hat 109x den Durchmesser der Erde.",emoji:"☀️"},
      {q:"Wie viele km von der Erde entfernt ist der Mond?",a:384400,unit:"km",hint:"Die Entfernung schwankt zwischen 356.000 und 407.000 km.",emoji:"🌙"},
      {q:"Wie schwer ist ein Kubikzentimeter Neutronenstern-Material in Tonnen?",a:1000000000,unit:"Tonnen",hint:"Neutronensterne sind die dichtesten bekannten Objekte.",emoji:"⭐"},
      {q:"Wie viele Jahre alt ist das Universum (in Milliarden)?",a:13.8,unit:"Milliarden Jahre",hint:"Seit dem Urknall vor etwa 13,8 Milliarden Jahren.",emoji:"🌌"},
      {q:"Wie viele km/h bewegt sich die Erde um die Sonne?",a:107000,unit:"km/h",hint:"Das sind etwa 30 km pro Sekunde.",emoji:"🌍"},
      {q:"Wie viele Sterne gibt es schätzungsweise in der Milchstraße (Milliarden)?",a:200,unit:"Milliarden",hint:"Und es gibt Milliarden weitere Galaxien im Universum.",emoji:"⭐"},
      {q:"Wie viele Minuten braucht Licht von der Sonne zur Erde?",a:8,unit:"Minuten",hint:"Genau 8 Minuten und 20 Sekunden.",emoji:"☀️"},
      {q:"Wie groß ist die Schwerkraft auf dem Jupiter im Vergleich zur Erde in Prozent?",a:250,unit:"% der Erdgravitation",hint:"Auf Jupiter würdest du das 2,5-fache deines Gewichts wiegen.",emoji:"🪐"},
      {q:"Wie viele km/s bewegen sich Galaxien durch das Universum?",a:1000,unit:"km/s",hint:"Manche Galaxien rasen mit enormer Geschwindigkeit.",emoji:"🌌"},
      {q:"Wie heiß ist der Kern der Erde in Grad Celsius?",a:6000,unit:"°C",hint:"Ähnlich heiß wie die Oberfläche der Sonne.",emoji:"🌍"},
      {q:"Wie viele Monate dauert ein Jahr auf dem Mars?",a:24,unit:"Monate",hint:"Ein Marsjahr dauert 687 Erdtage.",emoji:"🔴"},
      {q:"Wie viele Kilometer hoch ist die Atmosphäre der Erde?",a:10000,unit:"km",hint:"Die dichte Troposphäre reicht nur 12 km hoch.",emoji:"🌍"},
      {q:"Wie viele Mal größer ist die Sonne als die Erde?",a:1300000,unit:"Mal",hint:"1,3 Millionen Erden würden in die Sonne passen.",emoji:"☀️"},
      {q:"Wie viele Grad Celsius beträgt die Temperatur im Weltall?",a:-270,unit:"°C",hint:"Nahe dem absoluten Nullpunkt von -273°C.",emoji:"❄️"},
      {q:"Wie viele Stunden dauert ein Tag auf der Venus?",a:5832,unit:"Stunden",hint:"Ein Venusjahr ist kürzer als ein Venustag.",emoji:"🪐"},
      {q:"Wie viele km ist ein Lichtjahr lang?",a:9460000000000,unit:"km",hint:"Das Licht legt pro Jahr 9,46 Billionen km zurück.",emoji:"💡"},
      {q:"Wie viele Grad Celsius ist die Temperatur auf dem Merkur tagsüber?",a:430,unit:"°C",hint:"Nachts fällt sie auf -180°C – kein Magnetfeld, keine Atmosphäre.",emoji:"☿"},
      {q:"Wie viele Mal hat die Erde sich seit ihrer Entstehung um die Sonne gedreht?",a:4500000000,unit:"Mal",hint:"Die Erde ist ~4,5 Milliarden Jahre alt.",emoji:"🌍"},
      {q:"Wie viele km beträgt der Durchmesser des größten bekannten Schwarzen Lochs?",a:130000000000000,unit:"km",hint:"TON 618 – 66 Milliarden Sonnenmassen schwer.",emoji:"🌑"},
      {q:"Wie viele Sekunden braucht ein Objekt im freien Fall bis zum Einschlag aus 100m?",a:4.5,unit:"Sekunden",hint:"Nach der Formel s = ½gt².",emoji:"⬇️"},
      {q:"Wie viele Kelvin ist der absolute Nullpunkt?",a:0,unit:"Kelvin",hint:"Entspricht -273,15°C – kälter geht es nicht.",emoji:"🌡️"},
      {q:"Wie schwer ist die Erde in kg (als Potenz von 10)?",a:24,unit:"x10^? kg",hint:"5,97 × 10^24 kg ist die Erdmasse.",emoji:"🌍"},
      {q:"Wie viele Monde hat die Erde?",a:1,unit:"Mond",hint:"Im Gegensatz zu Jupiter mit 146 Monden.",emoji:"🌙"},
      {q:"Wie viele km/h bewegt sich die Internationale Raumstation ISS?",a:28000,unit:"km/h",hint:"Sie umkreist die Erde alle 90 Minuten.",emoji:"🚀"},
    ],
  },
  kids: {
    "🎯 Gratis-Test": [
      {q:"Wie viele Beine hat eine Spinne?",a:8,unit:"Beine",hint:"Spinnen sind keine Insekten – Insekten haben nur 6 Beine!",emoji:"🕷️"},
      {q:"Wie hoch ist der Mount Everest in Metern?",a:8849,unit:"Meter",hint:"Er ist der höchste Berg der Erde.",emoji:"🏔️"},
      {q:"Wie viele Farben hat ein Regenbogen?",a:7,unit:"Farben",hint:"Rot, Orange, Gelb, Grün, Blau, Indigo, Violett.",emoji:"🌈"},
      {q:"Wie viele Planeten gibt es in unserem Sonnensystem?",a:8,unit:"Planeten",hint:"Pluto zählt seit 2006 nicht mehr dazu.",emoji:"🪐"},
      {q:"Wie viele Zähne hat ein Erwachsener?",a:32,unit:"Zähne",hint:"Inklusive der Weisheitszähne.",emoji:"🦷"},
      {q:"Wie viele Stunden hat ein Tag?",a:24,unit:"Stunden",hint:"Die Erde dreht sich einmal in 24 Stunden um ihre Achse.",emoji:"⏰"},
      {q:"Wie viele Herzen hat ein Tintenfisch?",a:3,unit:"Herzen",hint:"Zwei pumpen Blut zu den Kiemen, eines zum Körper.",emoji:"🐙"},
      {q:"Wie schnell kann ein Gepard laufen in km/h?",a:112,unit:"km/h",hint:"Er ist das schnellste Landtier der Welt.",emoji:"🐆"},
      {q:"Wie viele km ist es von der Erde zum Mond?",a:384400,unit:"km",hint:"Die Apollo-Astronauten brauchten 3 Tage dorthin.",emoji:"🌙"},
      {q:"Wie viele Knochen hat ein Erwachsener?",a:206,unit:"Knochen",hint:"Babys haben noch 270 – viele wachsen zusammen.",emoji:"🦴"},
      {q:"Wie alt kann eine Schildkröte werden in Jahren?",a:150,unit:"Jahre",hint:"Manche Schildkröten werden über 200 Jahre alt!",emoji:"🐢"},
      {q:"Wie viele Kontinente gibt es auf der Erde?",a:7,unit:"Kontinente",hint:"Afrika, Amerika (2), Antarktika, Asien, Australien, Europa.",emoji:"🌍"},
      {q:"Wie groß war der größte Dinosaurier in Metern?",a:40,unit:"Meter",hint:"Der Argentinosaurus war der längste bekannte Dinosaurier.",emoji:"🦕"},
      {q:"Wie viele Augen hat eine Biene?",a:5,unit:"Augen",hint:"2 große Facettenaugen und 3 kleine Punktaugen oben.",emoji:"🐝"},
      {q:"Wie viele Minuten braucht Sonnenlicht bis zur Erde?",a:8,unit:"Minuten",hint:"Licht reist mit 300.000 km pro Sekunde.",emoji:"☀️"},
    ],
    "🐘 Tiere": [
      {q:"Wie viele Beine hat eine Spinne?",a:8,unit:"Beine",hint:"Spinnen sind Spinnentiere, keine Insekten.",emoji:"🕷️"},
      {q:"Wie schwer wird ein ausgewachsener Elefant in Tonnen?",a:6,unit:"Tonnen",hint:"Elefanten sind die schwersten Landtiere.",emoji:"🐘"},
      {q:"Wie schnell kann ein Gepard laufen in km/h?",a:112,unit:"km/h",hint:"Das schnellste Landtier der Welt.",emoji:"🐆"},
      {q:"Wie viele Tage trägt ein Elefant sein Baby?",a:645,unit:"Tage",hint:"Fast 2 Jahre – die längste Schwangerschaft auf Land.",emoji:"🐘"},
      {q:"Wie hoch kann ein Känguru springen in Metern?",a:3,unit:"Meter",hint:"Und bis zu 9 Meter weit in einem Sprung!",emoji:"🦘"},
      {q:"Wie viele Stunden schläft ein Koala pro Tag?",a:22,unit:"Stunden",hint:"Eukalyptus-Blätter sind schwer verdaulich.",emoji:"🐨"},
      {q:"Wie viele Zähne hat ein Erwachsenes Krokodil?",a:66,unit:"Zähne",hint:"Sie erneuern ihre Zähne bis zu 50 Mal im Leben.",emoji:"🐊"},
      {q:"Wie viele Jahre kann ein Grönlandwal leben?",a:211,unit:"Jahre",hint:"Das langlebigste Säugetier der Erde.",emoji:"🐳"},
      {q:"Wie schwer wird ein ausgewachsener Gorilla in kg?",a:270,unit:"kg",hint:"Trotz Größe sind Gorillas Vegetarier.",emoji:"🦍"},
      {q:"Wie viele Liter Milch gibt eine Kuh pro Tag?",a:25,unit:"Liter",hint:"Hochleistungskühe können bis zu 50 Liter geben.",emoji:"🐄"},
      {q:"Wie viele Magen hat eine Kuh?",a:4,unit:"Mägen",hint:"Pansen, Netzmagen, Blättermagen, Labmagen.",emoji:"🐄"},
      {q:"Wie viele Herzen hat ein Tintenfisch?",a:3,unit:"Herzen",hint:"Zwei zu den Kiemen, eines zum Körper.",emoji:"🐙"},
      {q:"Wie lange kann eine Boa Constrictor werden in Metern?",a:4,unit:"Meter",hint:"Pythons werden sogar bis zu 6 Meter lang.",emoji:"🐍"},
      {q:"Wie viele km/h schwimmt der schnellste Fisch (Marlin)?",a:110,unit:"km/h",hint:"Schneller als viele Autos auf der Autobahn.",emoji:"🐟"},
      {q:"Wie viele Geruchsrezeptoren hat ein Hund (Millionen)?",a:300,unit:"Millionen",hint:"Menschen haben nur 6 Millionen.",emoji:"🐕"},
      {q:"Wie viele Augen hat eine Biene?",a:5,unit:"Augen",hint:"2 Facettenaugen und 3 Punktaugen.",emoji:"🐝"},
      {q:"Wie hoch kann ein Floh springen in cm?",a:33,unit:"cm",hint:"Das ist das 200-fache seiner Körperlänge.",emoji:"🦟"},
      {q:"Wie lange schläft ein Löwe pro Tag in Stunden?",a:20,unit:"Stunden",hint:"Löwen schlafen mehr als Koalas – fast den ganzen Tag!",emoji:"🦁"},
      {q:"Wie viele km/h kann ein Strauß laufen?",a:70,unit:"km/h",hint:"Der schnellste laufende Vogel der Welt.",emoji:"🦜"},
      {q:"Wie schwer ist das Ei eines Straußes in kg?",a:1.35,unit:"kg",hint:"Das größte Ei aller lebenden Vögel.",emoji:"🥚"},
      {q:"Wie viele Eier legt eine Königin-Biene täglich?",a:2000,unit:"Eier",hint:"Im Sommer legt die Königin bis zu 2000 Eier pro Tag.",emoji:"🐝"},
      {q:"Wie lange können Schildkröten ohne Essen auskommen in Monaten?",a:12,unit:"Monate",hint:"Sie können ihren Stoffwechsel stark verlangsamen.",emoji:"🐢"},
      {q:"Wie viele kg Bambus frisst ein Panda täglich?",a:15,unit:"kg",hint:"Bambus ist nährstoffarm – daher die riesige Menge.",emoji:"🐼"},
      {q:"Wie groß wird ein ausgewachsener Blauwal in Metern?",a:30,unit:"Meter",hint:"Das größte Tier, das je auf der Erde gelebt hat.",emoji:"🐋"},
      {q:"Wie viele Beine hat ein Tausendfüßer wirklich?",a:750,unit:"Beine",hint:"Trotz des Namens haben sie nie genau 1000 Beine.",emoji:"🐛"},
      {q:"Wie oft schlägt das Herz eines Kolibris pro Minute?",a:1200,unit:"Mal",hint:"Das schnellste Herz aller Vögel.",emoji:"🐦"},
      {q:"Wie lange brütet ein Adler seine Eier in Tagen?",a:35,unit:"Tage",hint:"Beide Elternteile brüten abwechselnd.",emoji:"🦅"},
      {q:"Wie viele Streifen hat ein Zebra maximal?",a:80,unit:"Streifen",hint:"Jedes Zebra hat ein einzigartiges Streifenmuster.",emoji:"🦓"},
      {q:"Wie viele Jahre alt kann eine Karotte werden?",a:2,unit:"Jahre",hint:"Karotten sind zweijährige Pflanzen.",emoji:"🥕"},
      {q:"Wie tief kann ein Wal tauchen in Metern?",a:3000,unit:"Meter",hint:"Pottwal-Rekord: fast 3 km tief.",emoji:"🐳"},
    ],
    "🌍 Geografie": [
      {q:"Wie hoch ist der Mount Everest in Metern?",a:8849,unit:"Meter",hint:"Der höchste Berg der Erde, im Himalaya.",emoji:"🏔️"},
      {q:"Wie lang ist der Nil in km?",a:6650,unit:"km",hint:"Er ist der längste Fluss der Welt.",emoji:"🌊"},
      {q:"Wie viele Länder gibt es auf der Erde?",a:195,unit:"Länder",hint:"Davon sind 193 Mitglieder der UNO.",emoji:"🌍"},
      {q:"Wie groß ist Russland in Millionen km²?",a:17,unit:"Millionen km²",hint:"Das größte Land der Welt.",emoji:"🗺️"},
      {q:"Wie tief ist der Marianengraben in Metern?",a:11000,unit:"Meter",hint:"Der tiefste Punkt der Weltmeere.",emoji:"🌊"},
      {q:"Wie viele km lang ist der Amazonas?",a:6400,unit:"km",hint:"Der wasserreichste Fluss der Welt.",emoji:"🌿"},
      {q:"Wie hoch liegt die Hauptstadt von Bolivien (La Paz) in Metern?",a:3600,unit:"Meter",hint:"Eine der höchstgelegenen Hauptstädte der Welt.",emoji:"🏙️"},
      {q:"Wie viele km² hat die Sahara?",a:9200000,unit:"km²",hint:"Die größte Wüste der Welt.",emoji:"🏜️"},
      {q:"Wie lang ist der Amazonas-Regenwald in km²?",a:5500000,unit:"km²",hint:"Er produziert 20% des weltweiten Sauerstoffs.",emoji:"🌳"},
      {q:"Wie tief ist der Baikalsee in Metern?",a:1642,unit:"Meter",hint:"Der tiefste See der Welt, in Russland.",emoji:"💧"},
      {q:"Wie viele km² hat Deutschland?",a:357000,unit:"km²",hint:"Deutschland ist das flächengrößte Land in Mitteleuropa.",emoji:"🇩🇪"},
      {q:"Wie hoch ist der Kilimandscharo in Metern?",a:5895,unit:"Meter",hint:"Der höchste Berg Afrikas.",emoji:"🏔️"},
      {q:"Wie lang ist die Chinesische Mauer in km?",a:21000,unit:"km",hint:"Das längste Bauwerk der Menschheitsgeschichte.",emoji:"🧱"},
      {q:"Wie viele Einwohner hat China (Milliarden)?",a:1.4,unit:"Milliarden",hint:"Das bevölkerungsreichste Land der Erde.",emoji:"🇨🇳"},
      {q:"Wie viele km² ist der Ozean groß?",a:361000000,unit:"km²",hint:"71% der Erdoberfläche ist von Wasser bedeckt.",emoji:"🌊"},
      {q:"Wie viele km lang ist die Küstenlinie Kanadas?",a:202080,unit:"km",hint:"Die längste Küstenlinie aller Länder.",emoji:"🍁"},
      {q:"Wie hoch ist der Eiffelturm in Metern?",a:330,unit:"Meter",hint:"Inklusive Antenne steht er in Paris.",emoji:"🗼"},
      {q:"Wie tief ist der tiefste Ozean (Pazifik) in Metern?",a:11034,unit:"Meter",hint:"Der Challenger Deep im Marianengraben.",emoji:"🌊"},
      {q:"Wie viele Einwohner hat die Erde (Milliarden)?",a:8,unit:"Milliarden",hint:"2022 überschritt die Weltbevölkerung 8 Milliarden.",emoji:"🌍"},
      {q:"Wie lang ist der Rhein in km?",a:1230,unit:"km",hint:"Er fließt durch die Schweiz, Deutschland und die Niederlande.",emoji:"🌊"},
      {q:"Wie groß ist Australien in km²?",a:7700000,unit:"km²",hint:"Der sechstgrößte Staat der Erde.",emoji:"🦘"},
      {q:"Wie viele km² hat der Amazonas-Regenwald?",a:5500000,unit:"km²",hint:"Die größte tropische Regenwaldregion der Erde.",emoji:"🌴"},
      {q:"Wie hoch fliegen Flugzeuge durchschnittlich in Metern?",a:10000,unit:"Meter",hint:"Die Reiseflughöhe liegt bei 9.000–12.000 Metern.",emoji:"✈️"},
      {q:"Wie lang ist die Elbe in km?",a:1091,unit:"km",hint:"Sie fließt von Tschechien durch Deutschland.",emoji:"🌊"},
      {q:"Wie viele Länder grenzen an Deutschland?",a:9,unit:"Länder",hint:"Dänemark, Polen, Tschechien, Österreich, Schweiz, Frankreich, Luxemburg, Belgien, Niederlande.",emoji:"🇩🇪"},
      {q:"Wie viele Inseln hat Indonesien?",a:17000,unit:"Inseln",hint:"Der viertbevölkerungsreichste Staat der Welt.",emoji:"🏝️"},
      {q:"Wie hoch ist der Zugspitze in Metern?",a:2962,unit:"Meter",hint:"Der höchste Berg Deutschlands in Bayern.",emoji:"🏔️"},
      {q:"Wie tief ist der Genfer See in Metern?",a:310,unit:"Meter",hint:"Der größte See Mitteleuropas.",emoji:"💧"},
      {q:"Wie viele km² ist der Schwarzwald groß?",a:6000,unit:"km²",hint:"Der größte zusammenhängende Waldgebirge Deutschlands.",emoji:"🌲"},
      {q:"Wie viele km ist der Äquator lang?",a:40075,unit:"km",hint:"Der Umfang der Erde am Breitengrad 0°.",emoji:"🌍"},
    ],
    "🦕 Dinosaurier": [
      {q:"Vor wie vielen Millionen Jahren starben die Dinosaurier aus?",a:66,unit:"Millionen Jahren",hint:"Ein Asteroideneinschlag löste das Massenaussterben aus.",emoji:"☄️"},
      {q:"Wie lang war der größte Dinosaurier (Argentinosaurus) in Metern?",a:40,unit:"Meter",hint:"Länger als 4 Busse hintereinander.",emoji:"🦕"},
      {q:"Wie groß war ein T-Rex-Zahn in cm?",a:30,unit:"cm",hint:"So lang wie ein menschlicher Unterarm.",emoji:"🦷"},
      {q:"Wie viele kg wog ein ausgewachsener T-Rex?",a:8000,unit:"kg",hint:"Trotz der Größe war er ein Zweibeiniger.",emoji:"🦖"},
      {q:"Wie lange lebten Dinosaurier auf der Erde (Millionen Jahre)?",a:165,unit:"Millionen Jahre",hint:"Viel länger als bisher die Menschen – wir sind erst 0,3 Mio. Jahre alt.",emoji:"🌍"},
      {q:"Wie groß waren die Eier des größten Dinosauriers in cm Durchmesser?",a:45,unit:"cm",hint:"Fast so groß wie ein Fußball.",emoji:"🥚"},
      {q:"Wie viele Hörner hatte ein Triceratops?",a:3,unit:"Hörner",hint:"Zwei lange und ein kurzes Nasenhorn.",emoji:"🦏"},
      {q:"Wie lang war ein Velociraptor wirklich in Metern?",a:1.8,unit:"Meter",hint:"Viel kleiner als im Film – so groß wie ein Truthahn.",emoji:"🦖"},
      {q:"Vor wie vielen Millionen Jahren erschienen die ersten Dinosaurier?",a:231,unit:"Millionen Jahren",hint:"In der Trias-Periode.",emoji:"🌿"},
      {q:"Wie lang war ein Brachiosaurus-Hals in Metern?",a:9,unit:"Meter",hint:"Damit konnte er Blätter aus sehr hohen Bäumen fressen.",emoji:"🦕"},
      {q:"Wie groß war das Gehirn eines Stegosaurus im Vergleich zu einer Walnuss?",a:1,unit:"Walnussgröße",hint:"Es war tatsächlich so klein wie eine Walnuss.",emoji:"🧠"},
      {q:"Wie viele Platten hatte ein Stegosaurus auf dem Rücken?",a:17,unit:"Platten",hint:"Die Platten halfen bei der Temperaturregulierung.",emoji:"🦖"},
      {q:"Wie lang waren die Krallen eines Iguanodon in cm?",a:15,unit:"cm",hint:"Iguanodons nutzten sie zur Verteidigung.",emoji:"🦖"},
      {q:"Wie hoch konnte ein Brachiosaurus seinen Kopf heben in Metern?",a:12,unit:"Meter",hint:"So hoch wie ein vierstöckiges Haus.",emoji:"🦕"},
      {q:"Wie viele Zähne hatte ein T-Rex?",a:60,unit:"Zähne",hint:"Und sie wurden ständig erneuert wie bei Haien.",emoji:"🦷"},
      {q:"Wie schnell konnte ein T-Rex laufen in km/h?",a:20,unit:"km/h",hint:"Langsamer als ein Mensch auf dem Fahrrad.",emoji:"🦖"},
      {q:"Wie lang war ein Diplodocus in Metern?",a:27,unit:"Meter",hint:"Der Schwanz allein war halb so lang wie der ganze Körper.",emoji:"🦕"},
      {q:"Wie groß war ein Mikroraptor in cm?",a:50,unit:"cm",hint:"Einer der kleinsten bekannten Dinosaurier.",emoji:"🐦"},
      {q:"Vor wie vielen Jahren entstand der erste Vogel (Archaeopteryx)?",a:150000000,unit:"Jahren",hint:"Vögel sind die lebenden Nachfahren der Dinosaurier.",emoji:"🐦"},
      {q:"Wie lange dauerte die Kreidezeit in Millionen Jahren?",a:79,unit:"Millionen Jahre",hint:"Von vor 145 bis vor 66 Millionen Jahren.",emoji:"🌿"},
      {q:"Wie viele Federn hatte ein Velociraptor schätzungsweise?",a:500,unit:"Federn",hint:"Velociraptoren waren tatsächlich befiedert wie Vögel.",emoji:"🪶"},
      {q:"Wie groß war ein Compsognathus in cm?",a:60,unit:"cm",hint:"Einer der kleinsten Dinosaurier – so groß wie eine Henne.",emoji:"🐓"},
      {q:"Wie lang war der Dornfortsatz eines Spinosaurus in cm?",a:180,unit:"cm",hint:"Der Spinosaurus hatte einen großen Segel auf dem Rücken.",emoji:"🦖"},
      {q:"Wie viele Dinosaurier-Arten wurden bisher entdeckt (ca.)?",a:700,unit:"Arten",hint:"Und jedes Jahr werden neue Arten gefunden.",emoji:"🔍"},
      {q:"Wie groß war ein Pteranodon mit Flügelspannweite in Metern?",a:7,unit:"Meter",hint:"Kein Dinosaurier, aber zeitgleich – ein fliegender Reptil.",emoji:"🦅"},
      {q:"Wie viele Tonnen fraß ein Brachiosaurus täglich?",a:0.4,unit:"Tonnen",hint:"400 kg Pflanzen täglich – das ist enorm.",emoji:"🌿"},
      {q:"Wie dick war die Schädeldecke eines Pachycephalosaurus in cm?",a:25,unit:"cm",hint:"Für Kopfstöße gegen andere Artgenossen.",emoji:"💀"},
      {q:"Wie lang war die Kralle des Deinocheirus in cm?",a:70,unit:"cm",hint:"Einer der seltsamsten Dinosaurier – erst 2014 vollständig beschrieben.",emoji:"🦖"},
      {q:"Wie viele Jahre hat es gedauert, das erste vollständige T-Rex-Skelett zu finden?",a:100,unit:"Jahre",hint:"Sue ist das vollständigste je gefundene T-Rex-Skelett.",emoji:"🦴"},
      {q:"Wie groß war ein Ankylosauri-Panzer in mm Dicke?",a:50,unit:"mm",hint:"Der natürliche Panzer war so stark wie Stahl.",emoji:"🛡️"},
    ],
    "🚀 Weltraum": [
      {q:"Wie viele Planeten gibt es in unserem Sonnensystem?",a:8,unit:"Planeten",hint:"Pluto ist seit 2006 kein Planet mehr.",emoji:"🪐"},
      {q:"Wie viele Minuten braucht Sonnenlicht bis zur Erde?",a:8,unit:"Minuten",hint:"Licht reist mit 300.000 km pro Sekunde.",emoji:"☀️"},
      {q:"Wie viele Monde hat der Saturn?",a:146,unit:"Monde",hint:"Saturn hat die meisten Monde aller Planeten.",emoji:"🪐"},
      {q:"Wie weit ist die Erde von der Sonne entfernt in Millionen km?",a:150,unit:"Millionen km",hint:"Diese Entfernung nennt man 1 Astronomische Einheit.",emoji:"☀️"},
      {q:"Wie viele km/s bewegt sich Licht?",a:300000,unit:"km/s",hint:"Nichts im Universum ist schneller als Licht.",emoji:"💡"},
      {q:"Wie viele Grad Celsius ist es auf dem Mond nachts?",a:-170,unit:"°C",hint:"Tagsüber sind es +130°C.",emoji:"🌙"},
      {q:"Wie viele Sterne hat unsere Galaxie (Milchstraße) ungefähr?",a:200000000000,unit:"Sterne",hint:"200 Milliarden Sterne in der Milchstraße allein.",emoji:"⭐"},
      {q:"Wie alt ist das Universum in Milliarden Jahren?",a:13.8,unit:"Milliarden Jahre",hint:"Seit dem Urknall.",emoji:"🌌"},
      {q:"Wie viele km von der Erde ist der Mond entfernt?",a:384400,unit:"km",hint:"Apollo-Astronauten brauchten 3 Tage.",emoji:"🌙"},
      {q:"Wie hoch fliegt die ISS über der Erde in km?",a:400,unit:"km",hint:"Sie umkreist die Erde alle 90 Minuten.",emoji:"🚀"},
      {q:"Wie viele Erdmassen hat Jupiter?",a:318,unit:"Erdmassen",hint:"Jupiter ist 318 Mal so schwer wie die Erde.",emoji:"🪐"},
      {q:"Wie viele Monate dauert ein Jahr auf dem Mars?",a:24,unit:"Erdmonate",hint:"Ein Marsjahr = 687 Erdtage.",emoji:"🔴"},
      {q:"Wie viele km/h bewegt sich die Erde um die Sonne?",a:107000,unit:"km/h",hint:"Das sind 30 km pro Sekunde.",emoji:"🌍"},
      {q:"Wie groß ist die Sonne im Vergleich zur Erde?",a:1300000,unit:"Mal größer",hint:"1,3 Millionen Erden würden in die Sonne passen.",emoji:"☀️"},
      {q:"Wie viele km beträgt der Durchmesser der Erde?",a:12742,unit:"km",hint:"Am Äquator ist sie etwas dicker als an den Polen.",emoji:"🌍"},
      {q:"Wie heiß ist die Oberfläche der Sonne in °C?",a:5500,unit:"°C",hint:"Im Kern sind es 15 Millionen Grad.",emoji:"☀️"},
      {q:"Wie lange dauerte die erste Mondlandung (Aufenthalt) in Stunden?",a:21,unit:"Stunden",hint:"Neil Armstrong und Buzz Aldrin am 20. Juli 1969.",emoji:"🌙"},
      {q:"Wie viele Stunden dauert ein Tag auf der Venus?",a:5832,unit:"Stunden",hint:"Ein Venusjahr ist kürzer als ein Venustag!",emoji:"🪐"},
      {q:"Wie viele km beträgt der Umfang der Erde am Äquator?",a:40075,unit:"km",hint:"Die Erde ist nicht perfekt rund – am Äquator etwas breiter.",emoji:"🌍"},
      {q:"Wie weit ist Alpha Centauri von der Erde entfernt in Lichtjahren?",a:4.37,unit:"Lichtjahre",hint:"Das nächste Sternensystem nach unserem.",emoji:"⭐"},
      {q:"Wie viele Grad Celsius ist es im Weltraum?",a:-270,unit:"°C",hint:"Fast der absolute Nullpunkt von -273°C.",emoji:"❄️"},
      {q:"Wie schnell dreht sich die Erde am Äquator in km/h?",a:1670,unit:"km/h",hint:"Wir spüren die Rotation nicht, weil alles mitbewegt wird.",emoji:"🌍"},
      {q:"Wie viele Astronauten waren bisher auf dem Mond?",a:12,unit:"Astronauten",hint:"Alle 12 waren Amerikaner, bei den Apollo-Missionen.",emoji:"👨‍🚀"},
      {q:"Wie groß ist der Große Rote Fleck auf Jupiter in km?",a:16000,unit:"km",hint:"Ein Sturm, der seit 350 Jahren tobt.",emoji:"🪐"},
      {q:"Wie viele Ringe hat Saturn?",a:7,unit:"Hauptringe",hint:"Die Ringe bestehen aus Eis und Gestein.",emoji:"🪐"},
      {q:"Wie viele km/h muss eine Rakete fliegen um die Erde zu verlassen?",a:40000,unit:"km/h",hint:"Das ist die Fluchtgeschwindigkeit der Erde.",emoji:"🚀"},
      {q:"Wie viele Jahre ist Pluto von der Sonne entfernt (Lichtminuten)?",a:330,unit:"Lichtminuten",hint:"Licht braucht 5,5 Stunden von der Sonne zu Pluto.",emoji:"🌑"},
      {q:"Wie viele Monde hat der Mars?",a:2,unit:"Monde",hint:"Phobos und Deimos – beide sehr klein.",emoji:"🔴"},
      {q:"Wie lange dauert ein Tag auf dem Merkur in Erdtagen?",a:59,unit:"Erdtage",hint:"Merkur dreht sich sehr langsam um seine Achse.",emoji:"☿"},
      {q:"Wie viele km/h fährt der Sonnenwind?",a:500000,unit:"km/h",hint:"Elektrisch geladene Teilchen von der Sonne.",emoji:"💨"},
    ],
    "🏆 Sport & Rekorde": [
      {q:"Wie viele Kilometer ist ein Marathon lang?",a:42.195,unit:"km",hint:"Benannt nach dem Lauf eines Boten aus Marathon nach Athen.",emoji:"🏃"},
      {q:"Wie schnell lief Usain Bolt seinen Weltrekord über 100m in Sekunden?",a:9.58,unit:"Sekunden",hint:"Aufgestellt 2009 in Berlin.",emoji:"⚡"},
      {q:"Wie viele Tore schoss Ronaldo in seiner Karriere (ca.)?",a:900,unit:"Tore",hint:"Er ist der erfolgreichste Torschütze aller Zeiten.",emoji:"⚽"},
      {q:"Wie viele Goldmedaillen gewann Michael Phelps bei Olympia?",a:23,unit:"Goldmedaillen",hint:"Der erfolgreichste Olympiateilnehmer aller Zeiten.",emoji:"🏊"},
      {q:"Wie hoch ist ein Basketballkorb in Metern?",a:3.05,unit:"Meter",hint:"Die offizielle Höhe in der NBA und bei Olympia.",emoji:"🏀"},
      {q:"Wie viele Spieler stehen beim Fußball auf dem Platz (beide Teams)?",a:22,unit:"Spieler",hint:"11 pro Mannschaft.",emoji:"⚽"},
      {q:"Wie lang ist ein olympisches Schwimmbecken in Metern?",a:50,unit:"Meter",hint:"Die offizielle Länge für Weltrekorde.",emoji:"🏊"},
      {q:"Wie viele km/h fuhr der schnellste Tennisaufschlag?",a:263,unit:"km/h",hint:"Samuel Groth aus Australien, 2012.",emoji:"🎾"},
      {q:"Wie viele Punkte bekommt man bei einem Touchdown im American Football?",a:6,unit:"Punkte",hint:"Dazu kommt noch ein Extra-Punkt für den Kick.",emoji:"🏈"},
      {q:"Wie hoch ist ein Volleyballnetz bei Männern in Metern?",a:2.43,unit:"Meter",hint:"Bei Frauen ist es 2,24 Meter hoch.",emoji:"🏐"},
      {q:"Wie viele km fährt ein Tour-de-France-Fahrer insgesamt?",a:3500,unit:"km",hint:"Über 21 Etappen in 3 Wochen.",emoji:"🚴"},
      {q:"Wie viele Spieler hat eine Baseballmannschaft?",a:9,unit:"Spieler",hint:"9 Feldspieler und ein Schlagmann.",emoji:"⚾"},
      {q:"Wie lange dauert ein Eishockeyspiel in Minuten (reine Spielzeit)?",a:60,unit:"Minuten",hint:"3 Drittel à 20 Minuten.",emoji:"🏒"},
      {q:"Wie viele Male hat Novak Djokovic Wimbledon gewonnen?",a:7,unit:"Mal",hint:"Er ist der Rekordsieger in Wimbledon.",emoji:"🎾"},
      {q:"Wie viele Runden hat ein Formel-1-Rennen durchschnittlich?",a:57,unit:"Runden",hint:"Je nach Streckenlänge variiert die Rundenzahl.",emoji:"🏎️"},
      {q:"Wie viele Meter hoch springt der Hochsprung-Weltrekord?",a:2.45,unit:"Meter",hint:"Javier Sotomayor stellte 1993 diesen Rekord auf.",emoji:"🏃"},
      {q:"Wie viele km weit wirft man beim Speerwurf-Weltrekord?",a:98.48,unit:"Meter",hint:"Jan Železný aus Tschechien, 1996.",emoji:"🎯"},
      {q:"Wie viele Punkte braucht man im Tischtennis zum Gewinnen eines Satzes?",a:11,unit:"Punkte",hint:"Mit 2 Punkten Vorsprung muss man gewinnen.",emoji:"🏓"},
      {q:"Wie lang ist ein Fußballfeld maximal in Metern?",a:105,unit:"Meter",hint:"Die FIFA-Vorgabe ist 100–110 Meter.",emoji:"⚽"},
      {q:"Wie viele Goldmedaillen hat Deutschland bei den Olympischen Spielen 2024 gewonnen?",a:12,unit:"Goldmedaillen",hint:"Paris 2024 – Deutschland belegte Platz 10 im Medaillenspiegel.",emoji:"🥇"},
      {q:"Wie schwer ist ein Boxball beim Schwergewicht maximal in kg?",a:999,unit:"unbegrenzt",hint:"Im Schwergewicht gibt es keine Gewichtsobergrenze.",emoji:"🥊"},
      {q:"Wie viele Pferde stehen bei der Formel 1 im Motor (PS)?",a:1000,unit:"PS",hint:"Moderne F1-Motoren leisten über 1000 PS.",emoji:"🏎️"},
      {q:"Wie viele Meter weit springt man beim Weitsprung-Weltrekord?",a:8.95,unit:"Meter",hint:"Mike Powell sprang 1991 in Tokio diesen Rekord.",emoji:"🏃"},
      {q:"Wie viele Stunden dauert das längste Tennisspiel aller Zeiten?",a:11,unit:"Stunden",hint:"Isner vs. Mahut 2010 in Wimbledon.",emoji:"🎾"},
      {q:"Wie viele Mal hat Bayern München die Bundesliga gewonnen?",a:32,unit:"Mal",hint:"Deutschlands erfolgreichster Fußballklub.",emoji:"⚽"},
      {q:"Wie groß ist ein Basketball-Spielfeld in Metern?",a:28,unit:"Meter Länge",hint:"Das offizielle FIBA-Spielfeld ist 28 x 15 Meter.",emoji:"🏀"},
      {q:"Wie viele km/h erreichte der schnellste Golfball beim Abschlag?",a:340,unit:"km/h",hint:"Beim Drive kann der Ball unglaubliche Geschwindigkeiten erreichen.",emoji:"⛳"},
      {q:"Wie viele Spieler hat ein Rugbyteam?",a:15,unit:"Spieler",hint:"Im Rugby League sind es 13 Spieler.",emoji:"🏉"},
      {q:"Wie viele Punkte ist ein Elfmeter beim Fußball wert?",a:1,unit:"Tor",hint:"Ein verwandelter Elfmeter zählt als normales Tor.",emoji:"⚽"},
      {q:"Wie viele Schritte darf man im Basketball machen ohne zu dribbeln?",a:2,unit:"Schritte",hint:"Bei 3 Schritten gibt es Schrittfehler.",emoji:"🏀"},
    ],
  }
};

/* ─── HELPERS ────────────────────────────────────── */
const genCode   = () => Math.random().toString(36).slice(2,7).toUpperCase();
const fmtNum    = (n) => {
  if(n==null) return "?";
  const num=Number(n);
  // integers that look like years (1000-2200) or any whole number: no thousand separator
  if(Number.isInteger(num)&&num>=1000&&num<=2200) return String(num);
  // other integers >= 10000: use separator
  if(Number.isInteger(num)) return num.toLocaleString("de-DE");
  // decimals
  return num.toLocaleString("de-DE",{maximumFractionDigits:2});
};
const inviteUrl = (c) => `${location.origin}${location.pathname}?room=${c}`;
function avatarColor(name,t){
  const h=[...(name||"?")].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return t.id==="kids"?`hsl(${h},60%,55%)`:`hsl(${h},40%,32%)`;
}
const inject=(css)=>{
  let el=document.getElementById("wtf-style");
  if(!el){el=document.createElement("style");el.id="wtf-style";document.head.appendChild(el);}
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
  // gather all unused questions from selected categories
  let pool=[];
  available.forEach(cat=>{
    cats[cat].forEach((q,i)=>{
      const id=`${cat}::${i}`;
      if(!usedIds.includes(id)) pool.push({...q,id,cat});
    });
  });
  if(!pool.length){
    // all used – reset
    usedIds.splice(0,usedIds.length);
    available.forEach(cat=>{
      cats[cat].forEach((q,i)=>pool.push({...q,id:`${cat}::${i}`,cat}));
    });
  }
  return pool[Math.floor(Math.random()*pool.length)];
}

function calcRound(room){
  const q=room.q,order=room.order||[],guesses=room.guesses||{},bets=room.bets||{};
  const ranked=order.filter(id=>guesses[id]!=null).map(id=>({id,diff:Math.abs(guesses[id]-q.a)})).sort((a,b)=>a.diff-b.diff);
  const closestId=ranked[0]?.id,farthestId=ranked[ranked.length-1]?.id,anyExact=ranked.some(r=>r.diff===0);
  const roundScores={};
  order.forEach(id=>{
    let pts=0;
    if(guesses[id]==null){roundScores[id]=0;return;}
    const diff=Math.abs(guesses[id]-q.a);
    if(diff===0)pts+=2;
    else if(!anyExact&&id===closestId)pts+=1;
    const bet=bets[id]||{};
    if(bet.closest===closestId)pts+=1;
    if(bet.farthest===farthestId)pts+=1;
    roundScores[id]=pts;
  });
  const newScores={...room.scores};
  order.forEach(id=>{newScores[id]=(newScores[id]||0)+(roundScores[id]||0);});
  return{roundScores,newScores,closestId,farthestId};
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

/* ─── PRIMITIVES ─────────────────────────────────── */
const row={display:"flex",alignItems:"center",gap:10};
const col={display:"flex",flexDirection:"column",gap:12};
const page={minHeight:"100vh",padding:"24px 16px",maxWidth:520,margin:"0 auto"};

function Spinner({t}){return <div style={{width:28,height:28,border:`3px solid ${t.border}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto"}}/>;}
function Btn({children,onClick,variant="primary",disabled,t,full,style:sx={}}){
  const base={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"13px 22px",border:"none",borderRadius:t.radius,fontSize:15,fontWeight:700,letterSpacing:.3,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.38:1,transition:"all .15s",width:full?"100%":undefined,WebkitTapHighlightColor:"transparent",userSelect:"none"};
  const v={primary:{background:t.accent,color:"#fff"},secondary:{background:"transparent",color:t.text,border:`2px solid ${t.border}`},ghost:{background:"transparent",color:t.muted}};
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
  const fs=size==="lg"?"clamp(56px,13vw,88px)":"40px";
  if(t.id==="adult")return <div style={{fontFamily:t.fontTitle,fontSize:fs,letterSpacing:3,lineHeight:1,color:t.accent,animation:"flame 2.5s ease infinite"}}>WTFacts{size==="lg"&&<div style={{fontFamily:t.fontBody,fontSize:12,letterSpacing:2.5,color:t.muted,marginTop:4}}>FAKTEN. DIE DU NIE GEBRAUCHT HAST.</div>}</div>;
  return <div style={{textAlign:"center"}}><div style={{fontFamily:t.fontTitle,fontSize:fs,lineHeight:1.1,animation:"rainbow 3s linear infinite"}}>WTFacts</div><div style={{fontSize:size==="lg"?24:16,animation:"bop 1.2s ease infinite"}}>🌈✨</div></div>;
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

/* ─── HOME ───────────────────────────────────────── */
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
          {["1–15 Spieler","330 Fragen","Echtzeit","Wetten"].map(x=><Pill key={x} t={ADULT} color={ADULT.muted}>{x}</Pill>)}
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

/* ─── CATEGORY SELECTION ─────────────────────────── */
function CategoryScreen({mode,onStart,t}){
  const cats=Object.keys(QUESTIONS[mode]);
  const freeKey=mode==="adult"?"🎯 Gratis-Test":"🎯 Gratis-Test";
  const [selected,setSelected]=useState([freeKey]);

  function toggle(c){
    setSelected(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  }

  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>KATEGORIEN WÄHLEN</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?30:36,marginBottom:6}}>
      {t.id==="kids"?"Was wollt ihr spielen?":"Was wird gespielt?"}
    </h2>
    <p style={{color:t.muted,fontSize:14,marginBottom:18}}>Wähle mindestens eine Kategorie</p>
    <div style={{...col,marginBottom:18}}>
      {cats.map(c=>{
        const isFree=c===freeKey;
        const sel=selected.includes(c);
        return <div key={c} onClick={()=>toggle(c)} style={{...row,padding:"13px 16px",borderRadius:t.radius,cursor:"pointer",background:sel?t.accent+"18":t.surface,border:`2px solid ${sel?t.accent:t.border}`,transition:"all .15s"}}>
          <div style={{fontSize:22,minWidth:32}}>{sel?"✅":"⬜"}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15}}>{c}</div>
            {isFree&&<div style={{fontSize:12,color:t.green,fontWeight:700,marginTop:2}}>✓ Kostenlos – perfekt zum Testen!</div>}
            <div style={{fontSize:12,color:t.muted,marginTop:1}}>{QUESTIONS[mode][c].length} Fragen</div>
          </div>
        </div>;
      })}
    </div>
    <Btn t={t} full disabled={selected.length===0} onClick={()=>onStart(selected)}>
      {t.id==="kids"?`Spiel starten mit ${selected.length} Kategorie(n) 🎮`:`Spiel starten (${selected.length} Kategorie(n)) →`}
    </Btn>
  </div>;
}

/* ─── LOBBY ──────────────────────────────────────── */
function LobbyScreen({room,code,myId,t,onGoCategories}){
  const[copied,setCopied]=useState(false);
  const isHost=room.hostId===myId;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const link=inviteUrl(code);
  function copy(){navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}
  return <div style={{...page,animation:"fu .3s ease both"}}>
    <Logo t={t} size="sm"/>
    <div style={{marginTop:18,marginBottom:6}}><Pill t={t} color={t.green}>{t.id==="kids"?"🎈 LOBBY":"LOBBY"}</Pill></div>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?34:40,marginBottom:6}}>{t.id==="kids"?"Warte auf alle!":"Warte auf Mitspieler"}</h2>
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
      ?<Btn t={t} onClick={onGoCategories} full>{t.id==="kids"?"Kategorien wählen 🎮":"Kategorien wählen →"}</Btn>
      :<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{t.id==="kids"?"Warte auf den Spielleiter 🙂":"Warte auf den Host..."}</p>}
  </div>;
}

/* ─── QUESTION ───────────────────────────────────── */
function QuestionScreen({room,myId,t,onGuess}){
  const[val,setVal]=useState("");
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{};
  const myGuess=guesses[myId];
  const doneCount=Object.values(guesses).filter(v=>v!=null).length;
  if(!q)return <div style={{...page,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner t={t}/></div>;
  function submit(){const n=parseFloat(val.replace(",","."));if(isNaN(n))return;onGuess(n);}
  return <div style={page}>
    <div style={{...row,justifyContent:"space-between",marginBottom:18,animation:"fu .3s ease both"}}>
      <Pill t={t} color={t.green}>{t.id==="kids"?`🎯 Frage ${(room.qIdx||0)+1}`:`FRAGE ${(room.qIdx||0)+1}`}</Pill>
      <span style={{fontSize:13,color:t.muted,fontFamily:t.fontMono}}>{doneCount}/{pl.length} ✓</span>
    </div>
    <Card t={t} glow style={{marginBottom:14,animation:"fu .3s .05s ease both"}}>
      <div style={{fontSize:26,marginBottom:8}}>{q.emoji||"❓"}</div>
      <Pill t={t} color={t.muted}>{q.cat}</Pill>
      <p style={{fontSize:t.id==="kids"?20:18,lineHeight:1.55,fontWeight:t.id==="kids"?700:500,marginTop:12}}>{q.q}</p>
      <p style={{marginTop:12,color:t.muted,fontSize:14}}>Antwort in: <strong style={{color:t.gold}}>{q.unit}</strong></p>
    </Card>
    {myGuess==null
      ?<Card t={t} style={{animation:"fu .3s .1s ease both"}}>
        <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.6,marginBottom:10}}>{t.id==="kids"?`DEIN TIPP (${q.unit}) 🤔`:`DEIN TIPP (${q.unit})`}</p>
        <div style={row}>
          <Inp type="number" value={val} onChange={setVal} placeholder="z.B. 42" t={t} autoFocus style={{fontSize:22,fontWeight:700,fontFamily:t.fontMono}}/>
          <Btn t={t} onClick={submit} disabled={!val} style={{flexShrink:0}}>OK ✓</Btn>
        </div>
        <p style={{marginTop:11,color:t.muted,fontSize:13,lineHeight:1.5}}>{t.id==="kids"?"💬 Redet – aber zeigt eure Zahl nicht!":"💬 Diskutiert – zeigt euren Tipp aber nicht!"}</p>
      </Card>
      :<Card t={t} style={{textAlign:"center",animation:"fu .3s .1s ease both"}}>
        <div style={{fontSize:42,fontFamily:t.fontMono,color:t.accent,fontWeight:800,marginBottom:6}}>{fmtNum(myGuess)} {q.unit}</div>
        <p style={{color:t.green,fontWeight:700,marginBottom:14}}>✓ Tipp abgegeben!</p>
        <div style={{fontSize:12,color:t.muted,display:"flex",justifyContent:"space-between",marginBottom:5}}><span>Warte auf alle...</span><span>{doneCount}/{pl.length}</span></div>
        <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(doneCount/pl.length)*100}%`,background:`linear-gradient(90deg,${t.accent},${t.gold})`,borderRadius:3,transition:"width .4s ease"}}/></div>
      </Card>}
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:14}}>
      {pl.map(p=>{const done=guesses[p.id]!=null;return <div key={p.id} style={{padding:"5px 12px",borderRadius:100,fontSize:13,fontWeight:700,border:`1px solid ${done?t.green:t.border}`,color:done?t.green:t.muted,background:done?t.green+"18":t.surface,transition:"all .25s"}}>{p.name} {done?"✓":"…"}</div>;})}
    </div>
  </div>;
}

/* ─── BETTING ────────────────────────────────────── */
function BettingScreen({room,myId,t,onBet}){
  const[closest,setClosest]=useState("");
  const[farthest,setFarthest]=useState("");
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const others=pl.filter(p=>p.id!==myId);
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
    <Pill t={t} color={t.gold}>{t.id==="kids"?"🎲 WETTEN":"WETTEN"}</Pill>
    <h2 style={{fontFamily:t.fontTitle,fontSize:t.id==="kids"?32:38,margin:"8px 0 5px"}}>{t.id==="kids"?"Wer trifft's am besten?":"Wer liegt wo?"}</h2>
    <p style={{color:t.muted,marginBottom:18,fontSize:14}}>Richtige Wette = +1 Punkt extra</p>
    {myBet
      ?<Card t={t} style={{textAlign:"center"}}><div style={{fontSize:52,animation:"bop 1.2s ease infinite",marginBottom:10}}>🎲</div><p style={{fontWeight:700,fontSize:17}}>Wette gesetzt!</p><p style={{color:t.muted,marginTop:7,animation:"pulse 1.5s ease infinite"}}>Warte auf Auflösung...</p></Card>
      :<>
        <RG label={t.id==="kids"?"🎯 Wer liegt AM NÄCHSTEN?":"🎯 AM NÄCHSTEN dran"} color={t.green} val={closest} setVal={setClosest}/>
        {!soloOther&&<RG label={t.id==="kids"?"🙈 Wer liegt AM WEITESTEN?":"💀 AM WEITESTEN daneben"} color={t.danger} val={farthest} setVal={setFarthest}/>}
        {soloOther&&<p style={{color:t.muted,fontSize:13,marginBottom:12,textAlign:"center"}}>Bei 2 Spielern reicht eine Auswahl 👆</p>}
        <Btn t={t} full disabled={!canSubmit} onClick={submitBet}>Wette abgeben 🎲</Btn>
      </>}
  </div>;
}

/* ─── RESULTS ────────────────────────────────────── */
function ResultsScreen({room,myId,t,onNext,onEnd}){
  const q=room.q;
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const guesses=room.guesses||{},bets=room.bets||{},scores=room.scores||{},rs=room.roundScores||{};
  const isHost=room.hostId===myId;
  const medals=["🥇","🥈","🥉"];
  const ranked=pl.filter(p=>guesses[p.id]!=null).map(p=>({...p,guess:guesses[p.id],diff:Math.abs(guesses[p.id]-q.a)})).sort((a,b)=>a.diff-b.diff);
  const closestId=ranked[0]?.id,farthestId=ranked[ranked.length-1]?.id;
  return <div style={page}>
    <div style={{textAlign:"center",marginBottom:22,animation:"fu .3s ease both"}}>
      <div style={{fontSize:30,marginBottom:6}}>{q.emoji||"❓"}</div>
      <Pill t={t}>AUFLÖSUNG</Pill>
      <div style={{fontFamily:t.fontTitle,fontSize:"clamp(50px,12vw,82px)",color:t.accent,lineHeight:1,marginTop:8,animation:"pop .5s ease both",textShadow:t.id==="adult"?"0 0 32px rgba(232,54,10,.35)":undefined}}>{fmtNum(q.a)} {q.unit}</div>
      <p style={{color:t.muted,marginTop:11,fontSize:15,lineHeight:1.6,maxWidth:380,margin:"11px auto 0"}}>{q.hint}</p>
    </div>
    <Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{t.id==="kids"?"TIPPS 📊":"TIPPS DIESER RUNDE"}</p>
      {ranked.map((p,i)=>{const exact=p.diff===0,win=i===0&&!exact,pts=rs[p.id]||0;return <div key={p.id} style={{...row,padding:"10px 13px",borderRadius:t.radius,marginBottom:8,background:exact?t.green+"18":win?t.accent+"14":t.surface,border:`1.5px solid ${exact?t.green:win?t.accent+"44":t.border}`,animation:`fu .3s ${i*.07}s ease both`}}><span style={{fontSize:18,minWidth:20}}>{medals[i]||`${i+1}.`}</span><Avatar name={p.name} t={t} size={28}/><span style={{fontWeight:700,flex:1,fontSize:14}}>{p.name}</span><span style={{fontFamily:t.fontMono,fontSize:13,color:win||exact?t.accent:t.text}}>{fmtNum(p.guess)} {q.unit}</span><span style={{fontFamily:t.fontMono,fontSize:11,color:t.muted,minWidth:44,textAlign:"right"}}>Δ{fmtNum(p.diff)}</span>{pts>0&&<Pill t={t} color={exact?t.green:t.gold}>+{pts}P</Pill>}</div>;})}
    </Card>
    {Object.keys(bets).length>0&&<Card t={t} style={{marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>WETTEN</p>
      {pl.map(p=>{
        const b=bets[p.id];if(!b)return null;
        const cp=pl.find(x=>x.id===b.closest),fp=pl.find(x=>x.id===b.farthest);
        const okC=b.closest===closestId,okF=b.farthest===farthestId;
        const betPts=(rs[p.id]||0)-(()=>{const diff=Math.abs((guesses[p.id]||0)-q.a);const base=diff===0?2:p.id===closestId&&!ranked.some(r=>r.diff===0)?1:0;return base;})();
        return <div key={p.id} style={{marginBottom:12,padding:"10px 12px",background:t.surface,borderRadius:t.radius,border:`1px solid ${t.border}`}}>
          <div style={{...row,marginBottom:8}}>
            <Avatar name={p.name} t={t} size={26}/>
            <span style={{fontWeight:700,fontSize:14}}>{p.name}</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:100,background:okC?t.green+"22":t.danger+"18",border:`1px solid ${okC?t.green:t.danger}`,fontSize:13}}>
              <span>{okC?"🎯":"❌"}</span>
              <span style={{color:okC?t.green:t.danger,fontWeight:700}}>Nächster: {cp?.name||"?"}</span>
              {okC&&<span style={{color:t.green,fontSize:11,fontWeight:800}}>+1P</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:100,background:okF?t.green+"22":t.danger+"18",border:`1px solid ${okF?t.green:t.danger}`,fontSize:13}}>
              <span>{okF?"💀":"❌"}</span>
              <span style={{color:okF?t.green:t.danger,fontWeight:700}}>Weitester: {fp?.name||"?"}</span>
              {okF&&<span style={{color:t.green,fontSize:11,fontWeight:800}}>+1P</span>}
            </div>
          </div>
        </div>;
      })}
    </Card>}
    <Card t={t} style={{marginBottom:18}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:12}}>{t.id==="kids"?"PUNKTE 🏆":"GESAMTPUNKTE"}</p>
      {[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<pl.length-1?`1px solid ${t.border}`:"none"}}><span style={{fontFamily:t.fontTitle,fontSize:20,color:i===0?t.gold:t.muted,minWidth:20}}>{i+1}</span><Avatar name={p.name} t={t} size={30}/><span style={{flex:1,fontWeight:p.id===myId?800:400}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:12}}> (Du)</span>}</span><span style={{fontFamily:t.fontTitle,fontSize:32,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span></div>)}
    </Card>
    {isHost?<div style={{display:"flex",gap:10}}><Btn t={t} onClick={onNext} full>Nächste Frage →</Btn><Btn t={t} variant="secondary" onClick={onEnd}>Beenden</Btn></div>:<p style={{textAlign:"center",color:t.muted,animation:"pulse 1.5s ease infinite"}}>{t.id==="kids"?"Warte auf den Spielleiter 🙂":"Warte auf den Host..."}</p>}
  </div>;
}

/* ─── FINAL ──────────────────────────────────────── */
function FinalScreen({room,myId,t,onRestart}){
  const pl=(room.order||[]).map(id=>room.players?.[id]).filter(Boolean);
  const scores=room.scores||{};
  const allBets=room.allBets||{};  // accumulated bets across rounds
  const allGuesses=room.allGuesses||{};  // accumulated guesses across rounds
  const sorted=[...pl].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0));
  const winner=sorted[0];
  const loser=sorted[sorted.length-1];
  const medals=["🥇","🥈","🥉"];
  useEffect(()=>{launchConfetti();},[]);

  // Calculate stats from history
  const history=room.history||[];
  const totalRounds=history.length;

  // Bet king: most correct bets
  const betWins={};
  const betTotal={};
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
  const betKingId=pl.reduce((best,p)=>(!best||betWins[p.id]>betWins[best])&&betTotal[p.id]>0?p.id:best,null);
  const betKing=pl.find(p=>p.id===betKingId);
  const betKingRate=betKingId&&betTotal[betKingId]>0?Math.round((betWins[betKingId]/betTotal[betKingId])*100):0;

  // Worst guesser: highest average diff
  const avgDiff={};
  const diffCount={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g==null)return;
      avgDiff[pid]=(avgDiff[pid]||0)+Math.abs(g-r.answer);
      diffCount[pid]=(diffCount[pid]||0)+1;
    });
  });
  const worstId=pl.reduce((worst,p)=>{
    if(!diffCount[p.id])return worst;
    const avg=avgDiff[p.id]/diffCount[p.id];
    if(!worst)return p.id;
    return avg>(avgDiff[worst]/diffCount[worst])?p.id:worst;
  },null);
  const worstPlayer=pl.find(p=>p.id===worstId);

  const bestId=pl.reduce((best,p)=>{
    if(!diffCount[p.id])return best;
    const avg=avgDiff[p.id]/diffCount[p.id];
    if(!best)return p.id;
    return avg<(avgDiff[best]/diffCount[best])?p.id:best;
  },null);
  const bestPlayer=pl.find(p=>p.id===bestId);

  // Exact hits per player
  const exactHits={};
  history.forEach(r=>{
    if(!r.guesses||!r.answer)return;
    Object.entries(r.guesses).forEach(([pid,g])=>{
      if(g!=null&&Math.abs(g-r.answer)===0) exactHits[pid]=(exactHits[pid]||0)+1;
    });
  });
  const exactKingId=pl.reduce((best,p)=>(exactHits[p.id]||0)>(exactHits[best]||0)?p.id:best,pl[0]?.id);
  const exactKing=pl.find(p=>p.id===exactKingId);

  const bestAvg=bestId&&diffCount[bestId]?Math.round(avgDiff[bestId]/diffCount[bestId]*10)/10:null;
  const worstAvg=worstId&&diffCount[worstId]?Math.round(avgDiff[worstId]/diffCount[worstId]*10)/10:null;

  const statCards=[
    betKing&&{icon:"🎲",label:"Wettkönig",name:betKing.name,sub:`${betWins[betKingId]} von ${betTotal[betKingId]} Wetten richtig (${betKingRate}%)`,color:t.gold},
    bestPlayer&&sorted.length>1&&{icon:"🎯",label:"Bester Schätzer",name:bestPlayer.name,sub:`Ø ${fmtNum(bestAvg)} ${totalRounds>0?"Abweichung":""}`,color:t.green},
    worstPlayer&&sorted.length>1&&bestId!==worstId&&{icon:"🙈",label:"Schlechtester Schätzer",name:worstPlayer.name,sub:`Ø ${fmtNum(worstAvg)} Abweichung`,color:t.danger},
    exactKing&&(exactHits[exactKingId]||0)>0&&{icon:"💥",label:"Punktlandungen",name:exactKing.name,sub:`${exactHits[exactKingId]} exakte Treffer`,color:t.accent},
  ].filter(Boolean);

  return <div style={{...page,textAlign:"center",paddingTop:36}}>
    <div style={{fontSize:68,animation:"pop .7s ease both"}}>{t.id==="kids"?"🏆🎉🌟":"🏆"}</div>
    <div style={{fontFamily:t.fontTitle,fontSize:50,color:t.gold,marginTop:6,animation:"pop .7s .1s ease both",lineHeight:1}}>{winner?.name||"?"}</div>
    <p style={{color:t.muted,fontSize:16,margin:"5px 0 24px"}}>{t.id==="kids"?`gewinnt mit ${scores[winner?.id]||0} Punkten! 🎊`:`gewinnt mit ${scores[winner?.id]||0} Punkten.`}</p>

    {/* Endstand */}
    <Card t={t} style={{textAlign:"left",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:t.muted,letterSpacing:.8,marginBottom:14}}>ENDSTAND</p>
      {sorted.map((p,i)=><div key={p.id} style={{...row,padding:"10px 0",borderBottom:i<sorted.length-1?`1px solid ${t.border}`:"none",animation:`fu .4s ${i*.08}s ease both`}}>
        <span style={{fontSize:20,minWidth:26}}>{medals[i]||`${i+1}.`}</span>
        <Avatar name={p.name} t={t}/>
        <span style={{flex:1,fontWeight:p.id===myId?800:400,fontSize:15,textAlign:"left"}}>{p.name}{p.id===myId&&<span style={{color:t.accent,fontSize:11}}> (Du)</span>}</span>
        <span style={{fontFamily:t.fontTitle,fontSize:36,color:i===0?t.gold:t.text}}>{scores[p.id]||0}</span>
      </div>)}
    </Card>

    {/* Stats */}
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

    <Btn t={t} onClick={onRestart} full style={{marginBottom:16}}>{t.id==="kids"?"🔄 Nochmal spielen!":"Neue Runde starten"}</Btn>
  </div>;
}

/* ─── ROOT APP ───────────────────────────────────── */
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
  const unsubRef=useRef(null);
  const t=mode==="kids"?KIDS:ADULT;
  useEffect(()=>{inject(globalCSS(t));},[t]);

  function listenRoom(c){
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=dbListen(c,r=>{
      if(!r)return;
      setRoom({...r});
      setMode(r.mode||"adult");
      const map={lobby:"lobby",categories:"categories",question:"question",betting:"betting",results:"results",final:"final"};
      if(map[r.phase])setScreen(map[r.phase]);
      // reset advance guards on new question
      if(r.phase==="question"){advanceGuessPhaseRef.current=false;advanceBetPhaseRef.current=false;}
      if(r.phase==="betting"){advanceBetPhaseRef.current=false;}
    });
  }

  async function handleHost(name,m){
    setMode(m);
    const c=genCode();
    setCode(c);
    await dbSet(c,{code:c,mode:m,hostId:myId,players:{[myId]:{id:myId,name}},order:[myId],phase:"lobby",guesses:{},bets:{},scores:{},roundScores:{},q:null,qIdx:0,history:[]});
    listenRoom(c);
  }

  async function handleJoin(c,name,m){
    setMode(m||"adult");
    setCode(c);
    const r=await dbGet(c);
    await dbPatch(c,{players:{...r.players,[myId]:{id:myId,name}},order:[...(r.order||[]),myId]});
    listenRoom(c);
  }

  async function handleGoCategories(){
    await dbPatch(code,{phase:"categories"});
  }

  async function handleStartWithCats(selectedCats){
    selectedCatsRef.current=selectedCats;
    const q=getQuestion(mode,selectedCats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:0,selectedCats});
  }

  async function handleGuess(val){
    // write own guess
    await update(ref(db,`rooms/${code}/guesses`),{[myId]:val});
    // only the HOST decides when to advance phase – avoids race conditions
    // the onValue listener (listenRoom) will pick up the change for everyone
    // host watches and advances once all guesses are in
  }

  // called by the room listener whenever room updates
  const advanceGuessPhaseRef=useRef(false);
  useEffect(()=>{
    if(!room||room.phase!=="question")return;
    const order=room.order||[];
    const guesses=room.guesses||{};
    const allDone=order.length>0&&order.every(id=>guesses[id]!=null);
    // only host advances to avoid double-write
    if(allDone&&room.hostId===myId&&!advanceGuessPhaseRef.current){
      advanceGuessPhaseRef.current=true;
      const advance=async()=>{
        const r=await dbGet(code);
        const g=r.guesses||{};
        const stillAllDone=(r.order||[]).every(id=>g[id]!=null);
        if(!stillAllDone)return;
        if((r.order||[]).length<3){
          const merged={...r,guesses:g};
          const{roundScores,newScores,closestId,farthestId}=calcRound(merged);
          const histEntry={guesses:g,answer:r.q?.a,bets:{},closestId,farthestId};
          const prevHistory=r.history||[];
          await dbPatch(code,{phase:"results",roundScores,scores:newScores,history:[...prevHistory,histEntry]});
        } else {
          await dbPatch(code,{phase:"betting"});
        }
      };
      advance();
    }
    if(!allDone) advanceGuessPhaseRef.current=false;
  },[room?.guesses,room?.phase]);

  async function handleBet(closest,farthest){
    await update(ref(db,`rooms/${code}/bets`),{[myId]:{closest,farthest}});
    // host advances phase once all bets are in
  }

  const advanceBetPhaseRef=useRef(false);
  useEffect(()=>{
    if(!room||room.phase!=="betting")return;
    const order=room.order||[];
    const bets=room.bets||{};
    const allDone=order.length>0&&order.every(id=>bets[id]&&bets[id].closest&&bets[id].farthest);
    if(allDone&&room.hostId===myId&&!advanceBetPhaseRef.current){
      advanceBetPhaseRef.current=true;
      const advance=async()=>{
        const r=await dbGet(code);
        const b=r.bets||{};
        const stillAllDone=(r.order||[]).every(id=>b[id]&&b[id].closest&&b[id].farthest);
        if(!stillAllDone)return;
        const{roundScores,newScores,closestId,farthestId}=calcRound(r);
        const histEntry={guesses:r.guesses,answer:r.q?.a,bets:b,closestId,farthestId};
        const prevHistory=r.history||[];
        await dbPatch(code,{phase:"results",roundScores,scores:newScores,history:[...prevHistory,histEntry]});
      };
      advance();
    }
    if(!allDone) advanceBetPhaseRef.current=false;
  },[room?.bets,room?.phase]);

  async function handleNext(){
    const r=await dbGet(code);
    const cats=r.selectedCats||selectedCatsRef.current||Object.keys(QUESTIONS[mode]);
    const q=getQuestion(mode,cats,usedIdsRef.current);
    if(q)usedIdsRef.current.push(q.id);
    await dbPatch(code,{phase:"question",q,guesses:{},bets:{},roundScores:{},qIdx:(r.qIdx||0)+1});
  }

  async function handleEnd(){await dbPatch(code,{phase:"final"});}

  function handleRestart(){
    if(unsubRef.current)unsubRef.current();
    setRoom(null);setCode(null);setScreen("home");
    usedIdsRef.current=[];selectedCatsRef.current=[];
  }

  return <>
    {loading&&<LoadingOverlay t={t} text={loadTxt}/>}
    {screen==="home"&&<HomeScreen onHost={handleHost} onJoin={handleJoin}/>}
    {screen==="lobby"&&room&&<LobbyScreen room={room} code={code} myId={myId} t={t} onGoCategories={handleGoCategories}/>}
    {screen==="categories"&&room&&room.hostId===myId&&<CategoryScreen mode={mode} onStart={handleStartWithCats} t={t}/>}
    {screen==="categories"&&room&&room.hostId!==myId&&<div style={{...page,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><Spinner t={t}/><p style={{color:t.muted,animation:"pulse 1.5s ease infinite"}}>Host wählt Kategorien...</p></div>}
    {screen==="question"&&room&&<QuestionScreen room={room} myId={myId} t={t} onGuess={handleGuess}/>}
    {screen==="betting"&&room&&(room.order||[]).length>1&&<BettingScreen room={room} myId={myId} t={t} onBet={handleBet}/>}
    {screen==="results"&&room&&<ResultsScreen room={room} myId={myId} t={t} onNext={handleNext} onEnd={handleEnd}/>}
    {screen==="final"&&room&&<FinalScreen room={room} myId={myId} t={t} onRestart={handleRestart}/>}
  </>;
}
