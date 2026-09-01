// Na liście rozgrywek zbieramy PRZEZ DRUŻYNY — bo tylko ta droga jest sprawdzona.
//
// CO NIE DZIAŁAŁO: strona grupy wczytana w ukrytej ramce pokazuje wyłącznie mecze nadchodzące.
// Lista rozegranych doczytuje się dopiero po dłuższej interakcji, której w ramce nie ma — więc
// zbieracz stał na „mecz 1 (zebranych 0)" i ponawiał w nieskończoność. Sprawdziłem to zarówno
// u siebie, jak i na zrzutach: 38 wierszy widocznych w oknie, zero w ramce.
//
// CO DZIAŁA: strona drużyny. Lista jej meczów jest krótka i widoczna od razu, więc ramka dostaje
// ją bez żadnych sztuczek. Tą drogą Lech Rypin zebrał się w całości.
//
// DLATEGO: na liście rozgrywek klikamy JEDEN wiersz w oknie głównym (z zablokowanym przejściem),
// żeby poznać adres meczu. Z niego czytamy identyfikatory obu drużyn, a dalej idziemy już
// wyłącznie po stronach drużyn — każdy odczytany mecz dokłada kolejne kluby do kolejki. W ten
// sposób z jednego kliknięcia rozwija się cała grupa.
import fs from "node:fs";

const p = "public/zakladka-lnp-v2.js";
let t = fs.readFileSync(p, "utf8");

const kod = `
// Adres JEDNEGO meczu z listy w oknie glownym — bez przechodzenia na niego.
// Atrapa pushState zapisuje adres i nie wykonuje przejscia; widok owszem sie zmieni, ale nam
// wystarczy ten jeden adres, bo dalej pracujemy juz po stronach druzyn.
function pierwszyAdresZListy(){
 var w = wierszeRozegrane();
 if(!w.length) return '';
 var op=history.pushState, or_=history.replaceState, zlapany='';
 history.pushState=function(a,b,u){ if(/\\/mecz\\//.test(String(u||''))){ zlapany=String(u); return; } return op.apply(history,arguments); };
 history.replaceState=function(a,b,u){ if(/\\/mecz\\//.test(String(u||''))){ zlapany=String(u); return; } return or_.apply(history,arguments); };
 var el=w[0];
 var cele=[el].concat([].slice.call(el.querySelectorAll('*')).filter(function(x){
  return x.children.length===0 && (x.textContent||'').trim().length>1; }).slice(0,6));
 cele.forEach(function(c){ ['pointerdown','mousedown','mouseup','click'].forEach(function(ty){
  try{ c.dispatchEvent(new MouseEvent(ty,{bubbles:true,cancelable:true,view:window,button:0})); }catch(e){} }); });
 history.pushState=op; history.replaceState=or_;
 return zlapany ? (location.origin+zlapany) : '';
}

// Identyfikatory obu druzyn z meczu — wczytujemy go w ramce i czytamy odnosniki.
function druzynyZMeczu(adres, gotowe){
 var f=document.createElement('iframe');
 f.style.cssText='position:fixed;left:-9999px;top:0;width:1500px;height:2400px';
 f.src=adres; document.body.appendChild(f);
 var n=0;
 var t=setInterval(function(){
  n++;
  var d=null; try{ d=f.contentDocument; }catch(e){}
  var txt=(d&&d.body)?(d.body.innerText||''):'';
  if(/Skład wyjściowy/.test(txt)){
   clearInterval(t);
   var ids=[].slice.call((d.documentElement.innerHTML||'').matchAll(/druzyna\\/([0-9a-f-]{30,40})/gi)).map(function(m){return m[1];});
   var jedyne=[]; ids.forEach(function(x){ if(jedyne.indexOf(x)<0) jedyne.push(x); });
   f.remove(); gotowe(jedyne); return;
  }
  if(/Ups! Piłka za boiskiem/.test(txt) || n>40){ clearInterval(t); f.remove(); gotowe([]); }
 },400);
}

// Cala grupa: od jednego meczu, przez kolejne druzyny, az do wyczerpania kolejki.
function zbierzGrupePrzezDruzyny(gotowe){
 var doZrobienia=[], zrobione={}, dodanych=0;

 function poDruzynie(){
  var id=doZrobienia.shift();
  if(!id){ gotowe(dodanych); return; }
  if(zrobione[id]){ setTimeout(poDruzynie,50); return; }
  zrobione[id]=true;
  var adres=location.origin+'/rozgrywki/druzyna/'+id+'?tab=tab-mecz';
  var nr=0, nieudane=0;
  function wiersz(){
   if(zaDlugo()){ gotowe(dodanych); return; }
   linia.textContent='SBS '+SBS_ZBIERACZ+': klub '+Object.keys(zrobione).length+'/'+(Object.keys(zrobione).length+doZrobienia.length)
    +' - mecz '+(nr+1)+' (zebranych '+dodanych+')'+(nieudane?' - podejscie '+(nieudane+1):'');
   zdejmijMeczZDruzyny(adres, nr, function(w){
    if(w.koniec){ setTimeout(poDruzynie,200); return; }
    if(w.blad){
     nieudane++;
     if(nieudane>20){ setTimeout(poDruzynie,200); return; }
     setTimeout(wiersz, 500); return;
    }
    if(w.adres && w.tekst){
     var wpis='### PROTOKOL: '+w.adres+'\\n'+w.tekst;
     var byl=false;
     for(var q=0;q<zebrane.length;q++){ if(zebrane[q].indexOf('### PROTOKOL: '+w.adres+'\\n')===0){ zebrane[q]=wpis; byl=true; break; } }
     if(!byl){ zebrane.push(wpis); dodanych++; }
     try{ localStorage.setItem(KLUCZ, JSON.stringify(zebrane)); }catch(e){}
    }
    // Kazdy odczytany mecz dokłada obie druzyny do kolejki — tak rozwija sie cala grupa.
    (w.druzynyZMeczu||[]).forEach(function(d){ if(!zrobione[d] && doZrobienia.indexOf(d)<0) doZrobienia.push(d); });
    nr++; nieudane=0;
    setTimeout(wiersz, 200);
   });
  }
  wiersz();
 }

 linia.textContent='SBS '+SBS_ZBIERACZ+': czytam pierwszy mecz z listy...';
 var adres=pierwszyAdresZListy();
 if(!adres){ gotowe(0); return; }
 druzynyZMeczu(adres, function(ids){
  if(!ids.length){ gotowe(0); return; }
  doZrobienia = ids.slice();
  poDruzynie();
 });
}
`;

const kotwica = "function start(){";
if (t.indexOf(kotwica) < 0) { console.error("Nie znalazłem start()."); process.exit(1); }
t = t.replace(kotwica, kod + "\n" + kotwica);

// Na liście rozgrywek idziemy tą drogą zamiast ładować grupę do ramki.
const stare = `  zbierzZeStronyDruzyny(function(){ koniec(); });`;
const nowe = `  zbierzGrupePrzezDruzyny(function(){ koniec(); });`;
if (t.indexOf(stare) < 0) { console.error("Nie znalazłem wywołania na liście."); process.exit(1); }
t = t.replace(stare, nowe);

// zdejmijMeczZDruzyny ma oddawać także identyfikatory drużyn — inaczej kolejka się nie rozwinie.
const stareW = `    var wynik={ nr:nr, adres:adres, tekst:txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(d) };`;
const noweW = `    var idsD=[].slice.call((d.documentElement.innerHTML||'').matchAll(/druzyna\\/([0-9a-f-]{30,40})/gi)).map(function(m){return m[1];});
    var jedyneD=[]; idsD.forEach(function(x){ if(jedyneD.indexOf(x)<0) jedyneD.push(x); });
    var wynik={ nr:nr, adres:adres, druzynyZMeczu:jedyneD, tekst:txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(d) };`;
if (t.indexOf(stareW) < 0) { console.error("Nie znalazłem budowy wyniku."); process.exit(1); }
t = t.replace(stareW, noweW);

fs.writeFileSync(p, t, "utf8");
console.log("Lista rozgrywek zbiera teraz przez strony drużyn.");
