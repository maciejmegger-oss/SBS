// Przycisk „Skopiuj opis strony" w stopce panelu OD RAZU, a nie dopiero po zakończeniu pracy.
//
// Zbieracz zacina się w połowie i panel końcowy nie powstaje — a to właśnie wtedy opis strony
// jest najbardziej potrzebny. Przycisk stoi więc od pierwszej sekundy, obok przerwania pracy.
import fs from "node:fs";

const p = "public/zakladka-lnp-v2.js";
let t = fs.readFileSync(p, "utf8");

const kotwica = "(document.body||document.documentElement).appendChild(box);";
if (t.indexOf(kotwica) < 0) { console.error("Nie znalazłem miejsca."); process.exit(1); }

const dodatek = `

// OPIS STRONY — dostepny natychmiast, nie dopiero na koncu.
//
// Zbieranie calej kolejki zacina sie w polowie i panel koncowy nie powstaje. Tymczasem to
// wlasnie wtedy potrzebny jest opis strony: jak zbudowane sa wiersze meczow, czy sa w nich
// odnosniki, czy identyfikatory. Przycisk czyta WYLACZNIE otwarta strone i kopiuje opis do
// schowka — niczego nie klika, nie wysyla i nie zmienia.
function opisStrony(){
 var dane={};
 try{
  dane.wersja = SBS_ZBIERACZ;
  dane.adres = location.pathname + location.search.slice(0,100);
  dane.linkiDoMeczow = document.querySelectorAll('a[href*="/mecz/"]').length;
  dane.idWKodzie = (document.documentElement.innerHTML.match(/mecz\\/[0-9a-f-]{30,40}/gi)||[]).length;
  dane.slowoRozegrany = ((document.body.innerText||'').match(/Rozegrany/g)||[]).length;
  try{ dane.wierszyZWynikiem = wierszeRozegrane().length; }catch(e){ dane.wierszyZWynikiem='blad'; }
  var wyniki=[].slice.call(document.querySelectorAll('*')).filter(function(e){
   return e.children.length===0 && /^\\d{1,2}\\s*:\\s*\\d{1,2}$/.test((e.textContent||'').trim());
  });
  dane.elementowZWynikiem = wyniki.length;
  dane.probki = wyniki.slice(0,2).map(function(e){
   var w=e; for(var i=0;i<4 && w.parentElement;i++) w=w.parentElement;
   var atr=[];
   try{ for(var a=0;a<w.attributes.length;a++) atr.push(w.attributes[a].name+'='+String(w.attributes[a].value).slice(0,50)); }catch(e2){}
   return { tag:w.tagName, atrybuty:atr, maNgContext:(typeof w.__ngContext__!=='undefined'), html:(w.outerHTML||'').slice(0,600) };
  });
 }catch(e3){ dane.blad=String(e3 && e3.message); }
 return JSON.stringify(dane, null, 1);
}
function doSchowka(tekst){
 var pole=document.createElement('textarea'); pole.value=tekst;
 document.body.appendChild(pole); pole.select();
 var ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
 document.body.removeChild(pole);
 return ok;
}
var przyciskOpisu=document.createElement('button');
przyciskOpisu.textContent='Skopiuj opis strony (dla SBS)';
przyciskOpisu.style.cssText='display:block;width:100%;padding:7px;margin-bottom:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
przyciskOpisu.onclick=function(){
 przyciskOpisu.textContent = doSchowka(opisStrony()) ? 'Skopiowane — wklej to w rozmowie z SBS' : 'Nie udalo sie skopiowac';
};
stopka.appendChild(przyciskOpisu);

var przyciskStop=document.createElement('button');
przyciskStop.textContent='Przerwij i pokaz, co mam';
przyciskStop.style.cssText='display:block;width:100%;padding:7px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
przyciskStop.onclick=function(){ PRZERWANO_CZASEM=true; ZBIERAM=false; try{ koniec(); }catch(e){} };
stopka.appendChild(przyciskStop);`;

t = t.replace(kotwica, kotwica + dodatek);
fs.writeFileSync(p, t, "utf8");
console.log("Dodano przyciski do stopki panelu (opis strony + przerwanie).");
