import {
  SCHEDULE_DAYS,
  SCHEDULE_HOURS,
  SCHEDULE_LESSON_KINDS,
  SCHEDULE_PLAN_TYPES,
  SCHEDULE_PRIORITIES,
  SCHEDULE_SLOT_MINUTES,
  SCHEDULE_TIMEZONES,
  parseSlotKey,
  slotKey,
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
        children: [
          createElement('span', {
            className: 'hint',
            text: isPermanentPlan(activePlan)
              ? 'Постоянное расписание связано с карточками учеников.'
              : 'Текущая неделя хранит временные изменения отдельно.',
          }),
        ],
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
          !plan.fixed && screen.plans.length > 1
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
  const renderContext = buildPlanRenderContext(screen, plan);

  grid.append(createElement('div', { className: 'schedule-cell header-cell' }));

  for (const day of SCHEDULE_DAYS) {
    grid.append(createElement('div', { className: 'schedule-cell header-cell', text: day.label }));
  }

  grid.append(createElement('div', { className: 'schedule-cell header-cell' }));

  for (const hour of SCHEDULE_HOURS) {
    grid.append(createElement('div', { className: 'schedule-cell time-cell', text: timeLabel(hour, plan.timezone) }));

    for (const day of SCHEDULE_DAYS) {
      const key = `${day.key}_${hour}`;
      grid.append(renderSlot(screen, plan, key, readonly, renderContext));
    }

    grid.append(createElement('div', { className: 'schedule-cell time-cell', text: timeLabel(hour, plan.timezone) }));
  }

  const assignmentLayer = createElement('div', { className: 'assignment-layer' });

  for (const assignment of renderContext.assignments) {
    const overlay = renderAssignmentOverlay(screen, plan, assignment, readonly);

    if (overlay) {
      assignmentLayer.append(overlay);
    }
  }

  grid.append(assignmentLayer);

  return createElement('div', { className: 'native-grid-wrap', children: [grid] });
}

function renderSlot(screen, plan, slotKey, readonly, renderContext) {
  const parsed = parseSlotKey(slotKey);
  const halfSlots = SCHEDULE_SLOT_MINUTES.map((minute) => {
    const key = slotKeyFromParts(parsed.dayKey, parsed.hour, minute);
    return key
      ? {
          key,
          minute,
          assignment: renderContext.assignmentsBySlot.get(key),
          covered: renderContext.coveredSlotKeys.has(key),
          priority: plan.painted[key],
        }
      : null;
  });
  const hasAssignment = halfSlots.some((item) => item?.assignment);
  const hasCoveredSlot = halfSlots.some((item) => item?.covered);
  const hasLongAssignment = halfSlots.some((item) => (item?.assignment?.student?.defaultLessonDurationMinutes || 60) > 60);
  const slot = createElement('div', {
    className: [
      'schedule-cell',
      'native-slot',
      hasAssignment ? 'occupied' : '',
      hasCoveredSlot ? 'covered-by-lesson' : '',
      halfSlots.some((item) => item?.assignment?.lesson?.kind !== SCHEDULE_LESSON_KINDS.oneOff) ? 'regular-occupied' : '',
      hasLongAssignment ? 'long-lesson-slot' : '',
    ]
      .filter(Boolean)
      .join(' '),
    attrs: { 'data-hour-key': slotKey },
  });

  for (const halfSlot of halfSlots) {
    slot.append(renderSlotHalf(screen, plan, halfSlot, readonly));
  }

  return slot;
}

function renderSlotHalf(screen, plan, halfSlot, readonly) {
  if (!halfSlot) {
    return createElement('div', { className: 'slot-half unavailable' });
  }

  const { key, minute, assignment, covered, priority } = halfSlot;
  const half = createElement('div', {
    className: [
      'slot-half',
      minute === 0 ? 'slot-half-start' : 'slot-half-middle',
      assignment ? 'occupied' : '',
      covered ? 'covered' : '',
      priority ? `priority-${priority}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    attrs: {
      'data-slot-key': key,
      title: `Начало ${parseSlotKey(key).startTime}`,
    },
  });

  if (!assignment && !covered && minute === 0) {
    half.append(createElement('span', { className: 'slot-empty-label', text: priorityLabel(priority) }));
  }

  if (!readonly) {
    half.addEventListener('click', async () => {
      if (assignment) {
        return;
      }

      if (screen.selectedStudentId && !plan.paintMode) {
        const studentId = screen.selectedStudentId;
        screen.selectedStudentId = null;
        await addStudentLessonToPlan(screen, plan, studentId, key);
        return;
      }

      if (!plan.paintMode) {
        return;
      }

      await replacePlan(screen, await scheduleService.togglePriority(plan, key, plan.priorityColor));
    });

    half.addEventListener('dragover', (event) => {
      event.preventDefault();
      half.classList.add('over');
    });

    half.addEventListener('dragleave', () => half.classList.remove('over'));

    half.addEventListener('drop', async (event) => {
      event.preventDefault();
      half.classList.remove('over');
      await handleDrop(screen, plan, key);
    });
  }

  return half;
}

function renderAssignmentOverlay(screen, plan, assignment, readonly) {
  const parsed = parseSlotKey(assignment.slotKey);
  const dayIndex = SCHEDULE_DAYS.findIndex((day) => day.key === parsed?.dayKey);
  const hourIndex = SCHEDULE_HOURS.indexOf(parsed?.hour);

  if (!parsed || dayIndex < 0 || hourIndex < 0) {
    return null;
  }

  const durationMinutes = getDurationMinutes(assignment.student);
  const rowSpan = Math.max(1, Math.ceil((parsed.minute + durationMinutes) / 60));
  const spanMinutes = rowSpan * 60;
  const offsetPercent = (parsed.minute / spanMinutes) * 100;
  const heightPercent = (durationMinutes / spanMinutes) * 100;

  return createElement('div', {
    className: 'assignment-overlay-slot',
    attrs: {
      'data-overlay-slot-key': assignment.slotKey,
      style: [
        `grid-column: ${dayIndex + 2}`,
        `grid-row: ${hourIndex + 2} / span ${rowSpan}`,
        `--lesson-offset: ${offsetPercent}%`,
        `--lesson-height: ${heightPercent}%`,
      ].join('; '),
    },
    children: [renderAssignment(screen, plan, assignment.slotKey, assignment, readonly)],
  });
}

function renderAssignment(screen, plan, slotKey, assignment, readonly) {
  const { student } = assignment;
  const durationUnits = getDurationUnits(student);
  const children = [
    createElement('strong', {
      text: plan.hideNames ? 'Занято' : scheduleStudentName(student),
      attrs: { title: student?.fullName },
    }),
  ];

  if (!readonly) {
    children.push(
      createElement('button', { className: 'slot-clear-button', text: 'x', attrs: { type: 'button', title: 'Очистить' } }),
    );
  }

  const block = createElement('div', {
    className: [
      'assignment-block',
      durationUnits > 2 ? 'long-lesson' : '',
      assignment.lesson?.kind === SCHEDULE_LESSON_KINDS.oneOff ? 'one-off-lesson' : 'regular-lesson',
    ]
      .filter(Boolean)
      .join(' '),
    attrs: {
      draggable: readonly ? undefined : 'true',
      style: `--duration-units: ${durationUnits};`,
    },
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
        kind: assignment.lesson?.kind,
        planId: plan.id,
        slotKey,
        studentId: student?.id,
        lessonId: assignment.lesson?.id,
      };
    });

    block.querySelector('.slot-clear-button').addEventListener('click', async (event) => {
      event.stopPropagation();

      if (assignment.source === 'lesson') {
        await clearPlanLesson(screen, plan, assignment.lesson);
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

  if (payload.type === 'assignment' && payload.source === 'lesson') {
    await movePlanLesson(screen, plan, payload.lessonId, targetSlot);
    return;
  }

  if (payload.type === 'assignment' && payload.studentId) {
    await moveManualAssignment(screen, plan, payload.slotKey, payload.studentId, targetSlot);
    return;
  }

  if (payload.type === 'student') {
    await addStudentLessonToPlan(screen, plan, payload.studentId, targetSlot);
  } else {
    await replacePlan(screen, await scheduleService.assignStudent(plan, targetSlot, payload.studentId));
  }
}

function buildPlanRenderContext(screen, plan) {
  const assignments = collectPlanAssignments(screen, plan);
  const assignmentsBySlot = new Map(assignments.map((assignment) => [assignment.slotKey, assignment]));
  const coveredSlotKeys = new Set();

  for (const assignment of assignments) {
    const parsed = parseSlotKey(assignment.slotKey);
    const durationMinutes = getDurationMinutes(assignment.student);

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

function collectPlanAssignments(screen, plan) {
  const assignments = [];
  const cardLessons = buildLessonsFromStudentCards(screen.students);
  const cardLessonIds = new Set(cardLessons.map((lesson) => lesson.id));
  const localLessons = plan.lessons ?? [];
  const hiddenRegularLessonIds = new Set(plan.hiddenRegularLessonIds ?? []);
  const regularOverrides = new Map(
    localLessons
      .filter((lesson) => lesson.kind === SCHEDULE_LESSON_KINDS.regular && cardLessonIds.has(lesson.id))
      .map((lesson) => [lesson.id, lesson]),
  );
  const lessons = isPermanentPlan(plan)
    ? cardLessons
    : [
        ...cardLessons
          .filter((lesson) => !hiddenRegularLessonIds.has(lesson.id))
          .map((lesson) => regularOverrides.get(lesson.id) ?? lesson),
        ...localLessons.filter(
          (lesson) =>
            lesson.kind === SCHEDULE_LESSON_KINDS.oneOff ||
            (lesson.kind === SCHEDULE_LESSON_KINDS.regular && !cardLessonIds.has(lesson.id) && lesson.scope === 'week'),
        ),
      ];

  for (const lesson of lessons) {
    const key = scheduleLessonSlotKey(lesson);
    const student = screen.students.find((item) => item.id === lesson.studentId);

    if (!key || !student) {
      continue;
    }

    assignments.push({
      source: 'lesson',
      slotKey: key,
      student,
      studentId: student.id,
      lesson,
      lessonId: lesson.id,
    });
  }

  for (const [key, studentId] of Object.entries(plan.assignments ?? {})) {
    const student = screen.students.find((item) => item.id === studentId);

    if (!parseSlotKey(key) || !student) {
      continue;
    }

    assignments.push({
      source: 'manual',
      slotKey: key,
      student,
      studentId,
      lesson: null,
      lessonId: null,
    });
  }

  return assignments;
}

async function addStudentLessonToPlan(screen, plan, studentId, slotKey) {
  const student = screen.students.find((item) => item.id === studentId);
  const parsed = parseSlotKey(slotKey);

  if (!student || !parsed) {
    return;
  }

  const kind = await askLessonKind(student, parsed.startTime);

  if (!kind) {
    return;
  }

  const lesson = {
    id: crypto.randomUUID(),
    studentId: student.id,
    weekday: parsed.dayKey,
    startTime: parsed.startTime,
    kind,
    timezone: 'moscow',
  };

  await savePlanLesson(screen, plan, lesson);
}

async function savePlanLesson(screen, plan, lesson) {
  const student = screen.students.find((item) => item.id === lesson.studentId);
  const targetSlot = scheduleLessonSlotKey(lesson);

  if (!student || !targetSlot) {
    return;
  }

  if (isPermanentPlan(plan) && lesson.kind === SCHEDULE_LESSON_KINDS.oneOff) {
    window.alert('Разовые занятия добавляются в текущую неделю, а постоянное расписание формируется из карточек учеников.');
    return;
  }

  if (hasTimeCollision(screen, plan, student.id, lesson.id, targetSlot, student.defaultLessonDurationMinutes)) {
    window.alert('Это время пересекается с другим занятием.');
    return;
  }

  if (isPermanentPlan(plan) && lesson.kind === SCHEDULE_LESSON_KINDS.regular) {
    await upsertStudentRegularLesson(screen, student, lesson);
    return;
  }

  await replacePlan(
    screen,
    await scheduleService.saveLesson(plan, {
      ...lesson,
      scope: lesson.kind === SCHEDULE_LESSON_KINDS.regular ? 'week' : lesson.scope,
    }),
  );
}

async function movePlanLesson(screen, plan, lessonId, targetSlot) {
  const assignment = findRenderedAssignment(screen, plan, lessonId);
  const lesson = assignment?.lesson;
  const parsed = parseSlotKey(targetSlot);
  const student = lesson ? screen.students.find((item) => item.id === lesson.studentId) : null;

  if (!lesson || !parsed || !student) {
    return;
  }

  if (hasTimeCollision(screen, plan, student.id, lesson.id, targetSlot, student.defaultLessonDurationMinutes)) {
    window.alert('Это время пересекается с другим занятием.');
    return;
  }

  const movedLesson = {
    ...lesson,
    weekday: parsed.dayKey,
    startTime: parsed.startTime,
    timezone: 'moscow',
  };

  if (isPermanentPlan(plan) && lesson.kind === SCHEDULE_LESSON_KINDS.regular) {
    await upsertStudentRegularLesson(screen, student, movedLesson);
    return;
  }

  await replacePlan(
    screen,
    await scheduleService.saveLesson(plan, {
      ...movedLesson,
      scope: movedLesson.kind === SCHEDULE_LESSON_KINDS.regular ? 'week' : movedLesson.scope,
    }),
  );
}

async function moveManualAssignment(screen, plan, sourceSlot, studentId, targetSlot) {
  const student = screen.students.find((item) => item.id === studentId);

  if (!student) {
    return;
  }

  if (hasTimeCollision(screen, plan, student.id, null, targetSlot, student.defaultLessonDurationMinutes, sourceSlot)) {
    window.alert('Это время пересекается с другим занятием.');
    return;
  }

  await replacePlan(screen, await scheduleService.moveStudent(plan, sourceSlot, targetSlot));
}

async function clearPlanLesson(screen, plan, lesson) {
  if (isPermanentPlan(plan) && lesson.kind === SCHEDULE_LESSON_KINDS.regular) {
    const student = screen.students.find((item) => item.id === lesson.studentId);

    if (student) {
      await persistRegularLessons(
        screen,
        student.id,
        (student.regularLessons ?? []).filter((item) => item.id !== lesson.id),
      );
    }

    return;
  }

  if (isCurrentWeekPlan(plan) && lesson.kind === SCHEDULE_LESSON_KINDS.regular) {
    await replacePlan(
      screen,
      await scheduleService.updatePlan(plan, {
        lessons: (plan.lessons ?? []).filter((item) => item.id !== lesson.id),
        hiddenRegularLessonIds: [...new Set([...(plan.hiddenRegularLessonIds ?? []), lesson.id])],
      }),
    );
    return;
  }

  await replacePlan(screen, await scheduleService.clearLesson(plan, lesson.id));
}

function askLessonKind(student, startTime) {
  return new Promise((resolve) => {
    const dialog = createElement('dialog', { className: 'dialog lesson-kind-dialog' });
    let settled = false;

    function finish(kind) {
      settled = true;
      dialog.close();
      resolve(kind);
    }

    const oneOffButton = createElement('button', {
      className: 'secondary-button',
      text: 'Разовое',
      attrs: { type: 'button' },
    });
    const regularButton = createElement('button', {
      className: 'primary-button',
      text: 'Постоянное',
      attrs: { type: 'button' },
    });
    const cancelButton = createElement('button', {
      className: 'secondary-button',
      text: 'Отмена',
      attrs: { type: 'button' },
    });

    oneOffButton.addEventListener('click', () => finish(SCHEDULE_LESSON_KINDS.oneOff));
    regularButton.addEventListener('click', () => finish(SCHEDULE_LESSON_KINDS.regular));
    cancelButton.addEventListener('click', () => finish(null));
    dialog.addEventListener('close', () => {
      dialog.remove();

      if (!settled) {
        resolve(null);
      }
    });

    dialog.append(
      createElement('div', {
        className: 'lesson-kind-content',
        children: [
          createElement('h2', { text: 'Как добавить занятие?' }),
          createElement('p', {
            className: 'muted',
            text: `${scheduleStudentName(student)} · ${startTime}. Разовое останется только в этом расписании, постоянное добавится в карточку ученика.`,
          }),
          createElement('div', {
            className: 'lesson-kind-actions',
            children: [oneOffButton, regularButton, cancelButton],
          }),
        ],
      }),
    );
    document.body.append(dialog);
    dialog.showModal();
    oneOffButton.focus();
  });
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

async function upsertStudentRegularLesson(screen, student, lesson) {
  const regularLessons = [...(student.regularLessons ?? [])];
  const index = regularLessons.findIndex((item) => item.id === lesson.id);
  const studentLesson = {
    id: lesson.id,
    weekday: lesson.weekday,
    startTime: lesson.startTime,
    timezone: 'moscow',
  };

  if (index >= 0) {
    regularLessons[index] = studentLesson;
  } else {
    regularLessons.push(studentLesson);
  }

  await persistRegularLessons(screen, student.id, regularLessons);
}

function buildLessonsFromStudentCards(students) {
  const lessons = [];

  for (const student of students) {
    for (const lesson of student.regularLessons ?? []) {
      if (!scheduleLessonSlotKey(lesson)) {
        continue;
      }

      lessons.push({
        id: lesson.id || crypto.randomUUID(),
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

function getDurationUnits(student) {
  const duration = Number(student?.defaultLessonDurationMinutes || 60);
  return Math.max(1, Math.ceil(duration / 30));
}

function getDurationMinutes(student) {
  return getDurationUnits(student) * 30;
}

function hasTimeCollision(screen, plan, studentId, ignoredLessonId, targetSlotKey, durationMinutes, ignoredSourceSlotKey = null) {
  const target = parseSlotKey(targetSlotKey);

  if (!target) {
    return false;
  }

  const targetStart = target.totalMinutes;
  const targetEnd = targetStart + Math.max(30, Math.ceil(Number(durationMinutes || 60) / 30) * 30);

  return collectTimedAssignments(screen, plan).some((assignment) => {
    if (assignment.slotKey === ignoredSourceSlotKey) {
      return false;
    }

    if (assignment.dayKey !== target.dayKey) {
      return false;
    }

    if (assignment.source === 'lesson' && assignment.studentId === studentId && assignment.lessonId === ignoredLessonId) {
      return false;
    }

    return intervalsOverlap(targetStart, targetEnd, assignment.start, assignment.end);
  });
}

function collectTimedAssignments(screen, plan) {
  return collectPlanAssignments(screen, plan)
    .map((assignment) => {
      const parsed = parseSlotKey(assignment.slotKey);

      if (!parsed) {
        return null;
      }

      return {
        source: assignment.source,
        slotKey: assignment.slotKey,
        studentId: assignment.studentId,
        lessonId: assignment.lessonId,
        dayKey: parsed.dayKey,
        start: parsed.totalMinutes,
        end: parsed.totalMinutes + getDurationMinutes(assignment.student),
      };
    })
    .filter(Boolean);
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isCurrentWeekPlan(plan) {
  return plan?.type === SCHEDULE_PLAN_TYPES.currentWeek;
}

function isPermanentPlan(plan) {
  return plan?.type === SCHEDULE_PLAN_TYPES.permanent;
}

function findRenderedAssignment(screen, plan, lessonId) {
  return collectPlanAssignments(screen, plan).find((assignment) => assignment.lessonId === lessonId) ?? null;
}

async function deletePlan(screen, plan) {
  if (plan.fixed) {
    return;
  }

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
