(function(){try{
var K='sbs_sklad_agencji';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrany sklad.');return;}
var u=location.href;
if(!/\/beraterfirma\/berater\/\d+/.test(u)&&!/\/berater\/\d+/.test(u)){alert('SBS: to nie jest profil agencji.\n\nOtworz strone agencji na Transfermarkcie (adres z \u201e/beraterfirma/berater/\u201d) i kliknij ponownie.');return;}
var idAg=((u.match(/\/berater\/(\d+)/)||[])[1])||'';
var agencja=(document.title||'').split(/ - |\|/)[0].replace(/\s+/g,' ').trim();
var linki=document.querySelectorAll('a[href*="/profil/spieler/"]');
if(!linki.length){alert('SBS: nie widze tabeli reprezentowanych zawodnikow na tej stronie.');return;}
var widziane={},wiersze=[];
for(var i=0;i<linki.length;i++){
var a=linki[i];
var nazwa=(a.getAttribute('title')||a.textContent||'').replace(/\s+/g,' ').trim();
if(!nazwa||nazwa.length<3||nazwa.length>60)continue;
var href=a.href.split('?')[0];
if(widziane[href])continue;
widziane[href]=1;
var tr=a.closest('tr');
var wiek='',klub='',wart='',poz='';
if(tr){
var wyzej;
while((wyzej=tr.parentElement&&tr.parentElement.closest('tr')))tr=wyzej;
var kl=tr.querySelector('a[href*="/verein/"]');
if(kl){
klub=(kl.getAttribute('title')||'').replace(/\s+/g,' ').trim();
if(!klub){var im2=kl.querySelector('img');if(im2)klub=(im2.getAttribute('title')||im2.getAttribute('alt')||'').replace(/\s+/g,' ').trim();}
if(!klub)klub=(kl.textContent||'').replace(/\s+/g,' ').trim();}
if(!klub){var ki=tr.querySelector('img[class*="wappen"],img[src*="wappen"],img[src*="vereinslogo"]');
if(ki)klub=(ki.getAttribute('title')||ki.getAttribute('alt')||'').replace(/\s+/g,' ').trim();}
var kom=a.closest('td');
if(kom){
var wyzejK;
while((wyzejK=kom.parentElement&&kom.parentElement.closest('td')))kom=wyzejK;
var lisc=kom.querySelectorAll('*');
for(var z=0;z<lisc.length;z++){
if(lisc[z].children.length)continue;
var tx=(lisc[z].textContent||'').replace(/\s+/g,' ').trim();
if(!tx||tx===nazwa)continue;
if(tx.length<3||tx.length>32)continue;
if(/\d|@|\u20ac/.test(tx))continue;
poz=tx;break;}}
var td=tr.querySelectorAll('td');
for(var j=0;j<td.length;j++){
if(td[j].querySelector('table,td'))continue;
var t=(td[j].textContent||'').replace(/\u00a0/g,' ').trim();
if(!wiek&&/^\d{2}$/.test(t))wiek=t;
if(!wart&&t.indexOf('\u20ac')>=0)wart=t;}}
wiersze.push(nazwa+' | '+wiek+' | '+klub+' | '+poz+' | '+wart);}
if(!wiersze.length){alert('SBS: znalazlem odnosniki do zawodnikow, ale nie umialem odczytac wierszy.');return;}
var naglowek='### AGENCJA: '+agencja+' | '+u+' | ID:'+idAg+' ###';
var stare=(localStorage.getItem(K)||'').split('\n').filter(function(x){return x.trim()});
if(stare.length&&stare[0].indexOf('ID:'+idAg+' ')<0){
if(!confirm('SBS: w buforze masz sklad innej agencji ('+stare[0].replace(/^### AGENCJA: /,'').split(' | ')[0]+').\n\nOK = zaczynam zbierac te agencje od nowa.\nAnuluj = nie ruszam bufora.'))return;
stare=[];}
var poNazwie={},kolejnosc=[];
for(var s=1;s<stare.length;s++){var kl2=stare[s].split(' | ')[0];if(!kl2)continue;if(!poNazwie[kl2])kolejnosc.push(kl2);poNazwie[kl2]=stare[s];}
var nowych=0;
for(var k=0;k<wiersze.length;k++){var kl3=wiersze[k].split(' | ')[0];
if(!poNazwie[kl3]){kolejnosc.push(kl3);nowych++;}
poNazwie[kl3]=wiersze[k];}
var lista=[];for(var m=0;m<kolejnosc.length;m++)lista.push(poNazwie[kolejnosc[m]]);
var caly=naglowek+'\n'+lista.join('\n');
localStorage.setItem(K,caly);
var ile=lista.length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+agencja+'</b><br>z tej strony nowych: '+nowych+'<br>w buforze: '+ile+' \u2014 schowek gotowy<br><span style="opacity:.75;font-weight:400">Przejdz na kolejna strone i kliknij ponownie<br>Shift+klik = wyczysc bufor</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3600);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();
