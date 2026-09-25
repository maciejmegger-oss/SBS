(function(){try{
var u=location.href;
if(!/\/berater\/\d+/.test(u)){alert('SBS: to nie jest profil agencji.\n\nOtworz strone agencji na Transfermarkcie i kliknij ponownie.');return;}
var agencja=(document.title||'').split(/ - |\|/)[0].replace(/\s+/g,' ').trim();
var osoby=[],widziane={};
var linki=document.querySelectorAll('a[href*="/beraterberater/"],a[href*="/mitarbeiter/"],a[href*="/berater/mitarbeiter/"]');
for(var i=0;i<linki.length;i++){
var n=(linki[i].getAttribute('title')||linki[i].textContent||'').replace(/\s+/g,' ').trim();
if(!n||n.length<4||n.length>50)continue;
if(widziane[n.toLowerCase()])continue;widziane[n.toLowerCase()]=1;
osoby.push(n);}
if(!osoby.length){
// Zapasowo: sekcja „Pracownicy" bywa zwyklym blokiem bez odnosnikow — bierzemy z niej wiersze,
// ktore wygladaja na imie i nazwisko (dwa lub trzy slowa z wielkiej litery, bez cyfr).
var bloki=document.querySelectorAll('div,section,aside,table');
for(var b=0;b<bloki.length;b++){
var nag=(bloki[b].textContent||'').slice(0,40);
if(!/pracownic|mitarbeiter|staff/i.test(nag))continue;
var linie=(bloki[b].innerText||'').split('\n').map(function(x){return x.trim()}).filter(Boolean);
for(var l=0;l<linie.length;l++){
var t=linie[l];
if(/pracownic|mitarbeiter|staff/i.test(t))continue;
if(t.length<4||t.length>50||/\d|@|\u20ac/.test(t))continue;
if(!/^[A-Z\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b][^ ]+( [A-Z\u0104\u0106\u0118\u0141\u0143\u00d3\u015a\u0179\u017b][^ ]+){1,2}$/.test(t))continue;
if(widziane[t.toLowerCase()])continue;widziane[t.toLowerCase()]=1;
osoby.push(t);}
if(osoby.length)break;}}
if(!osoby.length){alert('SBS: nie znalazlem sekcji Pracownicy na tej stronie.\n\nMozesz wpisac nazwiska recznie w oknie w SBS — po jednym w linijce.');return;}
// Numer i mail z bloku CONTACT to jedyne dane kontaktowe, jakie Transfermarkt podaje — i sa
// wspolne dla calej agencji, nie dla poszczegolnych osob. Dopisujemy je do naglowka, zeby SBS
// mogl nimi podstawic puste pola przy menedzerach.
var tel='',mail='';
var wszystkie=document.querySelectorAll('td,span,div,dt,th');
for(var t2=0;t2<wszystkie.length;t2++){
var e2=wszystkie[t2];
if(e2.children.length)continue;
var et=(e2.textContent||'').replace(/\u00a0/g,' ').trim();
if(!et||et.length>20)continue;
var kk=et.toLowerCase().replace(/[^a-z]/g,'');
if(kk!=='telefon'&&kk!=='email'&&kk!=='emailadres')continue;
var v2=e2.nextElementSibling;if(!v2)continue;
var vt=(v2.textContent||'').replace(/\u00a0/g,' ').trim();
if(!vt||vt==='-')continue;
if(kk==='telefon'&&!tel)tel=vt;
if(kk!=='telefon'&&!mail&&vt.indexOf('@')>=0)mail=vt;}
var caly='### PRACOWNICY: '+agencja+' | '+u+(tel?' | TEL:'+tel:'')+(mail?' | MAIL:'+mail:'')+' ###\n'+osoby.join('\n');
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+agencja+'</b><br>pracownikow: '+osoby.length+' \u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Wklej w oknie „Wgraj menedzerow" w SBS</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();
