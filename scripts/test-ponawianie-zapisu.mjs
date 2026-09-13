// Sprawdza ponawianie zapisu statystyk przy chwilowym braku odpowiedzi bazy (504 Gateway Timeout)
// — na PRAWDZIWYM module api/_ponawianie.js i PRAWDZIWYCH funkcjach z src/main.ts.
// Przypadek ze zrzutu (13.09.2026): Jagiellonia Białystok, „zapisano 22 z 23 — baza odrzuciła
// zapis (Prelec Nik: kod 504 {"message":"Gateway Timeout"})".
//
// Uruchomienie:  node scripts/test-ponawianie-zapisu.mjs
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const serwer = fs.readFileSync("api/stats-90minut.js", "utf8");
const { patchZPonowieniem, CHWILOWE_STATUSY, czyChwilowyStatus } =
  await import(pathToFileURL(process.cwd() + "/api/_ponawianie.js").href);
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

// Udawana baza: kolejne odpowiedzi z listy; liczba = kod, 'zerwane' = błąd połączenia.
const baza = (odpowiedzi) => {
  const wyslane = [];
  const fetch = async (url, opcje) => {
    wyslane.push({ url, metoda: opcje.method, cialo: opcje.body });
    const o = odpowiedzi[Math.min(wyslane.length - 1, odpowiedzi.length - 1)];
    if (o === 'zerwane') throw new Error('fetch failed');
    return { ok: o >= 200 && o < 300, status: o, text: async () => o === 504 ? '{"message":"Gateway Timeout"}' : '{"message":"bad"}' };
  };
  return { fetch, wyslane };
};
const przerwy = [];
const czekaj = async (ms) => { przerwy.push(ms); };

console.log('\n1. Serwer ponawia chwilowe błędy');
{
  const b = baza([504, 504, 204]);
  const w = await patchZPonowieniem('https://baza/rest/v1/sbs_players?id=eq.Z9', { body: '{"minutes":900}' }, { fetch: b.fetch, czekaj });
  sprawdz('504, 504, potem zapis — kończy się sukcesem', w.ok && w.proby === 3, JSON.stringify(w));
  sprawdz('każda próba to PATCH z tą samą treścią', b.wyslane.every(x => x.metoda === 'PATCH' && x.cialo === '{"minutes":900}'), JSON.stringify(b.wyslane));
  sprawdz('między próbami są przerwy, rosnące', przerwy.length === 2 && przerwy[1] > przerwy[0], JSON.stringify(przerwy));
}
{
  const b = baza(['zerwane', 200]);
  const w = await patchZPonowieniem('u', {}, { fetch: b.fetch, czekaj });
  sprawdz('zerwane połączenie też ponawiane', w.ok && w.proby === 2, JSON.stringify(w));
}
{
  const b = baza([504, 504, 504, 504]);
  const w = await patchZPonowieniem('u', {}, { fetch: b.fetch, czekaj });
  sprawdz('uparty 504 — po trzech próbach błąd oznaczony jako chwilowy', !w.ok && w.proby === 3 && w.chwilowy && w.status === 504, JSON.stringify(w));
  sprawdz('nie ponawia w nieskończoność', b.wyslane.length === 3, String(b.wyslane.length));
}
{
  const b = baza([400, 200]);
  const w = await patchZPonowieniem('u', {}, { fetch: b.fetch, czekaj });
  sprawdz('400 (zła treść) NIE jest ponawiany — to prawdziwa odmowa', !w.ok && w.proby === 1 && w.chwilowy === false && b.wyslane.length === 1, JSON.stringify(w));
}
[401, 403, 404, 409].forEach(k => sprawdz(`kod ${k} nie jest chwilowy`, !czyChwilowyStatus(k)));
[429, 502, 503, 504].forEach(k => sprawdz(`kod ${k} jest chwilowy`, czyChwilowyStatus(k)));

console.log('\n2. Przeglądarka: druga próba i uczciwy komunikat');
const kod = [
  wytnij('CHWILOWE_STATUSY_BAZY', /const CHWILOWE_STATUSY_BAZY = new Set\(\[[^\]]*\]\);/),
  wytnij('bladChwilowy', /const bladChwilowy = .*;/),
  wytnij('pakietDoPonowienia', /function pakietDoPonowienia\(pakiet, nieudane\)\{[\s\S]*?\n\}/),
  wytnij('opisNieudanegoZapisu', /function opisNieudanegoZapisu\(zapisani, wszystkich, nieudane\)\{[\s\S]*?\n\}/),
].join('\n');
const api = new Function(`${kod}\n return { CHWILOWE_STATUSY_BAZY, pakietDoPonowienia, opisNieudanegoZapisu };`)();

sprawdz('przeglądarka i serwer uznają za chwilowe te same kody',
  JSON.stringify([...api.CHWILOWE_STATUSY_BAZY].sort()) === JSON.stringify([...CHWILOWE_STATUSY].sort()),
  `${[...api.CHWILOWE_STATUSY_BAZY]} / ${[...CHWILOWE_STATUSY]}`);

const PRELEC = { id: 'Z9', kto: 'Prelec Nik', status: 504, tresc: '{"message":"Gateway Timeout"}', chwilowy: true, proby: 3 };
{
  const pakiet = [{ id: 'Z1', kto: 'Jan A' }, { id: 'Z9', kto: 'Prelec Nik' }, { id: 'Z3', kto: 'Adam B' }];
  const zly = { id: 'Z3', kto: 'Adam B', status: 400, tresc: 'bad', chwilowy: false };
  const w = api.pakietDoPonowienia(pakiet, [PRELEC, zly]);
  sprawdz('do ponownej wysyłki idzie tylko Prelec (504), nie odmowa 400', w.length === 1 && w[0].id === 'Z9', JSON.stringify(w));
  sprawdz('stara odpowiedź serwera (bez chwilowy) rozpoznana po kodzie',
    api.pakietDoPonowienia(pakiet, [{ id: 'Z9', kto: 'Prelec Nik', status: 504 }]).length === 1);
  sprawdz('błąd bez id nie wysyła niczego na ślepo', api.pakietDoPonowienia(pakiet, [{ kto: 'Prelec Nik', status: 504 }]).length === 0);
}
{
  const t = api.opisNieudanegoZapisu(22, 23, [PRELEC]);
  console.log('   komunikat: ' + t);
  sprawdz('przy 504 NIE pisze „baza odrzuciła zapis"', !/odrzuciła/.test(t), t);
  sprawdz('mówi, że baza nie odpowiedziała na czas i co kliknąć', /nie odpowiedziała na czas/.test(t) && /Ponów nieudane/.test(t), t);
  sprawdz('podaje, kogo dotyczy', /Prelec Nik: kod 504/.test(t), t);
  const odmowa = api.opisNieudanegoZapisu(22, 23, [{ kto: 'Adam B', status: 400, tresc: 'bad' }]);
  sprawdz('prawdziwa odmowa dalej nazywa się odmową', /baza odrzuciła zapis \(Adam B: kod 400/.test(odmowa), odmowa);
  const mieszane = api.opisNieudanegoZapisu(21, 23, [PRELEC, { kto: 'Adam B', status: 400 }]);
  sprawdz('chwilowy + odmowa razem — liczy się odmowa', /odrzuciła/.test(mieszane), mieszane);
  const zadnych = api.opisNieudanegoZapisu(22, 23, []);
  sprawdz('brak listy błędów — komunikat bez „(undefined…)"', !/undefined/.test(zadnych), zadnych);
}

console.log('\n3. Podpięcie');
sprawdz('serwer importuje ponawianie', serwer.includes('import { patchZPonowieniem } from "./_ponawianie.js";'));
sprawdz('oba zapisy zawodników idą przez ponawianie', (serwer.match(/await patchZPonowieniem\(`\$\{BAZA\}\/rest\/v1\/sbs_players/g) || []).length === 2);
sprawdz('żaden zapis zawodnika nie został na gołym fetch PATCH', !/fetch\(`\$\{BAZA\}\/rest\/v1\/sbs_players\?id=eq\.[^`]*`, \{\s*method: "PATCH"/.test(serwer));
sprawdz('błędy zapisu niosą id i znacznik chwilowości', (serwer.match(/chwilowy: w\.chwilowy, proby: w\.proby/g) || []).length === 2 && /bledySzybkie\.push\(\{ id: poz\.id,/.test(serwer));
sprawdz('przeglądarka wysyła ponownie tylko chwilowo nieudane', zrodlo.includes('const doPonowienia = pakietDoPonowienia(dane.pakiet, nieudane);') && zrodlo.includes('const odp2 = await wyslijPakiet(doPonowienia);'));
sprawdz('komunikat błędu z opisNieudanegoZapisu', zrodlo.includes('throw new Error(opisNieudanegoZapisu(zapisani, dane.pakiet.length, nieudane));'));
sprawdz('stary komunikat „baza odrzuciła zapis" nie jest już sklejany na sztywno w przebiegu grupy', !/throw new Error\(`zapisano \$\{zapisani\} z \$\{dane\.pakiet\.length\} — baza odrzuciła zapis`/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
