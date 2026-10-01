// FLAGI NARODOWOŚCI JAKO PLIKI, NIE EMOJI.
//
// PO CO TO JEST
// Windows nie ma w czcionce znaków flag — emoji 🇵🇱 wyświetla się tam jako dwie litery „PL".
// Cała aplikacja pokazywała więc zamiast flag pary liter. Flagi idą teraz jako małe pliki SVG
// (zestaw flag-icons, licencja MIT, same rysunki w domenie publicznej): rysują się tak samo
// w każdym systemie, skalują bez rozmycia i nie wymagają żadnego połączenia z zewnątrz.
//
// Uruchomienie (po dopisaniu kraju do SKROTY_KRAJOW):
//   node scripts/wytnij-flagi.mjs
import fs from "node:fs";
import path from "node:path";

// Nazwa kraju tak, jak zapisuje ją kartoteka → kod ISO 3166-1 alfa-2 (pliki zestawu flag-icons).
// Anglia, Szkocja i Walia mają własne kody regionalne — w piłce to osobne reprezentacje.
const SKROTY_KRAJOW = {
  'polska':'pl','niemcy':'de','portugalia':'pt','hiszpania':'es','francja':'fr','włochy':'it',
  'anglia':'gb-eng','wielka brytania':'gb','szkocja':'gb-sct','walia':'gb-wls','irlandia':'ie',
  'holandia':'nl','belgia':'be','austria':'at','szwajcaria':'ch','dania':'dk','szwecja':'se',
  'norwegia':'no','finlandia':'fi','islandia':'is','ukraina':'ua','białoruś':'by','rosja':'ru',
  'czechy':'cz','słowacja':'sk','węgry':'hu','rumunia':'ro','bułgaria':'bg','serbia':'rs',
  'chorwacja':'hr','słowenia':'si','bośnia i hercegowina':'ba','czarnogóra':'me',
  'macedonia północna':'mk','albania':'al','kosowo':'xk','grecja':'gr','turcja':'tr','cypr':'cy',
  'gruzja':'ge','armenia':'am','litwa':'lt','łotwa':'lv','estonia':'ee','mołdawia':'md',
  'brazylia':'br','argentyna':'ar','urugwaj':'uy','kolumbia':'co','chile':'cl','peru':'pe',
  'meksyk':'mx','usa':'us','stany zjednoczone':'us','kanada':'ca','paragwaj':'py',
  'wenezuela':'ve','ekwador':'ec','nigeria':'ng','ghana':'gh','senegal':'sn','kamerun':'cm',
  'wybrzeże kości słoniowej':'ci','mali':'ml','algieria':'dz','maroko':'ma','tunezja':'tn',
  'egipt':'eg','rpa':'za','demokratyczna republika konga':'cd','iran':'ir','irak':'iq',
  'izrael':'il','arabia saudyjska':'sa','japonia':'jp','korea południowa':'kr','chiny':'cn',
  'australia':'au','nowa zelandia':'nz','gwinea':'gn','gwinea bissau':'gw','komory':'km',
  'burkina faso':'bf','kongo':'cg','azerbejdżan':'az',
};

const zrodlo = "node_modules/flag-icons/flags/4x3";
const cel = "public/flagi";
if (!fs.existsSync(zrodlo)) { console.error(`Brak ${zrodlo} — uruchom najpierw: npm install`); process.exit(1); }
fs.mkdirSync(cel, { recursive: true });

const kody = [...new Set(Object.values(SKROTY_KRAJOW))];
const braki = [];
let bajtow = 0;
for (const kod of kody) {
  const plik = path.join(zrodlo, kod + ".svg");
  if (!fs.existsSync(plik)) { braki.push(kod); continue; }
  const tresc = fs.readFileSync(plik);
  fs.writeFileSync(path.join(cel, kod + ".svg"), tresc);
  bajtow += tresc.length;
}

const ts = `// NAZWA KRAJU → PLIK FLAGI. NIE POPRAWIAJ RĘCZNIE.
// Powstaje z scripts/wytnij-flagi.mjs; same rysunki leżą w public/flagi (zestaw flag-icons, MIT).
// Emoji flag nie używamy, bo Windows pokazuje je jako dwie litery (🇵🇱 → „PL").

export const KOD_FLAGI: Record<string, string> = ${JSON.stringify(SKROTY_KRAJOW, null, 2).replace(/"/g, '"')};

/** Ścieżka do pliku flagi albo pusty tekst, gdy kraju nie znamy. */
export function plikFlagi(kraj: string): string {
  const kod = KOD_FLAGI[String(kraj || "").trim().toLowerCase()];
  return kod ? "/flagi/" + kod + ".svg" : "";
}
`;
fs.writeFileSync("src/data/flagi.ts", ts, "utf8");

console.log(`Skopiowane flagi: ${kody.length - braki.length} z ${kody.length} (${Math.round(bajtow / 1024)} kB)`);
if (braki.length) console.log(`Brak w zestawie: ${braki.join(", ")}`);
console.log(`Nazw krajów obsłużonych: ${Object.keys(SKROTY_KRAJOW).length}`);
