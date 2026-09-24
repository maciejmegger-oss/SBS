// Menu mobilne
const toggle = document.querySelector('.nav__toggle');
const menu = document.getElementById('menu');
toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
menu.addEventListener('click', e => {
  if (e.target.tagName === 'A') { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', false); }
});

// Kliknięcie "Wybieram X" / pakietu ustawia wartość w formularzu
const setSelect = (id, value) => {
  const sel = document.getElementById(id);
  const opt = [...sel.options].find(o => o.text === value);
  if (opt) sel.value = opt.value;
};
document.querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => setSelect('f-typ', a.dataset.pick)));
document.querySelectorAll('[data-pkg]').forEach(a => a.addEventListener('click', () => setSelect('f-pkg', a.dataset.pkg)));

// Data: nie wcześniej niż dziś
const dateInput = document.querySelector('input[type=date]');
dateInput.min = new Date().toISOString().slice(0, 10);

document.getElementById('year').textContent = new Date().getFullYear();

// Formularz — walidacja i wysyłka.
// Gdy ustawisz action formularza na adres Formspree / własnego API, dane zostaną wysłane fetch-em.
const form = document.getElementById('form');
const msg = document.getElementById('form-msg');
form.addEventListener('submit', async e => {
  e.preventDefault();
  let ok = true;
  form.querySelectorAll('[required]').forEach(el => {
    const bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
    el.classList.toggle('invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) { msg.textContent = 'Uzupełnij zaznaczone pola i zaakceptuj zasady.'; return; }

  const action = form.getAttribute('action');
  if (action && action !== '#') {
    try {
      const res = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error();
    } catch {
      msg.textContent = 'Coś poszło nie tak. Napisz do nas bezpośrednio: kontakt@twojadomena.pl';
      return;
    }
  }
  form.reset();
  msg.textContent = 'Dziękujemy! Odezwiemy się w ciągu 24 godzin ♡';
});
