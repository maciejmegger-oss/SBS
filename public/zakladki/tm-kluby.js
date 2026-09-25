(function(){try{
var K='sbs_zebrane';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebrane kluby.');return;}
var u=location.href;
if(/\/verein\/\d+/.test(u)&&!/\/leistungsdaten\//.test(u)){
location.href=u.replace(/\/(startseite|kader|spielplan|leistungsdaten)\/verein\//,'/leistungsdaten/verein/').replace(/\/verein\//,'/leistungsdaten/verein/').replace(/\/leistungsdaten\/leistungsdaten\//,'/leistungsdaten/');
return;}
if(!/\/leistungsdaten\//.test(u)){alert('SBS: to nie jest strona klubu na Transfermarkcie.\n\nOtworz klub, a potem kliknij te zakladke ponownie.');return;}
var best=null,n=0;var ts=document.querySelectorAll('table');
for(var i=0;i<ts.length;i++){var r=ts[i].rows.length;if(r>n){n=r;best=ts[i];}}
var t=(best&&n>4)?best.innerText:document.body.innerText;
if(!/\d\s*['’]/.test(t)){alert('SBS: na tej stronie nie ma minut.\n\nUpewnij sie, ze u gory wybrales sezon i rozgrywki (np. \u201eLacznie 26/27\u201d).');return;}
var nazwa=(document.title||'klub').split(' - ')[0];
var stare=localStorage.getItem(K)||'';
if(stare.indexOf('### '+nazwa+' ###')>=0){alert('SBS: '+nazwa+' jest juz zebrany — pomijam, zeby nie dublowac.');return;}
var caly=stare+(stare?'\n\n':'')+'### '+nazwa+' ###\n'+t;
localStorage.setItem(K,caly);
var ile=(caly.match(/### /g)||[]).length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: dodano '+nazwa+'</b><br>zebrane kluby: '+ile+' — schowek gotowy do wklejenia<br><span style="opacity:.75;font-weight:400">Shift+klik = wyczysc zebrane</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3200);
}).catch(function(e){alert('Nie udało się skopiować: '+e.message)})}catch(e){alert('Błąd: '+e.message)}})();
