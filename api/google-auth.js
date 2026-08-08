// Krok 1 podłączenia Kalendarza Google: przekierowanie na ekran zgody.
//
// Endpoint jest chroniony sekretem, bo kto go otworzy, ten podłącza SWÓJ kalendarz do tej
// instalacji SBS. Bez tego ktoś przypadkowy mógłby wpiąć obcy kalendarz.
import { ZAKRES, konfiguracjaGoogle, adresPrzekierowania } from "./_google.js";

export default async function handler(req, res) {
  const sekret = process.env.CRON_SECRET;
  const podany = (Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret) || "";
  if (!sekret) {
    return res.status(500).send("Ustaw najpierw zmienną CRON_SECRET w Vercelu — bez niej ten adres byłby otwarty dla każdego.");
  }
  if (podany !== sekret) return res.status(401).send("Brak uprawnień.");

  const k = konfiguracjaGoogle();
  if (!k.idKlienta || !k.sekretKlienta) {
    return res.status(500).send("Brak GOOGLE_CLIENT_ID lub GOOGLE_CLIENT_SECRET w zmiennych środowiskowych Vercela.");
  }

  const parametry = new URLSearchParams({
    client_id: k.idKlienta,
    redirect_uri: adresPrzekierowania(req),
    response_type: "code",
    scope: ZAKRES,
    // access_type=offline zwraca token odświeżania, prompt=consent wymusza go także wtedy, gdy
    // zgoda była już kiedyś udzielona — inaczej przy drugim podejściu Google oddaje sam token
    // dostępowy i nie ma czego zapisać.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    // Sekret wraca do nas razem z kodem, więc krok drugi też jest chroniony — bez tego adres
    // powrotny byłby otwarty i wyświetlałby stronę z tokenem każdemu, kto go wywoła.
    state: sekret,
  });

  res.writeHead(302, { Location: "https://accounts.google.com/o/oauth2/v2/auth?" + parametry });
  res.end();
}
