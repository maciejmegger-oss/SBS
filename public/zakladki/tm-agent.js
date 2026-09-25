(function(){try{
var K='sbs_agenci';
if(window.event&&window.event.shiftKey){localStorage.removeItem(K);alert('SBS: wyczyszczono zebranych zawodnikow.');return;}
var u=location.href;
if(!/\/profil\/spieler\/\d+/.test(u)){alert('SBS: to nie jest profil zawodnika na Transfermarkcie.\n\nOtworz profil zawodnika (adres z \u201e/profil/spieler/\u201d) i kliknij ponownie.');return;}
var imie=(document.title||'').split(' - ')[0].replace(/\s+/g,' ').trim();
if(!imie){alert('SBS: nie odczytalem nazwiska z tej strony.');return;}
function pole(ok){
var n=document.querySelectorAll('span,th,td,dt,div');
for(var i=0;i<n.length;i++){var e=n[i];
if(e.children.length)continue;
var t=(e.textContent||'').replace(/\u00a0/g,' ').trim();
if(!t||t.length>34||t.charAt(t.length-1)!==':')continue;
var k=t.toLowerCase().replace(/\u0142/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
if(!ok(k))continue;
var v=e.nextElementSibling;if(!v)continue;
var a=v.querySelector('a')||(v.tagName==='A'?v:null);
var nazwa=a?((a.getAttribute('title')||a.textContent||'').trim()):((v.textContent||'').replace(/\u00a0/g,' ').trim());
nazwa=nazwa.replace(/[\s.\u2026]+$/,'').trim();
if(nazwa)return{nazwa:nazwa,link:(a&&a.href)?a.href:''};}
return null;}
var ETYKIETY=['menadzerowie','menedzerowie','menadzer','menedzer','doradca','doradcy','berater','spielerberater','playeragent','agent','agents','advisor'];
var ag=pole(function(k){return ETYKIETY.indexOf(k)>=0;});
var agent=ag?ag.nazwa:'';var agLink=ag?ag.link:'';
if(/^(brak|-|\u2013|\u2014|unknown|k\.A\.)$/i.test(agent)){agent='';agLink='';}
var ur=pole(function(k){return k.indexOf('urodz')===0||k.indexOf('dataurodzenia')===0||k.indexOf('geb')===0||k.indexOf('dateofbirth')===0;});
var rok='';
if(ur){var mu=ur.nazwa.match(/(\d{4})/);if(mu)rok=mu[1];}
if(!rok){var mt=document.body.innerText.replace(/\u00a0/g,' ').match(/(?:Urodz|Data urodzenia|Geb\.|Date of birth)[^\n]*?(\d{4})/i);if(mt)rok=mt[1];}
var wpis='### '+imie+' ###\nROK: '+rok+'\nAGENT: '+(agent||'-')+(agLink?'\nLINK: '+agLink:'');
var stare=localStorage.getItem(K)||'';
if(stare.indexOf('### '+imie+' ###')>=0){alert('SBS: '+imie+' jest juz zebrany — pomijam, zeby nie dublowac.');return;}
var caly=stare+(stare?'\n\n':'')+wpis;
localStorage.setItem(K,caly);
var ile=(caly.match(/### /g)||[]).length;
navigator.clipboard.writeText(caly).then(function(){
var d=document.createElement('div');
d.innerHTML='<b>SBS: '+imie+'</b><br>menedzer: '+(agent||'Transfermarkt nie podaje')+'<br>zebranych: '+ile+' — schowek gotowy<br><span style="opacity:.75;font-weight:400">Shift+klik = wyczysc zebrane</span>';
d.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#16302A;color:#C69B3C;padding:12px 18px;border-radius:8px;font:600 13px sans-serif;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.3)';
document.body.appendChild(d);setTimeout(function(){d.remove()},3200);
}).catch(function(e){alert('Nie udalo sie skopiowac: '+e.message)})}catch(e){alert('Blad: '+e.message)}})();
