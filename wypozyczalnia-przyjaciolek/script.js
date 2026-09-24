const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---- Menu mobilne ----
const toggle = $('.nav__toggle');
const menu = $('#menu');
const closeMenu = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', menu.classList.toggle('open')));
menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });

// ---- Cień pod menu + przycisk "Zarezerwuj" na dole ekranu (telefon) ----
const nav = $('.nav');
const sticky = $('.sticky-cta');
const booking = $('#rezerwacja');
const onScroll = () => {
  nav.classList.toggle('scrolled', scrollY > 10);
  const b = booking.getBoundingClientRect();
  const inBooking = b.top < innerHeight && b.bottom > 0;
  sticky.classList.toggle('show', scrollY > innerHeight * .8 && !inBooking);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---- Zmieniające się słowo w nagłówku ----
const words = ['na zakupy', 'na koncert', 'do pogadania', 'na wyjazd', 'na urodziny', 'na imprezę', 'po rozstaniu'];
const rot = $('.rot__w');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) {
  let i = 0;
  setInterval(() => {
    rot.classList.add('out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      rot.textContent = words[i];
      rot.classList.remove('out');
      rot.classList.add('in');
      requestAnimationFrame(() => requestAnimationFrame(() => rot.classList.remove('in')));
    }, 380);
  }, 2400);
}

// ---- Animacje przy przewijaniu ----
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); }
}), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach(el => io.observe(el));

// ---- Przyciski "Wybieram X" i pakiety ustawiają formularz ----
const setSelect = (id, value) => {
  const sel = document.getElementById(id);
  const opt = [...sel.options].find(o => o.text === value);
  if (opt) sel.value = opt.value;
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-pick], [data-pkg]');
  if (!a) return;
  if (a.dataset.pick) setSelect('f-typ', a.dataset.pick);
  if (a.dataset.pkg) setSelect('f-pkg', a.dataset.pkg);
});

// ---- Quiz ----
const RESULTS = {
  spokoj:  { kawa: 'Powierniczka', miasto: 'Dama',          kolacja: 'Dama',   foto: 'Instagramerka' },
  energia: { kawa: 'Wariatka',     miasto: 'Imprezowiczka', kolacja: 'Wariatka', foto: 'Instagramerka' },
  smutek:  { kawa: 'Powierniczka', miasto: 'Wariatka',      kolacja: 'Powierniczka', foto: 'Wariatka' },
  glam:    { kawa: 'Instagramerka', miasto: 'Imprezowiczka', kolacja: 'Dama',  foto: 'Instagramerka' },
};
const quiz = $('#quiz');
const [step1, step2] = $$('.quiz__step', quiz);
const res = $('.quiz__res', quiz);
let mood = null;
$$('[data-a]', quiz).forEach(b => b.addEventListener('click', () => { mood = b.dataset.a; step1.hidden = true; step2.hidden = false; }));
$$('[data-b]', quiz).forEach(b => b.addEventListener('click', () => {
  const name = RESULTS[mood][b.dataset.b];
  $('.quiz__name', res).textContent = name;
  $('.quiz__img', res).src = `img/${name.toLowerCase()}.jpg`;
  $('#quiz-go').dataset.pick = name;
  step2.hidden = true; res.hidden = false;
}));
$('#quiz-again').addEventListener('click', () => { res.hidden = true; step1.hidden = false; });

// ---- Formularz ----
$('input[type=date]').min = new Date().toISOString().slice(0, 10);
$('#year').textContent = new Date().getFullYear();

const form = $('#form');
const msg = $('#form-msg');
form.addEventListener('input', e => e.target.classList.remove('invalid'));
form.addEventListener('submit', async e => {
  e.preventDefault();
  msg.className = 'form__msg';
  let ok = true;
  $$('[required]', form).forEach(el => {
    const bad = el.type === 'checkbox' ? !el.checked : !el.value.trim();
    el.classList.toggle('invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) { msg.textContent = 'Uzupełnij zaznaczone pola i zaakceptuj regulamin.'; return; }

  // Gdy ustawisz action formularza (np. Formspree), dane zostaną wysłane.
  const action = form.getAttribute('action');
  if (action && action !== '#') {
    try {
      const r = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error();
    } catch {
      msg.textContent = 'Coś poszło nie tak. Napisz do nas: kontakt@twojadomena.pl';
      return;
    }
  }
  form.reset();
  msg.classList.add('ok');
  msg.textContent = 'Dziękujemy! 💗 Odezwiemy się w ciągu 24 godzin.';
});
