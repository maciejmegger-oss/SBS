// Zbieranie całej kolejki ze STRONY DRUŻYNY — przez ukrytą ramkę, bez opuszczania strony.
//
// SKĄD TO SIĘ WZIĘŁO: sprawdziłem to na żywej stronie ŁNP i działa. Mechanizm jest taki:
//
//  1. Wczytujemy stronę drużyny w UKRYTEJ RAMCE (nie w oknie — dzięki temu zbieracz przeżywa).
//  2. W ramce podmieniamy history.pushState na atrapę, która zapisuje adres i NIE wykonuje
//     przejścia.
//  3. Klikamy wiersz meczu. Angular nie zmienia adresu (bo atrapa), ale RENDERUJE PROTOKÓŁ
//     W MIEJSCU — czytamy go prosto z ramki, razem z adresem meczu.
//  4. Kolejny mecz = nowa ramka. Strona nadrzędna ani razu się nie przeładowuje.
//
// Dlaczego dotąd nie działało: klikanie na stronie GRUPY naprawdę przenosiło okno na mecz,
// a wtedy ginął cały zbieracz razem z listą. Ramka to odcina.
import fs from "node:fs";

const p = "public/zakladka-lnp-v2.js";
let t = fs.readFileSync(p, "utf8");

const kod = `
// ZBIERANIE ZE STRONY DRUŻYNY — sprawdzone na zywej stronie LNP.
//
// Strona druzyny ("Otworz mecze klubu") wymienia wszystkie jej mecze. Klikniecie wiersza otwiera
// protokol, ale w oknie glownym zabiloby zbieracz. Dlatego pracujemy w UKRYTEJ RAMCE: tam
// podmieniamy history.pushState na atrape, ktora zapisuje adres meczu i nie wykonuje przejscia.
// Angular renderuje wtedy protokol W MIEJSCU — mamy i adres, i sklady, a strona stoi nieruszona.
//
// Jeden mecz = jedna ramka. LNP odsyla 404 mniej wiecej co drugi raz, wiec kazdy krok ma az
// dwanascie podejsc — bez tego gubilismy cale druzyny.
function zdejmijMeczZDruzyny(adresDruzyny, nr, gotowe){
 var f=document.createElement('iframe');
 f.style.cssText='position:fixed;left:-9999px;top:0;width:1500px;height:2400px';
 f.src=adresDruzyny;
 document.body.appendChild(f);
 var faza='ladowanie', n=0, zlapany='';
 var t=setInterval(function(){
  n++;
  var d=null, W=null;
  try{ d=f.contentDocument; W=f.contentWindow; }catch(e){}
  if(!d||!d.body){ if(n>30){ clearInterval(t); f.remove(); gotowe({blad:'ramka pusta'}); } return; }
  var txt=d.body.innerText||'';

  if(faza==='ladowanie'){
   if(/Ups! Piłka za boiskiem/.test(txt)){ clearInterval(t); f.remove(); gotowe({blad:'404'}); return; }
   if(/Rozegrany/.test(txt)){
    var w=wierszeRozegraneW(d);
    if(nr>=w.length){ clearInterval(t); f.remove(); gotowe({koniec:true, wierszy:w.length}); return; }
    var op=W.history.pushState, or_=W.history.replaceState;
    W.history.pushState=function(a,b,u){ if(/\\/mecz\\//.test(String(u||''))){ zlapany=String(u); return; } return op.apply(W.history,arguments); };
    W.history.replaceState=function(a,b,u){ if(/\\/mecz\\//.test(String(u||''))){ zlapany=String(u); return; } return or_.apply(W.history,arguments); };
    var el=w[nr];
    var cele=[el].concat([].slice.call(el.querySelectorAll('*')).filter(function(x){
     return x.children.length===0 && (x.textContent||'').trim().length>1; }).slice(0,6));
    cele.forEach(function(c){ ['pointerdown','mousedown','mouseup','click'].forEach(function(ty){
     try{ c.dispatchEvent(new W.MouseEvent(ty,{bubbles:true,cancelable:true,view:W,button:0})); }catch(e){} }); });
    faza='protokol'; n=0;
    return;
   }
   if(n>30){ clearInterval(t); f.remove(); gotowe({blad:'brak listy meczow'}); }
   return;
  }

  if(faza==='protokol'){
   if(/Skład wyjściowy/.test(txt)){
    clearInterval(t);
    var j=txt.search(/^\\s*Składy\\s*$/m);
    var adres=zlapany ? (location.origin+zlapany) : '';
    var wynik={ nr:nr, adres:adres, tekst:txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(d) };
    f.remove(); gotowe(wynik); return;
   }
   if(n>26){ clearInterval(t); f.remove(); gotowe({blad:'protokol sie nie pokazal'}); }
  }
 },400);
}

// Wiersze rozegranych meczow w PODANYM dokumencie (ramka albo biezaca strona).
function wierszeRozegraneW(d){
 function maWynik(t){
  var m=t.match(/\\d{1,2}\\s*:\\s*\\d{1,2}/g); if(!m) return false;
  for(var i=0;i<m.length;i++){ var x=m[i].replace(/\\s+/g,''); if(/^\\d{2}:\\d{2}$/.test(x)) continue; return true; }
  return false;
 }
 var kand=[].slice.call(d.querySelectorAll('div,li,tr,a,section,article'));
 var out=[];
 for(var i=0;i<kand.length;i++){
  var el=kand[i], t=(el.textContent||'').replace(/\\s+/g,' ').trim();
  if(t.length<8||t.length>400) continue;
  if(/Nierozegran/i.test(t)) continue;
  if(!/Rozegrany/i.test(t)) continue;
  if(!maWynik(t)) continue;
  out.push(el);
 }
 return out.filter(function(a){ return !out.some(function(b){ return a!==b && a.contains(b); }); });
}

// Przejscie po wszystkich meczach druzyny.
function zbierzZeStronyDruzyny(gotowe){
 var adres=location.href;
 var nr=0, nieudane=0, dodanych=0;
 function dalej(){
  if(zaDlugo()){ gotowe(dodanych); return; }
  linia.textContent='SBS '+SBS_ZBIERACZ+': mecz '+(nr+1)+' (zebranych '+dodanych+')'+(nieudane?' - podejscie '+(nieudane+1):'');
  zdejmijMeczZDruzyny(adres, nr, function(w){
   if(w.koniec){ gotowe(dodanych); return; }
   if(w.blad){
    nieudane++;
    if(nieudane>12){ gotowe(dodanych); return; }
    setTimeout(dalej, 600); return;
   }
   if(w.adres && w.tekst){
    var wpis='### PROTOKOL: '+w.adres+'\\n'+w.tekst;
    var byl=false;
    for(var q=0;q<zebrane.length;q++){ if(zebrane[q].indexOf('### PROTOKOL: '+w.adres+'\\n')===0){ zebrane[q]=wpis; byl=true; break; } }
    if(!byl){ zebrane.push(wpis); dodanych++; }
    try{ localStorage.setItem(KLUCZ, JSON.stringify(zebrane)); }catch(e){}
   }
   nr++; nieudane=0;
   setTimeout(dalej, 250);
  });
 }
 dalej();
}
`;

const kotwica = "function start(){";
if (t.indexOf(kotwica) < 0) { console.error("Nie znalazłem start()."); process.exit(1); }
t = t.replace(kotwica, kod + "\n" + kotwica);

// Wpięcie: na stronie drużyny idziemy tą drogą, zamiast szukać listy pod tabelą.
const wpiecie = ` if(/\\/mecz\\//.test(location.pathname)){`;
const nowe = ` // STRONA DRUZYNY — tu jest komplet meczow tego klubu i tu zbieranie dziala najpewniej.
 if(location.pathname.indexOf('/druzyna/')>=0){
  linia.textContent='SBS '+SBS_ZBIERACZ+': strona druzyny - zbieram jej mecze';
  zbierzZeStronyDruzyny(function(ile){ koniec(); });
  return;
 }
 if(/\\/mecz\\//.test(location.pathname)){`;
if (t.indexOf(wpiecie) < 0) { console.error("Nie znalazłem gałęzi /mecz/."); process.exit(1); }
t = t.replace(wpiecie, nowe);

fs.writeFileSync(p, t, "utf8");
console.log("Dodano zbieranie ze strony drużyny (przez ukrytą ramkę).");
