(function(){try{

function zdarzenia(d){try{
 if(!d) return '';
 var out=[],widziane={};
 var MINUTA=/^\\s*\\d{1,3}'(?:\\s*\\+\\s*\\d+')?\\s*$/;
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
  var mm=tt.match(/^(\\d{1,3})'(?:\\s*\\+\\s*(\\d+)')?$/);
  if(!mm) continue;
  var wiersz=el, pojemnik=el, glab=0;
  while(wiersz&&glab<5&&!(wiersz.textContent||'').match(/[A-Za-z\\u00c0-\\u017f]{3,}/)){pojemnik=wiersz;wiersz=wiersz.parentElement;glab++;}
  if(!wiersz) continue;
  var podpisy=opisz(pojemnik);
  if(!podpisy.length&&pojemnik) podpisy=obok(pojemnik.previousElementSibling).concat(obok(pojemnik.nextElementSibling));
  var kto=(wiersz.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60);
  var linia=mm[1]+"'|"+kto+'|'+podpisy.join(' ').slice(0,160);
  if(!widziane[linia]){widziane[linia]=1;out.push(linia);}
 }
 return out.length?('\\n### ZDARZENIA\\n'+out.join('\\n')):'';
}catch(e){return '';}}

var K='sbs_protokoly';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrane protokoly.');return;}
if(!/laczynaspilka\.pl/.test(location.host)){alert('SBS: to nie jest strona Laczy nas pilka.');return;}
var t=document.body.innerText||'';
var i=t.search(/^\s*Sk\u0142ady\s*$/m);
if(i<0){alert('SBS: na tej stronie nie widze sekcji \u201eSklady\u201d.\n\nOtworz strone MECZU (nie tabele) i poczekaj, az sie zaladuje.');return;}
var naglowek=(document.title||'mecz').replace(/\s+/g,' ').trim();
var protokol='### PROTOKOL: '+naglowek+'\n'+t.slice(Math.max(0,i-400))+zdarzenia(document);
var zebrane=[];try{zebrane=JSON.parse(localStorage.getItem(K)||'[]');}catch(e){}
if(zebrane.indexOf(protokol)<0)zebrane.push(protokol);
localStorage.setItem(K,JSON.stringify(zebrane));
var calosc=zebrane.join('\n\n');
var p=document.createElement('textarea');p.value=calosc;document.body.appendChild(p);p.select();
document.execCommand('copy');document.body.removeChild(p);
alert('SBS: zebrano '+zebrane.length+' protokolow i skopiowano do schowka.\n\nWklej je w aplikacji w oknie \u201eWklej protokol meczu\u201d.\n\nShift+klikniecie czysci liste.');
}catch(e){alert('SBS: '+e.message);}})();
