// Zarządzanie kontami użytkowników — wyłącznie po stronie serwera.
//
// DLACZEGO TO NIE MOŻE BYĆ W PRZEGLĄDARCE
// Zakładanie, blokowanie i usuwanie kont wymaga klucza `service_role`, który
// omija wszystkie reguły dostępu i daje pełną władzę nad bazą. Wszystko, co
// trafia do kodu aplikacji (nawet „ukryte" w zmiennej), jest wysyłane do
// przeglądarki i czytelne dla każdego odwiedzającego. Ten klucz żyje więc
// tylko tutaj, jako zmienna środowiskowa wdrożenia.
//
// KOMU WOLNO
// Każde wywołanie musi przynieść token zalogowanego użytkownika. Funkcja
// sprawdza go w Supabase, odczytuje rolę z bazy (nie z tokenu — token można
// odczytać, ale roli w nim nie ma) i przepuszcza wyłącznie administratorów.
// Danym przysłanym z przeglądarki nie ufamy w żadnym punkcie.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ROLES = ["admin", "scout", "viewer"];

const svc = (path, init = {}) =>
  fetch(SUPABASE_URL + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

/** Sprawdza token i zwraca profil wywołującego. Rzuca, gdy to nie administrator. */
async function requireAdmin(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw Object.assign(new Error("Brak tokenu — zaloguj się ponownie."), { status: 401 });

  // Weryfikacja tokenu po stronie Supabase. Tokenu nie próbujemy odczytywać
  // samodzielnie: bez sprawdzenia podpisu dałoby się go podrobić.
  const userRes = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + token },
  });
  if (!userRes.ok) {
    throw Object.assign(new Error("Sesja wygasła — zaloguj się ponownie."), { status: 401 });
  }
  const user = await userRes.json();

  // Rola pochodzi z bazy, nie z tokenu — inaczej wystarczyłoby podmienić token
  // po swojej stronie, żeby zostać administratorem.
  const profRes = await svc(
    "/rest/v1/sbs_users?id=eq." + encodeURIComponent(user.id) + "&select=id,role,org_id,active",
  );
  const rows = await profRes.json();
  const profile = Array.isArray(rows) ? rows[0] : null;

  if (!profile || !profile.active) {
    throw Object.assign(new Error("Konto nieaktywne."), { status: 403 });
  }
  if (profile.role !== "admin") {
    throw Object.assign(new Error("Ta operacja wymaga uprawnień administratora."), { status: 403 });
  }
  return profile;
}

/** Pobiera profil osoby, na której wykonujemy operację — i pilnuje granicy organizacji. */
async function targetInSameOrg(userId, adminProfile) {
  const res = await svc(
    "/rest/v1/sbs_users?id=eq." + encodeURIComponent(userId) + "&select=id,email,role,org_id",
  );
  const rows = await res.json();
  const target = Array.isArray(rows) ? rows[0] : null;
  if (!target || target.org_id !== adminProfile.org_id) {
    // Ten sam komunikat dla „nie istnieje" i „z innej organizacji" — inaczej
    // dałoby się sprawdzać po ID, kto istnieje w innych organizacjach.
    throw Object.assign(new Error("Nie znaleziono takiego użytkownika."), { status: 404 });
  }
  return target;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Dozwolona jest tylko metoda POST." });
  }
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return res.status(500).json({
      error:
        "Funkcja nie jest skonfigurowana. Brakuje zmiennych środowiskowych: " +
        [
          !SUPABASE_URL && "SUPABASE_URL",
          !ANON_KEY && "SUPABASE_ANON_KEY",
          !SERVICE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
        ]
          .filter(Boolean)
          .join(", ") +
        ". Patrz docs/KONFIGURACJA-LOGOWANIA.md.",
    });
  }

  let admin;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    // ---- lista użytkowników w organizacji ---------------------------------
    if (action === "list") {
      const r = await svc(
        "/rest/v1/sbs_users?org_id=eq." + encodeURIComponent(admin.org_id) +
          "&select=id,email,full_name,role,active,created_at,last_seen_at&order=created_at.asc",
      );
      const users = await r.json();
      if (!Array.isArray(users)) throw new Error(users.message || "Nie udało się pobrać listy kont.");
      // `invited` = zaproszenie wysłane, ale osoba jeszcze nigdy się nie zalogowała.
      return res.status(200).json({
        users: users.map((u) => ({ ...u, invited: !u.last_seen_at })),
      });
    }

    // ---- zaproszenie nowej osoby -----------------------------------------
    if (action === "invite" || action === "resend-invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const fullName = String(body.fullName || "").trim();
      const role = ROLES.includes(body.role) ? body.role : "scout";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: "Podaj poprawny adres e-mail." });
      }

      const siteUrl = body.siteUrl || req.headers?.origin || "";
      const inviteRes = await svc(
        "/auth/v1/invite" + (siteUrl ? "?redirect_to=" + encodeURIComponent(siteUrl) : ""),
        {
          method: "POST",
          body: JSON.stringify({
            email,
            // Te dane odczyta wyzwalacz w bazie i założy z nich profil
            // (patrz sbs_handle_new_user w migracji). Dzięki temu nowa osoba
            // od pierwszego logowania ma właściwą rolę i organizację.
            data: { full_name: fullName, role, org_id: admin.org_id },
          }),
        },
      );

      if (!inviteRes.ok) {
        const err = await inviteRes.json().catch(() => ({}));
        const msg = String(err.msg || err.message || "").toLowerCase();
        if (msg.includes("already been registered") || msg.includes("already registered")) {
          return res.status(400).json({ error: "Konto z tym adresem już istnieje." });
        }
        if (inviteRes.status === 429 || msg.includes("rate limit")) {
          return res.status(429).json({
            error:
              "Przekroczono limit wysyłanych wiadomości. Wbudowany nadawca Supabase pozwala " +
              "na kilka maili na godzinę — po skonfigurowaniu własnego SMTP limit znika.",
          });
        }
        return res.status(400).json({ error: err.msg || err.message || "Nie udało się wysłać zaproszenia." });
      }
      return res.status(200).json({ ok: true });
    }

    // ---- zmiana roli ------------------------------------------------------
    if (action === "set-role") {
      const role = body.role;
      if (!ROLES.includes(role)) return res.status(400).json({ error: "Nieznana rola." });

      const target = await targetInSameOrg(body.userId, admin);

      // Zabezpieczenie przed zamknięciem się na zewnątrz: gdyby ostatni admin
      // odebrał sobie uprawnienia, nikt nie mógłby już zarządzać kontami —
      // odzyskanie dostępu wymagałoby ręcznego SQL-a w panelu Supabase.
      if (target.id === admin.id && role !== "admin") {
        return res.status(400).json({
          error: "Nie możesz odebrać uprawnień administratora samemu sobie.",
        });
      }
      if (target.role === "admin" && role !== "admin") {
        const cnt = await svc(
          "/rest/v1/sbs_users?org_id=eq." + encodeURIComponent(admin.org_id) +
            "&role=eq.admin&active=eq.true&select=id",
        );
        const admins = await cnt.json();
        if (Array.isArray(admins) && admins.length <= 1) {
          return res.status(400).json({ error: "To jedyny administrator — najpierw wyznacz innego." });
        }
      }

      await svc("/rest/v1/sbs_users?id=eq." + encodeURIComponent(target.id), {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      return res.status(200).json({ ok: true });
    }

    // ---- blokowanie i odblokowanie konta ----------------------------------
    if (action === "set-active") {
      const active = body.active === true;
      const target = await targetInSameOrg(body.userId, admin);
      if (target.id === admin.id && !active) {
        return res.status(400).json({ error: "Nie możesz zablokować własnego konta." });
      }
      await svc("/rest/v1/sbs_users?id=eq." + encodeURIComponent(target.id), {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      return res.status(200).json({ ok: true });
    }

    // ---- trwałe usunięcie konta ------------------------------------------
    if (action === "delete") {
      const target = await targetInSameOrg(body.userId, admin);
      if (target.id === admin.id) {
        return res.status(400).json({ error: "Nie możesz usunąć własnego konta." });
      }
      // Usunięcie konta w Supabase kasuje kaskadowo profil w sbs_users
      // (klucz obcy z `on delete cascade`). Dane wprowadzone przez tę osobę
      // — zawodnicy, obserwacje, raporty — zostają w bazie nienaruszone.
      const del = await svc("/auth/v1/admin/users/" + encodeURIComponent(target.id), {
        method: "DELETE",
      });
      if (!del.ok) {
        const err = await del.json().catch(() => ({}));
        return res.status(400).json({ error: err.msg || "Nie udało się usunąć konta." });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Nieznana operacja: " + action });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
}
