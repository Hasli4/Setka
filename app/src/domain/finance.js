import { SCHEDULE_DAYS } from './schedule.js';

const MOSCOW_TIMEZONE = 'Europe/Moscow';
const TARGET_PAYMENT_DAY = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const weekdayKeys = Object.freeze(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const knownWeekdays = new Set(SCHEDULE_DAYS.map((day) => day.key));

export function buildIncomeForecast(students, today = new Date()) {
  const todayDate = getMoscowDate(today);
  const targetDate = getMonthlyPaymentTarget(todayDate);
  const rows = students
    .filter((student) => student.status === 'active')
    .map((student) => buildForecastRow(student, todayDate, targetDate))
    .sort(compareForecastRows);
  const dueRows = rows.filter((row) => row.needsPayment);

  return {
    today: formatIsoDate(todayDate),
    targetDate: formatIsoDate(targetDate),
    targetDay: targetDate.day,
    rows,
    dueRows,
    dueStudents: dueRows.length,
    totalDue: dueRows.reduce((sum, row) => sum + row.subscriptionPrice, 0),
  };
}

export function buildFinanceReport(students) {
  const activeStudents = students.filter((student) => student.status === 'active');
  const rows = activeStudents.map((student) => {
    const lessonsPerWeek = Array.isArray(student.regularLessons) ? student.regularLessons.length : 0;
    const singleLessonPrice = Number(student.billing?.singleLessonPrice || 0);

    return {
      student,
      lessonsPerWeek,
      singleLessonPrice,
      weeklyTotal: lessonsPerWeek * singleLessonPrice,
    };
  });
  const weeklyTotal = rows.reduce((sum, row) => sum + row.weeklyTotal, 0);
  const weeklyLessons = rows.reduce((sum, row) => sum + row.lessonsPerWeek, 0);

  return {
    rows,
    activeStudents: activeStudents.length,
    weeklyLessons,
    weeklyTotal,
    monthlyTotal: weeklyTotal * 4,
  };
}

function compareForecastRows(first, second) {
  if (first.needsPayment !== second.needsPayment) {
    return first.needsPayment ? -1 : 1;
  }

  const balanceCompare = first.projectedBalance - second.projectedBalance;

  if (balanceCompare !== 0) {
    return balanceCompare;
  }

  return studentDisplayName(first.student).localeCompare(studentDisplayName(second.student), 'ru');
}

function studentDisplayName(student) {
  return student.nickname || student.fullName || '';
}

function buildForecastRow(student, todayDate, targetDate) {
  const remainingLessons = Number(student.billing?.remainingLessons || 0);
  const subscriptionPrice = Number(student.billing?.subscriptionPrice || 0);
  const hasRegularLessons = Array.isArray(student.regularLessons) && student.regularLessons.length > 0;
  const projectedLessons = countProjectedLessons(student.regularLessons, todayDate, targetDate);
  const projectedBalance = remainingLessons - projectedLessons;

  return {
    student,
    remainingLessons,
    projectedLessons,
    projectedBalance,
    subscriptionPrice,
    needsPayment: hasRegularLessons && projectedBalance <= 0 && subscriptionPrice > 0,
  };
}

function countProjectedLessons(regularLessons, startDate, endDate) {
  const lessonsByWeekday = new Map();

  for (const lesson of regularLessons ?? []) {
    if (!knownWeekdays.has(lesson.weekday)) {
      continue;
    }

    lessonsByWeekday.set(lesson.weekday, (lessonsByWeekday.get(lesson.weekday) ?? 0) + 1);
  }

  let count = 0;
  const startDay = toDayNumber(startDate);
  const endDay = toDayNumber(endDate);

  for (let day = startDay; day <= endDay; day += 1) {
    const date = fromDayNumber(day);
    count += lessonsByWeekday.get(getWeekdayKey(date)) ?? 0;
  }

  return count;
}

function getMoscowDate(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MOSCOW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
  };
}

function getMonthlyPaymentTarget(todayDate) {
  let year = todayDate.year;
  let month = todayDate.month;
  let day = getTargetDay(year, month);
  let targetDate = { year, month, day };

  if (compareDates(todayDate, targetDate) > 0) {
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }

    day = getTargetDay(year, month);
    targetDate = { year, month, day };
  }

  return targetDate;
}

function getTargetDay(year, month) {
  return Math.min(TARGET_PAYMENT_DAY, daysInMonth(year, month));
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function compareDates(left, right) {
  return toDayNumber(left) - toDayNumber(right);
}

function toDayNumber(date) {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

function fromDayNumber(dayNumber) {
  const date = new Date(dayNumber * MS_PER_DAY);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getWeekdayKey(dateParts) {
  return weekdayKeys[new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)).getUTCDay()];
}

function formatIsoDate(date) {
  return [date.year, date.month, date.day].map((part) => String(part).padStart(2, '0')).join('-');
}
