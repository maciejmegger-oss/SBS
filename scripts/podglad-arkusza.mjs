// PODGLĄD DOWOLNEGO ARKUSZA — co naprawdę jest w pliku, zanim napiszę import.
//
// Arkusze przychodzą z klubów w różnych kształtach: scalone komórki, nagłówki w środku tabeli,
// oceny w kolorach. Ten skrypt wypisuje treść po wierszach, żeby nie zgadywać struktury.
//
// Uruchomienie:  node scripts/podglad-arkusza.mjs "F:\\ścieżka\\plik.xlsx" [ile wierszy]
import fs from "node:fs";
import * as XLSX from "xlsx";

const plik = process.argv[2];
const ile = Number(process.argv[3]) || 120;
if (!plik || !fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(1); }

const wb = XLSX.read(fs.readFileSync(plik), { type: "buffer" });
console.log("ARKUSZE:", wb.SheetNames.join(" | "));
for (const nazwa of wb.SheetNames) {
  const ws = wb.Sheets[nazwa];
  const wiersze = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  console.log(`\n===== ${nazwa}  zakres ${ws['!ref'] || '(pusty)'}  wierszy ${wiersze.length} =====`);
  wiersze.slice(0, ile).forEach((w, i) => {
    const komorki = w.map((c) => String(c).replace(/\s+/g, " ").trim()).filter((c) => c !== "");
    if (komorki.length) console.log(`${String(i + 1).padStart(3)} | ${komorki.join(" ¦ ").slice(0, 320)}`);
  });
  if (wiersze.length > ile) console.log(`   … jeszcze ${wiersze.length - ile} wierszy`);
}
