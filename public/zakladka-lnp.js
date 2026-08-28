(function(){

var SBS_ZBIERACZ="v20 z 28.08.2026";
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
// Teraz po dwoch minutach przerywamy to, co akurat trwa, i pokazujemy panel z tym, co udalo sie
// zebrac. Lepiej oddac czesc kolejki i powiedziec o tym wprost, niz zostawic czlowieka
// z mrugajacym licznikiem.
var trybJedenMecz = false;
// Ostatnie liczby widziane przy szukaniu listy — trafiaja do panelu, gdy nic nie udalo sie zebrac.
var ostatnioLinkow = 0, ostatnioWierszy = 0, ostatnioKrokow = 0;
var CZAS_STARTU = 0;                       // ustawiany w start(), zeby liczyc od pierwszego ruchu
var PRZERWANO_CZASEM = false;
function minelo(){ return CZAS_STARTU ? (new Date().getTime() - CZAS_STARTU) : 0; }
function zaDlugo(){ return minelo() > 120000; }

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
box.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#16302A;color:#F6F3EA;padding:12px 16px;border-radius:8px;font:14px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4)';
box.textContent='SBS '+SBS_ZBIERACZ+': zaczynam...';
(document.body||document.documentElement).appendChild(box);

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

function zbierzAdresyZWierszy(gotowe){
 var wiersze = wierszeRozegrane();
 if(!wiersze.length){ gotowe([]); return; }
 var adresy=[], k=0;
 var pierwotnyPush = history.pushState, pierwotnyReplace = history.replaceState;
 var zlapany = '';
 function lap(u){
  var s = String(u||'');
  if(/\/mecz\//.test(s)){
   try{ zlapany = new URL(s, location.origin).href; }catch(e){ zlapany = ''; }
  }
 }
 history.pushState = function(a,b,u){ lap(u); return pierwotnyPush.apply(history, arguments); };
 history.replaceState = function(a,b,u){ lap(u); return pierwotnyReplace.apply(history, arguments); };
 var bazowy = location.href;
 function koncz(){
  history.pushState = pierwotnyPush;
  history.replaceState = pierwotnyReplace;
  try{ if(location.href !== bazowy) pierwotnyReplace.call(history, {}, '', bazowy); }catch(e){}
  gotowe(adresy);
 }
 function dalej(){
  // JESLI KLIKNIECIE JEDNAK PRZENIOSLO STRONE, dalsza praca nie ma sensu: lista meczow zniknela,
  // a wiersze w pamieci sa juz odlaczone od dokumentu. Dotad zbieracz klikal w nie do konca i
  // liczyl "35/35", choc od pierwszego przeniesienia nie zbieral juz nic. Konczymy z tym, co mamy.
  if(location.pathname.indexOf('/mecz/') >= 0){ koncz(); return; }
  if(k >= wiersze.length || zaDlugo()){ koncz(); return; }
  box.textContent='SBS '+SBS_ZBIERACZ+': czytam adresy meczow '+(k+1)+'/'+wiersze.length;
  var el = wiersze[k];
  zlapany = '';
  // Najpierw droga tansza i pewniejsza: identyfikator z danych Angulara. Klikamy dopiero,
  // gdy jej nie ma — klikanie jest wolne i zalezy od tego, jak strona wiesza obsluge.
  var zDanych = idMeczuZKontekstu(el);
  if(zDanych){ zlapany = location.origin + '/rozgrywki/mecz/' + zDanych; zapisz(); return; }
  // PELNA SEKWENCJA ZDARZEN MYSZY, NIE SAMO .click().
  //
  // Zmierzone na zywej stronie: zbieracz widzial wszystkie 36 wierszy, a mimo to nie wyciagnal
  // ani jednego adresu. Powod: Angular wiesza obsluge na zdarzeniach mousedown/mouseup albo na
  // elemencie glebiej w wierszu, a samo el.click() na kontenerze nic nie wywolywalo.
  //
  // Dlatego wysylamy pelna sekwencje (pointerdown, mousedown, mouseup, click) i probujemy nie
  // tylko wiersza, ale i jego wnetrza — od najglebszych elementow z trescia, bo to na nich
  // najczesciej siedzi obsluga.
  var cele = [el];
  try{
   var srodek = [].slice.call(el.querySelectorAll('*')).filter(function(x){
    return x.children.length === 0 && (x.textContent||'').trim().length > 1;
   });
   for(var s=0; s<srodek.length && cele.length<14; s++) cele.push(srodek[s]);
  }catch(e){}
  function wyslijKlik(cel){
   var typy = ['pointerdown','mousedown','mouseup','click'];
   for(var y=0; y<typy.length; y++){
    try{
     var ev;
     try{ ev = new MouseEvent(typy[y], {bubbles:true, cancelable:true, view:window, button:0}); }
     catch(e2){ ev = document.createEvent('MouseEvents'); ev.initEvent(typy[y], true, true); }
     cel.dispatchEvent(ev);
    }catch(e3){}
   }
   try{ if(cel.click) cel.click(); }catch(e4){}
  }
  var ci = 0;
  function klik(){
   if(ci >= cele.length || zlapany || zaDlugo()){ zapisz(); return; }
   wyslijKlik(cele[ci]);
   ci++;
   // Nawigacje poznajemy takze po zmianie adresu — nie kazdy router idzie przez pushState.
   setTimeout(function(){
    if(!zlapany && /\/mecz\//.test(location.pathname)) zlapany = location.href;
    if(zlapany) zapisz(); else klik();
   }, 180);
  }
  function zapisz(){
   if(zlapany && adresy.indexOf(zlapany) < 0) adresy.push(zlapany);
   // Router mogl zmienic adres — wracamy do listy bez przeladowania strony.
   try{ if(location.href !== bazowy) pierwotnyReplace.call(history, {}, '', bazowy); }catch(e){}
   k++;
   setTimeout(dalej, 60);
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
 box.textContent='SBS '+SBS_ZBIERACZ+': otwieram zakladke z meczami ('+zakladkaNr+'/'+k.length+')...';
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
  box.textContent='SBS '+SBS_ZBIERACZ+': szukam rozegranych meczow ('+krok+'/'+MAX+') - odnosnikow '+ileLinkow+', wierszy '+ileWierszy;

  if(mamy || krok>=MAX || zaDlugo()){
   clearInterval(t);
   var k=naglowekRozegranych();
   if(k){ try{ k.scrollIntoView({block:'start'}); }catch(e){} }
   gotowe();
  }
 },700);
}
function start(){
 if(!CZAS_STARTU){
  CZAS_STARTU = new Date().getTime();
  // Twardy limit: cokolwiek by sie nie dzialo, po dwoch minutach pokazujemy panel.
  setTimeout(function(){
   if(koniec.pokazano) return;
   PRZERWANO_CZASEM = true;
   ZBIERAM = false;                       // przestajemy blokowac klikniecia, praca i tak sie konczy
   koniec();
  }, 120000);
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
   box.textContent='SBS '+SBS_ZBIERACZ+': LNP odeslalo 404, ale mam zapamietane '+zapas.length
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
 if(/\/mecz\//.test(location.pathname)){
  // Na stronie meczu bierzemy ten jeden — i MOWIMY O TYM W PANELU. Bez tego wyglada, jakby
  // zakladka zebrala cala kolejke i znalazla w niej tylko jeden mecz.
  trybJedenMecz = true;
  box.textContent='SBS '+SBS_ZBIERACZ+': jestes na stronie meczu - zbieram ten jeden';
  linki=[location.href];nastepny();return;
 }
 if(!rozwiniete){
  rozwiniete=true;
  box.textContent='SBS '+SBS_ZBIERACZ+': rozwijam liste meczow...';
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
   box.textContent='SBS '+SBS_ZBIERACZ+': strona nie oddala listy meczow, biore zapamietane '+linki.length+' adresow';
   nastepny();return;
  }
 }
 if(linki.length && !(ileWierszy>=2 && linki.length*2<ileWierszy)){
  zapamietajListe(linki);
  box.textContent='SBS '+SBS_ZBIERACZ+': zbieram protokoly 0/'+linki.length;nastepny();return;
 }
 // LISTA POD TABELA. Gdy na ekranie sa mecze z wynikiem, a odnosnikow do nich brak albo jest
 // ich mniej — czytamy adresy prosto z wierszy, przechwytujac router. To jest zwykla droga na
 // stronie grupy, nie awaryjna: tam wiersze nigdy nie sa odnosnikami.
 if(!probowanoKlikac && ileWierszy>=2 && linki.length*2 < ileWierszy){
  probowanoKlikac=true;
  box.textContent='SBS '+SBS_ZBIERACZ+': na ekranie '+ileWierszy+' rozegranych meczow - czytam ich adresy';
  zbierzAdresyZWierszy(function(adresy){
   var razem=linki.slice();
   for(var q=0;q<adresy.length;q++) if(razem.indexOf(adresy[q])<0) razem.push(adresy[q]);
   // BEZ PETLI. Gdy z wierszy nie da sie wyciagnac ani jednego adresu, powtarzanie tego samego
   // nic nie zmieni — dotad zbieracz probowal w kolko az do limitu dwoch minut i konczyl zerem
   // bez slowa wyjasnienia. Konczymy od razu i mowimy, co widzielismy.
   if(!razem.length){ koniec(); return; }
   linki=razem;i=0;
   zapamietajListe(linki);
   box.textContent='SBS '+SBS_ZBIERACZ+': mam '+linki.length+' meczow - zbieram protokoly';
   nastepny();
  });
  return;
 }
 czekam++;
 if(czekam<6){box.textContent='SBS '+SBS_ZBIERACZ+': czekam, az strona sie zaladuje...';setTimeout(start,500);return;}
 if(!probowanoKlikac&&wierszeRozegrane().length){
  probowanoKlikac=true;
  zbierzAdresyPrzezKlikanie(function(adresy){
   if(adresy.length){
    linki=adresy;i=0;
    box.textContent='SBS '+SBS_ZBIERACZ+': zbieram protokoly 0/'+linki.length;
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
   box.textContent='SBS '+SBS_ZBIERACZ+': wyczyscilem bufor. Wejdz na liste meczow wlasciwej grupy i kliknij zakladke.';
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
var PODEJSC = 5;
var nieudanych = 0, nieudaneUrl = [];
function nastepny(){
 if(i>=linki.length){ poKolejce(); return; }
 wczytajMecz(linki[i], 0);
}
function wczytajMecz(url, podejscie){
 box.textContent='SBS '+SBS_ZBIERACZ+': kolejka '+kolejek+' - protokoly '+i+'/'+linki.length
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
    var wpis='### PROTOKOL: '+url+'\n'+txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(f.contentDocument);
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
  box.textContent='SBS '+SBS_ZBIERACZ+': otwieram mecz '+(k+1)+'/'+wiersze.length+' (adresow '+adresy.length+')';
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
  box.textContent='SBS '+SBS_ZBIERACZ+': doszlo '+swieze.length+' meczow - zbieram dalej';
  linki=swieze;i=0;nastepny();return;
 }
 var wybor=listaKolejek();
 if(wybor&&wybor.selectedIndex+1<wybor.options.length&&kolejek<40){
  kolejek++;
  box.textContent='SBS '+SBS_ZBIERACZ+': przechodze do kolejki '+kolejek+'...';
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
  box.textContent='SBS '+SBS_ZBIERACZ+': roczniki '+(n+1)+'/'+doZrobienia.length+(zostalo?' (zostanie '+zostalo+' na potem)':'');
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
 if(!PRZERWANO_CZASEM && koniec.tura < 4 && nieudaneUrl.length){
  var przedTura = nieudaneUrl.length;
  if(koniec.tura > 0 && przedTura >= koniec.poprzednioNieudanych){
   koniec.tura = 4;                       // ostatnia tura nic nie dala — nie ma po co dalej
  } else {
   koniec.tura++;
   koniec.poprzednioNieudanych = przedTura;
   box.textContent='SBS '+SBS_ZBIERACZ+': '+przedTura+' meczow nie weszlo - tura '+(koniec.tura+1)
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
   box.textContent='SBS '+SBS_ZBIERACZ+': roczniki gotowe (+'+zdobyte+')';
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
  + (PRZERWANO_CZASEM ? '<div style="color:#F0C674">Przerwane po 2 minutach — LNP odpowiadalo za wolno.</div>' : '')
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
 var wyczysc=document.createElement('button');
 wyczysc.textContent='Wyczysc zebrane ('+zebrane.length+')';
 wyczysc.style.cssText='display:block;width:100%;padding:6px;margin-bottom:6px;border:1px solid rgba(246,243,234,.35);border-radius:6px;background:transparent;color:#F6F3EA;font:13px sans-serif;cursor:pointer';
 wyczysc.onclick=function(){
  try{localStorage.removeItem(KLUCZ);}catch(e){}
  zebrane=[];
  box.textContent='SBS '+SBS_ZBIERACZ+': wyczyscilem zebrane protokoly. Kliknij zakladke jeszcze raz, zeby zebrac te grupe od nowa.';
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
 box.textContent='SBS '+SBS_ZBIERACZ+': wysylam '+zebrane.length+' protokolow do aplikacji...';
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
