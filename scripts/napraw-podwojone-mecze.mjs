// Jednorazowa naprawa dorobku podwojonego przez niestabilny klucz protokołu.
//
// CO SIĘ STAŁO: tożsamość meczu wyliczaliśmy z treści wklejki. Ta sama kolejka zebrana drugi raz
// dawała inny klucz (raz z datą, raz bez, raz z datą ze stopki strony), więc zabezpieczenie przed
// podwójnym liczeniem nie działało i mecze doliczały się po dwa–trzy razy. Zawodnicy Arki II mieli
// po 6–7 spotkań przy czterech rozegranych w lidze.
//
// JAK NAPRAWIAMY: w sezonie każda para gra ze sobą dokładnie dwa razy — raz u siebie, raz na
// wyjeździe. Więc para (rywal, czy u siebie) jednoznacznie wskazuje mecz. Zostawiamy po jednym
// wpisie z każdej takiej pary i przeliczamy mecze, minuty i kartki od nowa.
//
// Uruchomienie bez argumentów tylko pokazuje, co by się zmieniło. Zapis wymaga słowa „zapisz".
import fs from "node:fs";

const BAZA = process.env.SBS_URL;
const KLUCZ = process.env.SBS_KEY;
const ZAPISZ = process.argv.includes("zapisz");

if (!BAZA || !KLUCZ) {
  console.error("Ustaw SBS_URL i SBS_KEY w środowisku.");
  process.exit(1);
}

const naglowki = { apikey: KLUCZ, Authorization: "Bearer " + KLUCZ, "Content-Type": "application/json" };

async function wszyscyZawodnicy() {
  const out = [];
  for (let od = 0; ; od += 1000) {
    const r = await fetch(
      `${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,club_id,matches,minutes,goals,custom_fields&limit=1000&offset=${od}`,
      { headers: naglowki }
    );
    const cz = await r.json();
    if (!Array.isArray(cz)) throw new Error("Baza odpowiedziała: " + JSON.stringify(cz).slice(0, 200));
    out.push(...cz);
    if (cz.length < 1000) break;
  }
  return out;
}

// Mecz rozpoznajemy po rywalu i tym, czy graliśmy u siebie. W jednym sezonie ta para występuje raz.
const kluczSpotkania = (x) => `${String(x.rywal || "").toLowerCase().trim()}|${x.dom ? "d" : "w"}`;

const kluby = await (await fetch(`${BAZA}/rest/v1/sbs_clubs?select=id,name&limit=3000`, { headers: naglowki })).json();
const nazwaKlubu = new Map(kluby.map((c) => [c.id, c.name]));

const zawodnicy = await wszyscyZawodnicy();
console.log(`Wczytano ${zawodnicy.length} zawodników.\n`);

const doNaprawy = [];
for (const p of zawodnicy) {
  const ext = (p.custom_fields || {}).__ext || {};
  const przebieg = Array.isArray(ext.przebieg) ? ext.przebieg : [];
  if (przebieg.length < 2) continue;

  // RUSZAMY WYŁĄCZNIE WPISY Z PROTOKOŁÓW ŁNP. Mecze pobrane z 90minut mają w kluczu numer
  // spotkania z tamtego serwisu — jest stabilny, nigdy się nie dublował i dotyczy zwykle
  // POPRZEDNIEGO sezonu w innej lidze. Gdyby wpaść z deduplikacją i na nie, ten sam rywal
  // spotkany raz w III, raz w IV lidze zlałby się w jeden mecz.
  const zProtokolu = przebieg.filter((x) => /^lnp/.test(String(x.mecz || "")));
  const pozostale = przebieg.filter((x) => !/^lnp/.test(String(x.mecz || "")));
  if (zProtokolu.length < 2) continue;

  const wgSpotkania = new Map();
  for (const x of zProtokolu) {
    const k = kluczSpotkania(x);
    // Zostawiamy wpis z największą liczbą minut — kopie bywają ucięte, oryginał nie.
    const stary = wgSpotkania.get(k);
    if (!stary || (x.minuty || 0) > (stary.minuty || 0)) wgSpotkania.set(k, x);
  }
  if (wgSpotkania.size === zProtokolu.length) continue; // nic się nie powtarza

  const czysty = [...pozostale, ...wgSpotkania.values()];
  const noweMecze = czysty.length;
  const noweMinuty = czysty.reduce((s, x) => s + (x.minuty || 0), 0);
  const noweZolte = czysty.reduce((s, x) => s + (x.zolte || 0), 0);
  const noweCzerwone = czysty.reduce((s, x) => s + (x.czerwone || 0), 0);
  const krotnosc = przebieg.length / noweMecze;

  doNaprawy.push({
    p, ext, czysty,
    klub: nazwaKlubu.get(p.club_id) || "(bez klubu)",
    przed: { mecze: p.matches || 0, minuty: p.minutes || 0, gole: p.goals || 0 },
    po: { mecze: noweMecze, minuty: noweMinuty, zolte: noweZolte, czerwone: noweCzerwone },
    krotnosc,
  });
}

console.log(`Do naprawy: ${doNaprawy.length} zawodników.\n`);

const wgKlubu = new Map();
for (const d of doNaprawy) wgKlubu.set(d.klub, (wgKlubu.get(d.klub) || 0) + 1);
console.log("Kluby, których to dotyczy:");
[...wgKlubu.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(3)} × ${k}`));

console.log("\nPrzykłady:");
doNaprawy.slice(0, 15).forEach((d) => {
  console.log(
    `  ${(d.p.last_name + " " + d.p.first_name).padEnd(28)} ${d.przed.mecze} m / ${d.przed.minuty} min` +
    `  →  ${d.po.mecze} m / ${d.po.minuty} min   (${d.klub})`
  );
});

const zGolami = doNaprawy.filter((d) => d.przed.gole > 0);
console.log(`\nZ bramkami (gole liczone są poza przebiegiem, więc wymagają osobnej decyzji): ${zGolami.length}`);
zGolami.slice(0, 10).forEach((d) =>
  console.log(`  ${d.p.last_name} ${d.p.first_name}: ${d.przed.gole} goli, krotność ${d.krotnosc.toFixed(2)}`)
);

if (!ZAPISZ) {
  fs.writeFileSync("scripts/.podglad-naprawy.json", JSON.stringify(doNaprawy.map((d) => ({
    id: d.p.id, kto: `${d.p.last_name} ${d.p.first_name}`, klub: d.klub, przed: d.przed, po: d.po,
  })), null, 1));
  console.log("\nTo był PODGLĄD — nic nie zapisano. Szczegóły: scripts/.podglad-naprawy.json");
  console.log("Aby zapisać: node scripts/napraw-podwojone-mecze.mjs zapisz");
  process.exit(0);
}

// --- ZAPIS ---
let ok = 0, bledy = 0;
for (let i = 0; i < doNaprawy.length; i += 8) {
  const paczka = doNaprawy.slice(i, i + 8);
  await Promise.all(paczka.map(async (d) => {
    const ext = { ...d.ext, przebieg: d.czysty, rozliczoneMecze: d.czysty.map((x) => x.mecz).filter(Boolean) };
    if (d.po.zolte || ext.yellowCards !== undefined) ext.yellowCards = d.po.zolte;
    if (d.po.czerwone || ext.redCards !== undefined) ext.redCards = d.po.czerwone;
    const cf = { ...(d.p.custom_fields || {}), __ext: ext };
    const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(d.p.id)}`, {
      method: "PATCH",
      headers: { ...naglowki, Prefer: "return=minimal" },
      body: JSON.stringify({ matches: d.po.mecze, minutes: d.po.minuty, custom_fields: cf }),
    });
    if (r.ok) ok++; else { bledy++; console.error("  BŁĄD", d.p.id, r.status, (await r.text()).slice(0, 120)); }
  }));
  process.stdout.write(`\r  zapisano ${ok}/${doNaprawy.length}`);
}
console.log(`\n\nGotowe: poprawiono ${ok}, błędów ${bledy}.`);
