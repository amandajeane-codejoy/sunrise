const VERSION = '0.2';
const SCREENS = ['checkin', 'today', 'progress', 'settings'];
const TAB_FOR = { checkin: 'today', today: 'today', progress: 'progress', settings: 'settings' };

function openScreen(id, { push = true } = {}) {
  if (!SCREENS.includes(id)) id = 'checkin';
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('#nav button').forEach(b => {
    const on = b.dataset.tab === TAB_FOR[id];
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  if (push) history.replaceState(null, '', id === 'checkin' ? './' : `?screen=${id}`);
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function fillDates() {
  const now = new Date();
  const long = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
  const short = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase().replace(',', ' ·');
  document.querySelectorAll('[data-date="long"]').forEach(el => el.textContent = long);
  document.querySelectorAll('[data-date="short"]').forEach(el => el.textContent = short);
  const h = now.getHours();
  document.querySelector('[data-greeting]').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.querySelector('[data-kicker]').textContent = h < 12 ? 'Your morning starts here' : 'Your day, your plan';
}

// Sample activity until real logging arrives (step 6).
function sampleKind(date) {
  const pattern = ['work', 'rest', 'walk', 'work', '', 'work', 'walk'];
  return pattern[date.getDate() % pattern.length];
}

function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  document.getElementById('cal-month').textContent = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const cal = document.getElementById('calendar');
  const parts = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="dow">${d}</span>`);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  for (let i = 0; i < lead; i++) parts.push('<span></span>');
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const classes = ['day'];
    if (d < now.getDate()) { const k = sampleKind(date); if (k) classes.push(k); }
    if (d === now.getDate()) classes.push('today');
    if (d > now.getDate()) classes.push('future');
    parts.push(`<span class="${classes.join(' ')}">${d}</span>`);
  }
  cal.innerHTML = parts.join('');
}

document.addEventListener('click', event => {
  const go = event.target.closest('[data-go]');
  if (go) return openScreen(go.dataset.go);

  const soon = event.target.closest('[data-soon]');
  if (soon) return toast(soon.dataset.soon);

  const plan = event.target.closest('[data-plan]');
  if (plan) {
    document.querySelectorAll('.choice').forEach(b => b.classList.toggle('selected', b === plan));
    document.getElementById('plan-status').textContent = plan.dataset.plan;
  }
});

document.getElementById('version').textContent = VERSION;
fillDates();
renderCalendar();
openScreen(new URLSearchParams(location.search).get('screen') || 'checkin', { push: false });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
