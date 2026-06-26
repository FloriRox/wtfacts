// Läuft automatisch vor jedem "npm run build" (siehe package.json -> "prebuild").
// Ersetzt den CACHE_NAME in public/sw.js durch einen frischen Zeitstempel,
// damit der Service Worker bei jedem Deploy seinen alten Cache verwirft
// und alle Assets (inkl. Icons) neu vom Server lädt.

import fs from 'fs';
import path from 'path';

const swPath = path.join(process.cwd(), 'public', 'sw.js');

if (!fs.existsSync(swPath)) {
  console.warn('[bump-sw] public/sw.js nicht gefunden – überspringe.');
  process.exit(0);
}

let content = fs.readFileSync(swPath, 'utf8');
const stamp = `estimates-${Date.now()}`;

const updated = content.replace(
  /const CACHE_NAME = '.*?';/,
  `const CACHE_NAME = '${stamp}';`
);

if (updated === content) {
  console.warn('[bump-sw] Konnte CACHE_NAME-Zeile nicht finden/ersetzen – bitte sw.js prüfen.');
} else {
  fs.writeFileSync(swPath, updated);
  console.log(`[bump-sw] CACHE_NAME aktualisiert auf "${stamp}"`);
}
