(function(){try{
if(!/transfermarkt\./.test(location.host)){alert('SBS: to nie jest strona Transfermarktu.');return;}
var T=document.body.innerText||'';
function po(et){var re=new RegExp(et+'\\s*:?\\s*\\n?\\s*([^\\n]+)','i');var m=T.match(re);return m?m[1].trim():'';}
var nazwa=(document.querySelector('h1')||{}).innerText||document.title.split(' - ')[0];
nazwa=nazwa.replace(/#\d+\s*/,'').replace(/\s+/g,' ').trim();
var data=po('Date of birth|Data urodzenia|Geburtsdatum').replace(/\(.*?\)/,'').trim();
var poz=po('Position|Pozycja|Hauptposition');
var noga=po('Foot|Noga|Fu\u00df');
var wzrost=po('Height|Wzrost|Gr\u00f6\u00dfe');
var kraj=po('Citizenship|Obywatelstwo|Nationalit\u00e4t');
var klub=po('Current club|Obecny klub|Aktueller Verein');
var kontrakt=po('Contract expires|Kontrakt do|Vertrag bis');
var out=['SBS-PROFIL','Zawodnik: '+nazwa,'Data urodzenia: '+data,'Pozycja: '+poz,'Noga: '+noga,
'Wzrost: '+wzrost,'Narodowosc: '+kraj,'Klub: '+klub,'Kontrakt do: '+kontrakt,'Adres: '+location.href];
var wiersz=null,ts=document.querySelectorAll('table tbody tr');
for(var i=0;i<ts.length;i++){var t=ts[i].innerText.replace(/\s+/g,' ');
if(/(26\/27|2026\/2027|Total|Suma|Gesamt)/i.test(t)&&/\d/.test(t)){wiersz=ts[i];}}
if(wiersz){var k=[].map.call(wiersz.cells,function(c){return c.innerText.replace(/\s+/g,' ').trim();});
out.push('Wiersz sezonu: '+k.join(' | '));}
var p=document.createElement('textarea');p.value=out.join('\n');document.body.appendChild(p);p.select();
document.execCommand('copy');document.body.removeChild(p);
alert('SBS: skopiowano profil '+nazwa+'.\n\nWklej go w oknie edycji zawodnika i kliknij \u201eWczytaj z wklejonego tekstu\u201d.');
}catch(e){alert('SBS: '+e.message);}})();
