import { SCHEDULE_DAYS, SCHEDULE_LESSON_KINDS, SCHEDULE_PLAN_TYPES } from './schedule.js';

const MOSCOW_TIMEZONE = 'Europe/Moscow';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const weekdayKeys = Object.freeze(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const knownWeekdays = new Set(SCHEDULE_DAYS.map((day) => day.key));

export function buildCurrentDayLessonEntries(students, lessonLogs, today = new Date(), sourcePlan = null) {
  const todayInfo = getMoscowDateInfo(today);
  const logsById = new Map((lessonLogs ?? []).map((lesson) => [lesson.id, lesson]));
  const studentsById = new Map((students ?? []).map((student) => [student.id, student]));
  const sourceLessons = buildSourceLessons(students, sourcePlan);
  const entries = [];

  for (const sourceLesson of sourceLessons) {
    const student = studentsById.get(sourceLesson.studentId);

    if (!student) {
      continue;
    }

    if (student.status !== 'active') {
      continue;
    }

    if (sourceLesson.weekday !== todayInfo.weekday || !knownWeekdays.has(sourceLesson.weekday)) {
      continue;
    }

    const id = createDailyLessonId(todayInfo.date, student.id, sourceLesson);
    const log = logsById.get(id);

    entries.push({
      id,
      date: todayInfo.date,
      weekday: todayInfo.weekday,
      studentId: student.id,
      student,
      regularLessonId: sourceLesson.kind === SCHEDULE_LESSON_KINDS.regular ? sourceLesson.id ?? '' : '',
      sourceLessonId: sourceLesson.id ?? '',
      startTime: sourceLesson.startTime,
      durationMinutes: Number(student.defaultLessonDurationMinutes || 60),
      kind: sourceLesson.kind || SCHEDULE_LESSON_KINDS.regular,
      status: log?.status || 'planned',
      topic: log?.topic || '',
      notes: log?.notes || '',
      charged: Boolean(log?.charged),
      doneAt: log?.doneAt || '',
      chargedAt: log?.chargedAt || '',
    });
  }

  return entries.sort((first, second) => {
    const timeCompare = first.startTime.localeCompare(second.startTime);
    return timeCompare || first.student.fullName.localeCompare(second.student.fullName, 'ru');
  });
}

export function getMoscowDateInfo(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateParts = {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
  };

  return {
    ...dateParts,
    date: formatIsoDate(dateParts),
    weekday: getWeekdayKey(dateParts),
  };
}

export function createDailyLessonId(date, studentId, regularLesson) {
  const lessonKey = regularLesson.id || `${regularLesson.weekday}_${regularLesson.startTime}`;
  return `${date}_${studentId}_${String(lessonKey).replace(/[^a-zа-яё0-9_-]+/gi, '-')}`;
}

function buildSourceLessons(students, sourcePlan) {
  const cardLessons = buildCardLessons(students);

  if (sourcePlan?.type !== SCHEDULE_PLAN_TYPES.currentWeek) {
    return cardLessons;
  }

  const cardLessonIds = new Set(cardLessons.map((lesson) => lesson.id));
  const hiddenRegularLessonIds = new Set(sourcePlan.hiddenRegularLessonIds ?? []);
  const localLessons = sourcePlan.lessons ?? [];
  const regularOverrides = new Map(
    localLessons
      .filter((lesson) => lesson.kind === SCHEDULE_LESSON_KINDS.regular && cardLessonIds.has(lesson.id))
      .map((lesson) => [lesson.id, lesson]),
  );

  return [
    ...cardLessons
      .filter((lesson) => !hiddenRegularLessonIds.has(lesson.id))
      .map((lesson) => regularOverrides.get(lesson.id) ?? lesson),
    ...localLessons.filter(
      (lesson) =>
        lesson.kind === SCHEDULE_LESSON_KINDS.oneOff ||
        (lesson.kind === SCHEDULE_LESSON_KINDS.regular && !cardLessonIds.has(lesson.id) && lesson.scope === 'week'),
    ),
  ];
}

function buildCardLessons(students) {
  const lessons = [];

  for (const student of students ?? []) {
    for (const lesson of student.regularLessons ?? []) {
      lessons.push({
        id: lesson.id || `${student.id}_${lesson.weekday}_${lesson.startTime}`,
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

function getWeekdayKey(dateParts) {
  const dayNumber = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day) / MS_PER_DAY;
  return weekdayKeys[new Date(dayNumber * MS_PER_DAY).getUTCDay()];
}

function formatIsoDate(date) {
  return [date.year, date.month, date.day].map((part) => String(part).padStart(2, '0')).join('-');
}
