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
    emptyState: document.getElementById('empty-state'),
    calendarSection: document.getElementById('calendar-section'),
    calendarGrid: document.getElementById('calendar-grid'),
    legendPeriod: document.getElementById('legend-period'),
    legendOvulation: document.getElementById('legend-ovulation'),
    legendFertile: document.getElementById('legend-fertile'),
    legendNormal: document.getElementById('legend-normal'),
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

  function computeCycleInfo(settings, today) {
    const originalStart = startOfDay(parseDateInput(settings.startDate));
    const cycleLength = settings.cycleLength;
    const periodLength = settings.periodLength;

    let cyclesElapsed = Math.floor(diffDays(today, originalStart) / cycleLength);
    if (cyclesElapsed < 0) cyclesElapsed = 0;
    const cycleStart = addDays(originalStart, cyclesElapsed * cycleLength);
    const cycleEnd = addDays(cycleStart, cycleLength - 1);

    const periodStart = cycleStart;
    const periodEnd = addDays(cycleStart, periodLength - 1);

    const ovulationDate = addDays(cycleStart, cycleLength - LUTEAL_PHASE_DAYS);
    const fertileStart = addDays(ovulationDate, -FERTILE_WINDOW_RADIUS);
    const fertileEnd = addDays(ovulationDate, FERTILE_WINDOW_RADIUS);

    const rangeStart = addDays(cycleStart, -SURROUNDING_DAYS);
    const rangeEnd = addDays(cycleEnd, SURROUNDING_DAYS);

    return {
      cycleStart, cycleEnd, periodStart, periodEnd,
      ovulationDate, fertileStart, fertileEnd,
      rangeStart, rangeEnd,
    };
  }

  function categorize(date, info) {
    if (date < info.rangeStart || date > info.rangeEnd) return 'inactive';
    if (date >= info.periodStart && date <= info.periodEnd) return 'period';
    if (diffDays(date, info.ovulationDate) === 0) return 'ovulation';
    if (date >= info.fertileStart && date <= info.fertileEnd) return 'fertile';
    return 'normal';
  }

  const MONTH_NAMES = [
    'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
    'лип', 'сер', 'вер', 'жов', 'лис', 'гру',
  ];

  function renderGrid(settings) {
    const today = startOfDay(new Date());
    const info = computeCycleInfo(settings, today);

    const gridStart = weekStart(info.rangeStart);
    const gridEnd = addDays(weekStart(info.rangeEnd), 6);

    el.calendarGrid.innerHTML = '';

    let prevMonth = null;
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      const cell = document.createElement('div');
      const category = categorize(d, info);
      cell.className = `day-cell ${category}`;
      cell.style.background = category === 'inactive' ? 'transparent' : `var(--color-${category})`;

      const isToday = diffDays(d, today) === 0;
      if (isToday) cell.classList.add('today');

      const month = d.getMonth();
      const showMonth = month !== prevMonth && category !== 'inactive';
      cell.textContent = showMonth ? `${d.getDate()} ${MONTH_NAMES[month]}` : String(d.getDate());
      if (showMonth) prevMonth = month;

      el.calendarGrid.appendChild(cell);
    }
  }

  function applyColors(colors) {
    const root = document.documentElement;
    root.style.setProperty('--color-period', colors.period);
    root.style.setProperty('--color-ovulation', colors.ovulation);
    root.style.setProperty('--color-fertile', colors.fertile);
    root.style.setProperty('--color-normal', colors.normal);

    el.legendPeriod.style.background = colors.period;
    el.legendOvulation.style.background = colors.ovulation;
    el.legendFertile.style.background = colors.fertile;
    el.legendNormal.style.background = colors.normal;
  }

  function fillForm(settings) {
    el.startDate.value = settings.startDate;
    el.cycleLength.value = settings.cycleLength;
    el.periodLength.value = settings.periodLength;
    el.colorPeriod.value = settings.colors.period;
    el.colorOvulation.value = settings.colors.ovulation;
    el.colorFertile.value = settings.colors.fertile;
    el.colorNormal.value = settings.colors.normal;
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
      },
    };
  }

  function render() {
    const settings = loadSettings();

    if (!settings) {
      el.calendarSection.hidden = true;
      el.emptyState.hidden = false;
      el.settingsPanel.hidden = false;
      return;
    }

    applyColors(settings.colors);
    fillForm(settings);
    renderGrid(settings);

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
    render();
  });

  render();
})();
