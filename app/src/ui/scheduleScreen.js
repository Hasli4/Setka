import {
  SCHEDULE_DAYS,
  SCHEDULE_HOURS,
  SCHEDULE_PRIORITIES,
  SCHEDULE_TIMEZONES,
  parseSlotKey,
  timeLabel,
} from '../domain/schedule.js';
import * as scheduleService from '../services/scheduleService.js';
import * as studentService from '../services/studentService.js';
import { buildParentText, buildScheduleExportHtml } from '../services/scheduleExportService.js';
import { clear, createElement } from './dom.js';

let dragPayload = null;

export function mountScheduleScreen(root, students, options = {}) {
  const screen = {
    root,
    students,
    onOpenStudent: options.onOpenStudent,
    onStudentsChanged: options.onStudentsChanged,
    plans: [],
    ui: {
      activePlanId: null,
      comparePlanId: null,
      compareMode: false,
    },
    selectedStudentId: null,
  };

  root.append(renderLoading());
  load(screen);
}

async function load(screen) {
  const workspace = await scheduleService.getScheduleWorkspace();
  screen.plans = workspace.plans;
  screen.ui = workspace.ui;
  render(screen);
}

function render(screen) {
  clear(screen.root);

  const activePlan = getActivePlan(screen);
  const comparePlan = getComparePlan(screen);

  screen.root.append(
    renderHeader(screen, activePlan),
    renderTabs(screen),
    renderToolbar(screen, activePlan),
    createElement('div', {
      className: screen.ui.compareMode ? 'schedule-native-layout compare' : 'schedule-native-layout',
      children: [
        createElement('div', {
          className: 'schedule-cards',
          children: screen.ui.compareMode
            ? [
                renderScheduleCard(screen, activePlan, { readonly: false, label: 'Активное расписание' }),
                renderScheduleCard(screen, comparePlan, { readonly: true, label: 'Сравнение' }),
              ]
            : [renderScheduleCard(screen, activePlan, { readonly: false, label: 'Активное расписание' })],
        }),
      ],
    }),
    renderStudentPalette(screen),
  );
}

function renderLoading() {
  return createElement('section', {
    className: 'workspace',
    children: [createElement('p', { className: 'muted', text: 'Загружаю расписание...' })],
  });
}

function renderHeader(screen, activePlan) {
  const newButton = createElement('button', {
    className: 'primary-button',
    text: 'Новое расписание',
    attrs: { type: 'button' },
  });
  newButton.addEventListener('click', async () => {
    const plan = await scheduleService.createPlan(`Расписание ${screen.plans.length + 1}`);
    screen.plans.push(plan);
    screen.ui.activePlanId = plan.id;
    screen.ui.comparePlanId = plan.id;
    await scheduleService.saveScheduleUi(screen.ui);
    render(screen);
  });

  const duplicateButton = createElement('button', {
    className: 'secondary-button',
    text: 'Дублировать',
    attrs: { type: 'button' },
  });
  duplicateButton.addEventListener('click', async () => {
    const plan = await scheduleService.duplicatePlan(activePlan);
    screen.plans.push(plan);
    screen.ui.activePlanId = plan.id;
    screen.ui.comparePlanId = plan.id;
    await scheduleService.saveScheduleUi(screen.ui);
    render(screen);
  });

  return createElement('header', {
    className: 'page-header',
    children: [
      createElement('div', {
        children: [
          createElement('p', { className: 'eyebrow', text: 'Общая база расписания' }),
          createElement('h1', { text: 'Расписание' }),
        ],
      }),
      createElement('div', {
        className: 'header-tools schedule-header-tools',
        children: [newButton, duplicateButton],
      }),
    ],
  });
}

function renderTabs(screen) {
  return createElement('div', {
    className: 'schedule-tabs',
    children: screen.plans.map((plan) => {
      const tab = createElement('button', {
        className: `schedule-tab ${plan.id === screen.ui.activePlanId ? 'active' : ''}`,
        attrs: { type: 'button' },
        children: [
          createElement('span', { text: plan.title }),
          screen.plans.length > 1
            ? createElement('span', { className: 'tab-close', text: 'x', attrs: { title: 'Удалить' } })
            : createElement('span'),
        ],
      });

      tab.addEventListener('click', async (event) => {
        if (event.target.classList.contains('tab-close')) {
          event.stopPropagation();
          await deletePlan(screen, plan);
          return;
        }

        screen.ui.activePlanId = plan.id;
        await scheduleService.saveScheduleUi(screen.ui);
        render(screen);
      });

      return tab;
    }),
  });
}

function renderToolbar(screen, activePlan) {
  const title = createElement('input', {
    className: 'schedule-title-input',
    attrs: { type: 'text', value: activePlan.title, 'aria-label': 'Название расписания' },
  });
  title.addEventListener('change', async () => {
    await updatePlan(screen, activePlan.id, { title: title.value });
  });

  const timezone = createSelect(
    'Часовой пояс',
    SCHEDULE_TIMEZONES.map((item) => ({ value: item.value, label: item.label })),
    activePlan.timezone,
  );
  timezone.input.addEventListener('change', async () => {
    await updatePlan(screen, activePlan.id, { timezone: timezone.input.value });
  });

  const priority = createSelect(
    'Цвет свободного окна',
    SCHEDULE_PRIORITIES.map((item) => ({ value: item.value, label: item.label })),
    activePlan.priorityColor,
  );
  priority.input.addEventListener('change', async () => {
    await updatePlan(screen, activePlan.id, { priorityColor: priority.input.value });
  });

  const paintMode = createCheckbox('Раскраска', activePlan.paintMode);
  paintMode.input.addEventListener('change', async () => {
    await updatePlan(screen, activePlan.id, { paintMode: paintMode.input.checked });
  });

  const hideNames = createCheckbox('Скрыть имена', activePlan.hideNames);
  hideNames.input.addEventListener('change', async () => {
    await updatePlan(screen, activePlan.id, { hideNames: hideNames.input.checked });
  });

  const includeExport = createCheckbox('В экспорт', activePlan.includeInExport);
  includeExport.input.addEventListener('change', async () => {
    await updatePlan(screen, activePlan.id, { includeInExport: includeExport.input.checked });
  });

  const compareToggle = createCheckbox('Сравнение', screen.ui.compareMode);
  compareToggle.input.addEventListener('change', async () => {
    screen.ui.compareMode = compareToggle.input.checked;
    await scheduleService.saveScheduleUi(screen.ui);
    render(screen);
  });

  const compareSelect = createSelect(
    'Сравнить с',
    screen.plans.map((plan) => ({ value: plan.id, label: plan.title })),
    screen.ui.comparePlanId,
  );
  compareSelect.input.addEventListener('change', async () => {
    screen.ui.comparePlanId = compareSelect.input.value;
    await scheduleService.saveScheduleUi(screen.ui);
    render(screen);
  });

  const downloadButton = createElement('button', {
    className: 'secondary-button',
    text: 'Скачать HTML',
    attrs: { type: 'button' },
  });
  downloadButton.addEventListener('click', () => downloadScheduleHtml(screen));

  const exportDataButton = createElement('button', {
    className: 'secondary-button',
    text: 'Экспорт данных',
    attrs: { type: 'button' },
  });
  exportDataButton.addEventListener('click', () => exportScheduleBackup(screen));

  const importDataButton = createElement('button', {
    className: 'secondary-button',
    text: 'Импорт данных',
    attrs: { type: 'button' },
  });
  importDataButton.addEventListener('click', () => importScheduleBackup(screen));

  const saveDistButton = createElement('button', {
    className: 'secondary-button',
    text: 'Сохранить в dist',
    attrs: { type: 'button' },
  });
  saveDistButton.addEventListener('click', () => saveScheduleToDist(screen));

  const publishButton = createElement('button', {
    className: 'primary-button',
    text: 'Опубликовать GitHub Pages',
    attrs: { type: 'button' },
  });
  publishButton.addEventListener('click', () => publishSchedule(screen));

  const copyTextButton = createElement('button', {
    className: 'secondary-button',
    text: 'Текст для родителей',
    attrs: { type: 'button' },
  });
  copyTextButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(buildParentText(activePlan, screen.students));
    window.alert('Текст со свободными окнами скопирован.');
  });

  return createElement('section', {
    className: 'schedule-toolbar',
    children: [
      createElement('label', {
        className: 'schedule-title-field',
        children: [createElement('span', { text: 'Название' }), title],
      }),
      timezone.field,
      priority.field,
      paintMode.field,
      hideNames.field,
      includeExport.field,
      compareToggle.field,
      compareSelect.field,
      downloadButton,
      exportDataButton,
      importDataButton,
      saveDistButton,
      publishButton,
      copyTextButton,
    ],
  });
}

function renderScheduleCard(screen, plan, { readonly, label }) {
  return createElement('section', {
    className: `schedule-builder-card ${readonly ? 'readonly' : ''}`,
    children: [
      createElement('div', {
        className: 'schedule-card-header',
        children: [
          createElement('div', {
            children: [
              createElement('p', { className: 'eyebrow', text: label }),
              createElement('h2', { text: plan.title }),
            ],
          }),
          createElement('p', {
            className: 'hint',
            text: readonly ? 'Режим просмотра' : plan.paintMode ? 'Клик по пустой ячейке меняет цвет.' : 'Перетащите ученика в ячейку.',
          }),
        ],
      }),
      renderGrid(screen, plan, readonly),
    ],
  });
}

function renderGrid(screen, plan, readonly) {
  const grid = createElement('div', { className: 'native-schedule-grid' });

  grid.append(createElement('div', { className: 'schedule-cell header-cell' }));

  for (const day of SCHEDULE_DAYS) {
    grid.append(createElement('div', { className: 'schedule-cell header-cell', text: day.label }));
  }

  grid.append(createElement('div', { className: 'schedule-cell header-cell' }));

  for (const hour of SCHEDULE_HOURS) {
    grid.append(createElement('div', { className: 'schedule-cell time-cell', text: timeLabel(hour, plan.timezone) }));

    for (const day of SCHEDULE_DAYS) {
      const key = `${day.key}_${hour}`;
      grid.append(renderSlot(screen, plan, key, readonly));
    }

    grid.append(createElement('div', { className: 'schedule-cell time-cell', text: timeLabel(hour, plan.timezone) }));
  }

  return createElement('div', { className: 'native-grid-wrap', children: [grid] });
}

function renderSlot(screen, plan, slotKey, readonly) {
  const assignment = getSlotAssignment(screen, plan, slotKey);
  const priority = plan.painted[slotKey];
  const student = assignment?.student ?? null;
  const slot = createElement('div', {
    className: [
      'schedule-cell',
      'native-slot',
      assignment ? 'occupied' : '',
      assignment?.source === 'regular' ? 'regular-occupied' : '',
      student?.defaultLessonDurationMinutes > 60 ? 'long-lesson-slot' : '',
      priority ? `priority-${priority}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    attrs: { 'data-slot-key': slotKey, 'data-student-id': student?.id },
  });

  if (assignment) {
    slot.append(renderAssignment(screen, plan, slotKey, assignment, readonly));
  } else {
    slot.append(createElement('span', { className: 'slot-empty-label', text: priorityLabel(priority) }));
  }

  if (!readonly) {
    slot.addEventListener('click', async () => {
      if (assignment) {
        return;
      }

      if (screen.selectedStudentId && !plan.paintMode) {
        const studentId = screen.selectedStudentId;
        screen.selectedStudentId = null;
        await assignStudentRegularLesson(screen, studentId, slotKey);
        return;
      }

      if (!plan.paintMode) {
        return;
      }

      await replacePlan(screen, await scheduleService.togglePriority(plan, slotKey, plan.priorityColor));
    });

    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('over');
    });

    slot.addEventListener('dragleave', () => slot.classList.remove('over'));

    slot.addEventListener('drop', async (event) => {
      event.preventDefault();
      slot.classList.remove('over');
      await handleDrop(screen, plan, slotKey);
    });
  }

  return slot;
}

function renderAssignment(screen, plan, slotKey, assignment, readonly) {
  const { student } = assignment;
  const durationMinutes = student?.defaultLessonDurationMinutes || 60;
  const children = [
    createElement('strong', {
      text: plan.hideNames ? 'Занято' : scheduleStudentName(student),
      attrs: { title: student?.fullName },
    }),
  ];

  if (durationMinutes !== 60) {
    children.push(createElement('span', { className: 'assignment-duration', text: `${durationMinutes} мин` }));
  }

  children.push(
    !readonly
      ? createElement('button', { className: 'slot-clear-button', text: 'x', attrs: { type: 'button', title: 'Очистить' } })
      : createElement('span'),
  );

  const block = createElement('div', {
    className: `assignment-block ${durationMinutes > 60 ? 'long-lesson' : ''}`,
    attrs: { draggable: readonly ? undefined : 'true' },
    children,
  });

  block.addEventListener('click', (event) => {
    event.stopPropagation();

    if (student?.id) {
      screen.onOpenStudent?.(student.id);
    }
  });

  if (!readonly) {
    block.addEventListener('dragstart', () => {
      dragPayload = {
        type: 'assignment',
        source: assignment.source,
        planId: plan.id,
        slotKey,
        studentId: student?.id,
        regularLessonId: assignment.lesson?.id,
      };
    });

    block.querySelector('.slot-clear-button').addEventListener('click', async (event) => {
      event.stopPropagation();

      if (assignment.source === 'regular') {
        await clearStudentRegularLesson(screen, student.id, assignment.lesson.id);
      } else {
        await replacePlan(screen, await scheduleService.clearStudent(plan, slotKey));
      }
    });
  }

  return block;
}

function renderStudentPalette(screen) {
  return createElement('aside', {
    className: 'schedule-students-panel',
    children: [
      createElement('div', {
        children: [
          createElement('p', { className: 'eyebrow', text: 'База учеников' }),
          createElement('h2', { text: 'Перетащить в расписание' }),
        ],
      }),
      screen.students.length
        ? createElement('div', {
            className: 'schedule-student-list',
            children: screen.students.map((student) => renderStudentChip(screen, student)),
          })
        : createElement('p', { className: 'muted', text: 'Сначала добавьте учеников во вкладке "Ученики".' }),
      renderLegend(),
    ],
  });
}

function renderStudentChip(screen, student) {
  const chip = createElement('div', {
    className: `schedule-student-chip ${student.id === screen.selectedStudentId ? 'selected' : ''}`,
    text: scheduleStudentName(student),
    attrs: { draggable: 'true', title: student.fullName },
  });

  chip.addEventListener('click', () => {
    screen.selectedStudentId = screen.selectedStudentId === student.id ? null : student.id;
    render(screen);
  });

  chip.addEventListener('dragstart', () => {
    dragPayload = { type: 'student', studentId: student.id };
  });

  return chip;
}

function renderLegend() {
  return createElement('div', {
    className: 'schedule-legend',
    children: [
      createElement('h3', { text: 'Цвета' }),
      ...SCHEDULE_PRIORITIES.map((priority) =>
        createElement('div', {
          className: 'legend-row',
          children: [
            createElement('span', { className: `legend-swatch priority-${priority.value}` }),
            createElement('span', { text: `${priority.label} - ${priority.description}` }),
          ],
        }),
      ),
    ],
  });
}

async function handleDrop(screen, plan, targetSlot) {
  if (!dragPayload) {
    return;
  }

  const payload = dragPayload;
  dragPayload = null;

  if (payload.type === 'assignment' && payload.source === 'regular') {
    await moveStudentRegularLesson(screen, payload.studentId, payload.regularLessonId, targetSlot);
    return;
  }

  if (payload.type === 'assignment' && payload.studentId) {
    await assignStudentRegularLesson(screen, payload.studentId, targetSlot);
    return;
  }

  if (payload.type === 'student') {
    await assignStudentRegularLesson(screen, payload.studentId, targetSlot);
  } else {
    await replacePlan(screen, await scheduleService.assignStudent(plan, targetSlot, payload.studentId));
  }
}

function getSlotAssignment(screen, plan, slotKey) {
  const regularAssignment = getRegularAssignment(screen, slotKey);

  if (regularAssignment) {
    return regularAssignment;
  }

  const studentId = plan.assignments[slotKey];
  const student = studentId ? screen.students.find((item) => item.id === studentId) : null;

  return studentId
    ? {
        source: 'manual',
        student,
        lesson: null,
      }
    : null;
}

function getRegularAssignment(screen, slotKey) {
  for (const student of screen.students) {
    for (const lesson of student.regularLessons ?? []) {
      if (regularLessonSlotKey(lesson) === slotKey) {
        return {
          source: 'regular',
          student,
          lesson,
        };
      }
    }
  }

  return null;
}

async function assignStudentRegularLesson(screen, studentId, slotKey) {
  const occupied = getRegularAssignment(screen, slotKey);

  if (occupied && occupied.student.id !== studentId) {
    window.alert('Этот слот уже занят другим учеником.');
    return;
  }

  const student = screen.students.find((item) => item.id === studentId);
  const lesson = createRegularLessonFromSlot(slotKey);

  if (!student || !lesson) {
    return;
  }

  const lessons = [...(student.regularLessons ?? [])];
  const existingSlotIndex = lessons.findIndex((item) => regularLessonSlotKey(item) === slotKey);

  if (existingSlotIndex >= 0) {
    lessons[existingSlotIndex] = { ...lesson, id: lessons[existingSlotIndex].id };
  } else if (lessons.length < 2) {
    lessons.push(lesson);
  } else {
    window.alert(
      'У ученика уже указаны два регулярных занятия. Перенесите существующее занятие или уберите одно в карточке.',
    );
    return;
  }

  await persistRegularLessons(screen, student.id, lessons);
}

async function moveStudentRegularLesson(screen, studentId, lessonId, targetSlot) {
  const occupied = getRegularAssignment(screen, targetSlot);

  if (occupied && occupied.student.id !== studentId) {
    window.alert('Этот слот уже занят другим учеником.');
    return;
  }

  const student = screen.students.find((item) => item.id === studentId);
  const lesson = createRegularLessonFromSlot(targetSlot, lessonId);

  if (!student || !lesson) {
    return;
  }

  const lessons = [...(student.regularLessons ?? [])];
  const index = lessons.findIndex((item) => item.id === lessonId);

  if (index >= 0) {
    lessons[index] = lesson;
  } else {
    lessons.push(lesson);
  }

  await persistRegularLessons(screen, student.id, lessons.slice(0, 2));
}

async function clearStudentRegularLesson(screen, studentId, lessonId) {
  const student = screen.students.find((item) => item.id === studentId);

  if (!student) {
    return;
  }

  await persistRegularLessons(
    screen,
    student.id,
    (student.regularLessons ?? []).filter((lesson) => lesson.id !== lessonId),
  );
}

async function persistRegularLessons(screen, studentId, regularLessons) {
  const updatedStudent = await studentService.updateStudentRegularLessons(studentId, regularLessons);
  screen.students = screen.students.map((student) => (student.id === studentId ? updatedStudent : student));

  if (screen.onStudentsChanged) {
    await screen.onStudentsChanged();
  } else {
    render(screen);
  }
}

function createRegularLessonFromSlot(slotKey, lessonId = crypto.randomUUID()) {
  const parsed = parseSlotKey(slotKey);

  if (!parsed) {
    return null;
  }

  return {
    id: lessonId,
    weekday: parsed.dayKey,
    startTime: `${String(parsed.hour).padStart(2, '0')}:00`,
    timezone: 'moscow',
  };
}

function regularLessonSlotKey(lesson) {
  if (!lesson?.weekday || !lesson?.startTime) {
    return null;
  }

  return `${lesson.weekday}_${Number(String(lesson.startTime).slice(0, 2))}`;
}

async function deletePlan(screen, plan) {
  if (screen.plans.length <= 1) {
    return;
  }

  const confirmed = window.confirm(`Удалить расписание "${plan.title}"?`);

  if (!confirmed) {
    return;
  }

  await scheduleService.removePlan(plan);
  screen.plans = screen.plans.filter((item) => item.id !== plan.id);
  screen.ui.activePlanId = screen.plans[0].id;
  screen.ui.comparePlanId = screen.plans[0].id;
  await scheduleService.saveScheduleUi(screen.ui);
  render(screen);
}

async function updatePlan(screen, planId, patch) {
  const plan = screen.plans.find((item) => item.id === planId);
  await replacePlan(screen, await scheduleService.updatePlan(plan, patch));
}

async function replacePlan(screen, updatedPlan) {
  screen.plans = screen.plans.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan));
  render(screen);
}

function getActivePlan(screen) {
  return screen.plans.find((plan) => plan.id === screen.ui.activePlanId) || screen.plans[0];
}

function getComparePlan(screen) {
  return screen.plans.find((plan) => plan.id === screen.ui.comparePlanId) || getActivePlan(screen);
}

function createSelect(label, options, value) {
  const input = createElement('select');

  for (const option of options) {
    const optionElement = createElement('option', { text: option.label, attrs: { value: option.value } });
    optionElement.selected = option.value === value;
    input.append(optionElement);
  }

  return {
    input,
    field: createElement('label', {
      className: 'schedule-control',
      children: [createElement('span', { text: label }), input],
    }),
  };
}

function createCheckbox(label, checked) {
  const input = createElement('input', { attrs: { type: 'checkbox' } });
  input.checked = checked;

  return {
    input,
    field: createElement('label', {
      className: 'schedule-checkbox',
      children: [input, createElement('span', { text: label })],
    }),
  };
}

function priorityLabel(priority) {
  if (!priority) {
    return 'Пусто';
  }

  return SCHEDULE_PRIORITIES.find((item) => item.value === priority)?.label ?? 'Свободно';
}

function scheduleStudentName(student) {
  return student?.nickname?.trim() || student?.fullName || 'Ученик удален';
}

function buildCurrentExportHtml(screen) {
  return buildScheduleExportHtml(screen.plans, screen.students);
}

function downloadScheduleHtml(screen) {
  downloadText('schedule-export.html', buildCurrentExportHtml(screen), 'text/html;charset=utf-8');
}

async function exportScheduleBackup(screen) {
  const backup = await scheduleService.exportScheduleBackup();
  downloadText(
    `setka-schedule-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(backup, null, 2),
    'application/json;charset=utf-8',
  );
}

async function importScheduleBackup(screen) {
  const file = await pickJsonFile();

  if (!file) {
    return;
  }

  const confirmed = window.confirm('Импорт заменит текущие варианты расписания данными из файла. Продолжить?');

  if (!confirmed) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const workspace = await scheduleService.importScheduleBackup(payload);
    screen.plans = workspace.plans;
    screen.ui = workspace.ui;
    render(screen);
    window.alert('Расписание импортировано из бэкапа.');
  } catch (error) {
    window.alert(`Не удалось импортировать бэкап: ${error.message}`);
  }
}

async function saveScheduleToDist(screen) {
  const response = await fetch('/api/schedule/export-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: buildCurrentExportHtml(screen) }),
  });
  const result = await response.json();

  if (!result.ok) {
    window.alert(`Не удалось сохранить HTML: ${result.error || 'ошибка'}`);
    return;
  }

  window.alert(`HTML сохранен: ${result.path}`);
}

async function publishSchedule(screen) {
  const confirmed = window.confirm(
    'Опубликовать расписание через schedule/deploy.bat? Это выполнит git commit/push в репозитории schedule.',
  );

  if (!confirmed) {
    return;
  }

  const response = await fetch('/api/schedule/publish-github-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: buildCurrentExportHtml(screen) }),
  });
  const result = await response.json();

  if (!result.ok) {
    window.alert(`Публикация не удалась: ${result.error || result.stderr || 'ошибка'}`);
    return;
  }

  window.alert('Публикация запущена. GitHub Pages обновится после выполнения workflow.');
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pickJsonFile() {
  return new Promise((resolve) => {
    const input = createElement('input', {
      attrs: {
        type: 'file',
        accept: 'application/json,.json',
      },
    });

    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });

    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });

    input.style.display = 'none';
    document.body.append(input);
    input.click();
  });
}

document.addEventListener('dragend', () => {
  dragPayload = null;
});
