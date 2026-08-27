(function(){

var SBS_ZBIERACZ="v4 z 26.08.2026";
var SBS_ADRES=(typeof window!=='undefined'&&window.__SBS_ADRES)?window.__SBS_ADRES:"";
var STRONA_STARTOWA=location.href;
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

var pominietych=0;
var zebrane=[];try{zebrane=JSON.parse(localStorage.getItem(KLUCZ)||'[]');}catch(e){zebrane=[];}
var bylo=zebrane.length, linki=[], i=0, kolejek=1, czekam=0, doliczen=0, rozwiniete=false, probowanoKlikac=false, wierszyNaEkranie=0, zakladkaNr=0;

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
  if(el.tagName==='A'){
   var cel_href=el.getAttribute('href')||'';
   if(cel_href && cel_href.charAt(0)!=='#'){
    var innaStrona=true;
    try{ innaStrona = new URL(el.href, location.href).pathname !== location.pathname; }catch(e){}
    if(innaStrona) continue;
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
 var k=kandydaciMeczow();
 if(zakladkaNr>=k.length){ gotowe(); return; }
 var cel=k[zakladkaNr];
 zakladkaNr++;
 box.textContent='SBS '+SBS_ZBIERACZ+': otwieram zakladke z meczami ('+zakladkaNr+'/'+k.length+')...';
 try{cel.click();}catch(e){}
 setTimeout(gotowe,1600);
}
function dociagnijStrone(gotowe){
 var krok=0;
 var t=setInterval(function(){
  krok++;
  try{window.scrollTo(0,document.body.scrollHeight);}catch(e){}
  var wiecej=[].slice.call(document.querySelectorAll('button,a')).filter(function(el){
   return /zaladuj wiecej|załaduj więcej|pokaz wiecej|pokaż więcej/i.test((el.textContent||'').trim());
  });
  wiecej.forEach(function(el){try{el.click();}catch(e){}});
  var n=naglowekRozegranych();
  if(n){ try{ n.scrollIntoView({block:'start'}); }catch(e){} box.textContent='SBS '+SBS_ZBIERACZ+': jestem przy \u201eRozegranych meczach\u201d ('+krok+')...'; }
  else box.textContent='SBS '+SBS_ZBIERACZ+': szukam rozegranych meczow ('+krok+')...';
  if(krok>=6){
   clearInterval(t);
   var k=naglowekRozegranych();
   if(k){ try{ k.scrollIntoView({block:'start'}); }catch(e){} }
   else { try{window.scrollTo(0,0);}catch(e){} }
   gotowe();
  }
 },700);
}
function start(){
 if(/\/mecz\//.test(location.pathname)){
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
 if(linki.length){box.textContent='SBS '+SBS_ZBIERACZ+': zbieram protokoly 0/'+linki.length;nastepny();return;}
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
 var rada = maRozegrane
  ? 'Sekcja \u201eRozegrane mecze\u201d jest, ale nie widze w niej ani jednego wiersza z wynikiem. Poczekaj, az wyniki sie wyswietla, i kliknij zakladke jeszcze raz.'
  : 'Na tej stronie sa same \u201ePlanowane mecze\u201d - w tym sezonie nie ma tu jeszcze zadnego rozegranego spotkania. Sprawdz u gory pole \u201eSezon\u201d i \u201eRozgrywki\u201d: wybierz sezon, w ktorym mecze juz sie odbyly.';
 alert('SBS '+SBS_ZBIERACZ+': nie mam z tej strony czego pobrac.\n\n'+rada+slad);
}

function nastepny(){
 if(i>=linki.length){ poKolejce(); return; }
 var url=linki[i];
 box.textContent='SBS '+SBS_ZBIERACZ+': kolejka '+kolejek+' - protokoly '+i+'/'+linki.length+' (razem '+zebrane.length+')';
 var f=document.createElement('iframe');
 f.style.cssText='position:fixed;left:-9999px;width:1200px;height:2000px';
 f.src=url;document.body.appendChild(f);
 var prob=0;
 var t=setInterval(function(){
  prob++;
  var txt='';
  try{txt=(f.contentDocument&&f.contentDocument.body)?f.contentDocument.body.innerText:'';}catch(e){txt='';}
  var ok=/Sk\u0142ad wyj\u015bciowy/.test(txt);
  if(ok||prob>16){
   clearInterval(t);
   if(ok){
    var j=txt.search(/^\s*Sk\u0142ady\s*$/m);
    var wpis='### PROTOKOL: '+url+'\n'+txt.slice(j<0?0:Math.max(0,j-400))+zdarzenia(f.contentDocument);
    var byl=false;
    for(var q=0;q<zebrane.length;q++){if(zebrane[q].indexOf('### PROTOKOL: '+url+'\n')===0){zebrane[q]=wpis;byl=true;break;}}
    if(!byl)zebrane.push(wpis);
   }
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
function wierszeRozegrane(){
 var szuk='tr,li,[role="row"],[class*="match"],[class*="mecz"],[class*="Match"]';
 var kand=[].slice.call(document.querySelectorAll(szuk));
 var granica=naglowekRozegranych();
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
 try{ window.open=function(u){ if(u) zlapane.push(String(u)); return null; }; }catch(e){}
 function skoncz(){
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

function koniec(){
 try{localStorage.setItem(KLUCZ,JSON.stringify(zebrane));}catch(e){}
 var tresc=zebrane.join('\n\n');
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
 alert('SBS '+SBS_ZBIERACZ+': dolozylem '+(zebrane.length-bylo)+' protokolow (kolejek przejrzanych: '+kolejek+(pominietych?', pominietych nierozegranych: '+pominietych:'')+'). W schowku masz teraz '+zebrane.length+' protokolow ('+tresc.length+' znakow).\n\nW aplikacji: Kluby -> wybierz grupe -> \u201eProtokoly z LNP\u201d -> Ctrl+V.\n\nShift + klikniecie tej zakladki czysci zebrana liste.');
}

start();

})();
