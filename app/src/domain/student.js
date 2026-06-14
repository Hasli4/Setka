import { STUDENT_STATUSES } from './statuses.js';
import { SCHEDULE_DAYS, parseMoscowTime } from './schedule.js';

const allowedStudentStatuses = new Set(STUDENT_STATUSES.map((status) => status.value));
const allowedWeekdays = new Set(SCHEDULE_DAYS.map((day) => day.key));

export function validateStudentInput(input) {
  const fullName = String(input.fullName ?? '').trim();

  if (!fullName) {
    throw new Error('Укажите ФИО ученика.');
  }

  const defaultLessonDurationMinutes = Number(input.defaultLessonDurationMinutes || 60);

  if (!Number.isFinite(defaultLessonDurationMinutes) || defaultLessonDurationMinutes < 15) {
    throw new Error('Длительность занятия должна быть не меньше 15 минут.');
  }

  const status = normalizeStudentStatus(input.status);

  return {
    fullName,
    nickname: String(input.nickname ?? '').trim(),
    direction: normalizeDirection(input.direction),
    status,
    defaultLessonDurationMinutes,
    startedAt: String(input.startedAt ?? ''),
    regularLessons: normalizeRegularLessons(input.regularLessons),
    billing: normalizeBilling(input.billing),
    contacts: normalizeContacts(input.contacts),
    notes: String(input.notes ?? '').trim(),
  };
}

function normalizeDirection(direction) {
  const value = String(direction ?? '').trim();
  return value === '__add_new__' ? '' : value;
}

export function normalizeStudentStatus(status) {
  const value = String(status ?? '').trim();

  if (value === 'frozen') {
    return 'paused';
  }

  return allowedStudentStatuses.has(value) ? value : 'new';
}

function normalizeRegularLessons(regularLessons) {
  if (!Array.isArray(regularLessons)) {
    return [];
  }

  return regularLessons
    .map((lesson) => {
      const weekday = String(lesson.weekday ?? '').trim();
      const startTime = parseMoscowTime(lesson.startTime);

      if (!allowedWeekdays.has(weekday) || !startTime) {
        return null;
      }

      return {
        id: lesson.id || crypto.randomUUID(),
        weekday,
        startTime,
        timezone: 'moscow',
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}

function normalizeBilling(billing = {}) {
  const subscriptionPrice = normalizeMoney(billing.subscriptionPrice);
  const lessonsPerSubscription = normalizePositiveInteger(billing.lessonsPerSubscription);
  const singleLessonPrice =
    subscriptionPrice > 0 && lessonsPerSubscription > 0
      ? Math.round((subscriptionPrice / lessonsPerSubscription) * 100) / 100
      : 0;

  return {
    subscriptionPrice,
    lessonsPerSubscription,
    singleLessonPrice,
  };
}

function normalizeMoney(value) {
  const amount = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function normalizePositiveInteger(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : 0;
}

function normalizeContacts(contacts) {
  if (!Array.isArray(contacts)) {
    return [];
  }

  return contacts
    .map((contact) => {
      const label = String(contact.label ?? '').trim();
      const value = String(contact.value ?? '').trim();
      const type = String(contact.type ?? 'other').trim() || 'other';

      if (!value) {
        return null;
      }

      return {
        id: contact.id || crypto.randomUUID(),
        type,
        label: label || contactLabel(type),
        value,
        href: normalizeContactHref(type, value),
        primary: Boolean(contact.primary),
      };
    })
    .filter(Boolean);
}

function contactLabel(type) {
  switch (type) {
    case 'phone':
      return 'Телефон';
    case 'telegram':
      return 'Telegram';
    case 'vk':
      return 'VK';
    default:
      return 'Контакт';
  }
}

function normalizeContactHref(type, value) {
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value) || /^tel:/i.test(value)) {
    return value;
  }

  if (type === 'phone') {
    const phone = value.replace(/[^\d+]/g, '');
    return phone ? `tel:${phone}` : value;
  }

  if (type === 'telegram') {
    const username = value.replace(/^@/, '').replace(/^t\.me\//i, '');
    return username ? `https://t.me/${username}` : value;
  }

  if (type === 'vk') {
    const vkPath = value.replace(/^vk\.com\//i, '');
    return vkPath ? `https://vk.com/${vkPath}` : value;
  }

  return value;
}

export function createStudent(input, deviceId) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    ...validateStudentInput(input),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    sourceDeviceId: deviceId,
    syncState: 'pending',
  };
}

export function updateStudent(existingStudent, input) {
  return {
    ...existingStudent,
    ...validateStudentInput(input),
    updatedAt: new Date().toISOString(),
    revision: existingStudent.revision + 1,
    syncState: 'pending',
  };
}
