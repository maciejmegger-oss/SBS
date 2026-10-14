// Wspólne ustawienia wywołań Anthropic dla endpointów AI.
//
// Model jest zapisany w JEDNYM miejscu — wcześniej siedział osobno w opinia-ai.js i raport-ai.js
// i zmiana wymagała pamiętania o obu. Można go nadpisać zmienną ANTHROPIC_MODEL w Vercelu bez
// wdrażania kodu. Przed zmianą sprawdź aktualną nazwę modelu w dokumentacji Anthropic.

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

/**
 * Zapisuje w logach funkcji, ile tokenów zużyło wywołanie. Dzięki temu koszt widać w Vercel →
 * Logs (szukaj "ai-zuzycie") i można go zestawić z limitem w konsoli Anthropic. Nie logujemy
 * treści zapytań ani odpowiedzi — to dane o zawodnikach, często niepełnoletnich.
 */
export function logujZuzycie(endpoint, konto, wynik) {
  try {
    const u = (wynik && wynik.usage) || {};
    console.log("ai-zuzycie " + JSON.stringify({
      endpoint,
      konto: konto && konto.userId,
      model: (wynik && wynik.model) || MODEL,
      wejscie: u.input_tokens || 0,
      wyjscie: u.output_tokens || 0,
      wyszukiwania: (u.server_tool_use && u.server_tool_use.web_search_requests) || 0,
    }));
  } catch { /* log nie może zepsuć odpowiedzi */ }
}
