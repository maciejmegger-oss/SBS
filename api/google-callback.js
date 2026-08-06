// Krok 2 podłączenia Kalendarza Google: zamiana kodu zgody na token odświeżania.
//
// Token POKAZUJEMY RAZ na stronie i nigdzie go nie zapisujemy. Zapis do bazy odpada, bo sbs_kv
// czyta z przeglądarki klucz anonimowy — token do kalendarza byłby wtedy widoczny dla każdego,
// kto otworzy stronę. Właściwe miejsce to zmienna środowiskowa Vercela, do której wkleja go
// wyłącznie właściciel instalacji.
import { konfiguracjaGoogle, adresPrzekierowania } from "./_google.js";

const uciec = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const strona = (tytul, tresc) => `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${uciec(tytul)}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1d2b26}
code{background:#f3f0e7;padding:2px 6px;border-radius:4px;word-break:break-all}
.token{display:block;background:#16302a;color:#f0d38a;padding:14px;border-radius:8px;font:13px/1.5 monospace;word-break:break-all;margin:12px 0}
.ostrz{border-left:4px solid #8c2f2f;background:#fbf3f2;padding:12px 14px;border-radius:4px;margin:16px 0}
ol{padding-left:22px}</style></head><body>${tresc}</body></html>`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Strona z sekretem nie może wylądować w żadnej pamięci podręcznej.
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const pierwszy = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const sekret = process.env.CRON_SECRET;
  if (!sekret || pierwszy(req.query.state) !== sekret) {
    return res.status(401).send(strona("Brak uprawnień", "<h1>Brak uprawnień</h1><p>Zacznij od adresu <code>/api/google-auth?secret=…</code>.</p>"));
  }

  const blad = pierwszy(req.query.error);
  if (blad) {
    return res.status(400).send(strona("Zgoda odrzucona",
      `<h1>Google nie udzieliło zgody</h1><p>Powód: <code>${uciec(blad)}</code></p>`));
  }

  const kod = pierwszy(req.query.code);
  if (!kod) {
    return res.status(400).send(strona("Brak kodu", "<h1>Brak kodu zgody</h1><p>Zacznij od adresu <code>/api/google-auth?secret=…</code>.</p>"));
  }

  const k = konfiguracjaGoogle();
  const odp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: kod,
      client_id: k.idKlienta,
      client_secret: k.sekretKlienta,
      redirect_uri: adresPrzekierowania(req),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const dane = await odp.json();

  if (!odp.ok || !dane.refresh_token) {
    const powod = dane.error_description || dane.error || `kod ${odp.status}`;
    return res.status(502).send(strona("Nie udało się", `<h1>Nie udało się pobrać tokenu</h1>
      <p>Google odpowiedziało: <code>${uciec(powod)}</code></p>
      <p>Jeśli w odpowiedzi nie było tokenu odświeżania, cofnij dostęp aplikacji na
      <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
      i przejdź proces jeszcze raz — Google wydaje ten token tylko przy pierwszej zgodzie.</p>`));
  }

  return res.status(200).send(strona("Token gotowy", `
    <h1>Gotowe — zostały dwa kroki</h1>
    <div class="ostrz"><strong>To jest hasło do Twojego kalendarza.</strong> Nie rób z tej strony zrzutu
    ekranu do wysłania, nie wklejaj tego nikomu i nie zapisuj w notatkach. Kto ma ten ciąg,
    ten może czytać i zmieniać wydarzenia w Twoim kalendarzu.</div>
    <ol>
      <li>Skopiuj poniższy ciąg:<span class="token">${uciec(dane.refresh_token)}</span></li>
      <li>W Vercelu otwórz projekt SBS &rarr; <strong>Settings &rarr; Environment Variables</strong>,
      dodaj zmienną <code>GOOGLE_REFRESH_TOKEN</code> i wklej go jako wartość.</li>
      <li>Kliknij <strong>Redeploy</strong>, żeby nowa zmienna trafiła do działającej wersji.</li>
    </ol>
    <p>Potem zamknij tę kartę — ta strona nie zapisuje niczego i po odświeżeniu token zniknie.
    Sprawdzić połączenie możesz adresem <code>/api/kalendarz-sync?secret=…&amp;dry=1</code>.</p>`));
}
