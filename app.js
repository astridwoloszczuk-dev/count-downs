// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://mezayharkjyvnnhvdlww.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lemF5aGFya2p5dm5uaHZkbHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTE2ODQsImV4cCI6MjA5MTY2NzY4NH0.GlyIlgobMa0lVjEhH59-Zu1mt3f_usAipFNsg0bJSqE';

const MEMBERS  = ['Astrid', 'Niko', 'Max', 'Alex', 'Vicky'];
const COLORS   = { Astrid: '#d97706', Niko: '#dc2626', Max: '#16a34a', Alex: '#2563eb', Vicky: '#db2777' };
const INITIALS = { Astrid: 'As', Niko: 'N', Max: 'M', Alex: 'Al', Vicky: 'V' };

const EMOJIS = ['📅','✈️','🏌️','⛳','📚','🎓','🏃','🎂','🎉','🏖️','🎮','🏆','⚽','🎵','🎭','🧳','🎄','🌍','🩺','🏠'];

// ── Supabase ──────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── State ─────────────────────────────────────────────────────────────────────
let currentTab      = localStorage.getItem('countdown_tab') || MEMBERS[0];
let events          = [];
let selectedEmoji   = '📅';
let selectedVisible = new Set(MEMBERS);
let editingId       = null;
let expandedId      = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tabBar     = document.getElementById('tab-bar');
const eventList  = document.getElementById('event-list');
const emptyState = document.getElementById('empty-state');
const modal      = document.getElementById('add-modal');
const titleInput = document.getElementById('event-title');
const dateInput  = document.getElementById('event-date');
const emojiGrid  = document.getElementById('emoji-grid');
const visPills   = document.getElementById('vis-pills');
const saveBtn    = document.getElementById('save-btn');
const fabBtn     = document.getElementById('fab');
const cancelBtn  = document.getElementById('cancel-btn');

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyClass(days) {
  if (days === 0) return 'today';
  if (days <= 7)  return 'soon';
  if (days <= 30) return 'month';
  return 'future';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Build tab bar ─────────────────────────────────────────────────────────────

function buildTabBar() {
  MEMBERS.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.member = name;
    btn.innerHTML = `<span class="tab-initial" style="background:${COLORS[name]}">${INITIALS[name]}</span><span>${name}</span>`;
    btn.addEventListener('click', () => setTab(name));
    tabBar.appendChild(btn);
  });
}

function setTab(name) {
  currentTab = name;
  localStorage.setItem('countdown_tab', name);
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.member === name));
  render();
}

// ── Build modal ───────────────────────────────────────────────────────────────

function buildEmojiGrid() {
  EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = em;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedEmoji = em;
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('selected', b.textContent === em));
    });
    emojiGrid.appendChild(btn);
  });
}

function buildVisPills() {
  const allBtn = document.createElement('button');
  allBtn.className = 'vis-all-btn';
  allBtn.textContent = 'All';
  allBtn.type = 'button';
  allBtn.addEventListener('click', () => {
    MEMBERS.forEach(m => selectedVisible.add(m));
    updateVisPills();
  });
  visPills.appendChild(allBtn);

  MEMBERS.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'vis-pill';
    btn.dataset.member = name;
    btn.type = 'button';
    btn.style.setProperty('--member-color', COLORS[name]);
    btn.innerHTML = `<span class="vis-initial" style="background:${COLORS[name]}">${INITIALS[name]}</span>${name}`;
    btn.addEventListener('click', () => {
      selectedVisible.has(name) ? selectedVisible.delete(name) : selectedVisible.add(name);
      updateVisPills();
    });
    visPills.appendChild(btn);
  });

  updateVisPills();
}

function updateVisPills() {
  document.querySelectorAll('.vis-pill').forEach(btn => {
    btn.classList.toggle('selected', selectedVisible.has(btn.dataset.member));
  });
  document.querySelector('.vis-all-btn').classList.toggle('selected', MEMBERS.every(m => selectedVisible.has(m)));
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const mine = events.filter(e => e.visible_to && e.visible_to.includes(currentTab));
  eventList.innerHTML = '';

  if (mine.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  mine.forEach(ev => {
    const days = daysUntil(ev.event_date);
    const urg  = urgencyClass(days);

    let dayNum, dayLabel;
    if (days === 0)      { dayNum = '🎉'; dayLabel = 'Today!'; }
    else if (days === 1) { dayNum = '1';  dayLabel = 'day'; }
    else                 { dayNum = String(days); dayLabel = 'days'; }

    const visDots = ev.visible_to.map(m =>
      `<span class="vis-dot" style="background:${COLORS[m]}" title="${m}">${INITIALS[m]}</span>`
    ).join('');

    const card = document.createElement('div');
    card.className = `event-card${expandedId === ev.id ? ' expanded' : ''}`;
    card.innerHTML = `
      <div class="cdown-box ${urg}">
        <span class="cdown-num">${dayNum}</span>
        <span class="cdown-label">${dayLabel}</span>
      </div>
      <div class="ev-info">
        <div class="ev-title-row">
          <span class="ev-emoji">${ev.emoji || '📅'}</span>
          <span class="ev-name">${escHtml(ev.title)}</span>
        </div>
        <div class="ev-meta">
          <span class="ev-date">${formatDate(ev.event_date)}</span>
          <span class="ev-vis">${visDots}</span>
        </div>
      </div>
      <div class="card-btns">
        <button class="edit-btn" type="button" aria-label="Edit event">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="del-btn" type="button" aria-label="Delete event">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    `;
    card.querySelector('.ev-info').addEventListener('click', () => {
      expandedId = expandedId === ev.id ? null : ev.id;
      render();
    });
    card.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); openModal(ev); });
    card.querySelector('.del-btn').addEventListener('click',  e => { e.stopPropagation(); deleteEvent(ev.id); });
    eventList.appendChild(card);
  });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function loadEvents() {
  const { data } = await db.from('countdowns')
    .select('*')
    .gte('event_date', todayStr())
    .order('event_date');
  events = data || [];
  render();
}

function subscribeRealtime() {
  db.channel('countdowns-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'countdowns' }, () => loadEvents())
    .subscribe();
}

async function deleteEvent(id) {
  await db.from('countdowns').delete().eq('id', id);
  events = events.filter(e => e.id !== id);
  render();
}

async function saveEvent() {
  const title = titleInput.value.trim();
  const date  = dateInput.value;
  if (!title || !date || selectedVisible.size === 0) return;

  const payload = { title, event_date: date, emoji: selectedEmoji, visible_to: Array.from(selectedVisible) };

  if (editingId) {
    const { data } = await db.from('countdowns').update(payload).eq('id', editingId).select().single();
    if (data) {
      const idx = events.findIndex(e => e.id === editingId);
      if (data.event_date >= todayStr()) {
        if (idx >= 0) events[idx] = data; else events.push(data);
      } else {
        if (idx >= 0) events.splice(idx, 1);
      }
      events.sort((a, b) => a.event_date.localeCompare(b.event_date));
    }
  } else {
    const { data } = await db.from('countdowns').insert(payload).select().single();
    if (data && data.event_date >= todayStr()) {
      events.push(data);
      events.sort((a, b) => a.event_date.localeCompare(b.event_date));
    }
  }
  closeModal();
  render();
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(ev = null) {
  editingId = ev ? ev.id : null;
  document.querySelector('#add-modal h2').textContent = ev ? 'Edit Event' : 'Add Event';
  selectedEmoji   = ev ? (ev.emoji || '📅') : '📅';
  selectedVisible = ev ? new Set(ev.visible_to) : new Set(MEMBERS);
  titleInput.value = ev ? ev.title : '';
  dateInput.value  = ev ? ev.event_date : '';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('selected', b.textContent === selectedEmoji));
  updateVisPills();
  modal.classList.remove('hidden');
  setTimeout(() => titleInput.focus(), 80);
}

function closeModal() {
  editingId = null;
  modal.classList.add('hidden');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

buildTabBar();
buildEmojiGrid();
buildVisPills();

fabBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
saveBtn.addEventListener('click', saveEvent);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); dateInput.focus(); } });

setTab(currentTab);
loadEvents();
subscribeRealtime();
