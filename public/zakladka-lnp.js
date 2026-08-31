(function(){

var SBS_ZBIERACZ="v44 z 30.08.2026";
var SBS_ADRES=(typeof window!=='undefined'&&window.__SBS_ADRES)?window.__SBS_ADRES:"";
var STRONA_STARTOWA=location.href;

// RYGIEL NA CZAS ZBIERANIA.
//
// Zbieracz musi klikac w zakladki i "Pokaz wiecej", zeby strona pokazala wszystkie mecze. Kazde
// takie klikniecie moze trafic w odnosnik prowadzacy gdzie indziej — i wtedy przegladarka
// opuszcza strone z tabela, a razem z nia ginie caly zbieracz. Wygladalo to jak "otwiera strone
// glowna i nic nie kopiuje".
//
// Sprawdzanie kazdego kandydata z osobna okazalo sie zawodne: zakladki na LNP bywaja <span>
// wewnatrz <a>, wiec element wygladal niewinnie, a klikniecie i tak szlo pod adres rodzica.
// Dlatego zamiast wylapywac wyjatki, zamykamy droge: dopoki zbieramy, zadne klikniecie nie
// wyprowadzi z tej strony. Odnosniki prowadzace gdzie indziej sa unieszkodliwiane w fazie
// przechwytywania, zanim przegladarka zdazy zareagowac.
// Wyjatek: droga awaryjna, w ktorej zbieracz wchodzi w kolejne mecze i wraca przez history.back(),
// nawiguje CELOWO. Na jej czas rygiel jest uchylany — patrz zbierzAdresyPrzezKlikanie().
var ZBIERAM=true, POZWOL_NAWIGACJE=false, zablokowanych=0;

// STRAZNIK CZASU — ZAWSZE KONCZYMY PANELEM, NIGDY MILCZENIEM.
//
// Najczestsza skarga brzmiala "kliknalem i nic sie nie dzieje". Tak wygladalo utkniecie
// w ktorejs fazie: zbieracz szukal listy meczow, przebijal sie przez kandydatow na zakladke
// albo czekal na strone, ktora nigdy sie nie doczytala. Licznik w rogu owszem, mrugal, ale
// przycisku "Wyslij do SBS" nie bylo, wiec nie bylo tez czego przeslac.
//
// Limit to dziesiec minut — tyle trwa zebranie calej grupy. Przerwac mozna w kazdej chwili
// przyciskiem w panelu, wiec dlugi limit nie wiezi nikogo. Po jego uplywie przerywamy to, co akurat trwa, i pokazujemy panel z tym, co udalo sie
// zebrac. Lepiej oddac czesc kolejki i powiedziec o tym wprost, niz zostawic czlowieka
// z mrugajacym licznikiem.
var trybJedenMecz = false;
// Ostatnie liczby widziane przy szukaniu listy — trafiaja do panelu, gdy nic nie udalo sie zebrac.
var ostatnioLinkow = 0, ostatnioWierszy = 0, ostatnioKrokow = 0;
var CZAS_STARTU = 0;                       // ustawiany w start(), zeby liczyc od pierwszego ruchu
var PRZERWANO_CZASEM = false;
function minelo(){ return CZAS_STARTU ? (new Date().getTime() - CZAS_STARTU) : 0; }
function zaDlugo(){ return PRZERWANO_CZASEM; }   // tylko recznie: przycisk "Przerwij"

// PORoWNUJEMY CALY ADRES, NIE SAMA SCIEZKE.
//
// LNP to aplikacja Angulara: strona grupy ma te sama sciezke "/rozgrywki" co strona ogolna,
// a sezon, liga i grupa siedza w PARAMETRACH. Porownywanie samych sciezek uznawalo wiec odnosnik
// "Wyniki" ze stopki (href="/rozgrywki") za "ta sama strona" i przepuszczalo klikniecie —
// Angular resetowal widok do Ekstraklasy i zbieracz tracil kolejke IV ligi.
//
// Kotwica bez adresu albo z sama kotwica (#) nie nawiguje nigdzie i jest bezpieczna.
function bezKotwicy(u){ try{ var x=new URL(u, location.href); return x.origin+x.pathname+x.search; }catch(e){ return ''; } }
document.addEventListener('click', function(e){
 if(!ZBIERAM || POZWOL_NAWIGACJE) return;
 var el=e.target;
 var a=null;
 try{ a = el && el.closest ? el.closest('a') : null; }catch(err){ a=null; }
 if(!a) return;
 var h=a.getAttribute&&a.getAttribute('href');
 if(!h || h.charAt(0)==='#') return;
 var cel=(a.getAttribute&&a.getAttribute('target'))||'';
 var gdzieIndziej = bezKotwicy(a.href) !== bezKotwicy(location.href);
 if(gdzieIndziej || (cel && cel!=='_self')){
  e.preventDefault(); e.stopPropagation(); zablokowanych++;
 }
}, true);
window.addEventListener('beforeunload', function(){ ZBIERAM=false; });
var box=document.createElement('div');
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
(document.body||document.documentElement).appendChild(box);

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
  dane.idWKodzie = (document.documentElement.innerHTML.match(/mecz\/[0-9a-f-]{30,40}/gi)||[]).length;
  dane.slowoRozegrany = ((document.body.innerText||'').match(/Rozegrany/g)||[]).length;
  try{ dane.wierszyZWynikiem = wierszeRozegrane().length; }catch(e){ dane.wierszyZWynikiem='blad'; }
  var wyniki=[].slice.call(document.querySelectorAll('*')).filter(function(e){
   return e.children.length===0 && /^\d{1,2}\s*:\s*\d{1,2}$/.test((e.textContent||'').trim());
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
// HERBY I NAZWY KLUBOW Z TABELI GRUPY.
//
// Herbow nie da sie pobrac po stronie serwera: LNP oddaje mu pusta skorupe Angulara, a i tak
// nie znalby adresow obrazkow. W otwartej tabeli sa jednak wprost — kazdy wiersz ma obrazek
// i nazwe. Czytamy je z tego, co juz widac, niczego nie klikajac.
//
// Nazwe bierzemy z PIERWSZEGO liscia wiersza, ktory zawiera litery — w tabeli LNP to wlasnie
// nazwa klubu ("CZARNI ZAGAN 1957"), bo pozycja stoi w osobnym elemencie. Odsiewamy obrazki
// serwisu (herb PZPN, banery sponsorow), zeby nie wziac ich za herb klubu.
function herbyZTabeli(){
 var out=[], widziane={};
 // ROZPOZNAJEMY HERB PO ADRESIE, NIE PO ROZMIARZE.
 //
 // Poprzednio odrzucalismy obrazki wieksze niz 260 punktow — a to wlasnie sa herby: w tabeli
 // widac miniature, ale plik zrodlowy bywa duzy. Z szesnastu klubow wchodzilo wiec piec.
 // LNP trzyma herby na swoim CDN (cdn.laczynaspilka.pl/content/static/pz/images/...), a gdy
 // klubu nie ma — podstawia wlasna tarcze (assets/icons/crest_default). Bierzemy jedno i drugie:
 // zaslepke tez, bo dopiero SBS ma powiedziec, ze dla tego klubu herbu brakuje.
 [].slice.call(document.querySelectorAll('img')).forEach(function(img){
  var src=img.currentSrc||img.getAttribute('src')||'';
  if(!src || /^data:/.test(src)) return;
  if(src.indexOf('//')===0) src=location.protocol+src;
  if(!/cdn\.laczynaspilka\.pl|crest|herb|logo-klub/i.test(src)) return;
  if(/pzpn|orlen|sponsor|banner|site-logo/i.test(src)) return;

  var wiersz=img;
  for(var i=0;i<6 && wiersz.parentElement;i++){
   wiersz=wiersz.parentElement;
   var t=(wiersz.textContent||'').replace(/\s+/g,' ').trim();
   if(t.length>=4 && t.length<=220 && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3}/.test(t)) break;
  }
  var nazwa='';
  [].slice.call(wiersz.querySelectorAll('*')).forEach(function(el){
   if(nazwa || el.children.length) return;
   var t=(el.textContent||'').replace(/\s+/g,' ').trim();
   if(t.length<3 || t.length>70) return;
   if(!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3}/.test(t)) return;
   if(/^\d+\.?$/.test(t)) return;
   nazwa=t;
  });
  if(!nazwa) return;
  var klucz=nazwa.toLowerCase();
  if(widziane[klucz]) return;
  widziane[klucz]=1;
  out.push(nazwa+'|'+src);
 });
 return out;
}

var przyciskHerby=document.createElement('button');
przyciskHerby.textContent='Zbierz herby i nazwy klubow';
przyciskHerby.style.cssText='display:block;width:100%;padding:7px;margin-bottom:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
// PRZYCISK MA WYSLAC, A NIE TYLKO ZEBRAC.
//
// Dotad zmienial tylko napis na "Mam 5 herbow — wyslij do SBS", a sam niczego nie wysylal:
// trzeba bylo doczekac do konca zbierania protokolow i uzyc zlotego przycisku. Kto klikal
// wylacznie herby, nie doczekal sie niczego i mial prawo sadzic, ze nie dzialaja.
przyciskHerby.onclick=function(){
 var lista=herbyZTabeli();
 if(!lista.length){ przyciskHerby.textContent='Nie widze tu tabeli z herbami'; return; }
 var wpis='### KLUBY\n'+lista.join('\n');
 var byl=false;
 for(var q=0;q<zebrane.length;q++){ if(zebrane[q].indexOf('### KLUBY\n')===0){ zebrane[q]=wpis; byl=true; break; } }
 if(!byl) zebrane.push(wpis);
 try{ localStorage.setItem(KLUCZ, JSON.stringify(zebrane)); }catch(e){}
 przyciskHerby.textContent='Wysylam '+lista.length+' herbow...';
 wyslij(zebrane.join('\n\n'));
};
stopka.appendChild(przyciskHerby);

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
stopka.appendChild(przyciskStop);

function zdarzenia(d){try{
 if(!d) return '';
 var out=[],widziane={};
 var MINUTA=/^\s*\d{1,3}'(?:\s*\+\s*\d+')?\s*$/;
 function opisz(w){
  var r=[];
  if(!w||!w.querySelectorAll) return r;
  var ob=w.querySelectorAll('img,svg,use,i,span[class]');
  for(var y=0;y<ob.length&&y<12;y++){
   var o=ob[y];
   var s=(o.getAttribute&&(o.getAttribute('src')||o.getAttribute('href')||o.getAttribute('xlink:href')||o.getAttribute('alt')||o.getAttribute('aria-label')||o.getAttribute('title')))||'';
   var c=(o.getAttribute&&o.getAttribute('class'))||'';
   if(s) r.push(String(s).split('/').pop());
   if(c) r.push(String(c));
  }
  return r;
 }
 function obok(w){
  if(!w) return [];
  if(MINUTA.test(w.textContent||'')) return [];
  return opisz(w);
 }
 var wszystkie=[].slice.call(d.querySelectorAll('*'));
 for(var k=0;k<wszystkie.length;k++){
  var el=wszystkie[k];
  if(el.children.length) continue;
  var tt=(el.textContent||'').trim();
  var mm=tt.match(/^(\d{1,3})'(?:\s*\+\s*(\d+)')?$/);
  if(!mm) continue;
  var wiersz=el, pojemnik=el, glab=0;
  while(wiersz&&glab<5&&!(wiersz.textContent||'').match(/[A-Za-z\u00c0-\u017f]{3,}/)){pojemnik=wiersz;wiersz=wiersz.parentElement;glab++;}
  if(!wiersz) continue;
  var podpisy=opisz(pojemnik);
  if(!podpisy.length&&pojemnik) podpisy=obok(pojemnik.previousElementSibling).concat(obok(pojemnik.nextElementSibling));
  var kto=(wiersz.textContent||'').replace(/\s+/g,' ').trim().slice(0,60);
  var linia=mm[1]+"'|"+kto+'|'+podpisy.join(' ').slice(0,160);
  if(!widziane[linia]){widziane[linia]=1;out.push(linia);}
 }
 return out.length?('\n### ZDARZENIA\n'+out.join('\n')):'';
}catch(e){return '';}}

if(!/laczynaspilka\.pl/.test(location.host)){box.remove();alert('SBS '+SBS_ZBIERACZ+': to nie jest strona Laczy nas pilka.');return;}
var KLUCZ='sbs_protokoly_hurt';
if(window.event&&window.event.shiftKey){try{localStorage.removeItem(KLUCZ);}catch(e){}alert('SBS '+SBS_ZBIERACZ+': wyczyscilem zebrane protokoly.');return;}

// ADRESY MECZOW Z LISTY POD TABELA — BEZ OPUSZCZANIA STRONY.
//
// Na stronie grupy wiersze rozegranych meczow nie sa odnosnikami: Angular otwiera mecz
// kliknieciem, przez router. Dlatego zadne szukanie <a href="/mecz/..."> ich nie znajdzie,
// a wchodzenie w kazdy mecz i cofanie sie trwalo wieki i lapalo bledy 404 LNP.
//
// Router konczy nawigacje wywolaniem history.pushState. Podsluchujemy wiec pushState, klikamy
// wiersz, zapisujemy adres, ktory router chcial otworzyc, i natychmiast wracamy. Strona nie
// przeladowuje sie ani razu, wiec nie ma jak sie zgubic.
// DRUGA DROGA: IDENTYFIKATOR MECZU WPROST Z DANYCH ANGULARA.
//
// Angular trzyma przy kazdym wyrenderowanym elemencie odnosnik do swoich danych (__ngContext__).
// Siedzi tam obiekt meczu, a w nim jego identyfikator — ten sam, ktory stoi w adresie
// /rozgrywki/mecz/<id>. Gdy klikanie w wiersz nic nie daje (a tak bywa, bo obsluga wisi na
// zdarzeniach, ktorych nie da sie wiernie podrobic), czytamy identyfikator stad.
//
// Bierzemy WYLACZNIE pola, ktorych nazwa mowi o meczu — inaczej trafilibysmy w identyfikator
// klubu albo sezonu. Zly adres i tak odpadnie przy wczytywaniu: strona meczu bez skladu nie
// zostanie zapisana.
function idMeczuZKontekstu(el){
 var WZOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 var NAZWA = /(^|[^a-z])(match|mecz|game|fixture)/i;

 // OBIEKT MECZU POZNAJEMY PO TYM, CO W SOBIE MA, A NIE PO NAZWIE POLA.
 //
 // Pierwsza wersja szukala klucza ze slowem "match" i nie znajdowala nic — LNP nazywa pole po
 // prostu "id", a obiekt trzyma pod nazwa, ktorej nie da sie odgadnac. Za to KSZTALT obiektu
 // meczu jest niepodrabialny: obie druzyny plus wynik albo kolejka. Klub ani sezon takiego
 // zestawu nie maja, wiec nie ma jak sie pomylic.
 function wygladaNaMecz(o){
  if(!o || typeof o !== 'object') return false;
  var klucze = [];
  try{ for(var k in o) klucze.push(k.toLowerCase()); }catch(e){ return false; }
  var maGospodarza = klucze.some(function(k){ return /^(home|gospodarz)/.test(k); });
  var maGoscia     = klucze.some(function(k){ return /^(away|guest|gosc)/.test(k); });
  var maWynikLubKolejke = klucze.some(function(k){ return /(score|result|wynik|queue|round|kolejk)/.test(k); });
  return maGospodarza && maGoscia && maWynikLubKolejke;
 }
 function idZObiektu(o){
  for(var k in o){
   var v;
   try{ v = o[k]; }catch(e){ continue; }
   if(typeof v === 'string' && WZOR.test(v) && /^id$/i.test(k)) return v;
  }
  for(var k2 in o){
   var v2;
   try{ v2 = o[k2]; }catch(e){ continue; }
   if(typeof v2 === 'string' && WZOR.test(v2) && NAZWA.test(k2)) return v2;
  }
  return '';
 }
 function szukaj(o, glab, widziane){
  if(!o || glab > 6 || typeof o !== 'object') return '';
  if(widziane.indexOf(o) >= 0) return '';
  widziane.push(o);
  if(wygladaNaMecz(o)){ var wprost = idZObiektu(o); if(wprost) return wprost; }
  for(var k in o){
   var v;
   try{ v = o[k]; }catch(e){ continue; }
   if(typeof v === 'string' && WZOR.test(v) && NAZWA.test(k)) return v;
   if(v && typeof v === 'object' && !(v instanceof Node) && !(v instanceof Window)){
    var r = szukaj(v, glab + 1, widziane);
    if(r) return r;
   }
  }
  return '';
 }
 var w = el, glebokosc = 0;
 while(w && glebokosc < 5){
  try{
   var ctx = w.__ngContext__;
   if(ctx){ var id = szukaj(ctx, 0, []); if(id) return id; }
  }catch(e){}
  w = w.parentElement; glebokosc++;
 }
 return '';
}

// PRZECHODZIMY PO MECZACH TAK, JAK ZROBILBY TO CZLOWIEK: otworz, przepisz, wroc, nastepny.
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
  var j = txt.search(/^\s*Składy\s*$/m);
  var wpis = '### PROTOKOL: ' + url + '\n' + txt.slice(j < 0 ? 0 : Math.max(0, j - 400)) + zdarzenia(document);
  for(var q = 0; q < zebrane.length; q++){
   if(zebrane[q].indexOf('### PROTOKOL: ' + url + '\n') === 0){ zebrane[q] = wpis; return true; }
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
   linia.textContent='SBS ' + SBS_ZBIERACZ + ': mecz ' + (k+1) + '/' + wiersze.length + ' - czekam na sklad (' + prob + ')';
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
  linia.textContent='SBS ' + SBS_ZBIERACZ + ': mecz ' + (k+1) + '/' + wiersze.length + ' (zebranych ' + zebranychTu + ')';
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
}

function zbierzLinki(){
 var wynik=[], widziane={};
 pominietych=0;
 function stan(el){
  var w=el, g=0;
  while(w&&g<5){
   var t=(w.textContent||'');
   if(/nierozegran|odwołan|przełożon/i.test(t)) return 'nie';
   if(/rozegran/i.test(t)) return 'tak';
   w=w.parentElement; g++;
  }
  return '?';
 }
 function dodaj(url, el){
  if(!url||widziane[url]) return;
  if(el&&stan(el)==='nie'){ pominietych++; widziane[url]=1; return; }
  widziane[url]=1; wynik.push(url);
 }
 [].slice.call(document.querySelectorAll('a[href*="/mecz/"]')).forEach(function(a){dodaj(a.href,a);});
 [].slice.call(document.querySelectorAll('[routerlink],[ng-reflect-router-link],[data-href],[data-url]'))
  .forEach(function(el){for(var i=0;i<el.attributes.length;i++){var v=el.attributes[i].value||'';
   if(/\/mecz\//.test(v)){try{dodaj(new URL(v,location.origin).href,el);}catch(e){}}}});
 if(!wynik.length){
  var html=document.documentElement.innerHTML||'';
  var re=/\/rozgrywki\/mecz\/([0-9a-fA-F-]{30,40})/g,m;
  while((m=re.exec(html))!==null) dodaj(location.origin+'/rozgrywki/mecz/'+m[1],null);
 }
 return wynik;
}

function listaKolejek(){
 var sel=[].slice.call(document.querySelectorAll('select'));
 for(var i=0;i<sel.length;i++){
  var opcje=[].slice.call(sel[i].options||[]);
  if(opcje.length<2) continue;
  var pasuje=opcje.filter(function(o){return /kolejk|runda|round/i.test(o.textContent||'');});
  if(pasuje.length>1||/kolejk|runda|round/i.test((sel[i].getAttribute('aria-label')||'')+' '+(sel[i].name||''))) return sel[i];
 }
 return null;
}

// LISTA MECZOW PRZEZYWA PRZERWANIE.
//
// LNP gubi sie przy byle czym: wejscie pod adres grupy konczy sie 404 mniej wiecej co drugi raz,
// zmiana filtra "Runda" tak samo. Dotad kazde takie potkniecie kasowalo cala prace — zbieracz
// nie mial skad wziac adresow meczow i zaczynal od zera.
//
// Dlatego raz zobaczona lista adresow zapisuje sie przy adresie strony. Gdy nastepnym razem
// strona wroci pusta albo z bledem, bierzemy liste z pamieci i po prostu dalej wczytujemy mecze —
// same strony meczow dzialaja po ponowieniu, wiec to wystarcza, zeby dojsc do konca.
var KLUCZ_LISTY='sbs_lista_meczow';
function kluczStrony(){ try{ var u=new URL(location.href); return u.pathname+u.search; }catch(e){ return location.href; } }
function zapamietajListe(lista){
 if(!lista||!lista.length) return;
 try{
  var m={}; try{ m=JSON.parse(localStorage.getItem(KLUCZ_LISTY)||'{}'); }catch(e){ m={}; }
  m[kluczStrony()]=lista;
  localStorage.setItem(KLUCZ_LISTY,JSON.stringify(m));
 }catch(e){}
}
function listaZPamieci(){
 try{
  var m=JSON.parse(localStorage.getItem(KLUCZ_LISTY)||'{}');
  var l=m[kluczStrony()];
  return (l&&l.length)?l:[];
 }catch(e){ return []; }
}

var pominietych=0;
var zebrane=[];try{zebrane=JSON.parse(localStorage.getItem(KLUCZ)||'[]');}catch(e){zebrane=[];}
var bylo=zebrane.length, linki=[], i=0, kolejek=1, czekam=0, doliczen=0, rozwiniete=false, probowanoKlikac=false, wierszyNaEkranie=0, zakladkaNr=0;

// Czy w ten element wolno kliknac?
//
// Zbieracz klika w elementy rozpoznane po TRESCI — "Mecze", "Pokaz wiecej". Ta sama tresc trafia
// sie w nawigacji portalu: w stopce LNP jest "Wyniki" prowadzace na /rozgrywki, a przy liscie
// zdarzen bywa "Pokaz wiecej" jako zwykly odnosnik. Klikniecie takiego elementu opuszcza strone
// albo otwiera nowa karte i cala praca przepada.
//
// Kryterium: element sterujacy trescia albo nie ma adresu, albo prowadzi na TE SAMA sciezke
// (zmienia sie co najwyzej parametr lub kotwica). Odnosnik otwierajacy nowa karte odsiewamy
// zawsze — zakladka z meczami nigdy nie otwiera sie w nowym oknie.
// Klikniecie w SPAN wewnatrz <a> otwiera adres tego <a>. Dlatego pytamy nie o sam element,
// tylko o najblizszy odnosnik NAD nim — inaczej "Wyniki" ze stopki (a > span) przechodzilo
// przez ochrone i przegladarka opuszczala strone z tabela, zamiast zbierac protokoly.
function odnosnikNad(el){
 if(!el) return null;
 if(el.tagName==='A') return el;
 try{ return el.closest ? el.closest('a') : null; }catch(e){ return null; }
}
function wolnoKliknac(el){
 if(!el) return false;
 var a=odnosnikNad(el);
 if(!a) return true;
 var t=(a.getAttribute&&a.getAttribute('target'))||'';
 if(t && t!=='_self') return false;
 var h=a.getAttribute&&a.getAttribute('href');
 if(!h || h.charAt(0)==='#') return true;
 // Caly adres, nie sama sciezka — grupa siedzi w parametrach (patrz komentarz przy ryglu).
 return bezKotwicy(a.href) === bezKotwicy(location.href);
}

function kandydaciMeczow(){
 var nazwy=/^(mecze|terminarz|wyniki|terminarz i wyniki|mecze i wyniki)$/i;
 var kand=[].slice.call(document.querySelectorAll('[role="tab"],button,a,li,span,div'));
 var out=[];
 for(var i=0;i<kand.length;i++){
  var el=kand[i];
  if(el.children.length>1) continue;
  var t=(el.textContent||'').replace(/\s+/g,' ').trim();
  if(!nazwy.test(t)) continue;
  if(el.tagName==='TH'||el.tagName==='TD') continue;
  if(el.closest&&el.closest('table')) continue;
  // NIE KLIKAMY W NIC, CO PROWADZI NA INNA STRONE.
  //
  // W stopce LNP jest odnosnik "Wyniki" kierujacy na laczynaspilka.pl/rozgrywki. Pasowal do
  // tej samej nazwy co zakladka z meczami, wiec zakladka go klikala i przegladarka opuszczala
  // strone z tabela — wygladalo to jak "zamyka strone i otwiera glowna, nic nie kopiuje".
  // Prawdziwa zakladka z meczami albo nie ma adresu, albo prowadzi na TE SAMA sciezke
  // (zmienia sie co najwyzej parametr lub kotwica). Kazdy inny adres odsiewamy.
  // Sprawdzamy odnosnik NAD elementem, nie sam element: zakladki na LNP to czesto <span>
  // albo <div> w srodku <a>, a klikniecie takiego dziecka i tak prowadzi pod adres rodzica.
  var kotwica=odnosnikNad(el);
  if(kotwica){
   var cel_href=kotwica.getAttribute('href')||'';
   if(cel_href && cel_href.charAt(0)!=='#'){
    if(bezKotwicy(kotwica.href) !== bezKotwicy(location.href)) continue;
   }
  }
  // Stopka i naglowek serwisu nie zawieraja zakladek tresci — tylko nawigacje po calym portalu.
  if(el.closest&&el.closest('footer,header')) continue;
  var waga=(el.getAttribute&&el.getAttribute('role')==='tab')?0:((el.tagName==='BUTTON'||el.tagName==='A')?1:2);
  if(el.closest&&el.closest('[class*="tab"],[class*="Tab"],[class*="nav"],[class*="Nav"]')) waga=waga-1;
  out.push({el:el,waga:waga});
 }
 out.sort(function(a,b){return a.waga-b.waga;});
 var lista=[];
 for(var j=0;j<out.length;j++) lista.push(out[j].el);
 return lista;
}
function otworzZakladkeMecze(gotowe){
 // Najwyzej trzech kandydatow. Lista meczow na stronie grupy jest POD tabela, a nie za zakladka,
 // wiec przebijanie sie przez dwadziescia kilka elementow tylko zjadalo czas — po jednym
 // klikniecie i 1,6 s czekania — zanim zbieracz w ogole zaczal szukac meczow.
 var k=kandydaciMeczow().slice(0,3);
 if(zakladkaNr>=k.length){ gotowe(); return; }
 var cel=k[zakladkaNr];
 zakladkaNr++;
 linia.textContent='SBS '+SBS_ZBIERACZ+': otwieram zakladke z meczami ('+zakladkaNr+'/'+k.length+')...';
 if(wolnoKliknac(cel)){try{cel.click();}catch(e){}}
 setTimeout(gotowe,1600);
}
// CZEKAMY NA LISTE MECZOW, A NIE NA UPLYW SZESCIU KROKOW.
//
// Strona grupy pokazuje najpierw tabele; lista rozegranych spotkan siedzi pod nia i doczytuje sie
// dopiero po przewinieciu. Dotad zbieracz przewijal szesc razy po 0,7 s i szedl dalej niezaleznie
// od tego, czy cokolwiek sie pojawilo. Gdy LNP odpowiadalo wolniej, decyzja zapadala na pustej
// stronie: zero wierszy, jeden przypadkowy odnosnik — i panel meldowal "zebrano 1 protokol"
// zamiast calej kolejki.
//
// Teraz przewijamy dopoki lista sie nie pojawi (albo do dwudziestu sekund) i dopiero wtedy
// decydujemy. Warunkiem konca jest ZOBACZENIE danych, nie zmeczenie licznika.
function dociagnijStrone(gotowe){
 var krok=0, MAX=28;
 var t=setInterval(function(){
  krok++;
  // Przewijamy w dol i z powrotem — czesc ukladow doczytuje przy ruchu, nie na samym koncu.
  try{ window.scrollTo(0, document.body.scrollHeight); }catch(e){}
  if(krok % 4 === 0){ try{ window.scrollTo(0, Math.round(document.body.scrollHeight/2)); }catch(e){} }
  var wiecej=[].slice.call(document.querySelectorAll('button,a')).filter(function(el){
   return /zaladuj wiecej|załaduj więcej|pokaz wiecej|pokaż więcej/i.test((el.textContent||'').trim());
  });
  wiecej.filter(wolnoKliknac).forEach(function(el){try{el.click();}catch(e){}});

  var ileLinkow = zbierzLinki().length;
  var ileWierszy = wierszeRozegrane().length;
  ostatnioLinkow = ileLinkow; ostatnioWierszy = ileWierszy; ostatnioKrokow = krok;
  var mamy = ileLinkow >= 2 || ileWierszy >= 2;
  linia.textContent='SBS '+SBS_ZBIERACZ+': szukam rozegranych meczow ('+krok+'/'+MAX+') - odnosnikow '+ileLinkow+', wierszy '+ileWierszy;

  if(mamy || krok>=MAX || zaDlugo()){
   clearInterval(t);
   var k=naglowekRozegranych();
   if(k){ try{ k.scrollIntoView({block:'start'}); }catch(e){} }
   gotowe();
  }
 },700);
}

// ZBIERANIE ZE STRONY DRUŻYNY — sprawdzone na zywej stronie LNP.
//
// Strona druzyny ("Otworz mecze klubu") wymienia wszystkie jej mecze. Klikniecie wiersza otwiera
// protokol, ale w oknie glownym zabiloby zbieracz. Dlatego pracujemy w UKRYTEJ RAMCE: tam
// podmieniamy history.pushState na atrape, ktora zapisuje adres meczu i nie wykonuje przejscia.
// Angular renderuje wtedy protokol W MIEJSCU — mamy i adres, i sklady, a strona stoi nieruszona.
//
// Jeden mecz = jedna ramka. LNP odsyla 404 mniej wiecej co drugi raz, wiec kazdy krok ma az
// dwanascie podejsc — bez tego gubilismy cale druzyny.

// Linijka z rozgrywkami („5 kolejka, Czwarta liga") stoi w naglowku meczu, wysoko nad skladami.
// Ucinalismy tekst 400 znakow przed „Skladu", wiec przy meczu z dlugim przebiegiem ta linijka
// wypadala poza wycinek. SBS nie wiedzial wtedy, jakie to rozgrywki, i nie umial wybrac miedzy
// seniorami a druzyna U17 o tej samej nazwie — „Stomil Olsztyn SA" nie trafial w zaden klub.
function naglowekRozgrywek(txt){
 var linie=String(txt||'').split('\n');
 for(var i=0;i<linie.length;i++){
  var l=linie[i].trim();
  if(/kolejka,/i.test(l) && l.length<120) return l+'\n';
 }
 return '';
}

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
   // Lista rozegranych doczytuje sie dopiero po przewinieciu — w ramce robimy to sami.
   try{ W.scrollTo(0, d.body.scrollHeight); }catch(e){}
   if(/Rozegrany/.test(txt)){
    var w=wierszeRozegraneW(d);
    if(nr>=w.length){ clearInterval(t); f.remove(); gotowe({koniec:true, wierszy:w.length}); return; }
    var op=W.history.pushState, or_=W.history.replaceState;
    W.history.pushState=function(a,b,u){ if(/\/mecz\//.test(String(u||''))){ zlapany=String(u); return; } return op.apply(W.history,arguments); };
    W.history.replaceState=function(a,b,u){ if(/\/mecz\//.test(String(u||''))){ zlapany=String(u); return; } return or_.apply(W.history,arguments); };
    var el=w[nr];
    var cele=[el].concat([].slice.call(el.querySelectorAll('*')).filter(function(x){
     return x.children.length===0 && (x.textContent||'').trim().length>1; }).slice(0,6));
    cele.forEach(function(c){ ['pointerdown','mousedown','mouseup','click'].forEach(function(ty){
     try{ c.dispatchEvent(new W.MouseEvent(ty,{bubbles:true,cancelable:true,view:W,button:0})); }catch(e){} }); });
    faza='protokol'; n=0;
    return;
   }
   if(n>60){ clearInterval(t); f.remove(); gotowe({blad:'brak listy meczow'}); }
   return;
  }

  if(faza==='protokol'){
   // CZEKAMY NA OBA SKLADY, NIE NA PIERWSZY.
   //
   // Protokol renderuje sie czesciami: najpierw gospodarze, chwile pozniej goscie. Zdejmowanie go
   // przy pierwszym "Sklad wyjsciowy" lapalo wiec czasem polowe strony i SBS meldowal potem
   // "nie udalo sie odczytac skladu" — dla tej samej druzyny, ktora w innym meczu wchodzila
   // w komplecie. Kazdy mecz ma dwa sklady, wiec na tyle czekamy.
   //
   // Po szesnastu probach (okolo szesciu sekundach) bierzemy to, co jest: lepiej oddac jedna
   // polowe protokolu niz nie oddac nic. Druga strona i tak dojdzie od swojej druzyny.
   var ileSkladow=(txt.match(/Skład wyjściowy/g)||[]).length;
   if(ileSkladow>=2 || (ileSkladow>=1 && n>16)){
    clearInterval(t);
    var j=txt.search(/^\s*Składy\s*$/m);
    var adres=zlapany ? (location.origin+zlapany) : '';
    // matchAll oddaje ITERATOR, a nie cos podobnego do tablicy — [].slice.call(...) dawalo wiec
    // zawsze pusta liste. Przez to kolejka klubow nigdy sie nie rozwijala i caly przebieg konczyl
    // sie na dwoch startowych druzynach. Zwykle match() oddaje tablice i to dziala.
    var jedyneD=[];
    ((d.documentElement.innerHTML||'').match(/druzyna\/[0-9a-f-]{30,40}/gi)||[]).forEach(function(x){
     var q=x.split('/')[1]; if(jedyneD.indexOf(q)<0) jedyneD.push(q); });
    var wynik={ nr:nr, adres:adres, druzynyZMeczu:jedyneD, tekst:naglowekRozgrywek(txt)+txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(d) };
    f.remove(); gotowe(wynik); return;
   }
   if(n>26){ clearInterval(t); f.remove(); gotowe({blad:'protokol sie nie pokazal'}); }
  }
 },400);
}

// Wiersze rozegranych meczow w PODANYM dokumencie (ramka albo biezaca strona).
// ROZGRYWKI, Z KTORYCH ZBIERAMY. Ustalane raz, na stronie grupy.
//
// Strona klubu na LNP wymienia mecze WSZYSTKICH jego druzyn: pierwszej, rezerw i juniorow.
// Zbieracz ruszal z Centralnej Ligi Juniorow, wchodzil na strone Lecha i zdejmowal protokol
// z Ekstraklasy - dorobek seniorow wladowywalby sie juniorom. Nazwa rozgrywek stoi w kazdym
// wierszu terminarza, wiec filtrujemy po niej.
var ROZGRYWKI_GRUPY = '';

// Nazwa rozgrywek z otwartej strony grupy — bierzemy najczestsza z wierszy terminarza.
function rozpoznajRozgrywki(d){
 var NAZWY=['Centralna Liga Juniorow','Centralna Liga Juniorów','Ekstraklasa','Pierwsza liga',
   'Druga liga','Trzecia liga','Czwarta liga','Klasa okregowa','Klasa okręgowa'];
 var txt=((d||document).body ? (d||document).body.innerText : '')||'';
 var licznik={}, najlepsza='', ile=0;
 NAZWY.forEach(function(n){
  var trafien=(txt.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length;
  if(trafien>ile){ ile=trafien; najlepsza=n; }
  licznik[n]=trafien;
 });
 return ile>=2 ? najlepsza : '';
}

function wierszeRozegraneW(d){
 function maWynik(t){
  var m=t.match(/\d{1,2}\s*:\s*\d{1,2}/g); if(!m) return false;
  for(var i=0;i<m.length;i++){ var x=m[i].replace(/\s+/g,''); if(/^\d{2}:\d{2}$/.test(x)) continue; return true; }
  return false;
 }
 var kand=[].slice.call(d.querySelectorAll('div,li,tr,a,section,article'));
 var out=[];
 for(var i=0;i<kand.length;i++){
  var el=kand[i], t=(el.textContent||'').replace(/\s+/g,' ').trim();
  if(t.length<8||t.length>400) continue;
  if(/Nierozegran/i.test(t)) continue;
  if(!/Rozegrany/i.test(t)) continue;
  if(!maWynik(t)) continue;
  // Mecz z innych rozgrywek tego samego klubu pomijamy — inaczej z Centralnej Ligi Juniorow
  // zeszlibysmy na Ekstraklase.
  if(ROZGRYWKI_GRUPY && t.toLowerCase().indexOf(ROZGRYWKI_GRUPY.toLowerCase())<0) continue;
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
    if(nieudane>40){ gotowe(dodanych); return; }
    setTimeout(dalej, 600); return;
   }
   if(w.adres && w.tekst){
    var wpis='### PROTOKOL: '+w.adres+'\n'+w.tekst;
    var byl=false;
    for(var q=0;q<zebrane.length;q++){ if(zebrane[q].indexOf('### PROTOKOL: '+w.adres+'\n')===0){ zebrane[q]=wpis; byl=true; break; } }
    if(!byl){ zebrane.push(wpis); dodanych++; }
    try{ localStorage.setItem(KLUCZ, JSON.stringify(zebrane)); }catch(e){}
   }
   nr++; nieudane=0;
   setTimeout(dalej, 250);
  });
 }
 dalej();
}


// Adres JEDNEGO meczu z listy w oknie glownym — bez przechodzenia na niego.
// Atrapa pushState zapisuje adres i nie wykonuje przejscia; widok owszem sie zmieni, ale nam
// wystarczy ten jeden adres, bo dalej pracujemy juz po stronach druzyn.
function pierwszyAdresZListy(){
 var w = wierszeRozegrane();
 if(!w.length) return '';
 var op=history.pushState, or_=history.replaceState, zlapany='';
 history.pushState=function(a,b,u){ if(/\/mecz\//.test(String(u||''))){ zlapany=String(u); return; } return op.apply(history,arguments); };
 history.replaceState=function(a,b,u){ if(/\/mecz\//.test(String(u||''))){ zlapany=String(u); return; } return or_.apply(history,arguments); };
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
   var jedyne=[];
   ((d.documentElement.innerHTML||'').match(/druzyna\/[0-9a-f-]{30,40}/gi)||[]).forEach(function(x){
    var q=x.split('/')[1]; if(jedyne.indexOf(q)<0) jedyne.push(q); });
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
   linia.textContent='SBS '+SBS_ZBIERACZ+': klub '+Object.keys(zrobione).length+' z '+(Object.keys(zrobione).length+doZrobienia.length)
    +', mecz '+(nr+1)+', zebranych '+dodanych+(nieudane?' (podejscie '+(nieudane+1)+' - LNP odsyla 404)':'');
   zdejmijMeczZDruzyny(adres, nr, function(w){
    if(w.koniec){ setTimeout(poDruzynie,200); return; }
    if(w.blad){
     nieudane++;
     if(nieudane>45){ setTimeout(poDruzynie,300); return; }
     setTimeout(wiersz, 500); return;
    }
    if(w.adres && w.tekst){
     var wpis='### PROTOKOL: '+w.adres+'\n'+w.tekst;
     var byl=false;
     for(var q=0;q<zebrane.length;q++){ if(zebrane[q].indexOf('### PROTOKOL: '+w.adres+'\n')===0){ zebrane[q]=wpis; byl=true; break; } }
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

 // IDENTYFIKATORY DRUZYN CZYTAMY Z OTWARTEJ STRONY, NIE Z RAMKI.
 //
 // Po klikniecu pierwszego wiersza Angular pokazuje ten mecz JUZ TUTAJ — razem z odnosnikami do
 // obu druzyn. Wczytywanie go po raz drugi w ramce bylo zbedne i zabojcze: jedno 404 z LNP na tym
 // kroku konczylo caly przebieg, zanim cokolwiek zdazyl zebrac. Teraz siegamy po to, co jest
 // pod reka, a ramka zostaje dopiero do wlasciwej pracy.
 linia.textContent='SBS '+SBS_ZBIERACZ+': czytam pierwszy mecz z listy...';
 var adres=pierwszyAdresZListy();
 var czekam=0;
 var t=setInterval(function(){
  czekam++;
  var ids=[];
  try{
   var trafienia=(document.documentElement.innerHTML||'').match(/druzyna\/[0-9a-f-]{30,40}/gi)||[];
   trafienia.forEach(function(x){ var id=x.split('/')[1]; if(ids.indexOf(id)<0) ids.push(id); });
  }catch(e){}
  if(ids.length>=2){
   clearInterval(t);
   doZrobienia=ids.slice();
   linia.textContent='SBS '+SBS_ZBIERACZ+': mam '+ids.length+' klubow na start - zbieram';
   poDruzynie();
   return;
  }
  if(czekam>30){
   clearInterval(t);
   // Ostatnia deska ratunku: mecz z ramki, tak jak dotad — ale juz bez uzaleznienia calego biegu.
   if(!adres){ gotowe(0); return; }
   druzynyZMeczu(adres, function(z){
    if(!z.length){ gotowe(0); return; }
    doZrobienia=z.slice(); poDruzynie();
   });
  }
 },400);
}

function start(){
 if(!CZAS_STARTU){
  CZAS_STARTU = new Date().getTime();
  // BEZ BUDZIKA. Zbieranie konczy sie, gdy skoncza sie mecze — albo gdy uzytkownik nacisnie
  // "Przerwij i pokaz, co mam". Kazdy limit czasu, jaki tu wstawialem, urywal prace w polowie.
 }
 if(zaDlugo()){ koniec(); return; }
 // Ta sama losowa awaria LNP trafia sie na stronie, z ktorej wlasnie startujemy. Nie ma sensu
 // nic z niej czytac — mowimy wprost, co sie stalo, i podajemy jedyne skuteczne lekarstwo.
 if(/Ups! Piłka za boiskiem/.test(document.body.innerText||'') || /\/rozgrywki\/404/.test(location.pathname)){
  box.textContent='';
  // Nawet na stronie bledu mozemy pracowac dalej, jesli adresy meczow sa juz zapamietane.
  var zapas=listaZPamieci();
  if(zapas.length){
   linki=zapas; i=0;
   linia.textContent='SBS '+SBS_ZBIERACZ+': LNP odeslalo 404, ale mam zapamietane '+zapas.length
    +' adresow meczow tej grupy - wczytuje je mimo to.';
   nastepny();
   return;
  }
  var b=document.createElement('div');
  b.style.cssText='margin-bottom:10px;line-height:1.45';
  b.textContent='SBS '+SBS_ZBIERACZ+': LNP odeslalo strone 404. To ich chwilowa awaria - ten sam adres '
   +'zwykle dziala za drugim razem. Wejdz pod niego ponownie (Enter w pasku adresu) i kliknij zakladke jeszcze raz.';
  box.appendChild(b);
  var wroc=document.createElement('button');
  wroc.textContent='Cofnij i sprobuj ponownie';
  wroc.style.cssText='display:block;width:100%;padding:9px;margin-bottom:6px;border:0;border-radius:6px;background:#C9A227;color:#16302A;font:600 13px sans-serif;cursor:pointer';
  wroc.onclick=function(){ ZBIERAM=false; try{history.back();}catch(e){} };
  box.appendChild(wroc);
  var zam=document.createElement('button');
  zam.textContent='Zamknij';
  zam.style.cssText='display:block;width:100%;padding:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
  zam.onclick=function(){ box.remove(); };
  box.appendChild(zam);
  return;
 }
 // STRONA DRUZYNY — tu jest komplet meczow tego klubu i tu zbieranie dziala najpewniej.
 if(location.pathname.indexOf('/druzyna/')>=0){
  linia.textContent='SBS '+SBS_ZBIERACZ+': strona druzyny - zbieram jej mecze';
  zbierzZeStronyDruzyny(function(ile){ koniec(); });
  return;
 }
 if(/\/mecz\//.test(location.pathname)){
  // Na stronie meczu bierzemy ten jeden — i MOWIMY O TYM W PANELU. Bez tego wyglada, jakby
  // zakladka zebrala cala kolejke i znalazla w niej tylko jeden mecz.
  trybJedenMecz = true;
  linia.textContent='SBS '+SBS_ZBIERACZ+': jestes na stronie meczu - zbieram ten jeden';
  linki=[location.href];nastepny();return;
 }
 if(!rozwiniete){
  rozwiniete=true;
  linia.textContent='SBS '+SBS_ZBIERACZ+': rozwijam liste meczow...';
  otworzZakladkeMecze(function(){ dociagnijStrone(start); });
  return;
 }
 linki=zbierzLinki();
 // JEDEN ODNOSNIK PRZY DWUDZIESTU MECZACH NA EKRANIE TO NIE KOMPLET.
 //
 // Strona druzyny pokazuje wszystkie rozegrane spotkania, ale wiersze nie sa odnosnikami —
 // Angular otwiera mecz kliknieciem. Zbieracz znajdowal wtedy jeden przypadkowy adres, uznawal
 // go za cala liste i konczyl prace z jednym protokolem zamiast dwudziestu. Gdy wierszy
 // z wynikiem jest wyraznie wiecej niz odnosnikow, idziemy droga klikania.
 var ileWierszy=wierszeRozegrane().length;
 // Lista z pamieci ratuje sytuacje, gdy strona wrocila pusta — a to na LNP norma, nie wyjatek.
 if(!linki.length){
  var zpam=listaZPamieci();
  if(zpam.length){
   linki=zpam;i=0;
   linia.textContent='SBS '+SBS_ZBIERACZ+': strona nie oddala listy meczow, biore zapamietane '+linki.length+' adresow';
   nastepny();return;
  }
 }
 if(linki.length && !(ileWierszy>=2 && linki.length*2<ileWierszy)){
  zapamietajListe(linki);
  linia.textContent='SBS '+SBS_ZBIERACZ+': zbieram protokoly 0/'+linki.length;nastepny();return;
 }
 // LISTA MECZOW NA TEJ STRONIE — ZBIERAMY PRZEZ UKRYTA RAMKE.
 //
 // Ta sama droga, ktora sprawdzila sie na stronie druzyny. Wiersze nie sa odnosnikami: klikniecie
 // otwiera mecz przez router Angulara i wyprowadza okno, zabijajac zbieracz. W ramce tego problemu
 // nie ma — podmieniona atrapa pushState zapisuje adres, protokol renderuje sie w miejscu,
 // a strona nadrzedna stoi nietknieta. Dziala tak samo na liscie rozgrywek, jak i u pojedynczego
 // klubu, wiec nie trzeba juz wchodzic w kazdy klub z osobna.
 if(!probowanoKlikac && ileWierszy>=2){
  probowanoKlikac=true;
  // Zapamietujemy rozgrywki TEJ strony, zanim ruszymy po klubach — dalej filtrujemy nimi wiersze
  // na stronach druzyn, ktore wymieniaja mecze wszystkich zespolow klubu naraz.
  ROZGRYWKI_GRUPY = rozpoznajRozgrywki(document);
  if(ROZGRYWKI_GRUPY) linia.textContent='SBS '+SBS_ZBIERACZ+': rozgrywki - '+ROZGRYWKI_GRUPY;
  // HERBY BIERZEMY OD RAZU, ZANIM RUSZYMY PO PROTOKOLY.
  //
  // Osobny przycisk w panelu zostaje, ale nikt nie ma obowiazku go szukac: tabela grupy jest
  // wlasnie na ekranie i to jedyny moment, w ktorym herby sa pod reka. Zbieranie ich nic nie
  // kosztuje - czytamy to, co juz widac, niczego nie klikajac.
  try{
   var herby=herbyZTabeli();
   if(herby.length>=4){
    var wpisH='### KLUBY\n'+herby.join('\n');
    var bylH=false;
    for(var qh=0;qh<zebrane.length;qh++){ if(zebrane[qh].indexOf('### KLUBY\n')===0){ zebrane[qh]=wpisH; bylH=true; break; } }
    if(!bylH) zebrane.push(wpisH);
    try{ localStorage.setItem(KLUCZ, JSON.stringify(zebrane)); }catch(e){}
   }
  }catch(e){}
  linia.textContent='SBS '+SBS_ZBIERACZ+': na ekranie '+ileWierszy+' rozegranych meczow - zbieram protokoly';
  zbierzGrupePrzezDruzyny(function(){ koniec(); });
  return;
 }
 czekam++;
 if(czekam<6){linia.textContent='SBS '+SBS_ZBIERACZ+': czekam, az strona sie zaladuje...';setTimeout(start,500);return;}
 if(!probowanoKlikac&&wierszeRozegrane().length){
  probowanoKlikac=true;
  zbierzAdresyPrzezKlikanie(function(adresy){
   if(adresy.length){
    linki=adresy;i=0;
    linia.textContent='SBS '+SBS_ZBIERACZ+': zbieram protokoly 0/'+linki.length;
    nastepny();return;
   }
   czekam=0;start();
  });
  return;
 }
 if(zakladkaNr<kandydaciMeczow().length){
  rozwiniete=false; czekam=0; probowanoKlikac=false;
  start();
  return;
 }
 box.remove();
 var wszystkieA=document.querySelectorAll('a').length;
 var zMecz=[].slice.call(document.querySelectorAll('a')).filter(function(a){return /mecz/i.test(a.getAttribute('href')||'');}).length;
 var dlugoscTekstu=(document.body.innerText||'').length;
 var zKodu=0;try{var hh=document.documentElement.innerHTML||'';var rr=/\/rozgrywki\/mecz\/[0-9a-fA-F-]{30,40}/g;var mm;while((mm=rr.exec(hh))!==null)zKodu++;}catch(e){}
 var maRozegrane=/rozegrane mecze/i.test(document.body.innerText||'');
 var slad=' [na stronie: odnosnikow '+wszystkieA+', w tym wskazujacych na mecz '+zMecz+'; numerow meczu w kodzie '+zKodu+'; wierszy z wynikiem '+wierszyNaEkranie+'; naglowek Rozegrane mecze: '+(maRozegrane?'jest':'brak')+'; tekstu '+dlugoscTekstu+' znakow; wysokosc '+document.body.scrollHeight+']';
 // TABELA TO NIE LISTA MECZOW. Najczestsza pomylka: zakladka uruchamiana na tabeli ligowej,
 // gdzie sa punkty i bilans, a nie ma ani jednego protokolu. Rozpoznajemy to po naglowkach
 // kolumn i mowimy wprost, dokad przejsc \u2014 zamiast ogolnego "nie mam czego pobrac".
 var tekstStrony=(document.body.innerText||'');
 var toTabela = /\bPunkty\b/i.test(tekstStrony) && /\bBilans\b/i.test(tekstStrony)
   && /\bWygrane\b/i.test(tekstStrony) && zMecz===0 && zKodu===0;
 // STRONA BLEDU TO NIE PUSTA KOLEJKA. Zapamietany adres grupy potrafi sie zdezaktualizowac —
 // LNP trzyma w nim identyfikatory sezonu i grupy, a te zmieniaja sie miedzy sezonami. Wtedy
 // otwiera sie 404 i rada "sprawdz pole Sezon" jest bez sensu, bo na stronie bledu nie ma
 // zadnych pol. Mowimy wprost, ze trzeba podac nowy adres.
 var to404 = /\b404\b/.test(tekstStrony) && /ups|nie znaleziono|not found/i.test(tekstStrony);
 var rada = to404
  ? 'To jest strona bledu 404 - zapamietany adres tej grupy jest juz nieaktualny (LNP zmienia identyfikatory miedzy sezonami).\n\nW aplikacji: Kluby -> wybierz te grupe -> przycisk "Link LNP dla grupy" -> wklej tam ADRES Z PASKA przegladarki, gdy bedziesz na dzialajacej liscie meczow tej grupy.'
  : toTabela
  ? 'Jestes na TABELI LIGOWEJ - sa tu punkty i bilans, ale nie ma protokolow. Przejdz do listy meczow tej grupy: u gory wybierz "Kolejka", zeby pokazaly sie spotkania z wynikami, i dopiero tam kliknij zakladke.'
  : maRozegrane
  ? 'Sekcja \u201eRozegrane mecze\u201d jest, ale nie widze w niej ani jednego wiersza z wynikiem. Poczekaj, az wyniki sie wyswietla, i kliknij zakladke jeszcze raz.'
  : 'Na tej stronie sa same \u201ePlanowane mecze\u201d - w tym sezonie nie ma tu jeszcze zadnego rozegranego spotkania. Sprawdz u gory pole \u201eSezon\u201d i \u201eRozgrywki\u201d: wybierz sezon, w ktorym mecze juz sie odbyly.';
 alert('SBS '+SBS_ZBIERACZ+': nie mam z tej strony czego pobrac.\n\n'+rada+slad);
 // Bufor moze byc pelen protokolow z innej grupy — daj go wyczyscic bez szukania skrotu.
 if(zebrane.length && box.parentNode){
  box.textContent='';
  var inf=document.createElement('div');
  inf.style.cssText='margin-bottom:8px;line-height:1.45';
  inf.textContent='W buforze zakladki leza jeszcze protokoly z poprzednich zebran: '+zebrane.length+'.';
  box.appendChild(inf);
  var czysc=document.createElement('button');
  czysc.textContent='Wyczysc zebrane ('+zebrane.length+')';
  czysc.style.cssText='display:block;width:100%;padding:8px;margin-bottom:6px;border:0;border-radius:6px;background:#C9A227;color:#16302A;font:600 13px sans-serif;cursor:pointer';
  czysc.onclick=function(){
   try{localStorage.removeItem(KLUCZ);}catch(e){}
   zebrane=[];
   linia.textContent='SBS '+SBS_ZBIERACZ+': wyczyscilem bufor. Wejdz na liste meczow wlasciwej grupy i kliknij zakladke.';
  };
  box.appendChild(czysc);
  var x=document.createElement('button');
  x.textContent='Zamknij';
  x.style.cssText='display:block;width:100%;padding:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
  x.onclick=function(){ box.remove(); };
  box.appendChild(x);
 }
}

// LNP ODSYLA 404 LOSOWO \u2014 I TO BYLA PRAWDZIWA PRZYCZYNA "NIE ZGRYWA STATYSTYK".
//
// Sprawdzone na zywym adresie meczu: pierwsze wejscie konczy sie strona "404 Ups! Pilka za
// boiskiem", drugie wejscie pod TEN SAM adres oddaje pelny protokol ze skladami. Dotyczy to tak
// samo stron grup, jak i stron meczow, i zdarza sie mniej wiecej co drugie zadanie.
//
// Zbieracz wczytywal kazdy mecz w ramce i przy 404 po prostu go pomijal - po cichu, bo warunek
// mowil tylko "nie ma skladu". Polowa kolejki znikala bez sladu, a na koncu widac bylo mniej
// protokolow, niz meczow na ekranie. Dlatego kazdy mecz dostaje teraz trzy podejscia.
// Zmierzone na zywej stronie: przy trzech podejsciach jeden mecz na piec i tak przepadal.
// Dlatego podejsc jest piec, a te, ktore mimo to nie weszly, wracaja w DRUGIEJ TURZE na koncu —
// awaryjnosc LNP jest losowa, wiec ponowienie po kilkudziesieciu sekundach zwykle trafia lepiej.
var PODEJSC = 10;
var nieudanych = 0, nieudaneUrl = [];
function nastepny(){
 if(i>=linki.length){ poKolejce(); return; }
 wczytajMecz(linki[i], 0);
}
function wczytajMecz(url, podejscie){
 linia.textContent='SBS '+SBS_ZBIERACZ+': kolejka '+kolejek+' - protokoly '+i+'/'+linki.length
  +(podejscie?' (podejscie '+(podejscie+1)+')':'')+' (razem '+zebrane.length+')';
 var f=document.createElement('iframe');
 f.style.cssText='position:fixed;left:-9999px;width:1200px;height:2000px';
 f.src=url;document.body.appendChild(f);
 var prob=0;
 var t=setInterval(function(){
  prob++;
  var txt='';
  try{txt=(f.contentDocument&&f.contentDocument.body)?f.contentDocument.body.innerText:'';}catch(e){txt='';}
  var ok=/Sk\u0142ad wyj\u015bciowy/.test(txt);
  var bladLnp=/Ups! Pi\u0142ka za boiskiem/.test(txt) || /\/rozgrywki\/404/.test((function(){try{return f.contentWindow.location.pathname;}catch(e){return '';}})());
  // Przy 404 nie ma na co czekac \u2014 wchodzimy pod ten sam adres jeszcze raz, i to od razu.
  if(bladLnp && podejscie < PODEJSC-1){
   clearInterval(t); f.remove();
   setTimeout(function(){ wczytajMecz(url, podejscie+1); }, 400);
   return;
  }
  if(ok||prob>20){
   clearInterval(t);
   if(ok){
    // Adresy profili zbieramy przy okazji \u2014 dokument meczu i tak jest juz wczytany.
    zbierzProfile(f.contentDocument);
    var j=txt.search(/^\s*Sk\u0142ady\s*$/m);
    var wpis='### PROTOKOL: '+url+'\n'+naglowekRozgrywek(txt)+txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(f.contentDocument);
    var byl=false;
    for(var q=0;q<zebrane.length;q++){if(zebrane[q].indexOf('### PROTOKOL: '+url+'\n')===0){zebrane[q]=wpis;byl=true;break;}}
    if(!byl)zebrane.push(wpis);
   } else { nieudanych++; if(nieudaneUrl.indexOf(url)<0) nieudaneUrl.push(url); }
   f.remove();i++;setTimeout(nastepny,300);
  }
 },500);
}

function maWynikMeczu(t){
 var m=t.match(/\d{1,2}\s*:\s*\d{1,2}/g);
 if(!m) return false;
 for(var i=0;i<m.length;i++){
  var s=m[i].replace(/\s+/g,'');
  if(/^\d{2}:\d{2}$/.test(s)) continue;
  return true;
 }
 return false;
}
function naglowekRozegranych(){
 var kand=[].slice.call(document.querySelectorAll('h1,h2,h3,h4,div,span,p'));
 for(var i=0;i<kand.length;i++){
  if(kand[i].children.length) continue;
  var t=(kand[i].textContent||'').replace(/\s+/g,' ').trim();
  if(/^rozegrane mecze$/i.test(t)) return kand[i];
 }
 return null;
}
// Wiersze rozegranych meczow — szukane po TRESCI, nie po znacznikach.
//
// Pierwotnie pytalismy o "tr, li, [class*=match]". Na liscie kolejek to wystarczalo, ale strona
// DRUZYNY (/rozgrywki/druzyna/...?tab=tab-mecz) buduje wiersze z wlasnych komponentow Angulara
// bez zadnej z tych klas — zbieracz mowil "wierszy z wynikiem 0" i konczyl prace, choc mecze
// byly na ekranie. Do tego filtr "tylko ponizej naglowka Rozegrane mecze" potrafil odciac
// wszystko, gdy naglowek stoi gdzie indziej niz lista.
//
// Dlatego szukamy szeroko i schodzimy tylko wtedy, gdy weziej nic nie znalezlismy. Kryterium
// jest tresc: wynik meczu plus data albo slowo "Rozegrany". Z zagniezdzonych trafien zostawiamy
// najglebsze, zeby nie wziac calej listy jako jednego wiersza.
function wierszeZSelektora(szuk, stosujGranice){
 var kand=[].slice.call(document.querySelectorAll(szuk));
 var granica=stosujGranice?naglowekRozegranych():null;
 var out=[];
 for(var i=0;i<kand.length;i++){
  var el=kand[i], t=(el.textContent||'').replace(/\s+/g,' ').trim();
  if(t.length<8||t.length>400) continue;
  if(/nierozegran|odwołan|przełożon/i.test(t)) continue;
  if(!maWynikMeczu(t)) continue;
  if(!/rozegran/i.test(t)&&!/\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}/.test(t)) continue;
  if(granica&&!(granica.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)) continue;
  out.push(el);
 }
 var fin=[];
 for(var a=0;a<out.length;a++){
  var zawiera=false;
  for(var b=0;b<out.length;b++){ if(a!==b&&out[a].contains(out[b])){zawiera=true;break;} }
  if(!zawiera) fin.push(out[a]);
 }
 return fin;
}
function wierszeRozegrane(){
 var waski='tr,li,[role="row"],[class*="match"],[class*="mecz"],[class*="Match"]';
 var szeroki=waski+',div,section,article,a';
 var fin=wierszeZSelektora(waski,true);
 if(!fin.length) fin=wierszeZSelektora(waski,false);      // naglowek stal w zlym miejscu
 if(!fin.length) fin=wierszeZSelektora(szeroki,true);     // wlasne komponenty Angulara
 if(!fin.length) fin=wierszeZSelektora(szeroki,false);    // i jedno, i drugie naraz
 wierszyNaEkranie=fin.length;
 return fin.slice(0,80);
}
function celeKlikania(el){
 var c=[];
 try{
  var a=el.querySelector('a[href],button,[role="link"],[role="button"]');
  if(a) c.push(a);
 }catch(e){}
 c.push(el);
 try{
  var dz=[].slice.call(el.querySelectorAll('*'));
  for(var i=0;i<dz.length&&c.length<6;i++){
   if(dz[i].children.length) continue;
   if((dz[i].textContent||'').trim().length<2) continue;
   if(c.indexOf(dz[i])<0) c.push(dz[i]);
  }
 }catch(e){}
 return c;
}
function zbierzAdresyPrzezKlikanie(gotowe){
 var baza=location.href, bazaP=location.pathname+location.search;
 var wiersze=wierszeRozegrane();
 if(!wiersze.length){ gotowe([]); return; }
 var adresy=[], k=0, zlapane=[], staryOpen=window.open;
 // Tu wychodzenie ze strony jest metoda, nie awaria — uchylamy rygiel na czas tej drogi.
 POZWOL_NAWIGACJE=true;
 try{ window.open=function(u){ if(u) zlapane.push(String(u)); return null; }; }catch(e){}
 function skoncz(){
  POZWOL_NAWIGACJE=false;
  try{ window.open=staryOpen; }catch(e){}
  var meczowe=adresy.filter(function(u){ return /mecz|match|spotkan/i.test(u); });
  gotowe(meczowe.length?meczowe:adresy);
 }
 function dodajAdres(u){
  var pelny='';
  try{ pelny=new URL(u,location.origin).href; }catch(e){ return; }
  if(pelny===baza) return;
  if(adresy.indexOf(pelny)<0) adresy.push(pelny);
 }
 function wroc(dalejGotowe){
  try{ history.back(); }catch(e){}
  var n=0;
  var t=setInterval(function(){
   n++;
   if(location.pathname+location.search===bazaP){ clearInterval(t); setTimeout(dalejGotowe,700); return; }
   if(n>=25){ clearInterval(t); skoncz(); }
  },200);
 }
 function dalej(){
  if(k>=wiersze.length){ skoncz(); return; }
  linia.textContent='SBS '+SBS_ZBIERACZ+': otwieram mecz '+(k+1)+'/'+wiersze.length+' (adresow '+adresy.length+')';
  var lista=wierszeRozegrane();
  var el=lista[k]||wiersze[k];
  if(!el||!el.isConnected){ k++; setTimeout(dalej,80); return; }
  var cele=celeKlikania(el), ci=0;
  function probuj(){
   if(ci>=cele.length){ k++; setTimeout(dalej,120); return; }
   var cel=cele[ci++];
   zlapane.length=0;
   // TU NAWIGACJA JEST ZAMIERZONA i nie wolno jej blokowac. Ta droga jest awaryjna: uruchamia sie
   // dopiero, gdy na stronie nie da sie znalezc odnosnikow do meczow, a sa widoczne wiersze
   // z wynikiem. Zbieracz wchodzi wtedy w mecz, zapisuje adres i wraca przez history.back().
   // Strażnik wolnoKliknac() chroni miejsca, gdzie klikamy w element STERUJACY TRESCIA — tam
   // wyjscie ze strony jest awaria. Tutaj jest metoda.
   try{ cel.click(); }catch(e){}
   var n=0;
   var t=setInterval(function(){
    n++;
    if(zlapane.length){ clearInterval(t); dodajAdres(zlapane[0]); k++; setTimeout(dalej,120); return; }
    if(location.pathname+location.search!==bazaP){
     clearInterval(t);
     dodajAdres(location.href);
     wroc(function(){ k++; dalej(); });
     return;
    }
    if(n>=12){ clearInterval(t); probuj(); }
   },100);
  }
  probuj();
 }
 dalej();
}
function poKolejce(){
 try{localStorage.setItem(KLUCZ,JSON.stringify(zebrane));}catch(e){}
 var swieze=zbierzLinki().filter(function(u){
  for(var q=0;q<zebrane.length;q++) if(zebrane[q].indexOf('### PROTOKOL: '+u+'\n')===0) return false;
  return true;
 });
 if(swieze.length&&doliczen<6){
  doliczen++;
  linia.textContent='SBS '+SBS_ZBIERACZ+': doszlo '+swieze.length+' meczow - zbieram dalej';
  linki=swieze;i=0;nastepny();return;
 }
 var wybor=listaKolejek();
 if(wybor&&wybor.selectedIndex+1<wybor.options.length&&kolejek<40){
  kolejek++;
  linia.textContent='SBS '+SBS_ZBIERACZ+': przechodze do kolejki '+kolejek+'...';
  var poprzednie=linki.join('|');
  wybor.selectedIndex=wybor.selectedIndex+1;
  wybor.dispatchEvent(new Event('change',{bubbles:true}));
  var czek=0;
  var licz=setInterval(function(){
   czek++;
   var teraz=zbierzLinki();
   if(teraz.length&&teraz.join('|')!==poprzednie){clearInterval(licz);linki=teraz;i=0;nastepny();return;}
   if(czek>16){clearInterval(licz);koniec();}
  },500);
  return;
 }
 koniec();
}

// ---------------------------------------------------------------------------
// ROCZNIKI Z PROFILI ZAWODNIKOW
//
// Protokol podaje nazwisko, numer i znacznik mlodziezowca — ale NIE date urodzenia. Bez rocznika
// kartoteka IV ligi zostaje bez wieku, a to wlasnie tam gra najwiecej mlodziezy.
//
// Data urodzenia jest w PROFILU zawodnika, pod stalym adresem, do ktorego protokol linkuje.
// Zbieramy te adresy przy okazji czytania protokolow (nic to nie kosztuje), a potem odwiedzamy
// tylko te profile, ktorych rocznika jeszcze nie znamy.
//
// Wynik zapamietujemy w przegladarce NA STALE. Przy drugim uruchomieniu tej samej grupy nie ma
// juz czego dobierac — inaczej kazde zbieranie kolejki oznaczalo trzysta dodatkowych wczytan.
var KLUCZ_ROCZNIKI='sbs_roczniki';
var profileZawodnikow={};
var roczniki={};
try{roczniki=JSON.parse(localStorage.getItem(KLUCZ_ROCZNIKI)||'{}');}catch(e){roczniki={};}

function kluczOsoby(s){
 return String(s||'').toLowerCase()
  .replace(/[łøđ]/g,function(c){return {'ł':'l','ø':'o','đ':'d'}[c];})
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
}

function zbierzProfile(doc){
 try{
  var a=doc.querySelectorAll('a[href*="/zawodnik/"]');
  for(var i=0;i<a.length;i++){
   var nazwa=(a[i].textContent||'').replace(/\s+/g,' ').replace(/\(.\)/g,'').trim();
   // Podpis odnosnika bywa sama strzalka albo "Zobacz profil" — nazwisko jest wtedy obok.
   if(!/[a-zA-ZÀ-ſ]{3,}/.test(nazwa)||/zobacz profil/i.test(nazwa)){
    var w=a[i].closest('tr,li,div');
    nazwa=w?(w.textContent||'').replace(/\s+/g,' ').replace(/\d+/g,'').replace(/\(.\)/g,'').replace(/zobacz profil.*/i,'').trim():'';
   }
   var k=kluczOsoby(nazwa);
   if(k&&k.indexOf(' ')>0&&!profileZawodnikow[k]) profileZawodnikow[k]=a[i].href;
  }
 }catch(e){}
}

function rocznikZTekstu(t){
 var s=String(t||'');
 // Rok STOI PIERWSZY w zapisie ISO (1990-05-02) i ostatni w polskim (14.03.2007). Sprawdzamy
 // ISO wczesniej, bo inaczej "1990-05-02" dalby rocznik 0002 z drugiego wzorca.
 var m=s.match(/urodz\w*[^0-9]{0,30}((?:19|20)\d{2})[.\-\/]\d{1,2}[.\-\/]\d{1,2}/i);
 if(m) return m[1];
 m=s.match(/urodz\w*[^0-9]{0,30}\d{1,2}[.\-\/]\d{1,2}[.\-\/]((?:19|20)\d{2})/i);
 if(m) return m[1];
 m=s.match(/urodz\w*[^0-9]{0,30}\d{1,2}\s+[a-ząćęłńóśźż]+\s+((?:19|20)\d{2})/i);
 if(m) return m[1];
 return '';
}

function pobierzRoczniki(gotowe){
 var doZrobienia=[];
 for(var k in profileZawodnikow){ if(!roczniki[k]) doZrobienia.push(k); }
 // Limit na jedno uruchomienie. Pierwsza kolejka w grupie to okolo trzystu zawodnikow —
 // wczytywanie wszystkich naraz trwaloby kilkanascie minut i wygladalo na zawieszenie.
 // Reszta dobierze sie przy kolejnym zbieraniu, bo to, co juz wiemy, zostaje zapamietane.
 var LIMIT=60;
 var zostalo=Math.max(0,doZrobienia.length-LIMIT);
 doZrobienia=doZrobienia.slice(0,LIMIT);
 if(!doZrobienia.length){ gotowe(0,0); return; }
 var n=0, zdobyte=0;
 function nastepnyProfil(){
  if(n>=doZrobienia.length){
   try{localStorage.setItem(KLUCZ_ROCZNIKI,JSON.stringify(roczniki));}catch(e){}
   gotowe(zdobyte,zostalo); return;
  }
  var k=doZrobienia[n];
  linia.textContent='SBS '+SBS_ZBIERACZ+': roczniki '+(n+1)+'/'+doZrobienia.length+(zostalo?' (zostanie '+zostalo+' na potem)':'');
  var f=document.createElement('iframe');
  f.style.cssText='position:fixed;left:-9999px;width:1000px;height:1400px';
  f.src=profileZawodnikow[k];
  document.body.appendChild(f);
  var prob=0;
  var t=setInterval(function(){
   prob++;
   var txt='';
   try{txt=(f.contentDocument&&f.contentDocument.body)?f.contentDocument.body.innerText:'';}catch(e){txt='';}
   var r=rocznikZTekstu(txt);
   if(r||prob>14){
    clearInterval(t);
    if(r){ roczniki[k]=r; zdobyte++; }
    f.remove(); n++; setTimeout(nastepnyProfil,120);
   }
  },500);
 }
 nastepnyProfil();
}

function blokRocznikow(){
 var linie=[];
 for(var k in roczniki){ if(roczniki[k]) linie.push(k+'|'+roczniki[k]); }
 return linie.length?('\n\n### ROCZNIKI\n'+linie.join('\n')):'';
}

function koniec(){
 if(koniec.pokazano) return;               // panel pokazujemy raz — strażnik czasu może wejść w trakcie
 // DRUGA TURA DLA TYCH, KTORE PRZEPADLY.
 //
 // Zmierzone na zywej stronie: przy pieciu podejsciach pod rzad zdarza sie mecz, ktory i tak nie
 // wchodzi — awaryjnosc LNP potrafi trzymac sie kilkunastu sekund. Ponowienie po przejsciu calej
 // kolejki trafia w zupelnie inny moment, wiec te resztki zwykle wchodza bez problemu.
 // Zmierzone: jedna dodatkowa tura odzyskala polowe resztek, ale nie wszystko. Awaryjnosc LNP
 // potrafi trzymac sie kilkunastu sekund pod rzad, wiec powtarzamy az do skutku — do czterech
 // tur, z rosnaca przerwa. Konczymy wczesniej, gdy tura nic nie odzyskala: to znak, ze problem
 // nie jest chwilowy i dalsze dobijanie sie nic nie da.
 koniec.tura = koniec.tura || 0;
 if(!PRZERWANO_CZASEM && !koniec.bezSensu && nieudaneUrl.length){
  var przedTura = nieudaneUrl.length;
  if(koniec.tura > 0 && przedTura >= koniec.poprzednioNieudanych){
   koniec.bezSensu = true;                // ostatnia tura nic nie odzyskala — dalsze proby nic nie dadza
  } else {
   koniec.tura++;
   koniec.poprzednioNieudanych = przedTura;
   linia.textContent='SBS '+SBS_ZBIERACZ+': '+przedTura+' meczow nie weszlo - tura '+(koniec.tura+1)
    +' (LNP odsyla 404 losowo, probuje dalej)';
   linki = nieudaneUrl.slice();
   nieudaneUrl = []; nieudanych = 0; i = 0;
   setTimeout(nastepny, 1500 * koniec.tura);
   return;
  }
 }
 // Roczniki dobieramy PRZED skopiowaniem, zeby poleicaly razem z protokolami — jedno wklejenie
 // w aplikacji ma zalatwic i statystyki, i wiek.
 if(!PRZERWANO_CZASEM && !koniec.poRocznikach){
  koniec.poRocznikach=true;
  pobierzRoczniki(function(zdobyte,zostalo){
   linia.textContent='SBS '+SBS_ZBIERACZ+': roczniki gotowe (+'+zdobyte+')';
   koniec();
  });
  return;
 }
 try{localStorage.setItem(KLUCZ,JSON.stringify(zebrane));}catch(e){}
 var tresc=zebrane.join('\n\n')+blokRocznikow();

 // OSTATNI KROK MUSI ZACZAC SIE OD KLIKNIECIA.
 //
 // Zbieranie trwa dziesiatki sekund i konczy sie w kodzie asynchronicznym - a wtedy przegladarka
 // (zwlaszcza Firefox) blokuje i window.open, i zapis do schowka, bo nie stoi za nimi zaden gest
 // uzytkownika. Objaw byl mylacy: zakladka mowila, ze zebrala protokoly, okno SBS sie nie
 // otwieralo, a w schowku zostawalo to, co bylo tam wczesniej. Wygladalo na zepsute wklejanie.
 //
 // Dlatego nie wysylamy nic sami. Pokazujemy przycisk; jego klikniecie jest gestem, wiec i okno,
 // i schowek dzialaja bez wyjatkow.
 koniec.pokazano=true;
 box.textContent='';
 box.style.maxWidth='320px';
 var opis=document.createElement('div');
 opis.style.cssText='margin-bottom:10px;line-height:1.45';
 // PANEL MA POWIEDZIEC TRZY RZECZY: ile zebrano, czy to komplet i CO ZROBIC DALEJ.
 // Samo "zebrane protokoly: 32" nie mowilo, czy statystyki sa juz w SBS — a nie sa: klikniecie
 // zakladki tylko zbiera, wgranie dzieje sie dopiero po "Wyslij do SBS" i "Zapisz protokoly".
 var nowych = zebrane.length - bylo;
 opis.innerHTML = '<div style="font-weight:600;margin-bottom:6px">SBS ' + SBS_ZBIERACZ + '</div>'
  + (nowych > 0
     ? '<div style="color:#9BD8A6">Zebrano ' + nowych + ' nowych protokolow.</div>'
     : '<div style="color:#F0C674">Nie zebralem ani jednego nowego protokolu.</div>'
        + '<div style="margin-top:4px;font-size:12px;opacity:.85">Co widzialem na stronie: odnosnikow do meczow ' + ostatnioLinkow
        + ', wierszy z wynikiem ' + ostatnioWierszy + ', nierozegranych ' + pominietych + ' (krokow szukania ' + ostatnioKrokow + ').</div>')
  + '<div style="margin-top:4px">W buforze razem: ' + zebrane.length + '</div>'
  + (pominietych ? '<div>Pominiete (nierozegrane): ' + pominietych + '</div>' : '')
  + (nieudanych ? '<div style="color:#F0A0A0">Nie udalo sie odczytac: ' + nieudanych + ' (LNP odsylalo 404)</div>' : '')
  + (PRZERWANO_CZASEM ? '<div style="color:#F0C674">Przerwane recznie — ponizej to, co zdazylem zebrac.</div>' : '')
  + (trybJedenMecz ? '<div style="margin-top:6px;color:#F0C674">To byla strona JEDNEGO meczu, wiec zebralem tylko jego. Zeby wziac cala kolejke, kliknij zakladke na stronie z TABELA grupy.</div>' : '')
  + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(246,243,234,.2);font-size:12.5px;line-height:1.5">'
  + 'To dopiero ZEBRANIE. Statystyk jeszcze nie ma w SBS — kliknij ponizej, a potem w SBS '
  + '<b>Zapisz protokoly</b>.</div>';
 box.appendChild(opis);
 var przycisk=document.createElement('button');
 przycisk.textContent='Wyslij do SBS ('+zebrane.length+')';
 przycisk.style.cssText='display:block;width:100%;padding:10px 14px;margin-bottom:6px;border:0;border-radius:6px;background:#C9A227;color:#16302A;font:600 14px sans-serif;cursor:pointer';
 box.appendChild(przycisk);
 // CZYSZCZENIE MUSI BYC PRZYCISKIEM, NIE SKROTEM KLAWISZOWYM.
 //
 // Dotad bufor czyscilo Shift + klikniecie zakladki. W Chrome to dziala, ale FIREFOX na
 // Shift + klikniecie bookmarka otwiera go w NOWYM OKNIE - zakladka uruchamia sie wtedy na
 // pustej karcie i mowi "to nie jest strona Laczy nas pilka". Gest byl wiec nie do wykonania
 // akurat w przegladarce, ktorej uzywamy.
 // OPIS STRONY DO SCHOWKA — zeby dalo sie naprawic zbieranie bez zgadywania.
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
   dane.idWKodzie = (document.documentElement.innerHTML.match(/mecz\/[0-9a-f-]{30,40}/gi)||[]).length;
   dane.slowoRozegrany = ((document.body.innerText||'').match(/Rozegrany/g)||[]).length;
   dane.wierszyZWynikiem = wierszeRozegrane().length;
   // Bierzemy element z samym wynikiem (np. "3:0") i wychodzimy w gore po rodzicach — tam siedzi
   // caly wiersz. Jego budowa mowi, czego szukac, zeby wyciagnac adres meczu.
   var wyniki=[].slice.call(document.querySelectorAll('*')).filter(function(e){
    return e.children.length===0 && /^\d{1,2}\s*:\s*\d{1,2}$/.test((e.textContent||'').trim());
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
 var wyczysc=document.createElement('button');
 wyczysc.textContent='Wyczysc zebrane ('+zebrane.length+')';
 wyczysc.style.cssText='display:block;width:100%;padding:6px;margin-bottom:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
 wyczysc.onclick=function(){
  try{localStorage.removeItem(KLUCZ);}catch(e){}
  zebrane=[];
  linia.textContent='SBS '+SBS_ZBIERACZ+': wyczyscilem zebrane protokoly. Kliknij zakladke jeszcze raz, zeby zebrac te grupe od nowa.';
 };
 box.appendChild(wyczysc);
 var zamknij=document.createElement('button');
 zamknij.textContent='Zamknij';
 zamknij.style.cssText='display:block;width:100%;padding:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
 zamknij.onclick=function(){ box.remove(); };
 box.appendChild(zamknij);
 przycisk.onclick=function(){ wyslij(tresc); };
 return;
}

// Wysylka odpalana KLIKNIECIEM — stad wolno jej otwierac okno i pisac do schowka.
function wyslij(tresc){
 var udalo=false;
 var p=document.createElement('textarea');p.value=tresc;document.body.appendChild(p);p.select();
 try{udalo=document.execCommand('copy');}catch(e){udalo=false;}
 document.body.removeChild(p);
 if(!udalo&&navigator.clipboard&&navigator.clipboard.writeText){
  try{navigator.clipboard.writeText(tresc);udalo=true;}catch(e){}
 }
 var doSbs=SBS_ADRES+'/app?sbs=odbior';
 linia.textContent='SBS '+SBS_ZBIERACZ+': wysylam '+zebrane.length+' protokolow do aplikacji...';
 var okno=null;
 try{okno=window.open(doSbs,'sbs_odbior');}catch(e){okno=null;}
 if(okno){
  var wyslane=false;
  var nasluch=function(ev){
   if(!ev.data||ev.data.typ!=='sbs-gotowy') return;
   try{okno.postMessage({typ:'sbs-protokoly',tresc:tresc,zrodlo:STRONA_STARTOWA},SBS_ADRES);wyslane=true;}catch(e){}
  };
  var potwierdzenie=function(ev){
   if(!ev.data||ev.data.typ!=='sbs-odebrano') return;
   window.removeEventListener('message',nasluch);
   window.removeEventListener('message',potwierdzenie);
   box.remove();
   alert('SBS '+SBS_ZBIERACZ+': wyslalem '+zebrane.length+' protokolow prosto do aplikacji (kolejek: '+kolejek+(pominietych?', pominietych nierozegranych: '+pominietych:'')+').\n\nPrzejdz do karty Scout Base System - protokoly juz tam sa, nic nie musisz wklejac.');
  };
  window.addEventListener('message',nasluch);
  window.addEventListener('message',potwierdzenie);
  setTimeout(function(){
   window.removeEventListener('message',nasluch);
   window.removeEventListener('message',potwierdzenie);
   if(box.parentNode) box.remove();
   if(!wyslane) alert('SBS '+SBS_ZBIERACZ+': zebralem '+zebrane.length+' protokolow, ale aplikacja sie nie odezwala.'+(udalo?' Sa w schowku - wejdz do SBS i nacisnij Ctrl+V.':' Kliknij zakladke jeszcze raz.'));
  },20000);
  return;
 }
 box.remove();
 if(!udalo){alert('SBS '+SBS_ZBIERACZ+': zebralem '+zebrane.length+' protokolow, ale przegladarka nie pozwolila zapisac ich do schowka.\n\nKliknij zakladke jeszcze raz - za drugim razem zwykle sie udaje.');return;}
 alert('SBS '+SBS_ZBIERACZ+': dolozylem '+(zebrane.length-bylo)+' protokolow (kolejek przejrzanych: '+kolejek+(pominietych?', pominietych nierozegranych: '+pominietych:'')+(zablokowanych?', zatrzymanych prob wyjscia ze strony: '+zablokowanych:'')+'). W schowku masz teraz '+zebrane.length+' protokolow ('+tresc.length+' znakow).\n\nW aplikacji: Kluby -> wybierz grupe -> \u201eProtokoly z LNP\u201d -> Ctrl+V.\n\nShift + klikniecie tej zakladki czysci zebrana liste.');
}

start();

})();
