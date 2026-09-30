// Sprawdza profil kompetencji przeniesiony z arkusza klubowego („Nazwisko-U19.xlsx") oraz podział
// elementów na profile pozycyjne.
//
// Zgłoszenie (01.10.2026): „czy możemy stworzyć taką ocenę profilu w systemie? ja bym takie aspekty
// w profilu podzielił na dane pozycje jakie cechy posiada". Taksonomia musi odpowiadać arkuszowi
// (48 elementów, 141 składowych, skala 1–6, drabina notowania), a listy pozycyjne nie mogą zawierać
// nazw, których w taksonomii nie ma — literówka cicho wypisałaby zawodnikowi puste wymaganie.
//
// Uruchomienie:  node scripts/test-profil-kompetencji.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: {
    contents: `export { OBSZARY_PROFILU, LEGENDA_OCENY, DRABINA_NOTOWANIA, ILE_ELEMENTOW, ILE_SKLADOWYCH } from './src/data/profil-kompetencji.ts';
               export { PROFILE_POZYCJI, profilDlaNumeru, profilPoKodzie, kluczowyNaPozycji, wszystkieElementy } from './src/data/profil-pozycje.ts';`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "esm", write: false,
});
const M = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

console.log("\n1. Taksonomia z arkusza");
sprawdz("plik generowany, nie pisany ręcznie", /NIE POPRAWIAJ RĘCZNIE/.test(fs.readFileSync("src/data/profil-kompetencji.ts", "utf8")));
sprawdz("skrypt przenoszący arkusz jest w repozytorium", fs.existsSync("scripts/wczytaj-profil-lechia.mjs"));
sprawdz("pięć obszarów w kolejności z arkusza",
  M.OBSZARY_PROFILU.map((o) => o.nazwa).join(" | ") ===
  "Koncepty — ofensywa | Koncepty — defensywa | Umiejętności techniczne | Umiejętności mentalne | Atrybuty fizyczne",
  M.OBSZARY_PROFILU.map((o) => o.nazwa).join(" | "));
sprawdz(`48 elementów (jest ${M.ILE_ELEMENTOW})`, M.ILE_ELEMENTOW === 48, String(M.ILE_ELEMENTOW));
sprawdz(`141 składowych (jest ${M.ILE_SKLADOWYCH})`, M.ILE_SKLADOWYCH === 141, String(M.ILE_SKLADOWYCH));
sprawdz("skala 1–6 z opisem każdego stopnia", M.LEGENDA_OCENY.length === 6
  && M.LEGENDA_OCENY[0].stopien === 6 && /MIĘDZYNARODOWY/.test(M.LEGENDA_OCENY[0].opis));
sprawdz("drabina notowania od U12 w górę", M.DRABINA_NOTOWANIA.length >= 20
  && M.DRABINA_NOTOWANIA[M.DRABINA_NOTOWANIA.length - 1].stopien === 1
  && /U12/.test(M.DRABINA_NOTOWANIA[M.DRABINA_NOTOWANIA.length - 1].opis),
  JSON.stringify(M.DRABINA_NOTOWANIA[M.DRABINA_NOTOWANIA.length - 1]));
sprawdz("testy motoryczne oznaczone osobno (Z-SCORE, nie ocena 1–6)",
  M.OBSZARY_PROFILU.find((o) => o.nazwa === "Atrybuty fizyczne").elementy.some((e) => e.testy));
sprawdz("elementy obligatoryjne mentalne bez oceny, ale wypisane",
  (M.OBSZARY_PROFILU.find((o) => o.nazwa === "Umiejętności mentalne").obligatoryjne || []).includes("PRACOWITOŚĆ"));

console.log("\n2. Podział na pozycje — to, o co prosiłeś");
sprawdz("dziesięć profili pozycyjnych jak w arkuszu klubowym", M.PROFILE_POZYCJI.length === 10, String(M.PROFILE_POZYCJI.length));
{
  const znane = new Set(M.wszystkieElementy());
  const literowki = [];
  for (const p of M.PROFILE_POZYCJI) for (const e of p.kluczowe) if (!znane.has(e)) literowki.push(`${p.kod}: ${e}`);
  sprawdz("każdy element kluczowy istnieje w taksonomii", !literowki.length, literowki.join(" | "));
  sprawdz("każdy profil ma co najmniej 9 elementów kluczowych",
    M.PROFILE_POZYCJI.every((p) => p.kluczowe.length >= 9),
    M.PROFILE_POZYCJI.filter((p) => p.kluczowe.length < 9).map((p) => p.kod).join(", "));
  sprawdz("profile różnią się od siebie — to nie jedna lista skopiowana dziesięć razy",
    new Set(M.PROFILE_POZYCJI.map((p) => p.kluczowe.join("|"))).size === 10);
}
sprawdz("stoper: powstrzymanie i gra głową kluczowe, finalizacja nie",
  M.kluczowyNaPozycji("POWSTRZYMANIE", M.profilDlaNumeru(4)) && M.kluczowyNaPozycji("GRA GŁOWĄ", M.profilDlaNumeru(5))
  && !M.kluczowyNaPozycji("FINALIZACJA", M.profilDlaNumeru(4)));
sprawdz("napastnik: finalizacja kluczowa, asekuracja defensywna nie",
  M.kluczowyNaPozycji("FINALIZACJA", M.profilDlaNumeru(9))
  && !M.kluczowyNaPozycji("ASEKURACJA DEFENSYWNA", M.profilDlaNumeru(9)));
sprawdz("skrzydło lewe i prawe mają ten sam profil", M.profilDlaNumeru(7).kod === M.profilDlaNumeru(11).kod);
sprawdz("numer z kartoteki trafia w profil pozycyjny (1-11 bez luk)",
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every((n) => M.profilDlaNumeru(n)),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((n) => !M.profilDlaNumeru(n)).join(", "));
sprawdz("bez numeru nie zgadujemy profilu", M.profilDlaNumeru(0) === null && M.profilDlaNumeru(null) === null);

console.log("\n3. Skrót z arkusza klubowego");
sprawdz('„DCM (6)" z arkusza rozpoznany', (M.profilPoKodzie("DCM (6)") || {}).numery?.[0] === 6);
sprawdz('„CB (4/5)" rozpoznany', (M.profilPoKodzie("CB (4/5)") || {}).nazwa === "Stoper");
sprawdz('skrót bez numeru też („DCM")', (M.profilPoKodzie("DCM") || {}).kod === "DCM (6)");
sprawdz("nieznany skrót zwraca nic, nie pierwszy z listy", M.profilPoKodzie("XYZ") === null);

console.log("\n4. Bramkarz — mówimy wprost, czego arkusz nie ma");
{
  const gk = M.profilDlaNumeru(1);
  sprawdz("profil bramkarza oznaczony jako niepełny", !!gk.brakWArkuszu, JSON.stringify(gk.brakWArkuszu));
  sprawdz("napisane, których elementów brakuje", /gra na linii|wyjścia/i.test(gk.brakWArkuszu));
  sprawdz("pozostałe profile nie mają takiej adnotacji",
    M.PROFILE_POZYCJI.filter((p) => p.brakWArkuszu).length === 1);
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
