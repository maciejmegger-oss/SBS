// Przeniesienie zawodników, którzy z protokołu IV ligi trafili do klubu młodzieżowego.
//
// CO SIĘ STAŁO: „START PRUSZCZ" i „MUSTANG OSTASZEWO" istnieją w bazie dwa razy — raz w IV lidze
// kujawsko-pomorskiej, raz w rozgrywkach „Rocznik 2013". Gdy okno protokołów otwarto bez wskazanej
// grupy, przy niejednoznacznej nazwie wygrywała kartoteka z większą liczbą zawodników i dorobek
// seniorów lądował u młodzieży. Klub z IV ligi zostawał z samymi kreskami.
//
// Przyczynę usunięto w kodzie (poziom rozgrywek czytamy teraz z samego protokołu). Ten skrypt
// sprząta to, co zdążyło wpaść w złe miejsce.
//
// Przenosimy WYŁĄCZNIE wpisy pochodzące z protokołu ŁNP — rozpoznajemy je po notatce albo po
// źródle statystyk. Zawodników, którzy w klubie docelowym już są (to samo imię i nazwisko),
// nie dublujemy: taki wpis usuwamy, bo jest kopią.
//
// Bez argumentu tylko pokazuje, co by zrobił. Zapis wymaga słowa „zapisz".
import fs from "node:fs";

const BAZA = process.env.SBS_URL;
const KLUCZ = process.env.SBS_KEY;
const ZAPISZ = process.argv.includes("zapisz");
if (!BAZA || !KLUCZ) { console.error("Ustaw SBS_URL i SBS_KEY."); process.exit(1); }

const naglowki = { apikey: KLUCZ, Authorization: "Bearer " + KLUCZ, "Content-Type": "application/json" };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");

const kluby = await (await fetch(`${BAZA}/rest/v1/sbs_clubs?select=id,name,league&limit=3000`, { headers: naglowki })).json();

// Pary: klub młodzieżowy -> klub o tej samej nazwie w IV lidze.
const pary = [];
for (const zly of kluby.filter((c) => /^Rocznik/i.test(String(c.league || "")))) {
  const dobry = kluby.find((c) => c.id !== zly.id && norm(c.name) === norm(zly.name) && /^IV liga/i.test(String(c.league || "")));
  if (dobry) pary.push({ zly, dobry });
}

let doPrzeniesienia = [], doUsuniecia = [];
for (const { zly, dobry } of pary) {
  const wZlym = await (await fetch(`${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,matches,minutes,notes,custom_fields&club_id=eq.${zly.id}&limit=300`, { headers: naglowki })).json();
  const wDobrym = await (await fetch(`${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,matches,minutes,goals,custom_fields&club_id=eq.${dobry.id}&limit=300`, { headers: naglowki })).json();
  const juzSa = new Map(wDobrym.map((p) => [norm(p.first_name) + "|" + norm(p.last_name), p]));

  for (const p of wZlym) {
    const ext = (p.custom_fields || {}).__ext || {};
    const zProtokolu = /protok/i.test(String(p.notes || "")) || ext.statsSource === "protokół ŁNP";
    if (!zProtokolu) continue;                       // prawdziwy młodzieżowiec — nie ruszamy
    const klucz = norm(p.first_name) + "|" + norm(p.last_name);
    const blizniak = juzSa.get(klucz);
    if (blizniak) doUsuniecia.push({ p, zly, dobry, cel: blizniak });
    else { doPrzeniesienia.push({ p, zly, dobry }); juzSa.set(klucz, p); }
  }
}

console.log(`Par klubów (młodzieżowy ↔ IV liga): ${pary.length}`);
console.log(`Do przeniesienia: ${doPrzeniesienia.length}`);
console.log(`Do usunięcia (już są w klubie docelowym): ${doUsuniecia.length}\n`);
doPrzeniesienia.slice(0, 12).forEach((x) =>
  console.log(`  ${(x.p.last_name + " " + x.p.first_name).padEnd(28)} ${x.p.matches || 0}m/${x.p.minutes || 0}min   ${x.zly.name} [${x.zly.league || ""}] → ${x.dobry.league}`)
);

if (!ZAPISZ) {
  console.log("\nTo był PODGLĄD — nic nie zapisano.");
  console.log("Aby zapisać: node scripts/przenies-z-mlodziezowych.mjs zapisz");
  process.exit(0);
}

let ok = 0, usuniete = 0, bledy = 0;
for (const x of doPrzeniesienia) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(x.p.id)}`, {
    method: "PATCH", headers: { ...naglowki, Prefer: "return=minimal" },
    body: JSON.stringify({ club_id: x.dobry.id }),
  });
  if (r.ok) ok++; else { bledy++; console.error("  BŁĄD przeniesienia", x.p.id, r.status); }
}
// NAJPIERW DOROBEK, DOPIERO POTEM KASOWANIE.
//
// Statystyki siedzą na kopii młodzieżowej, a oryginał w IV lidze ma zera — samo usunięcie kopii
// skasowałoby cały dorobek. Przepisujemy go wyłącznie wtedy, gdy oryginał jest pusty; gdyby coś
// tam było, znaczyłoby to, że pochodzi z innego źródła i nie wolno tego nadpisać.
let przepisane = 0;
for (const x of doUsuniecia) {
  const celPusty = !(x.cel.matches || 0) && !(x.cel.minutes || 0);
  const kopiaMa = (x.p.matches || 0) || (x.p.minutes || 0);
  if (celPusty && kopiaMa) {
    const extZrodla = (x.p.custom_fields || {}).__ext || {};
    const extCelu = (x.cel.custom_fields || {}).__ext || {};
    const cf = { ...(x.cel.custom_fields || {}), __ext: { ...extCelu,
      przebieg: extZrodla.przebieg, rozliczoneMecze: extZrodla.rozliczoneMecze,
      yellowCards: extZrodla.yellowCards, redCards: extZrodla.redCards,
      statsSource: extZrodla.statsSource, statsUpdatedAt: extZrodla.statsUpdatedAt } };
    const r0 = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(x.cel.id)}`, {
      method: "PATCH", headers: { ...naglowki, Prefer: "return=minimal" },
      body: JSON.stringify({ matches: x.p.matches || 0, minutes: x.p.minutes || 0, goals: x.p.goals || 0, custom_fields: cf }),
    });
    if (r0.ok) przepisane++;
    else { bledy++; console.error("  BŁĄD przepisania dorobku", x.cel.id, r0.status); continue; }
  }
  const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(x.p.id)}`, { method: "DELETE", headers: naglowki });
  if (r.ok) usuniete++; else { bledy++; console.error("  BŁĄD usunięcia", x.p.id, r.status); }
}
console.log(`\nGotowe: przeniesiono ${ok}, przepisano dorobek na oryginały ${przepisane}, usunięto kopii ${usuniete}, błędów ${bledy}.`);
