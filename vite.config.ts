import { defineConfig } from "vite";

// Funkcje z katalogu api/ na produkcji uruchamia Vercel. Serwer deweloperski Vite nic o nich nie
// wie i na /api/... oddawał stronę aplikacji, więc pobieranie statystyk i terminarzy działało
// wyłącznie po wdrożeniu. Ta wtyczka podstawia te same pliki pod te same adresy lokalnie:
// importuje handler na żądanie (dzięki temu zmiany w api/*.js łapią się bez restartu serwera)
// i podaje mu `req.query` oraz `res.status().json()`, czyli to, czego oczekuje od Vercela.
function vercelApiDevPlugin() {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();

        const url = new URL(req.url, "http://localhost");
        const name = url.pathname.replace(/^\/api\//, "").replace(/[^a-zA-Z0-9_-]/g, "");
        if (!name) return next();

        let handler;
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          handler = mod.default;
        } catch {
          return next();   // brak takiego pliku — niech Vite obsłuży to po swojemu
        }
        if (typeof handler !== "function") return next();

        // Treść żądania POST. Na produkcji parsuje ją Vercel i podaje w req.body; serwer
        // deweloperski nie robi nic, więc szybki zapis statystyk (przeglądarka odsyła policzony
        // ładunek) działałby wyłącznie po wdrożeniu. Ta pętla wyrównuje jedno z drugim.
        let body = undefined;
        if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
          const kawalki = [];
          for await (const k of req) kawalki.push(k);
          const tekst = Buffer.concat(kawalki).toString("utf8");
          try { body = tekst ? JSON.parse(tekst) : undefined; } catch { body = undefined; }
        }

        const query = Object.fromEntries(url.searchParams.entries());
        const shim = {
          status(code) { res.statusCode = code; return this; },
          setHeader(k, v) { res.setHeader(k, v); return this; },
          json(body) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(body));
            return this;
          },
        };

        try {
          await handler({ query, method: req.method, headers: req.headers, body }, shim);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Funkcja /api/" + name + " zgłosiła błąd: " + e.message }));
        }
      });
    },
  };
}

// Adresy przyjazne, bez końcówki .html — na produkcji załatwiają je przekierowania w vercel.json.
// Serwer deweloperski Vite nic o nich nie wie i oddawał pod /m czy /app stronę główną, więc ta sama
// ścieżka działała inaczej lokalnie i po wdrożeniu. Ta wtyczka wyrównuje jedno z drugim.
//
//   /      → index.html   (strona publiczna, bez logowania)
//   /app   → app.html     (system — wyłącznie po zalogowaniu)
//   /m     → mobile.html  (panel mobilny — wyłącznie po zalogowaniu)
function friendlyRoutesDevPlugin() {
  const TRASY: Record<string, string> = { "/m": "/mobile.html", "/app": "/app.html" };
  return {
    name: "friendly-routes-dev",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const czysty = (req.url || "").replace(/\/$/, "") || "/";
        if (TRASY[czysty]) req.url = TRASY[czysty];
        next();
      });
    },
  };
}

// Znacznik wersji wstrzykiwany przy budowaniu. Panel pokazuje go w zakładce Baza, żeby dało się
// jednym spojrzeniem stwierdzić, czy telefon pracuje na świeżo wdrożonej wersji — bez tego
// rozstrzygnięcie „czy poprawka doszła" sprowadzało się do zgadywania po wyglądzie ekranu.
const WERSJA = new Date().toISOString().slice(0, 16).replace("T", " ");

// ZNACZNIK WERSJI TAKŻE JAKO PLIK NA SERWERZE.
//
// Sam `__WERSJA__` mówi tylko, na czym pracuje TA karta. Panel musi jeszcze umieć zapytać, co
// stoi na serwerze — inaczej nie ma jak zauważyć, że wdrożono poprawkę.
//
// Wcześniej opierało się to na mechanizmie offline (nowy service worker = nowa wersja) i było
// bezużyteczne: plik sw.js nie zmienia się przy zwykłym wdrożeniu, więc przeglądarka nie miała
// czego instalować, zdarzenie „zmiana kontrolera" nie padało nigdy i pasek o nowej wersji nie
// pokazywał się ani razu. Znacznik w osobnym pliku jest od tego niezależny: zmienia się przy
// KAŻDYM zbudowaniu, bo bierze się z godziny budowania.
function wersjaPlikPlugin() {
  const tresc = JSON.stringify({ wersja: WERSJA });
  return {
    name: "wersja-panelu",
    // Serwer deweloperski nie przechodzi przez generateBundle, a bez tego sprawdzanie wersji
    // dawałoby lokalnie 404 i nie dałoby się go przetestować przed wdrożeniem.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || req.url.split("?")[0] !== "/wersja.json") return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(tresc);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "wersja.json", source: tresc });
    },
  };
}

export default defineConfig({
  define: { __WERSJA__: JSON.stringify(WERSJA) },
  plugins: [vercelApiDevPlugin(), friendlyRoutesDevPlugin(), wersjaPlikPlugin()],
  server: {
    port: 5173,
    hmr: process.env.NODE_ENV === 'production' ? false : undefined,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      // Trzy wejścia, jedna baza: strona publiczna, aplikacja na komputerze i panel mobilny.
      // Wspólny kod (klient Supabase, logowanie, typy) Vite wydzieli sam do osobnej paczki.
      input: {
        site: "index.html",
        main: "app.html",
        mobile: "mobile.html",
      },
    },
  },
});
