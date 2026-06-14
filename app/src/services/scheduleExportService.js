import {
  SCHEDULE_DAYS,
  SCHEDULE_HOURS,
  SCHEDULE_PRIORITIES,
  parseSlotKey,
  timeLabel,
  timezoneLabel,
} from '../domain/schedule.js';

const priorityLabels = Object.fromEntries(SCHEDULE_PRIORITIES.map((priority) => [priority.value, priority.label]));

export function buildScheduleExportHtml(plans, students) {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const regularAssignments = buildRegularAssignments(students);
  const exportPlans = plans.filter((plan) => plan.includeInExport !== false);

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Расписание занятий</title>
  <style>
    :root {
      --border: #d9e1ee;
      --text: #1f2937;
      --muted: #6b7280;
      --accent: #0c7c74;
      --bg: #f4f1ea;
      --panel: #fffdfa;
      --cell: 58px;
      --time-col: 78px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: linear-gradient(180deg, #eef7f5 0%, var(--bg) 100%);
      color: var(--text);
    }
    .app { max-width: 1800px; margin: 0 auto; padding: 20px; display: grid; gap: 16px; }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 30px rgba(15,23,42,.08); }
    .hero { padding: 16px; }
    h1, h2 { margin: 0; }
    .subtitle, .hint { color: var(--muted); line-height: 1.5; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px; }
    .tab { border: 1px solid var(--border); border-radius: 999px; padding: 8px 12px; background: #f8fafc; font-weight: 700; }
    .tab.active { background: var(--accent); color: white; border-color: var(--accent); }
    .legend { display: flex; flex-wrap: wrap; gap: 10px; }
    .legend-item { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: white; font-size: 13px; }
    .swatch { width: 18px; height: 18px; border-radius: 5px; border: 1px solid rgba(0,0,0,.08); }
    .swatch.green { background: rgba(34, 197, 94, .28); }
    .swatch.yellow { background: rgba(250, 204, 21, .34); }
    .swatch.red { background: rgba(239, 68, 68, .28); }
    .swatch.busy { background: rgba(59, 130, 246, .24); background-image: repeating-linear-gradient(45deg, rgba(59,130,246,.32) 0, rgba(59,130,246,.32) 7px, rgba(255,255,255,.22) 7px, rgba(255,255,255,.22) 14px); }
    .schedule-card { padding: 14px; display: none; }
    .schedule-card.active { display: block; }
    .grid-wrap { overflow: auto; border-radius: 8px; }
    .grid { min-width: 1040px; display: grid; grid-template-columns: var(--time-col) repeat(7, minmax(120px, 1fr)) var(--time-col); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .cell { min-height: var(--cell); background: white; padding: 8px; display: grid; place-items: center; text-align: center; }
    .header-cell, .time-cell { background: #f8fafc; font-weight: 800; }
    .slot { position: relative; overflow: hidden; }
    .slot.green { background: rgba(34, 197, 94, .18); }
    .slot.yellow { background: rgba(250, 204, 21, .22); }
    .slot.red { background: rgba(239, 68, 68, .18); }
    .slot.busy { background: rgba(59, 130, 246, .18); background-image: repeating-linear-gradient(45deg, rgba(59,130,246,.3) 0, rgba(59,130,246,.3) 9px, rgba(255,255,255,.25) 9px, rgba(255,255,255,.25) 18px); }
    .slot.occupied { background: rgba(168, 85, 247, .18); background-image: repeating-linear-gradient(45deg, rgba(168,85,247,.34) 0, rgba(168,85,247,.34) 9px, rgba(255,255,255,.24) 9px, rgba(255,255,255,.24) 18px); font-weight: 800; }
    .slot small { color: var(--muted); font-weight: 600; }
  </style>
</head>
<body>
  <main class="app">
    <section class="panel hero">
      <h1>Расписание занятий</h1>
      <p class="subtitle">Публичная версия расписания. Обновлено: ${escapeHtml(new Date().toLocaleString('ru-RU'))}</p>
      <div class="legend">${SCHEDULE_PRIORITIES.map((priority) => `<span class="legend-item"><span class="swatch ${priority.value}"></span>${escapeHtml(priority.label)} - ${escapeHtml(priority.description)}</span>`).join('')}</div>
    </section>
    <section class="panel tabs">
      ${exportPlans.map((plan, index) => `<button class="tab ${index === 0 ? 'active' : ''}" data-plan-tab="${escapeHtml(plan.id)}">${escapeHtml(plan.title)}</button>`).join('')}
    </section>
    ${exportPlans.map((plan, index) => renderExportPlan(plan, studentById, regularAssignments, index === 0)).join('')}
  </main>
  <script>
    document.querySelectorAll('[data-plan-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-plan-tab]').forEach((item) => item.classList.remove('active'));
        document.querySelectorAll('[data-plan-panel]').forEach((item) => item.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector('[data-plan-panel="' + tab.dataset.planTab + '"]').classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

export function buildParentText(plan, students) {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const greenLines = collectPriorityLines(plan, studentById, 'green');
  const yellowLines = collectPriorityLines(plan, studentById, 'yellow');
  const lines = [`Свободное время на неделю, часовой пояс: ${timezoneLabel(plan.timezone)}.`];

  if (greenLines.length) {
    lines.push('', 'Удобное время:', ...greenLines);
  }

  if (yellowLines.length) {
    lines.push('', 'Приемлемое время:', ...yellowLines);
  }

  if (!greenLines.length && !yellowLines.length) {
    lines.push('', 'Свободных зеленых или желтых окон пока нет.');
  }

  return lines.join('\n');
}

function renderExportPlan(plan, studentById, regularAssignments, active) {
  return `<section class="panel schedule-card ${active ? 'active' : ''}" data-plan-panel="${escapeHtml(plan.id)}">
    <h2>${escapeHtml(plan.title)}</h2>
    <p class="hint">Время показано для: ${escapeHtml(timezoneLabel(plan.timezone))}</p>
    <div class="grid-wrap">
      <div class="grid">
        <div class="cell header-cell"></div>
        ${SCHEDULE_DAYS.map((day) => `<div class="cell header-cell">${escapeHtml(day.label)}</div>`).join('')}
        <div class="cell header-cell"></div>
        ${SCHEDULE_HOURS.map((hour) => renderExportHourRow(plan, studentById, regularAssignments, hour)).join('')}
      </div>
    </div>
  </section>`;
}

function renderExportHourRow(plan, studentById, regularAssignments, hour) {
  return `<div class="cell time-cell">${escapeHtml(timeLabel(hour, plan.timezone))}</div>
    ${SCHEDULE_DAYS.map((day) => renderExportSlot(plan, studentById, regularAssignments, `${day.key}_${hour}`)).join('')}
    <div class="cell time-cell">${escapeHtml(timeLabel(hour, plan.timezone))}</div>`;
}

function renderExportSlot(plan, studentById, regularAssignments, key) {
  const studentId = regularAssignments.get(key) ?? plan.assignments[key];
  const priority = plan.painted[key];
  const student = studentId ? studentById.get(studentId) : null;

  if (studentId) {
    return `<div class="cell slot occupied">${plan.hideNames ? 'Занято' : escapeHtml(scheduleStudentName(student))}</div>`;
  }

  if (priority) {
    return `<div class="cell slot ${escapeHtml(priority)}"><small>${escapeHtml(priorityLabels[priority] || 'Свободно')}</small></div>`;
  }

  return '<div class="cell slot"><small>Пусто</small></div>';
}

function collectPriorityLines(plan, studentById, priority) {
  return Object.entries(plan.painted)
    .filter(([key, value]) => value === priority && !plan.assignments[key])
    .map(([key]) => {
      const parsed = parseSlotKey(key);
      const day = SCHEDULE_DAYS.find((item) => item.key === parsed.dayKey);
      return parsed && day ? `${day.label} ${timeLabel(parsed.hour, plan.timezone)}` : null;
    })
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function scheduleStudentName(student) {
  return student?.nickname?.trim() || student?.fullName || 'Занято';
}

function buildRegularAssignments(students) {
  const assignments = new Map();

  for (const student of students) {
    for (const lesson of student.regularLessons ?? []) {
      if (!lesson.weekday || !lesson.startTime) {
        continue;
      }

      const key = `${lesson.weekday}_${Number(String(lesson.startTime).slice(0, 2))}`;

      if (!assignments.has(key)) {
        assignments.set(key, student.id);
      }
    }
  }

  return assignments;
}
