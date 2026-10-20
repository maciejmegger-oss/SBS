// Trzy zgłoszenia z 20.10.2026, wszystkie o to samo: żeby z listy dało się coś ROZSTRZYGNĄĆ
// bez wchodzenia w profil.
//
//  1. „zrób w tych listach zakładkę agent i informacje, czy zawodnik ma agenta" — skład klubu
//     pokazywał statystyki, ale nie to, czy ktoś już go reprezentuje. Dla agencji to pierwsza
//     informacja, nie ostatnia.
//  2. „zmień monitoring młodzieżowców, aby było widać, czego dotyczy monitoring" — znacznik mówił
//     tylko TAK/NIE, a obserwacja, testy, transfer i polecenie to cztery różne sprawy.
//  3. „jeśli klub gra np. 1-3-4-3, to każdy zawodnik tego klubu powinien mieć w profilu taki
//     system" — system stał przy klubie, profil dziedziczył go w locie, a pole zostawało puste.
//
// Uruchomienie:  node scripts/test-agent-monitoring-systemy.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const schemat = fs.readFileSync("supabase/schema.sql", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Agent w składzie klubu");
sprawdz("kolumna Agent stoi w nagłówku, zaraz za Statusem",
  /<th>Status<\/th><th style="text-align:center;" title="Czy zawodnik ma menedżera[^"]*">Agent<\/th>/.test(zrodlo));
sprawdz("w wierszu ten sam przełącznik, co na liście Zawodników",
  /<td onclick="event\.stopPropagation\(\)" style="text-align:center;">\$\{agentToggleHtml\(p\)\}<\/td>\s*\n\s*<td style="text-align:right;">\$\{p\.matches/.test(zrodlo));
sprawdz("klik w komórkę nie otwiera profilu — wiersz jest klikalny, komórka nie",
  (zrodlo.match(/<td onclick="event\.stopPropagation\(\)" style="text-align:center;">\$\{agentToggleHtml\(p\)\}<\/td>/g) || []).length >= 1);
sprawdz("pusty skład rozciąga się na nową liczbę kolumn",
  /<tr><td colspan="12"><div class="empty">Jeszcze nikogo tu nie scoutujecie/.test(zrodlo));
sprawdz("nigdzie nie został stary colspan składu",
  !/<tr><td colspan="11"><div class="empty">Jeszcze nikogo tu nie scoutujecie/.test(zrodlo));

console.log("\n2. Czego dotyczy monitoring");
sprawdz("jest osobna funkcja od etykiety, a nie warunek wklejony w wiersz",
  /function etykietaMonitoringu\(p\)\{/.test(zrodlo));
sprawdz("powód bierzemy ze statusu monitoringowego, nie z dowolnego pola",
  /const powod = MONITORING_STATUSES\.includes\(p\.status\) \? String\(p\.status\) : '';/.test(zrodlo));
sprawdz("brak powodu nazwany wprost, a nie udawany czwartym rodzajem",
  /✓ Monitoring · bez powodu/.test(zrodlo));
sprawdz("podpowiedź mówi, gdzie ten powód wpisać",
  /Ustaw status w profilu zawodnika/.test(zrodlo));
sprawdz("skaner młodzieżowców korzysta z etykiety",
  /const mon = etykietaMonitoringu\(w\.p\);/.test(zrodlo)
  && /title="\$\{esc\(mon\.tytul\)\}"[^`]*\$\{esc\(mon\.tekst\)\}<\/button>/.test(zrodlo));
sprawdz("stary napis bez powodu zniknął ze skanera",
  !/\$\{wMonitoringu\?'✓ W monitoringu':'\+ Monitoring'\}/.test(zrodlo));
sprawdz("przełączenie monitoringu zapisuje JEDEN wiersz, nie całą kartotekę",
  /savePlayersSome\(\[pl\]\);\s+\/\/ jeden wiersz do bazy, nie cała kartoteka/.test(zrodlo));

// Zachowanie etykiety sprawdzamy na kopii logiki — chodzi o to, że trzy stany są naprawdę trzy.
{
  const STATUSY = ['Do Obserwacji','Na Testy','Do transferu','Z polecenia'];
  const etykieta = (p)=>{
    if(!p || !p.monitored) return '+ Monitoring';
    const powod = STATUSY.includes(p.status) ? String(p.status) : '';
    return powod ? '✓ '+powod : '✓ Monitoring · bez powodu';
  };
  sprawdz("poza monitoringiem — zaproszenie, nie powód", etykieta({monitored:false, status:'Na Testy'}) === '+ Monitoring');
  sprawdz("w monitoringu ze statusem — widać, czego dotyczy", etykieta({monitored:true, status:'Na Testy'}) === '✓ Na Testy');
  sprawdz("w monitoringu bez statusu — powiedziane wprost", etykieta({monitored:true, status:''}) === '✓ Monitoring · bez powodu');
  sprawdz("status spoza monitoringu nie udaje powodu",
    etykieta({monitored:true, status:'Odrzucony'}) === '✓ Monitoring · bez powodu');
}

console.log("\n3. System klubu wpisany do profili");
sprawdz("jest przycisk, a nie tylko podstawianie w formularzu",
  /data-action="systemy-do-profili"/.test(zrodlo)
  && /main\.querySelectorAll\('\[data-action="systemy-do-profili"\]'\)/.test(zrodlo));
sprawdz("akcja zamknięta przed panelem klienta",
  /'systemy-gry','systemy-do-profili','pozycje-z-tm'/.test(zrodlo));
sprawdz("liczymy na sucho przed pytaniem, zapisujemy po potwierdzeniu",
  zrodlo.indexOf("const plan = [];") < zrodlo.indexOf("if(!confirm('Wpisać system gry klubu")
  && zrodlo.indexOf("if(!confirm('Wpisać system gry klubu") < zrodlo.indexOf("plan.forEach(({p, system})=>{ p.formation = system; });"));
sprawdz("bierzemy tylko kluby z ustawionym systemem",
  /const kluby = DB\.clubs\.filter\(c=>String\(systemyKlubow\[c\.id\] \|\| ''\)\.trim\(\)\);/.test(zrodlo));
sprawdz("do zapisu idą wyłącznie zawodnicy z inną wartością",
  /\.filter\(p=> String\(p\.formation \|\| ''\) !== system\)/.test(zrodlo));
sprawdz("zapisujemy dotkniętych, nie całą kartotekę",
  /await savePlayersSome\(plan\.map\(x=>x\.p\)\);/.test(zrodlo));
sprawdz("okno mówi wprost, że nadpisuje wpis w profilu",
  /Wpis w profilu zostanie NADPISANY systemem klubu/.test(zrodlo));
sprawdz("klub bez systemu kończy się komunikatem, nie pustym przebiegiem",
  /Żaden klub nie ma jeszcze wpisanego systemu gry/.test(zrodlo));
sprawdz("nic do zrobienia też jest powiedziane",
  /Nie ma czego uzupełniać/.test(zrodlo));

console.log("\n4. Zapis systemu naprawdę dochodzi do bazy");
// To jest sedno: gdyby `formation` nie było kolumną ani polem własnym, cały przycisk byłby
// teatrem — wpis znikałby przy pierwszym przeładowaniu strony.
sprawdz("sbs_players ma kolumnę formation", /^\s*formation text,$/m.test(schemat));
sprawdz("system klubu nadal ma pierwszeństwo przed wpisem zawodnika",
  /return String\(systemyKlubow\[p\.clubId\] \|\| ''\) \|\| String\(p\.formation \|\| ''\);/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
