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
export const SCHEDULE_TIMES = Object.freeze(SCHEDULE_HOURS.map((hour) => `${String(hour).padStart(2, '0')}:00`));

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
    priorityColor: 'green',
    paintMode: false,
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
    priorityColor: priorityValues.has(plan?.priorityColor) ? plan.priorityColor : 'green',
    paintMode: Boolean(plan?.paintMode),
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

export function slotKey(dayKey, hour) {
  if (!dayKeys.has(dayKey)) {
    throw new Error('Некорректный день расписания.');
  }

  if (!SCHEDULE_HOURS.includes(Number(hour))) {
    throw new Error('Некорректное время расписания.');
  }

  return `${dayKey}_${Number(hour)}`;
}

export function parseSlotKey(key) {
  const [dayKey, hourValue] = String(key).split('_');
  const hour = Number(hourValue);

  if (!dayKeys.has(dayKey) || !SCHEDULE_HOURS.includes(hour)) {
    return null;
  }

  return { dayKey, hour };
}

export function assignStudentToSlot(plan, slot, studentId) {
  const assignments = { ...plan.assignments, [slot]: studentId };
  const painted = { ...plan.painted };
  delete painted[slot];

  return touchSchedulePlan(plan, { assignments, painted });
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

  if (!SCHEDULE_HOURS.includes(hour) || minute !== 0) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:00`;
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
