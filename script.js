(() => {
  'use strict';

  const STORAGE_KEY = 'cycleCalendarData';
  const SURROUNDING_DAYS = 5;
  const LUTEAL_PHASE_DAYS = 14;
  const FERTILE_WINDOW_RADIUS = 2;

  const DEFAULT_COLORS = {
    period: '#F7C6D9',
    ovulation: '#D9C6F7',
    fertile: '#C6E2F7',
    normal: '#FCEFC7',
    safe: '#C6F7D9',
  };

  const el = {
    settingsToggle: document.getElementById('settings-toggle'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsForm: document.getElementById('settings-form'),
    startDate: document.getElementById('start-date'),
    cycleLength: document.getElementById('cycle-length'),
    periodLength: document.getElementById('period-length'),
    colorPeriod: document.getElementById('color-period'),
    colorOvulation: document.getElementById('color-ovulation'),
    colorFertile: document.getElementById('color-fertile'),
    colorNormal: document.getElementById('color-normal'),
    colorSafe: document.getElementById('color-safe'),
    emptyState: document.getElementById('empty-state'),
    calendarSection: document.getElementById('calendar-section'),
    prevCycle: document.getElementById('prev-cycle'),
    nextCycle: document.getElementById('next-cycle'),
    cycleLabel: document.getElementById('cycle-label'),
    calendarGrid: document.getElementById('calendar-grid'),
    legendPeriod: document.getElementById('legend-period'),
    legendOvulation: document.getElementById('legend-ovulation'),
    legendFertile: document.getElementById('legend-fertile'),
    legendNormal: document.getElementById('legend-normal'),
    legendSafe: document.getElementById('legend-safe'),
    dayDetailBackdrop: document.getElementById('day-detail-backdrop'),
    dayDetail: document.getElementById('day-detail'),
    dayDetailClose: document.getElementById('day-detail-close'),
    dayDetailDate: document.getElementById('day-detail-date'),
    dayDetailPhase: document.getElementById('day-detail-phase'),
    dayDetailSetStart: document.getElementById('day-detail-set-start'),
  };

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function diffDays(a, b) {
    return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
  }

  function parseDateInput(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function weekStart(date) {
    const offset = (date.getDay() + 6) % 7; // Monday = 0
    return addDays(date, -offset);
  }

  function loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.startDate || !parsed.cycleLength || !parsed.periodLength) return null;
      return {
        startDate: parsed.startDate,
        cycleLength: Number(parsed.cycleLength),
        periodLength: Number(parsed.periodLength),
        colors: { ...DEFAULT_COLORS, ...(parsed.colors || {}) },
      };
    } catch {
      return null;
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function getCurrentCycleIndex(settings, today) {
    const originalStart = startOfDay(parseDateInput(settings.startDate));
    let cyclesElapsed = Math.floor(diffDays(today, originalStart) / settings.cycleLength);
    if (cyclesElapsed < 0) cyclesElapsed = 0;
    return cyclesElapsed;
  }

  function computeCycleWindow(settings, cycleIndex) {
    const originalStart = startOfDay(parseDateInput(settings.startDate));
    const cycleLength = settings.cycleLength;
    const periodLength = settings.periodLength;

    const cycleStart = addDays(originalStart, cycleIndex * cycleLength);
    const cycleEnd = addDays(cycleStart, cycleLength - 1);

    const periodStart = cycleStart;
    const periodEnd = addDays(cycleStart, periodLength - 1);

    const ovulationDate = addDays(cycleStart, cycleLength - LUTEAL_PHASE_DAYS);
    const fertileStart = addDays(ovulationDate, -FERTILE_WINDOW_RADIUS);
    const fertileEnd = addDays(ovulationDate, FERTILE_WINDOW_RADIUS);

    // Після фертильного вікна яйцеклітина вже загинула — до кінця циклу
    // запліднення неможливе.
    const safeStart = addDays(fertileEnd, 1);
    const safeEnd = cycleEnd;

    return {
      cycleStart, cycleEnd, periodStart, periodEnd,
      ovulationDate, fertileStart, fertileEnd, safeStart, safeEnd,
    };
  }

  function categorize(date, windows, rangeStart, rangeEnd) {
    if (date < rangeStart || date > rangeEnd) return 'inactive';
    for (const w of windows) {
      if (date >= w.periodStart && date <= w.periodEnd) return 'period';
      if (diffDays(date, w.ovulationDate) === 0) return 'ovulation';
      if (date >= w.fertileStart && date <= w.fertileEnd) return 'fertile';
      if (date >= w.safeStart && date <= w.safeEnd) return 'safe';
    }
    return 'normal';
  }

  const MONTH_NAMES = [
    'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
    'лип', 'сер', 'вер', 'жов', 'лис', 'гру',
  ];

  const MONTH_NAMES_GENITIVE = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
  ];

  const WEEKDAY_NAMES = ['понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота', 'неділя'];

  const PHASE_LABELS = {
    period: 'Менструація',
    ovulation: 'День овуляції',
    fertile: 'Фертильне вікно',
    normal: 'Звичайний день',
    safe: 'Безпечний день',
  };

  function renderGrid(settings, cycleIndex) {
    const today = startOfDay(new Date());
    const current = computeCycleWindow(settings, cycleIndex);
    const prev = computeCycleWindow(settings, cycleIndex - 1);
    const next = computeCycleWindow(settings, cycleIndex + 1);
    const windows = [current, prev, next];

    const rangeStart = addDays(current.cycleStart, -SURROUNDING_DAYS);
    const rangeEnd = addDays(current.cycleEnd, SURROUNDING_DAYS);

    const gridStart = weekStart(rangeStart);
    const gridEnd = addDays(weekStart(rangeEnd), 6);

    el.calendarGrid.innerHTML = '';

    let prevMonth = null;
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      const cell = document.createElement('div');
      const category = categorize(d, windows, rangeStart, rangeEnd);
      cell.className = `day-cell ${category}`;
      cell.style.background = category === 'inactive' ? 'transparent' : `var(--color-${category})`;

      const isToday = diffDays(d, today) === 0;
      if (isToday) cell.classList.add('today');

      const month = d.getMonth();
      const showMonth = month !== prevMonth && category !== 'inactive';
      cell.textContent = showMonth ? `${d.getDate()} ${MONTH_NAMES[month]}` : String(d.getDate());
      if (showMonth) prevMonth = month;

      if (category !== 'inactive') {
        cell.dataset.date = formatDateInput(d);
        cell.dataset.category = category;
      }

      el.calendarGrid.appendChild(cell);
    }
  }

  function applyColors(colors) {
    const root = document.documentElement;
    root.style.setProperty('--color-period', colors.period);
    root.style.setProperty('--color-ovulation', colors.ovulation);
    root.style.setProperty('--color-fertile', colors.fertile);
    root.style.setProperty('--color-normal', colors.normal);
    root.style.setProperty('--color-safe', colors.safe);

    el.legendPeriod.style.background = colors.period;
    el.legendOvulation.style.background = colors.ovulation;
    el.legendFertile.style.background = colors.fertile;
    el.legendNormal.style.background = colors.normal;
    el.legendSafe.style.background = colors.safe;
  }

  function fillForm(settings) {
    el.startDate.value = settings.startDate;
    el.cycleLength.value = settings.cycleLength;
    el.periodLength.value = settings.periodLength;
    el.colorPeriod.value = settings.colors.period;
    el.colorOvulation.value = settings.colors.ovulation;
    el.colorFertile.value = settings.colors.fertile;
    el.colorNormal.value = settings.colors.normal;
    el.colorSafe.value = settings.colors.safe;
  }

  function readForm() {
    return {
      startDate: el.startDate.value,
      cycleLength: Number(el.cycleLength.value),
      periodLength: Number(el.periodLength.value),
      colors: {
        period: el.colorPeriod.value,
        ovulation: el.colorOvulation.value,
        fertile: el.colorFertile.value,
        normal: el.colorNormal.value,
        safe: el.colorSafe.value,
      },
    };
  }

  function formatShort(date) {
    return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
  }

  function updateCycleLabel(settings, cycleIndex, baseIndex) {
    const cycleWindow = computeCycleWindow(settings, cycleIndex);
    const range = `${formatShort(cycleWindow.cycleStart)} – ${formatShort(cycleWindow.cycleEnd)}`;
    el.cycleLabel.textContent = cycleIndex === baseIndex ? `Поточний цикл (${range})` : range;
  }

  let viewOffset = 0;
  let selectedDate = null;

  function formatFullDate(dateStr) {
    const date = parseDateInput(dateStr);
    const weekday = WEEKDAY_NAMES[(date.getDay() + 6) % 7];
    return `${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]} ${date.getFullYear()}, ${weekday}`;
  }

  function openDayDetail(dateStr, category) {
    selectedDate = dateStr;
    el.dayDetailDate.textContent = formatFullDate(dateStr);
    el.dayDetailPhase.textContent = PHASE_LABELS[category] || '';
    el.dayDetailBackdrop.hidden = false;
    el.dayDetail.hidden = false;
  }

  function closeDayDetail() {
    el.dayDetailBackdrop.hidden = true;
    el.dayDetail.hidden = true;
    selectedDate = null;
  }

  function render() {
    const settings = loadSettings();

    if (!settings) {
      el.calendarSection.hidden = true;
      el.emptyState.hidden = false;
      el.settingsPanel.hidden = false;
      return;
    }

    const today = startOfDay(new Date());
    const baseIndex = getCurrentCycleIndex(settings, today);
    const cycleIndex = baseIndex + viewOffset;

    applyColors(settings.colors);
    fillForm(settings);
    renderGrid(settings, cycleIndex);
    updateCycleLabel(settings, cycleIndex, baseIndex);

    el.emptyState.hidden = true;
    el.calendarSection.hidden = false;
  }

  el.settingsToggle.addEventListener('click', () => {
    el.settingsPanel.hidden = !el.settingsPanel.hidden;
  });

  el.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = readForm();
    saveSettings(settings);
    el.settingsPanel.hidden = true;
    viewOffset = 0;
    render();
  });

  el.prevCycle.addEventListener('click', () => {
    viewOffset -= 1;
    render();
  });

  el.nextCycle.addEventListener('click', () => {
    viewOffset += 1;
    render();
  });

  el.cycleLabel.addEventListener('click', () => {
    viewOffset = 0;
    render();
  });

  el.calendarGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.day-cell');
    if (!cell || !cell.dataset.date) return;
    openDayDetail(cell.dataset.date, cell.dataset.category);
  });

  el.dayDetailClose.addEventListener('click', closeDayDetail);
  el.dayDetailBackdrop.addEventListener('click', closeDayDetail);

  el.dayDetailSetStart.addEventListener('click', () => {
    if (!selectedDate) return;
    const settings = loadSettings();
    if (!settings) return;
    settings.startDate = selectedDate;
    saveSettings(settings);
    viewOffset = 0;
    closeDayDetail();
    render();
  });

  const SWIPE_THRESHOLD = 40;
  let touchStartX = 0;
  let touchStartY = 0;

  el.calendarGrid.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });

  el.calendarGrid.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    viewOffset += deltaX < 0 ? 1 : -1;
    render();
  }, { passive: true });

  render();
})();
