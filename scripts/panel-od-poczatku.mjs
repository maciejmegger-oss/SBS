// Panel zakładki widoczny OD PIERWSZEJ SEKUNDY, a nie dopiero na końcu pracy.
//
// PO CO: przycisk „Skopiuj opis strony" pojawiał się dopiero w panelu końcowym, a zbieracz do
// końca nie dochodził — więc dokładnie wtedy, gdy był najbardziej potrzebny, nie dało się go
// kliknąć. Ten sam problem dotyczył „Wyślij do SBS": przy zacięciu nie było czego wysłać ani
// czym przerwać.
//
// Rozdzielamy więc panel na dwie części: linijkę z postępem (nadpisywaną w kółko) i stopkę
// z przyciskami, która stoi od początku i nie znika przy każdej zmianie tekstu. Dotąd każde
// `box.textContent = ...` kasowało zawartość całego pudełka razem z przyciskami.
import fs from "node:fs";

const p = "public/zakladka-lnp-v2.js";
let t = fs.readFileSync(p, "utf8");

const stare = `var box=document.createElement('div');
box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#16302A;color:#F6F3EA;padding:12px 16px;border-radius:8px;font:14px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4)';
box.textContent='SBS '+SBS_ZBIERACZ+': zaczynam...';
(document.body||document.documentElement).appendChild(box);`;

const nowe = `var box=document.createElement('div');
box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#16302A;color:#F6F3EA;padding:12px 16px;border-radius:8px;font:14px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);max-width:340px';
// Linijka postepu i stopka z przyciskami sa OSOBNE. Dzieki temu nadpisywanie tekstu postepu
// nie kasuje przyciskow — dotad kazde box.textContent=... zmiatalo je razem z trescia.
var linia=document.createElement('div');
linia.style.cssText='line-height:1.45';
linia.textContent='SBS '+SBS_ZBIERACZ+': zaczynam...';
box.appendChild(linia);
var stopka=document.createElement('div');
stopka.style.cssText='margin-top:10px;padding-top:8px;border-top:1px solid rgba(246,243,234,.2)';
box.appendChild(stopka);
(document.body||document.documentElement).appendChild(box);`;

if (t.indexOf(stare) < 0) { console.error("Nie znalazłem tworzenia panelu."); process.exit(1); }
t = t.replace(stare, nowe);

// Postęp pisze do linijki, nie do całego pudełka. Miejsca, które CZYSZCZĄ pudełko przed
// zbudowaniem panelu końcowego, zostają bez zmian — one budują nową zawartość od zera.
const przed = (t.match(/box\.textContent=/g) || []).length;
t = t.replace(/box\.textContent\s*=\s*'SBS '/g, "linia.textContent='SBS '");
t = t.replace(/box\.textContent\s*=\s*'SBS'/g, "linia.textContent='SBS'");
const po = (t.match(/box\.textContent=/g) || []).length;

fs.writeFileSync(p, t, "utf8");
console.log(`Panel rozdzielony. Zapisów postępu przeniesionych do linijki: ${przed - po}, pozostało czyszczeń pudełka: ${po}.`);
