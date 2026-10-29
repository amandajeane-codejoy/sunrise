// Messages to Davis (brief 4.12). They always say "your wife," never her name.
// The app writes the text; tapping the button opens Messages with it filled in,
// and she taps send there. Without a server, that last tap is hers.

/* ---------- Weeks ---------- */

// Monday of the week to summarize: this week on Sunday, otherwise last week.
function summaryWeekStart(today = dateKey()) {
  const thisMonday = dateKey(startOfWeek(new Date(today + 'T12:00')));
  const isSunday = new Date(today + 'T12:00').getDay() === 0;
  return isSunday ? thisMonday : addDays(thisMonday, -7);
}

function weekStats(monday) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const inWeek = workouts().filter(w => days.includes(w.date));
  return {
    monday,
    workouts: inWeek.length,
    shoulderDays: new Set(inWeek.filter(w => w.type === 'Shoulders & Posture').map(w => w.date)).size,
    walks: days.filter(d => dayStatus(d) === 'walk').length,
    journeyTotal: workouts().filter(w => w.date <= days[6]).length,
    target: Number(state.profile.weeklyTarget) || 3
  };
}

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

// "this week" on Sunday, "last week" after it's over.
function summaryMessage(stats, today = dateKey()) {
  const week = addDays(stats.monday, 6) >= today ? 'this week' : 'last week';
  const walks = stats.walks ? `, plus ${plural(stats.walks, 'walk')}` : '';
  if (!stats.workouts) {
    return `Your wife had a quiet week${stats.walks ? `, with ${plural(stats.walks, 'walk')} and no workouts` : ''}. ` +
      `A little encouragement might help her get moving${week === 'this week' ? ' this coming week' : ''}.`;
  }
  const shoulders = stats.shoulderDays ? `, including ${plural(stats.shoulderDays, 'shoulder day')}` : '';
  const goal = stats.workouts >= stats.target ? ' She hit her weekly goal!' : '';
  return `Your wife got in ${plural(stats.workouts, 'workout')} ${week}${shoulders}${walks}.${goal} ` +
    `That’s ${stats.journeyTotal} of 70 on her journey.`;
}

const TWO_DAYS_OFF_MESSAGE =
  'Your wife has had 2 days off in a row. A little encouragement might help her get moving tomorrow morning.';

/* ---------- Two days off ---------- */

// A day off: a past journey day with no workout and no walk. Planned rest counts.
function isDayOff(key) {
  const start = state.journey.startedOn;
  if (!start || key < start || key >= dateKey()) return false;
  const status = dayStatus(key);
  return status !== 'work' && status !== 'walk';
}

// The run of days off ending yesterday, if it's 2 or more. Keyed by its first
// day, so one alert covers the whole run instead of one every day.
function twoDaysOffRun() {
  let day = addDays(dateKey(), -1), length = 0;
  while (isDayOff(day)) { length += 1; day = addDays(day, -1); }
  return length >= 2 ? { key: `alert:${addDays(day, 1)}`, length } : null;
}

/* ---------- What's waiting to send ---------- */

function davisHandled(key) { return !!state.davisLog[key]; }

function markDavis(key, status) {
  state.davisLog[key] = { status, at: new Date().toISOString() };
  saveState();
}

function pendingAlert() {
  if (!state.davis.twoDayAlert) return null;
  const run = twoDaysOffRun();
  return run && !davisHandled(run.key) ? run : null;
}

// The Sunday summary is offered Sunday from 5 PM, and on Monday if it wasn't handled.
function pendingSummary(now = new Date()) {
  if (!state.davis.weeklySummary) return null;
  const day = now.getDay();
  if (!((day === 0 && now.getHours() >= 17) || day === 1)) return null;
  const monday = summaryWeekStart(dateKey(now));
  if (state.journey.startedOn && addDays(monday, 6) < state.journey.startedOn) return null;
  const key = `summary:${monday}`;
  return davisHandled(key) ? null : { key, monday };
}

function smsLink(text) {
  const phone = (state.davis.phone || '').replace(/[^\d+]/g, '');
  return `sms:${phone}&body=${encodeURIComponent(text)}`;
}

/* ---------- Rendering ---------- */

function davisName() { return esc(state.davis.name || 'Davis'); }

function renderDavisCards() {
  const cards = [];
  const alert = pendingAlert();
  if (alert) {
    cards.push(`<article class="card davis-card">
      <p class="eyebrow">A heads-up for ${davisName()}</p>
      <p class="quote">${esc(TWO_DAYS_OFF_MESSAGE)}</p>
      <div class="two-buttons gap-s">
        <button type="button" class="secondary" data-davis-skip="${alert.key}">Not now</button>
        <a class="primary small" href="${smsLink(TWO_DAYS_OFF_MESSAGE)}" data-davis-send="${alert.key}">Text ${davisName()}</a>
      </div>
    </article>`);
  }
  if (pendingSummary()) {
    cards.push(`<article class="card davis-card">
      <p class="eyebrow">Sunday summary</p>
      <p class="gap-s">This week’s update for ${davisName()} is ready.</p>
      <button type="button" class="primary small gap-s" data-go="davis-summary">See it →</button>
    </article>`);
  }
  document.getElementById('davis-cards').innerHTML = cards.join('');
}

function renderDavisSummary() {
  const monday = summaryWeekStart();
  const key = `summary:${monday}`;
  const stats = weekStats(monday);
  const text = summaryMessage(stats);
  const sunday = addDays(monday, 6);
  const fmt = k => new Date(k + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  document.getElementById('ds-week').textContent = `Week of ${fmt(monday)} to ${fmt(sunday)}`;
  document.getElementById('ds-message').textContent = text;
  const send = document.getElementById('ds-send');
  send.href = smsLink(text);
  send.dataset.davisSend = key;
  send.textContent = `Text ${state.davis.name || 'Davis'}`;
  document.getElementById('ds-title').textContent = `Weekly update for ${state.davis.name || 'Davis'}`;
  document.getElementById('ds-skip').dataset.davisSkip = key;
  document.getElementById('ds-no-phone').hidden = !!state.davis.phone;
  const handled = state.davisLog[key];
  document.getElementById('ds-status').textContent = !handled ? ''
    : handled.status === 'sent' ? '✓ Opened in Messages. Thanks for keeping him in the loop.'
    : 'Skipped this week. You can still send it.';
  document.getElementById('ds-off').hidden = state.davis.weeklySummary;
}

/* ---------- Taps ---------- */

document.addEventListener('click', event => {
  const t = event.target;
  // Let the link open Messages, and remember it was sent.
  const send = t.closest('[data-davis-send]');
  if (send) { markDavis(send.dataset.davisSend, 'sent'); setTimeout(render, 300); return; }
  const skip = t.closest('[data-davis-skip]');
  if (skip) {
    markDavis(skip.dataset.davisSkip, 'skipped');
    render();
    toast('Okay. Not this time.');
  }
});
