// Podmiana zbierzAdresyZWierszy na przejdzPoMeczach — zapis w pliku, bo w powłoce
// wyrażenia regularne i szablony rozjeżdżały się przy podstawianiu.
import fs from "node:fs";

const p = "public/zakladka-lnp-v2.js";
const linie = fs.readFileSync(p, "utf8").split(/\r?\n/);

const od = linie.findIndex((l) => l.startsWith("function zbierzAdresyZWierszy(gotowe){"));
if (od < 0) { console.error("Nie znalazłem zbierzAdresyZWierszy."); process.exit(1); }
let doIdx = -1;
for (let i = od + 1; i < linie.length; i++) if (linie[i] === "}") { doIdx = i; break; }
if (doIdx < 0) { console.error("Nie znalazłem końca funkcji."); process.exit(1); }

const nowa = `// PRZECHODZIMY PO MECZACH TAK, JAK ZROBILBY TO CZLOWIEK: otworz, przepisz, wroc, nastepny.
//
// Wszystkie sprytniejsze drogi zawiodly, kazda inaczej. Odczyt adresu z danych Angulara nic nie
// zwracal. Klikniecie w wiersz NAPRAWDE przenosilo strone na mecz — a poniewaz przywracalismy
// potem sam adres w pasku, zabezpieczenie przed tym nie mialo jak zadzialac: adres wygladal na
// liste, widok byl meczem, i zbieracz do konca klikal w wiersze odlaczone od dokumentu.
//
// Skoro klikniecie i tak otwiera mecz, nie walczymy z tym. Otwieramy mecz, przepisujemy protokol
// PROSTO ZE STRONY (bez ramki — jestesmy juz na niej), wracamy przez historie i bierzemy nastepny
// wiersz. Wolniej, ale kazdy krok jest sprawdzalny i nic nie zalezy od zgadywania.
function przejdzPoMeczach(gotowe){
 var wiersze = wierszeRozegrane();
 if(!wiersze.length){ gotowe(); return; }
 var bazowy = location.href;
 var k = 0, zebranychTu = 0;

 function koncz(){ gotowe(); }

 // Protokol czytamy z biezacej strony meczu — dokladnie tak samo, jak przy pojedynczym meczu.
 function przepiszProtokol(){
  var txt = document.body.innerText || '';
  if(!/Skład wyjściowy/.test(txt)) return false;
  var url = location.href.split('?')[0];
  var j = txt.search(/^\\s*Składy\\s*$/m);
  var wpis = '### PROTOKOL: ' + url + '\\n' + txt.slice(j < 0 ? 0 : Math.max(0, j - 400)) + zdarzenia(document);
  for(var q = 0; q < zebrane.length; q++){
   if(zebrane[q].indexOf('### PROTOKOL: ' + url + '\\n') === 0){ zebrane[q] = wpis; return true; }
  }
  zebrane.push(wpis);
  try{ localStorage.setItem(KLUCZ, JSON.stringify(zebrane)); }catch(e){}
  zebranychTu++;
  return true;
 }

 // Czekamy, az strona meczu sie wyswietli. LNP potrafi oddac 404 — wtedy wracamy i idziemy dalej,
 // bo mecz i tak zostanie policzony jako nieodczytany, a cala kolejka nie moze przez to stanac.
 function czekajNaMecz(){
  var prob = 0;
  var t = setInterval(function(){
   prob++;
   var txt = document.body.innerText || '';
   if(/Skład wyjściowy/.test(txt)){ clearInterval(t); przepiszProtokol(); wroc(); return; }
   if(/Ups! Piłka za boiskiem/.test(txt) || prob > 24){ clearInterval(t); nieudanych++; wroc(); return; }
   box.textContent = 'SBS ' + SBS_ZBIERACZ + ': mecz ' + (k+1) + '/' + wiersze.length + ' - czekam na sklad (' + prob + ')';
  }, 500);
 }

 function wroc(){
  try{ history.back(); }catch(e){}
  var prob = 0;
  var t = setInterval(function(){
   prob++;
   if(location.pathname.indexOf('/mecz/') < 0){
    clearInterval(t);
    // Po powrocie lista jest renderowana od nowa — stare elementy sa juz odlaczone.
    setTimeout(function(){
     wiersze = wierszeRozegrane();
     k++;
     dalej();
    }, 700);
    return;
   }
   if(prob > 30){ clearInterval(t); koncz(); }
  }, 300);
 }

 function dalej(){
  if(k >= wiersze.length || zaDlugo()){ koncz(); return; }
  box.textContent = 'SBS ' + SBS_ZBIERACZ + ': mecz ' + (k+1) + '/' + wiersze.length + ' (zebranych ' + zebranychTu + ')';
  var el = wiersze[k];
  if(!el || !el.isConnected){ k++; setTimeout(dalej, 80); return; }
  // Klikamy w wiersz i w jego wnetrze — az strona przejdzie na mecz.
  var cele = [el];
  try{
   var srodek = [].slice.call(el.querySelectorAll('*')).filter(function(x){
    return x.children.length === 0 && (x.textContent||'').trim().length > 1;
   });
   for(var s = 0; s < srodek.length && cele.length < 10; s++) cele.push(srodek[s]);
  }catch(e){}
  var ci = 0;
  function klik(){
   if(location.pathname.indexOf('/mecz/') >= 0){ czekajNaMecz(); return; }
   if(ci >= cele.length){ k++; setTimeout(dalej, 80); return; }   // ten wiersz sie nie otwiera
   try{ cele[ci].click(); }catch(e){}
   ci++;
   setTimeout(klik, 260);
  }
  klik();
 }
 dalej();
}`;

const wynik = linie.slice(0, od).concat(nowa.split("\n"), linie.slice(doIdx + 1));
fs.writeFileSync(p, wynik.join("\n"));
console.log(`Podmieniono: usunięto ${doIdx - od + 1} linii, wstawiono ${nowa.split("\n").length}.`);
