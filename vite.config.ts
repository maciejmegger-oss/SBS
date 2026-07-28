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

        // Vercel podaje funkcji gotowe `req.body` (rozpakowany JSON). Serwer Vite
        // tego nie robi — bez tego funkcje przyjmujące POST-a (np. admin-users)
        // widziałyby pustą treść i działały wyłącznie po wdrożeniu.
        let body = undefined;
        if (req.method !== "GET" && req.method !== "HEAD") {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = raw;   // nie-JSON zostawiamy surowy, tak jak robi to Vercel
            }
          }
        }

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
          await handler({ query, body, method: req.method, headers: req.headers }, shim);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Funkcja /api/" + name + " zgłosiła błąd: " + e.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vercelApiDevPlugin()],
  server: {
    port: 5173,
    hmr: process.env.NODE_ENV === 'production' ? false : undefined,
  },
  build: {
    sourcemap: false,
  },
});
