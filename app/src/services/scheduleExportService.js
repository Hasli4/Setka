import {
  SCHEDULE_DAYS,
  SCHEDULE_HOURS,
  SCHEDULE_LESSON_KINDS,
  SCHEDULE_PRIORITIES,
  SCHEDULE_SLOT_MINUTES,
  parseSlotKey,
  slotKey,
  timeLabel,
  timezoneLabel,
} from '../domain/schedule.js';

const priorityLabels = Object.fromEntries(SCHEDULE_PRIORITIES.map((priority) => [priority.value, priority.label]));

export function buildScheduleExportHtml(plans, students) {
  const studentById = new Map(students.map((student) => [student.id, student]));
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
    .slot { position: relative; overflow: visible; display: grid; grid-template-rows: 1fr 1fr; padding: 0; }
    .export-half { position: relative; min-height: calc(var(--cell) / 2); display: grid; place-items: center; padding: 2px 6px; }
    .export-half + .export-half { border-top: 1px dashed rgba(107, 114, 128, .22); }
    .export-half.green { background: rgba(34, 197, 94, .18); }
    .export-half.yellow { background: rgba(250, 204, 21, .22); }
    .export-half.red { background: rgba(239, 68, 68, .18); }
    .export-half.busy { background: rgba(59, 130, 246, .18); background-image: repeating-linear-gradient(45deg, rgba(59,130,246,.3) 0, rgba(59,130,246,.3) 9px, rgba(255,255,255,.25) 9px, rgba(255,255,255,.25) 18px); }
    .export-half.covered { color: transparent; }
    .export-assignment { position: absolute; z-index: 2; inset: 3px 5px auto 5px; min-height: 24px; height: calc((var(--duration-units, 2) * 100%) - 6px); display: grid; place-items: center; padding: 6px 8px; border: 1px solid rgba(12,124,116,.28); border-radius: 8px; background: rgba(223,241,238,.88); color: var(--text); font-weight: 900; line-height: 1.15; overflow-wrap: anywhere; text-align: center; }
    .export-assignment.one-off { border-color: rgba(188,108,37,.34); background: rgba(255,247,237,.92); }
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
    ${exportPlans.map((plan, index) => renderExportPlan(plan, students, studentById, index === 0)).join('')}
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
  const context = buildExportContext(plan, students, studentById);
  const greenLines = collectPriorityLines(plan, context, 'green');
  const yellowLines = collectPriorityLines(plan, context, 'yellow');
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

function renderExportPlan(plan, students, studentById, active) {
  const context = buildExportContext(plan, students, studentById);

  return `<section class="panel schedule-card ${active ? 'active' : ''}" data-plan-panel="${escapeHtml(plan.id)}">
    <h2>${escapeHtml(plan.title)}</h2>
    <p class="hint">Время показано для: ${escapeHtml(timezoneLabel(plan.timezone))}</p>
    <div class="grid-wrap">
      <div class="grid">
        <div class="cell header-cell"></div>
        ${SCHEDULE_DAYS.map((day) => `<div class="cell header-cell">${escapeHtml(day.label)}</div>`).join('')}
        <div class="cell header-cell"></div>
        ${SCHEDULE_HOURS.map((hour) => renderExportHourRow(plan, context, hour)).join('')}
      </div>
    </div>
  </section>`;
}

function renderExportHourRow(plan, context, hour) {
  return `<div class="cell time-cell">${escapeHtml(timeLabel(hour, plan.timezone))}</div>
    ${SCHEDULE_DAYS.map((day) => renderExportSlot(plan, context, `${day.key}_${hour}`)).join('')}
    <div class="cell time-cell">${escapeHtml(timeLabel(hour, plan.timezone))}</div>`;
}

function renderExportSlot(plan, context, key) {
  const parsed = parseSlotKey(key);

  return `<div class="cell slot">
    ${SCHEDULE_SLOT_MINUTES.map((minute) => renderExportHalf(plan, context, parsed.dayKey, parsed.hour, minute)).join('')}
  </div>`;
}

function renderExportHalf(plan, context, dayKey, hour, minute) {
  const key = slotKeyFromParts(dayKey, hour, minute);

  if (!key) {
    return '<div class="export-half unavailable"></div>';
  }

  const assignment = context.assignmentsBySlot.get(key);
  const priority = plan.painted[key];

  if (assignment) {
    const durationUnits = Math.max(1, Math.ceil(Number(assignment.student?.defaultLessonDurationMinutes || 60) / 30));
    const className = assignment.lesson?.kind === SCHEDULE_LESSON_KINDS.oneOff ? 'export-assignment one-off' : 'export-assignment';
    return `<div class="export-half occupied"><div class="${className}" style="--duration-units: ${durationUnits};">${plan.hideNames ? 'Занято' : escapeHtml(scheduleStudentName(assignment.student))}</div></div>`;
  }

  if (context.coveredSlotKeys.has(key)) {
    return '<div class="export-half covered"></div>';
  }

  if (priority) {
    return `<div class="export-half ${escapeHtml(priority)}"><small>${escapeHtml(priorityLabels[priority] || 'Свободно')}</small></div>`;
  }

  return `<div class="export-half">${minute === 0 ? '<small>Пусто</small>' : ''}</div>`;
}

function buildExportContext(plan, students, studentById) {
  const assignments = [];
  const planLessons = plan.lessonsInitialized ? plan.lessons ?? [] : buildRegularLessons(students);

  for (const lesson of planLessons) {
    const slot = scheduleLessonSlotKey(lesson);
    const student = studentById.get(lesson.studentId);

    if (!slot || !student) {
      continue;
    }

    assignments.push({
      source: 'lesson',
      slotKey: slot,
      student,
      studentId: student.id,
      lesson,
      lessonId: lesson.id,
    });
  }

  for (const [slotKeyValue, studentId] of Object.entries(plan.assignments ?? {})) {
    const student = studentById.get(studentId);

    if (!parseSlotKey(slotKeyValue) || !student) {
      continue;
    }

    assignments.push({
      source: 'manual',
      slotKey: slotKeyValue,
      student,
      studentId,
      lesson: null,
      lessonId: null,
    });
  }

  const assignmentsBySlot = new Map(assignments.map((assignment) => [assignment.slotKey, assignment]));
  const coveredSlotKeys = new Set();

  for (const assignment of assignments) {
    const parsed = parseSlotKey(assignment.slotKey);
    const durationMinutes = Math.max(30, Math.ceil(Number(assignment.student.defaultLessonDurationMinutes || 60) / 30) * 30);

    if (!parsed) {
      continue;
    }

    for (let offset = 30; offset < durationMinutes; offset += 30) {
      const coveredKey = slotKeyFromTotalMinutes(parsed.dayKey, parsed.totalMinutes + offset);

      if (coveredKey && !assignmentsBySlot.has(coveredKey)) {
        coveredSlotKeys.add(coveredKey);
      }
    }
  }

  return { assignments, assignmentsBySlot, coveredSlotKeys };
}

function collectPriorityLines(plan, context, priority) {
  return Object.entries(plan.painted)
    .filter(([key, value]) => value === priority && !context.assignmentsBySlot.has(key) && !context.coveredSlotKeys.has(key))
    .map(([key]) => {
      const parsed = parseSlotKey(key);
      const day = parsed ? SCHEDULE_DAYS.find((item) => item.key === parsed.dayKey) : null;
      return parsed && day ? `${day.label} ${slotTimeLabel(parsed, plan.timezone)}` : null;
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

function buildRegularLessons(students) {
  const lessons = [];

  for (const student of students) {
    for (const lesson of student.regularLessons ?? []) {
      if (!lesson.weekday || !lesson.startTime) {
        continue;
      }

      lessons.push({
        id: lesson.id || `${student.id}-${lesson.weekday}-${lesson.startTime}`,
        studentId: student.id,
        weekday: lesson.weekday,
        startTime: lesson.startTime,
        kind: SCHEDULE_LESSON_KINDS.regular,
        timezone: 'moscow',
      });
    }
  }

  return lessons;
}

function scheduleLessonSlotKey(lesson) {
  if (!lesson?.weekday || !lesson?.startTime) {
    return null;
  }

  const [hourValue, minuteValue = '0'] = String(lesson.startTime).split(':');
  return slotKeyFromParts(lesson.weekday, Number(hourValue), Number(minuteValue));
}

function slotKeyFromTotalMinutes(dayKey, totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return slotKeyFromParts(dayKey, hour, minute);
}

function slotKeyFromParts(dayKey, hour, minute = 0) {
  try {
    return slotKey(dayKey, hour, minute);
  } catch {
    return null;
  }
}

function slotTimeLabel(parsed, timezone) {
  const hourLabel = timeLabel(parsed.hour, timezone).slice(0, 2);
  return `${hourLabel}:${String(parsed.minute).padStart(2, '0')}`;
}
