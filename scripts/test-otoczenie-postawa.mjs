// „Otoczenie i postawa" — sekcja raportu o tym, czego nie widać w protokole.
//
// Zgłoszenie (10.10.2026): „załączyłem link do profilu FB, nie widzę oceny z mediów
// społecznościowych (...) ocena żeby była o jego życiu charakterze funkcjonowaniu".
//
// Klub tego potrzebuje, ale nie w formie wyroku wyciągniętego przez maszynę z czyjegoś profilu.
// W kartotece SBS są tysiące niepełnoletnich, a opinia AI ma wprost zapisane, że kont
// w mediach społecznościowych ani życia prywatnego nie rusza. Ten test pilnuje, żeby tak
// zostało, i żeby sekcja wypełniana przez człowieka zawsze niosła ze sobą źródło.
//
// Uruchomienie:  node scripts/test-otoczenie-postawa.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8").split(String.fromCharCode(13)).join("");
const opinia = fs.readFileSync("api/opinia-ai.js", "utf8").split(String.fromCharCode(13)).join("");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Pola w formularzu raportu");
for (const [id, co] of [
  ["rep-otoczenie", "środowisko i wsparcie"],
  ["rep-postawa", "podejście do zawodu"],
  ["rep-stabilnosc", "sytuacja i funkcjonowanie"],
  ["rep-zrodlo-otoczenia", "źródło informacji"],
]) {
  sprawdz(`jest pole ${co}`, new RegExp(`id="${id}"`).test(zrodlo));
}
sprawdz("źródło to lista, nie dowolny tekst — żeby dało się po nim filtrować",
  /<select id="rep-zrodlo-otoczenia">/.test(zrodlo));
sprawdz("wśród źródeł jest rozmowa z trenerem i obserwacja na miejscu",
  /Rozmowa z trenerem/.test(zrodlo) && /Obserwacja na miejscu/.test(zrodlo));

console.log("\n2. Zapis raportu");
for (const pole of ["otoczenie", "postawa", "stabilnosc", "zrodloOtoczenia"]) {
  sprawdz(`${pole} trafia do raportu`, new RegExp(`${pole}: \\(document\\.getElementById`).test(zrodlo));
}

console.log("\n3. Co wolno, a czego nie wolno tam wpisywać");
sprawdz("formularz wymienia dane wrażliwe, których nie wolno zapisywać",
  /wyznania, poglądów politycznych, zdrowia, pochodzenia ani życia uczuciowego/.test(zrodlo));
sprawdz("przy niepełnoletnim pojawia się osobne ostrzeżenie",
  /To zawodnik niepełnoletni/.test(zrodlo));
sprawdz("ostrzeżenie opiera się na policzonym wieku, nie na deklaracji",
  /function wybranyZawodnikNiepelnoletni\(\)\{[\s\S]*?wiekZawodnika\(p\)[\s\S]*?w < 18/.test(zrodlo));

console.log("\n4. Źródło idzie razem z treścią");
sprawdz("profil pokazuje, skąd skaut to wie",
  /Otoczenie — źródło: \$\{esc\(r\.zrodloOtoczenia\|\|'nie wskazano'\)\}/.test(zrodlo));
sprawdz("w wydruku też, razem z zastrzeżeniem o mediach społecznościowych",
  /Ocena skauta, nie odczyt z mediów społecznościowych/.test(zrodlo));
sprawdz("brak wskazanego źródła jest nazwany wprost, nie przemilczany",
  /skaut nie wskazał źródła/.test(zrodlo));
sprawdz("trzy pola trafiają do wydruku",
  /\['Środowisko i wsparcie', latestReport\.otoczenie\]/.test(zrodlo)
  && /\['Podejście do zawodu', latestReport\.postawa\]/.test(zrodlo)
  && /\['Sytuacja i funkcjonowanie', latestReport\.stabilnosc\]/.test(zrodlo));

console.log("\n5. Opinia AI nadal nie rusza mediów społecznościowych");
sprawdz("reguła dla modelu jest na miejscu",
  /NIE analizujesz kont w mediach społecznościowych/.test(opinia));
sprawdz("powód podany wprost — niepełnoletni w bazie",
  /osoby niepełnoletnie/.test(opinia));
sprawdz("model korzysta wyłącznie ze źródeł piłkarskich",
  /Korzystasz wyłącznie z publicznych źródeł\s*\n?\s*piłkarskich/.test(opinia)
  || /wyłącznie z publicznych źródeł/.test(opinia));
sprawdz("mentalności nie wolno oceniać zdalnie — tylko poszlaki",
  /Ocen[ay] mentalności nie da się postawić zdalnie/.test(opinia));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
