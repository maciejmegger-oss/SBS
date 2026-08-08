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
          await handler({ query, method: req.method, headers: req.headers }, shim);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Funkcja /api/" + name + " zgłosiła błąd: " + e.message }));
        }
      });
    },
  };
}

// Panel mobilny stoi pod adresem /m — na produkcji załatwia to przekierowanie w vercel.json.
// Serwer deweloperski Vite nic o nim nie wie i oddawał pod /m stronę aplikacji na komputerze,
// więc ta sama ścieżka działała inaczej lokalnie i po wdrożeniu. Ta wtyczka wyrównuje jedno z drugim.
function mobileRouteDevPlugin() {
  return {
    name: "mobile-route-dev",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/m" || req.url === "/m/") req.url = "/mobile.html";
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [vercelApiDevPlugin(), mobileRouteDevPlugin()],
  server: {
    port: 5173,
    hmr: process.env.NODE_ENV === 'production' ? false : undefined,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      // Dwa wejścia, jedna baza: aplikacja na komputerze i panel mobilny. Wspólny kod
      // (klient Supabase, logowanie, typy) Vite wydzieli sam do osobnej paczki.
      input: {
        main: "index.html",
        mobile: "mobile.html",
      },
    },
  },
});
