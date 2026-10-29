// The morning check-in (brief 4.2): today's plan, or tomorrow's on an early day.

let planTarget = 'today'; // 'today' or 'tomorrow'

const MISSED_NOTES = {
  1: 'Yesterday was off. Today’s a fresh one.',
  2: 'Two days off. Today’s a short restart workout. Let’s go.'
};
const REST_REASONS = ['Travel', 'Busy', 'Sore', 'Other'];

function planKey() { return planTarget === 'today' ? dateKey() : addDays(dateKey(), 1); }

function workoutsOn(key) { return state.log.filter(e => e.date === key && e.kind === 'workout'); }

function timeLabel(hhmm) {
  const [h, m] = (hhmm || '12:00').split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function renderCheckin() {
  const isToday = planTarget === 'today';
  const key = planKey();
  const plan = state.dayPlans[key] || null;
  const doneToday = isToday ? workoutsOn(key) : [];

  // "Never two in a row" note, only until today has a plan or a workout.
  const missed = isToday && !doneToday.length && !plan ? missedBeforeToday() : 0;
  const note = document.getElementById('missed-note');
  note.hidden = !missed;
  note.textContent = MISSED_NOTES[missed] || '';
  note.classList.toggle('trainer', missed === 2);

  document.getElementById('plan-title').textContent = isToday ? 'What’s the plan today?' : 'Tomorrow’s plan';
  const now = document.getElementById('workout-now');
  now.hidden = !isToday;
  now.textContent = doneToday.length ? 'Do another workout →'
    : todayLength() === 'restart' ? `Start the ${planWorkout('restart').minutes}-minute restart →`
    : todayLength() === 'short' ? 'Start 5-minute workout →' : 'Workout now →';

  document.querySelectorAll('[data-choice]').forEach(b => b.classList.toggle('selected', !!plan && plan.choice === b.dataset.choice));
  document.getElementById('plan-detail').innerHTML = planDetail(plan, isToday, doneToday);
  document.getElementById('plan-tomorrow').textContent = isToday ? 'Tomorrow’s an early day? Plan it now' : '‹ Back to today';
}

function planDetail(plan, isToday, doneToday) {
  const done = doneToday.length
    ? `<p class="done-today">✓ Today’s workout is done. That’s workout ${doneToday[doneToday.length - 1].number}.</p>` : '';
  if (!plan || plan.choice === 'now') return done ? `<div class="plan-detail">${done}</div>` : '';

  let html = done;
  if (plan.choice === 'later') {
    html += `<div class="row"><span>Workout at</span><input type="time" id="later-time" value="${plan.time || '12:00'}" aria-label="Workout time"></div>
      <p class="tiny gap-s">${isToday ? 'Your workout is set for ' + timeLabel(plan.time) + '.' : 'Planned for tomorrow at ' + timeLabel(plan.time) + '.'} Reminders for this time get set up with iPhone Shortcuts.</p>`;
    if (isToday && !doneToday.length) html += '<button type="button" class="primary" data-workout-now>Start now instead →</button>';
  }
  if (plan.choice === 'walk') {
    const logged = state.log.some(e => e.date === dateKey() && e.kind === 'walk');
    if (!isToday) html += '<p>Walk or hike planned for tomorrow. Active rest counts.</p>';
    else if (logged) html += '<p class="done-today">✓ Walk logged. Nice.</p>';
    else html += '<p>Walk or hike today. Active rest counts. Log it when you’re back.</p><button type="button" class="secondary" data-log-walk>I walked ✓</button>';
  }
  if (plan.choice === 'short' && !doneToday.length) {
    html += isToday
      ? `<p>Short day: the 5-minute version of ${esc(todayType())}. It still counts.</p><button type="button" class="primary" data-workout-now>Start 5-minute workout →</button>`
      : '<p>Short day planned for tomorrow: the 5-minute version.</p>';
  }
  if (plan.choice === 'rest') {
    html += `<p>${isToday ? 'Rest day logged. See you tomorrow.' : 'Rest day planned for tomorrow.'}</p>
      <p class="tiny gap-s">A quick reason (optional):</p>
      <div class="chips">${REST_REASONS.map(r =>
        `<button type="button" class="chip-btn${plan.reason === r ? ' selected' : ''}" data-reason="${r}">${r}</button>`).join('')}</div>`;
  }
  return `<div class="plan-detail">${html}</div>`;
}

function choosePlan(choice) {
  const key = planKey();
  const current = state.dayPlans[key];
  // Tapping the selected choice again clears it.
  if (current && current.choice === choice) setDayPlan(key, null);
  else setDayPlan(key, choice === 'later' ? { choice, time: '12:00' } : { choice });
  if (planTarget === 'today') todayState().length = null; // let the plan decide the length
  saveState();
  render();
  const messages = { walk: 'Walk day. Enjoy it.', rest: 'Rest day logged. See you tomorrow.', short: 'Short day. 5 minutes still counts.', later: 'Pick your time.' };
  const now = state.dayPlans[key];
  if (now) toast(planTarget === 'today' ? messages[choice] : 'Tomorrow’s plan is saved.');
}

function workoutNow() {
  if (!state.dayPlans[dateKey()]) setDayPlan(dateKey(), { choice: 'now' });
  openScreen('today');
}

document.addEventListener('click', event => {
  const t = event.target;
  const choice = t.closest('[data-choice]');
  if (choice) return choosePlan(choice.dataset.choice);
  if (t.closest('[data-workout-now]')) return workoutNow();
  if (t.closest('[data-plan-tomorrow]')) {
    planTarget = planTarget === 'today' ? 'tomorrow' : 'today';
    return render();
  }
  if (t.closest('[data-log-walk]')) { logWalk(); render(); return toast('Walk logged. Nice.'); }
  const reason = t.closest('[data-reason]');
  if (reason) {
    const plan = state.dayPlans[planKey()];
    plan.reason = plan.reason === reason.dataset.reason ? null : reason.dataset.reason;
    saveState();
    return render();
  }
});

document.addEventListener('change', event => {
  if (event.target.id !== 'later-time') return;
  const plan = state.dayPlans[planKey()];
  plan.time = event.target.value || '12:00';
  saveState();
  render();
  toast(`Workout set for ${timeLabel(plan.time)}`);
});
