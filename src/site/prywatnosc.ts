// Strona polityki prywatności — osobne, minimalne wejście.
//
// DLACZEGO NIE src/site/main.ts
// Tamten plik obsługuje formularz zgłoszenia, wybór pakietu, oczko przy haśle i odsłanianie
// sekcji przy przewijaniu. Na stronie z dokumentem prawnym nie ma ani jednej z tych rzeczy,
// a import klienta bazy przy wysyłce formularza wciągałby zależności, których ta strona
// nie potrzebuje. Tutaj zostaje wyłącznie to, co jest naprawdę używane: przełącznik języka
// i rok w stopce.

import "./style.css";
import { uruchomPrzelacznikJezyka } from "./jezyk";

const rok = document.getElementById("rok");
if (rok) rok.textContent = String(new Date().getFullYear());

uruchomPrzelacznikJezyka();
