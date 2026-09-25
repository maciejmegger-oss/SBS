// Sprawdza znak PZPN w przyciskach kadr młodzieżowych (zakładka Talent → REPREZENTANCI).
//
// Zgłoszenie (25.09.2026): „wstaw we wszystkich zespołach reprezentacji oficjalne logo PZPN".
// Wcześniej stały tam biało-czerwone kółka z liczbą (21, 20, 19…), a wiek i tak jest w etykiecie.
//
// Uruchomienie:  node scripts/test-logo-pzpn-kadry.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const kod = (zrodlo.match(/const znaczekKadry = \(k\)=> `[\s\S]*?`;/) || [])[0];
if (!kod) { console.error('Nie znalazłem znaczekKadry w src/main.ts.'); process.exit(1); }
const znaczekKadry = (kadra, wybrana) =>
  new Function('talentKadra', 'esc', `${kod}\n return znaczekKadry(${JSON.stringify(kadra)});`)(wybrana, (s) => String(s));

console.log('\n1. Logo zamiast kółka z liczbą');
{
  const u17 = znaczekKadry('U-17', '');
  sprawdz('przycisk kadry pokazuje logo PZPN', u17.includes('/logo-pzpn.png'), u17.slice(0, 80));
  sprawdz('to obrazek, nie kółko z numerem', u17.trim().startsWith('<img') && !u17.includes('znaczek-kadry"'), u17.slice(0, 60));
  sprawdz('podpowiedź mówi, czyja to kadra', /title="Kadra U-17 — powołania PZPN"/.test(u17), u17);
  sprawdz('każda kadra dostaje ten sam znak',
    ['U-21','U-20','U-19','U-18','U-16','U-15'].every(k => znaczekKadry(k, '').includes('/logo-pzpn.png')));
}

console.log('\n2. Wybrana pigułka — jasna podkładka pod logo');
{
  sprawdz('wybrana kadra dostaje klasę „na-ciemnym"', znaczekKadry('U-17', 'U-17').includes('na-ciemnym'));
  sprawdz('niewybrana jej nie ma', !znaczekKadry('U-17', 'U-15').includes('na-ciemnym'));
  sprawdz('styl podkładki opisany w arkuszu', /\.znaczek-kadry-pzpn\.na-ciemnym\{background:#FFFFFF/.test(style));
  sprawdz('logo mieści się w pigułce', /\.znaczek-kadry-pzpn\{width:22px;height:24px/.test(style));
}

console.log('\n3. Plik logo');
sprawdz('plik leży w public i pojedzie z wdrożeniem', fs.existsSync('public/logo-pzpn.png'));
{
  const rozmiar = fs.existsSync('public/logo-pzpn.png') ? fs.statSync('public/logo-pzpn.png').size : 0;
  sprawdz(`logo jest lekkie (${Math.round(rozmiar / 1024)} kB — znaczek ma 22 px, nie potrzeba więcej)`,
    rozmiar > 0 && rozmiar < 60 * 1024, String(rozmiar));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
