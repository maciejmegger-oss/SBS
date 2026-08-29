// Dodaje do panelu zakładki przycisk „Skopiuj opis strony".
//
// PO CO: zbieranie całej kolejki nie działa, a ja nie mogę tego odtworzyć u siebie — ŁNP przy
// każdej mojej próbie oddaje 404 na stronie grupy. Poprawiałem więc na ślepo i za każdym razem
// obok. Konsola przeglądarki byłaby drogą do zdobycia brakujących danych, ale Firefox blokuje
// wklejanie do niej i wymaga wpisywania hasła, co okazało się kolejną przeszkodą.
//
// Przycisk robi to samo bez konsoli: opisuje budowę wiersza meczu i kopiuje opis do schowka.
// Czyta wyłącznie stronę, którą użytkownik ma otwartą — niczego nie klika ani nie wysyła.
import fs from "node:fs";

const p = "public/zakladka-lnp-v2.js";
let t = fs.readFileSync(p, "utf8");

const kotwica = " var wyczysc=document.createElement('button');";
if (t.indexOf(kotwica) < 0) { console.error("Nie znalazłem miejsca w panelu."); process.exit(1); }

const dodatek = ` // OPIS STRONY DO SCHOWKA — zeby dalo sie naprawic zbieranie bez zgadywania.
 //
 // Zbieracz widzi wiersze meczow (liczy je poprawnie), ale nie potrafi wyciagnac z nich adresow.
 // Zeby to naprawic, trzeba wiedziec, jak te wiersze sa zbudowane na ZYWEJ stronie — a tego nie
 // da sie sprawdzic zdalnie. Ten przycisk zbiera taki opis i kopiuje do schowka.
 var opisz=document.createElement('button');
 opisz.textContent='Skopiuj opis strony (dla SBS)';
 opisz.style.cssText='display:block;width:100%;padding:6px;margin-bottom:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
 opisz.onclick=function(){
  var dane={};
  try{
   dane.adres = location.pathname + location.search.slice(0,120);
   dane.linkiDoMeczow = document.querySelectorAll('a[href*="/mecz/"]').length;
   dane.idWKodzie = (document.documentElement.innerHTML.match(/mecz\\/[0-9a-f-]{30,40}/gi)||[]).length;
   dane.slowoRozegrany = ((document.body.innerText||'').match(/Rozegrany/g)||[]).length;
   dane.wierszyZWynikiem = wierszeRozegrane().length;
   // Bierzemy element z samym wynikiem (np. "3:0") i wychodzimy w gore po rodzicach — tam siedzi
   // caly wiersz. Jego budowa mowi, czego szukac, zeby wyciagnac adres meczu.
   var wyniki=[].slice.call(document.querySelectorAll('*')).filter(function(e){
    return e.children.length===0 && /^\\d{1,2}\\s*:\\s*\\d{1,2}$/.test((e.textContent||'').trim());
   });
   dane.znalezionychWynikow = wyniki.length;
   dane.probki = wyniki.slice(0,2).map(function(e){
    var w=e; for(var i=0;i<4 && w.parentElement;i++) w=w.parentElement;
    var atrybuty=[];
    try{ for(var a=0;a<w.attributes.length;a++) atrybuty.push(w.attributes[a].name+'='+String(w.attributes[a].value).slice(0,60)); }catch(e2){}
    return { tag:w.tagName, atrybuty:atrybuty, html:(w.outerHTML||'').slice(0,700) };
   });
  }catch(e3){ dane.blad = String(e3 && e3.message); }
  var tekst = JSON.stringify(dane, null, 1);
  var pole=document.createElement('textarea'); pole.value=tekst; document.body.appendChild(pole); pole.select();
  var ok=false; try{ ok=document.execCommand('copy'); }catch(e4){}
  document.body.removeChild(pole);
  opisz.textContent = ok ? 'Skopiowane — wklej to w rozmowie z SBS' : 'Nie udalo sie skopiowac';
 };
 box.appendChild(opisz);
`;

t = t.replace(kotwica, dodatek + kotwica);
fs.writeFileSync(p, t, "utf8");
console.log("Dodano przycisk opisu strony do panelu.");
