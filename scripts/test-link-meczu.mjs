// Sprawdza link do transmisji / nagrania meczu przy obserwacji — na PRAWDZIWYM module
// src/data/link-meczu.ts i na PRAWDZIWYM kodzie wyświetlania z src/main.ts.
//
// Uruchomienie:  node scripts/test-link-meczu.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const mobilna = fs.readFileSync("src/mobile/main.ts", "utf8");
const magazyn = fs.readFileSync("src/data/storage.ts", "utf8");
const kalendarz = fs.readFileSync("api/kalendarz-sync.js", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const js = transformSync(fs.readFileSync("src/data/link-meczu.ts", "utf8"), { loader: "ts", format: "esm" }).code;
const modul = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const { linkDoMeczuZPola, bezpiecznyLinkMeczu, serwisLinkuMeczu, obserwacjeTegoSamegoMeczu } = modul;

console.log('\n1. Poprawne linki — także wklejone razem z tekstem');
[
  ['https://www.youtube.com/watch?v=abc123', 'https://www.youtube.com/watch?v=abc123'],
  ['   https://lechpoznan.tv/mecz/lech-ii-notec-czarnkow   ', 'https://lechpoznan.tv/mecz/lech-ii-notec-czarnkow'],
  ['Mecz na żywo: https://stream.klub.pl/live?id=5.', 'https://stream.klub.pl/live?id=5'],
  ['(https://youtu.be/XyZ)', 'https://youtu.be/XyZ'],
  ['www.notec-czarnkow.pl/transmisja', 'https://www.notec-czarnkow.pl/transmisja'],
  ['youtu.be/XyZ', 'https://youtu.be/XyZ'],
  ['http://192.168.1.20:8080/stream', 'http://192.168.1.20:8080/stream'],
].forEach(([wpis, oczekiwany]) => {
  const w = linkDoMeczuZPola(wpis);
  sprawdz(`„${wpis.trim()}" → ${oczekiwany}`, w.ok && w.wartosc === oczekiwany, JSON.stringify(w));
});

console.log('\n2. Puste pole usuwa link — to nie błąd');
['', '   ', null, undefined].forEach(wpis => {
  const w = linkDoMeczuZPola(wpis);
  sprawdz(`„${wpis}" → brak linku`, w.ok && w.wartosc === '', JSON.stringify(w));
});

console.log('\n3. Odrzucone — z powodem, a nie zapisane');
[
  'javascript:alert(1)',
  'JavaScript:alert(document.cookie)',
  'data:text/html,<script>alert(1)</script>',
  'javascript://%0aalert(1)',
  'Lech II - Noteć Czarnków',
  'mecz o 17.30',
  'https://ktos:haslo@zla-strona.pl/mecz',
].forEach(wpis => {
  const w = linkDoMeczuZPola(wpis);
  sprawdz(`„${wpis}" odrzucone`, !w.ok && typeof w.powod === 'string' && w.powod.length > 10, JSON.stringify(w));
});

console.log('\n4. Wyświetlanie sprawdza adres jeszcze raz');
sprawdz('javascript: z bazy nie trafia do href', bezpiecznyLinkMeczu('javascript:alert(1)') === '');
sprawdz('ftp: z bazy nie trafia do href', bezpiecznyLinkMeczu('ftp://pliki.pl/mecz.mp4') === '');
{
  const href = bezpiecznyLinkMeczu('https://x.pl/"><img src=x onerror=alert(1)>');
  sprawdz('cudzysłów i nawiasy ostre w adresie są zakodowane', href && !/["<>]/.test(href), href);
}
sprawdz('serwis bez „www."', serwisLinkuMeczu('https://www.youtube.com/watch?v=1') === 'youtube.com');

{
  const kod = [
    wytnij('esc', /function esc\(s\)\{.*\}/),
    wytnij('ogladajMeczHtml', /function ogladajMeczHtml\(o, etykieta = '▶ Oglądaj mecz'\)\{[\s\S]*?\n\}/),
  ].join('\n');
  const ogladajMeczHtml = new Function('bezpiecznyLinkMeczu', 'serwisLinkuMeczu', `${kod}\n return ogladajMeczHtml;`)(bezpiecznyLinkMeczu, serwisLinkuMeczu);
  const html = ogladajMeczHtml({ linkDoMeczu: 'https://lechpoznan.tv/mecz' });
  sprawdz('przycisk otwiera nową kartę bez dostępu do SBS', /target="_blank"/.test(html) && /rel="noopener noreferrer"/.test(html) && /href="https:\/\/lechpoznan\.tv\/mecz"/.test(html), html);
  sprawdz('obserwacja bez linku nie ma przycisku', ogladajMeczHtml({}) === '' && ogladajMeczHtml(null) === '');
  sprawdz('zatruty link z bazy nie daje przycisku', ogladajMeczHtml({ linkDoMeczu: 'javascript:alert(1)' }) === '');
}

console.log('\n5. Ten sam mecz dla kilku zawodników — jedna transmisja');
{
  const lista = [
    { id: 'A', date: '2026-09-12', match: 'Lech II Poznań - Noteć Czarnków' },
    { id: 'B', date: '2026-09-12', match: 'lech ii poznan – notec czarnkow' },
    { id: 'C', date: '2026-09-13', match: 'Lech II Poznań - Noteć Czarnków' },
    { id: 'D', date: '2026-09-12', match: 'Warta Poznań - Noteć Czarnków' },
  ];
  const w = obserwacjeTegoSamegoMeczu(lista, lista[0]).map(x => x.id);
  sprawdz('tylko ten sam mecz tego samego dnia, bez samej obserwacji', JSON.stringify(w) === '["B"]', JSON.stringify(w));
  sprawdz('obserwacja bez nazwy meczu nie łapie innych', obserwacjeTegoSamegoMeczu(lista, { id: 'X', date: '2026-09-12', match: '' }).length === 0);
}

console.log('\n6. Podpięcie');
sprawdz('pole zapisuje się bez migracji bazy (EXT_CONFIG obserwacji)', /sbs_observations:[\s\S]*?fields: \[[^\]]*"linkDoMeczu"/.test(magazyn));
sprawdz('formularz planu ma pole i przycisk „Wklej"', zrodlo.includes('id="obs-link"') && zrodlo.includes(`querySelectorAll('[data-action="obs-link-wklej"]')`));
sprawdz('zły link zatrzymuje zapis planu', /const linkPole = linkDoMeczuZPola\([\s\S]{0,80}\);\s*if\(!linkPole\.ok\)\{ alert\(/.test(zrodlo));
sprawdz('link trafia do obserwacji', zrodlo.includes('linkDoMeczu: linkPole.wartosc,'));
sprawdz('nieudany zapis cofa link dopisany innym obserwacjom', /if\(!zapisano\)\{\s*linkDlaInnych\.forEach\(x=>\{ x\.linkDoMeczu = ''; \}\);/.test(zrodlo));
const ileMiejsc = (zrodlo.match(/ogladajMeczHtml\((o|obs|editing)[,)]/g) || []).length;
sprawdz(`„▶ Oglądaj" w listach i podglądach (${ileMiejsc} miejsc)`, ileMiejsc >= 8, String(ileMiejsc));
sprawdz('telefon: pole w planie i zapis', mobilna.includes('id="n-link"') && mobilna.includes('linkDoMeczu: link.wartosc,'));
sprawdz('telefon: przycisk na karcie i w podglądzie przez bezpiecznyLinkMeczu',
  mobilna.includes('bezpiecznyLinkMeczu(o.linkDoMeczu)') && mobilna.includes('bezpiecznyLinkMeczu(obs.linkDoMeczu)'));
sprawdz('Kalendarz Google: link w opisie wydarzenia', /Transmisja: \$\{e\.linkDoMeczu\}/.test(kalendarz));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
