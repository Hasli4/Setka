export const SCHEDULE_DAYS = Object.freeze([
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Вс' },
]);

export const SCHEDULE_HOURS = Object.freeze(Array.from({ length: 10 }, (_, index) => 8 + index));
export const SCHEDULE_SLOT_MINUTES = Object.freeze([0, 30]);
export const SCHEDULE_TIMES = Object.freeze(
  SCHEDULE_HOURS.flatMap((hour, index) => {
    const hourLabel = String(hour).padStart(2, '0');
    const isLastHour = index === SCHEDULE_HOURS.length - 1;
    return isLastHour ? [`${hourLabel}:00`] : [`${hourLabel}:00`, `${hourLabel}:30`];
  }),
);
export const SCHEDULE_LESSON_KINDS = Object.freeze({
  regular: 'regular',
  oneOff: 'one_off',
});

export const SCHEDULE_PLAN_TYPES = Object.freeze({
  currentWeek: 'current_week',
  permanent: 'permanent',
});

export const SCHEDULE_PRIORITIES = Object.freeze([
  { value: 'green', label: 'Зеленый', description: 'удобно' },
  { value: 'yellow', label: 'Желтый', description: 'приемлемо' },
  { value: 'red', label: 'Красный', description: 'запасной вариант' },
  { value: 'busy', label: 'Синий', description: 'занято другим делом' },
]);

export const SCHEDULE_TIMEZONES = Object.freeze([
  { value: 'moscow', label: 'Москва (UTC/GMT +3)', offset: 0 },
  { value: 'perm', label: 'Пермь / Екатеринбург (UTC/GMT +5)', offset: 2 },
  { value: 'georgia', label: 'Грузия (UTC/GMT +4)', offset: 1 },
]);

const priorityValues = new Set(SCHEDULE_PRIORITIES.map((priority) => priority.value));
const timezoneValues = new Set(SCHEDULE_TIMEZONES.map((timezone) => timezone.value));
const dayKeys = new Set(SCHEDULE_DAYS.map((day) => day.key));

export function createSchedulePlan(title = 'Расписание 1', deviceId = 'local') {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    timezone: 'moscow',
    hideNames: false,
    includeInExport: true,
    type: null,
    fixed: false,
    priorityColor: 'green',
    paintMode: false,
    lessons: [],
    lessonsInitialized: false,
    hiddenRegularLessonIds: [],
    assignments: {},
    painted: {},
    createdAt: now,
    updatedAt: now,
    revision: 1,
    sourceDeviceId: deviceId,
    syncState: 'pending',
  };
}

export function duplicateSchedulePlan(sourcePlan, title = `${sourcePlan.title || 'Расписание'} копия`) {
  const now = new Date().toISOString();

  return {
    ...structuredClone(sourcePlan),
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    syncState: 'pending',
  };
}

export function normalizeSchedulePlan(plan) {
  const normalized = {
    ...createSchedulePlan(plan?.title || 'Расписание'),
    ...plan,
    title: String(plan?.title || 'Расписание').trim() || 'Расписание',
    timezone: timezoneValues.has(plan?.timezone) ? plan.timezone : 'moscow',
    hideNames: Boolean(plan?.hideNames),
    includeInExport: plan?.includeInExport !== false,
    type: Object.values(SCHEDULE_PLAN_TYPES).includes(plan?.type) ? plan.type : null,
    fixed: Boolean(plan?.fixed),
    priorityColor: priorityValues.has(plan?.priorityColor) ? plan.priorityColor : 'green',
    paintMode: Boolean(plan?.paintMode),
    lessons: normalizePlanLessons(plan?.lessons),
    lessonsInitialized: Boolean(plan?.lessonsInitialized),
    hiddenRegularLessonIds: Array.isArray(plan?.hiddenRegularLessonIds)
      ? [...new Set(plan.hiddenRegularLessonIds.filter((id) => typeof id === 'string' && id))]
      : [],
    assignments: normalizeAssignments(plan?.assignments),
    painted: normalizePainted(plan?.painted),
  };

  return normalized;
}

export function touchSchedulePlan(plan, patch = {}) {
  return normalizeSchedulePlan({
    ...plan,
    ...patch,
    updatedAt: new Date().toISOString(),
    revision: (plan.revision || 0) + 1,
    syncState: 'pending',
  });
}

export function slotKey(dayKey, hour, minute = 0) {
  if (!dayKeys.has(dayKey)) {
    throw new Error('Некорректный день расписания.');
  }

  const normalizedHour = Number(hour);
  const normalizedMinute = Number(minute);
  const formatted = `${String(normalizedHour).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;

  if (!SCHEDULE_TIMES.includes(formatted)) {
    throw new Error('Некорректное время расписания.');
  }

  return normalizedMinute === 0 ? `${dayKey}_${normalizedHour}` : `${dayKey}_${normalizedHour}_${normalizedMinute}`;
}

export function parseSlotKey(key) {
  const [dayKey, hourValue, minuteValue = '0'] = String(key).split('_');
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (!dayKeys.has(dayKey) || !SCHEDULE_TIMES.includes(startTime)) {
    return null;
  }

  return { dayKey, hour, minute, startTime, totalMinutes: hour * 60 + minute };
}

export function assignStudentToSlot(plan, slot, studentId) {
  const assignments = { ...plan.assignments, [slot]: studentId };
  const painted = { ...plan.painted };
  delete painted[slot];

  return touchSchedulePlan(plan, { assignments, painted });
}

export function upsertScheduleLesson(plan, lesson) {
  const normalizedLesson = normalizeScheduleLesson(lesson);

  if (!normalizedLesson) {
    return plan;
  }

  const lessons = [...(plan.lessons ?? [])];
  const index = lessons.findIndex((item) => item.id === normalizedLesson.id);

  if (index >= 0) {
    lessons[index] = normalizedLesson;
  } else {
    lessons.push(normalizedLesson);
  }

  const assignments = { ...(plan.assignments ?? {}) };
  delete assignments[lessonSlotKey(normalizedLesson)];

  return touchSchedulePlan(plan, { lessons, assignments, lessonsInitialized: true });
}

export function moveScheduleLesson(plan, lessonId, targetSlot) {
  const parsed = parseSlotKey(targetSlot);

  if (!parsed) {
    return plan;
  }

  const lessons = (plan.lessons ?? []).map((lesson) =>
    lesson.id === lessonId
      ? {
          ...lesson,
          weekday: parsed.dayKey,
          startTime: parsed.startTime,
          timezone: 'moscow',
        }
      : lesson,
  );
  const assignments = { ...(plan.assignments ?? {}) };
  delete assignments[targetSlot];

  return touchSchedulePlan(plan, { lessons, assignments, lessonsInitialized: true });
}

export function clearScheduleLesson(plan, lessonId) {
  const lessons = (plan.lessons ?? []).filter((lesson) => lesson.id !== lessonId);
  return touchSchedulePlan(plan, { lessons, lessonsInitialized: true });
}

export function moveAssignment(plan, sourceSlot, targetSlot) {
  const studentId = plan.assignments[sourceSlot];

  if (!studentId) {
    return plan;
  }

  const assignments = { ...plan.assignments };
  const painted = { ...plan.painted };
  delete assignments[sourceSlot];
  delete painted[targetSlot];
  assignments[targetSlot] = studentId;

  return touchSchedulePlan(plan, { assignments, painted });
}

export function clearSlot(plan, slot) {
  const assignments = { ...plan.assignments };
  delete assignments[slot];

  return touchSchedulePlan(plan, { assignments });
}

export function togglePaintedSlot(plan, slot, priority) {
  if (!priorityValues.has(priority)) {
    return plan;
  }

  if (plan.assignments[slot]) {
    return plan;
  }

  const painted = { ...plan.painted };

  if (painted[slot] === priority) {
    delete painted[slot];
  } else {
    painted[slot] = priority;
  }

  return touchSchedulePlan(plan, { painted });
}

export function normalizePriority(value) {
  return priorityValues.has(value) ? value : null;
}

export function timezoneLabel(value) {
  return SCHEDULE_TIMEZONES.find((timezone) => timezone.value === value)?.label ?? SCHEDULE_TIMEZONES[0].label;
}

export function timeLabel(hour, timezone = 'moscow') {
  const offset = SCHEDULE_TIMEZONES.find((item) => item.value === timezone)?.offset ?? 0;
  return `${String(hour + offset).padStart(2, '0')}:00`;
}

export function parseMoscowTime(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2})(?::([0-5]\d))?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (!SCHEDULE_TIMES.includes(formatted)) {
    return null;
  }

  return formatted;
}

export function timeToHour(value) {
  const time = parseMoscowTime(value);
  return time ? Number(time.slice(0, 2)) : null;
}

function normalizeAssignments(assignments) {
  return Object.fromEntries(
    Object.entries(assignments || {}).filter(([key, value]) => parseSlotKey(key) && typeof value === 'string' && value),
  );
}

function normalizePainted(painted) {
  return Object.fromEntries(
    Object.entries(painted || {})
      .map(([key, value]) => [key, normalizePriority(value)])
      .filter(([key, value]) => parseSlotKey(key) && value),
  );
}

function normalizePlanLessons(lessons) {
  if (!Array.isArray(lessons)) {
    return [];
  }

  return lessons.map(normalizeScheduleLesson).filter(Boolean);
}

function normalizeScheduleLesson(lesson) {
  const studentId = String(lesson?.studentId ?? '').trim();
  const weekday = String(lesson?.weekday ?? '').trim();
  const startTime = parseMoscowTime(lesson?.startTime);

  if (!studentId || !allowedWeekday(weekday) || !startTime) {
    return null;
  }

  const kind =
    lesson?.kind === SCHEDULE_LESSON_KINDS.oneOff ? SCHEDULE_LESSON_KINDS.oneOff : SCHEDULE_LESSON_KINDS.regular;

  return {
    id: lesson?.id || crypto.randomUUID(),
    studentId,
    weekday,
    startTime,
    kind,
    timezone: 'moscow',
  };
}

function lessonSlotKey(lesson) {
  const [hourValue, minuteValue = '0'] = String(lesson.startTime).split(':');
  return slotKey(lesson.weekday, Number(hourValue), Number(minuteValue));
}

function allowedWeekday(weekday) {
  return dayKeys.has(weekday);
}
