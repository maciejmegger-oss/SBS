(function(){try{
var K='sbs_agencje';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrane agencje.');return;}
var linki=document.querySelectorAll('a[href*="/beraterfirma/berater/"]');
if(!linki.length){alert('SBS: nie widze tu listy agencji.\n\nOtworz Transfermarkt \u2192 Zapoznaj sie \u2192 Agencje, wybierz kraj i kliknij ponownie.');return;}
var widziane={},wiersze=[];
for(var i=0;i<linki.length;i++){
var a=linki[i];
var nazwa=(a.getAttribute('title')||a.textContent||'').replace(/\s+/g,' ').trim();
if(!nazwa||nazwa.length<2)continue;
var href=a.href;
if(widziane[href])continue;
var tr=a.closest('tr');if(!tr)continue;
var wyzej;
while((wyzej=tr.parentElement&&tr.parentElement.closest('tr')))tr=wyzej;
widziane[href]=1;
var kraj='';
var flaga=tr.querySelector('img.flaggenrahmen,img[class*="flagge"]');
if(flaga)kraj=(flaga.getAttribute('title')||flaga.getAttribute('alt')||'').trim();
var lic=/licensed/i.test(tr.textContent||'')?'tak':'nie';
var logo='';
var im=tr.querySelectorAll('img');
for(var q=0;q<im.length;q++){
var s=im[q].getAttribute('src')||'';
if(!/^https?:/i.test(s))continue;
if(/flagge|flaggen|\/verifiziert|default|platzhalter|blank|nologo|dummy/i.test(s))continue;
logo=s;break;}
var td=tr.querySelectorAll('td'),zaw='',wart='';
for(var j=0;j<td.length;j++){
if(td[j].querySelector('table,td'))continue;
var t=(td[j].textContent||'').replace(/\u00a0/g,' ').trim();
if(!zaw&&/^\d{1,5}$/.test(t))zaw=t;
if(!wart&&t.indexOf('\u20ac')>=0)wart=t;}
wiersze.push(nazwa+' | '+href+' | '+kraj+' | '+zaw+' | '+wart+' | '+lic+' | '+logo);}
if(!wiersze.length){alert('SBS: znalazlem odnosniki, ale nie umialem odczytac wierszy tabeli.');return;}
var stare=(localStorage.getItem(K)||'').split('\n').filter(function(x){return x.trim()});
var poAdresie={},kolejnosc=[];
for(var s=0;s<stare.length;s++){var ad=stare[s].split(' | ')[1];if(!ad)continue;if(!poAdresie[ad])kolejnosc.push(ad);poAdresie[ad]=stare[s];}
var nowe=0,odswiezone=0;
for(var k=0;k<wiersze.length;k++){
var adres=wiersze[k].split(' | ')[1];
if(poAdresie[adres]){if(poAdresie[adres]!==wiersze[k])odswiezone++;}
else{kolejnosc.push(adres);nowe++;}
poAdresie[adres]=wiersze[k];}
var lista=[];for(var m=0;m<kolejnosc.length;m++)lista.push(poAdresie[kolejnosc[m]]);
var caly=lista.join('\n');
if(!nowe&&!odswiezone){alert('SBS: wszystkie '+wiersze.length+' agencji z tej strony mam juz w buforze, i to z tymi samymi danymi.');return;}
localStorage.setItem(K,caly);
var ile=lista.length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: nowych '+nowe+' agencji</b>'+(odswiezone?'<br>odswiezono danych: '+odswiezone:'')+'<br>w buforze: '+ile+' \u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Przejdz na kolejna strone i kliknij ponownie<br>Shift+klik = wyczysc bufor</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();
