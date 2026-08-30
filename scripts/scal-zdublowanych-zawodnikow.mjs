// Scala kartoteki tego samego zawodnika, powstałe przez podwójny zapis tego samego protokołu.
//
// SKĄD SIĘ WZIĘŁY: zakładka potrafiła wysłać protokoły dwa razy, każda przesyłka otwierała własne
// okno, a odkąd okna zapisują same — dwa zapisy ruszały równolegle. Żaden nie widział zawodników
// zakładanych przez drugi (szuka ich po nazwisku w klubie, a tamtych jeszcze nie było), więc
// każdy zakładał swoje. Stąd te same nazwiska, ten sam mecz, ta sama sekunda.
//
// CO ROBI: w obrębie jednego klubu łączy kartoteki o identycznym imieniu i nazwisku. Zostaje ta
// bogatsza — z obserwacjami, notatkami, rocznikiem — a dorobek scalamy po meczach, żeby żaden
// nie policzył się dwa razy ani nie przepadł.
//
// Uruchomienie:  SBS_KLUCZ=<klucz serwisowy> node scripts/scal-zdublowanych-zawodnikow.mjs [--zapisz]
const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
const NAPRAWDE = process.argv.includes('--zapisz');
if(!K){ console.error('Brak SBS_KLUCZ w środowisku.'); process.exit(1); }

const h = { apikey: K, Authorization: 'Bearer ' + K };
const hZapis = { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const norm = (s)=> String(s||'').toLowerCase().replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
  .normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');

const kluby = [];
for(let od = 0; ; od += 1000){
  const r = await (await fetch(`${B}/rest/v1/sbs_clubs?select=id,name,league&order=id&offset=${od}&limit=1000`, { headers: h })).json();
  if(!Array.isArray(r) || !r.length) break;
  kluby.push(...r); if(r.length < 1000) break;
}

// Ile treści niesie kartoteka — decyduje, którą zostawiamy.
const waga = (p)=>{
  const ext = ((p.custom_fields||{}).__ext) || {};
  return (p.birth_year ? 4 : 0) + (p.position ? 2 : 0) + (p.notes ? 3 : 0)
    + (p.status && p.status !== '—' ? 2 : 0) + (p.video_link ? 2 : 0) + (p.tm_link ? 2 : 0)
    + (Array.isArray(p.committee_reports) ? p.committee_reports.length * 5 : 0)
    + (ext.przebieg ? ext.przebieg.length : 0);
};

let doUsuniecia = 0, scalonych = 0;
const opisy = [];

for(const c of kluby){
  const p = await (await fetch(`${B}/rest/v1/sbs_players?select=*&club_id=eq.${encodeURIComponent(c.id)}&limit=500`, { headers: h })).json();
  if(!Array.isArray(p) || p.length < 2) continue;

  const wg = {};
  p.forEach(x=>{ const k = norm(x.first_name) + '|' + norm(x.last_name); if(k !== '|') (wg[k] = wg[k] || []).push(x); });

  for(const grupa of Object.values(wg)){
    if(grupa.length < 2) continue;
    grupa.sort((a,b)=> waga(b) - waga(a));
    const zostaje = grupa[0], reszta = grupa.slice(1);

    // Dorobek scalamy po meczu: ten sam mecz z dwóch kartotek to jeden mecz, nie dwa.
    const ext = { ...(((zostaje.custom_fields||{}).__ext) || {}) };
    const przebieg = [...(ext.przebieg || [])];
    const widziane = new Set(przebieg.map(x=> norm(x.rywal||'') + '|' + (x.dom ? 'd' : 'w')));
    const rozliczone = new Set(zostaje.rozliczone_mecze || ext.rozliczoneMecze || []);
    for(const r of reszta){
      const e = ((r.custom_fields||{}).__ext) || {};
      (e.przebieg || []).forEach(x=>{
        const k = norm(x.rywal||'') + '|' + (x.dom ? 'd' : 'w');
        if(widziane.has(k)) return;
        widziane.add(k); przebieg.push(x);
      });
      (e.rozliczoneMecze || []).forEach(k=>rozliczone.add(k));
    }
    ext.przebieg = przebieg;
    ext.rozliczoneMecze = [...rozliczone];
    const minuty = przebieg.reduce((s,x)=> s + (Number(x.minuty) || 0), 0);
    const gole = przebieg.reduce((s,x)=> s + (Number(x.gole) || 0), 0);

    opisy.push(`${c.name}: ${zostaje.first_name} ${zostaje.last_name} — zostaje ${zostaje.id}, `
      + `usuwam ${reszta.length} (mecze ${przebieg.length}, minuty ${minuty})`);
    scalonych++; doUsuniecia += reszta.length;

    if(NAPRAWDE){
      const body = JSON.stringify({
        custom_fields: { ...(zostaje.custom_fields||{}), __ext: ext },
        matches: przebieg.length, minutes: minuty, goals: gole,
      });
      const u = await fetch(`${B}/rest/v1/sbs_players?id=eq.${encodeURIComponent(zostaje.id)}`,
        { method:'PATCH', headers: hZapis, body });
      if(!u.ok){ console.error('  BŁĄD aktualizacji ' + zostaje.id + ': ' + await u.text()); continue; }
      for(const r of reszta){
        const del = await fetch(`${B}/rest/v1/sbs_players?id=eq.${encodeURIComponent(r.id)}`,
          { method:'DELETE', headers: hZapis });
        if(!del.ok) console.error('  BŁĄD usuwania ' + r.id + ': ' + await del.text());
      }
    }
  }
}

opisy.slice(0, 25).forEach(o=>console.log('  ' + o));
if(opisy.length > 25) console.log(`  …i ${opisy.length - 25} więcej`);
console.log(`\nZawodników do scalenia: ${scalonych}, nadmiarowych kartotek: ${doUsuniecia}`);
console.log(NAPRAWDE ? 'ZAPISANE w bazie.' : 'To była PRÓBA — nic nie zmieniłem. Dopisz --zapisz, żeby wykonać.');
