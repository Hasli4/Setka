const DIRECTION_INSTRUMENTAL = Object.freeze({
  Scratch: 'Scratch',
  'WEB-разработка': 'WEB-разработкой',
  'Web-разработка': 'Web-разработкой',
  'web-разработка': 'web-разработкой',
  Python: 'Python',
  'Roblox Studio': 'Roblox Studio',
  ИИ: 'ИИ',
  EV3: 'EV3',
  Unity: 'Unity',
  Другое: 'направлением',
});

export function buildPaymentMessage(student) {
  const studentName = toInstrumentalName(getFirstName(student));
  const direction = toInstrumentalDirection(student.direction);

  return [
    `Здравствуйте! За предыдущие занятия с ${studentName} продолжили работу с ${direction}.`,
    '',
    '',
    buildPaymentQuestion(student),
  ].join('\n');
}

export function toInstrumentalName(name) {
  const value = String(name ?? '').trim();

  if (!value) {
    return 'учеником';
  }

  const lower = value.toLowerCase();
  const last = lower.at(-1);
  const previous = lower.at(-2);

  if (lower.endsWith('ша') || lower.endsWith('жа') || lower.endsWith('ча') || lower.endsWith('ща')) {
    return `${value.slice(0, -1)}ей`;
  }

  if (last === 'а') {
    return `${value.slice(0, -1)}ой`;
  }

  if (last === 'я') {
    return `${value.slice(0, -1)}ей`;
  }

  if (last === 'й') {
    return `${value.slice(0, -1)}ем`;
  }

  if (last === 'ь') {
    return `${value.slice(0, -1)}ем`;
  }

  if (last === 'ц') {
    return `${value}ем`;
  }

  if (previous === 'и' && last === 'я') {
    return `${value.slice(0, -1)}ей`;
  }

  return `${value}ом`;
}

export function toInstrumentalDirection(direction) {
  const value = String(direction ?? '').trim();

  if (!value) {
    return 'направлением';
  }

  if (DIRECTION_INSTRUMENTAL[value]) {
    return DIRECTION_INSTRUMENTAL[value];
  }

  const lower = value.toLowerCase();
  const last = lower.at(-1);

  if (last === 'а') {
    return `${value.slice(0, -1)}ой`;
  }

  if (last === 'я') {
    return `${value.slice(0, -1)}ей`;
  }

  return value;
}

function getFirstName(student) {
  return String(student.fullName || student.nickname || '').trim().split(/\s+/)[0] || student.nickname || '';
}

function formatLessonsCount(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 'столько же занятий';
  }

  return `${amount} ${lessonPlural(amount)}`;
}

function buildPaymentQuestion(student) {
  const lessonsText = formatLessonsCount(student.billing?.lessonsPerSubscription);
  const remainingLessons = Number(student.billing?.remainingLessons ?? 0);

  if (Number.isFinite(remainingLessons) && remainingLessons < 0) {
    return `Предыдущее занятие было первым в новом абонементе, подскажите, также будете ${lessonsText} оплачивать?`;
  }

  return `У вас в абонементе осталось ${formatRemainingLessons(remainingLessons)}, подскажите, также будете ${lessonsText} оплачивать?`;
}

function formatRemainingLessons(value) {
  const amount = Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString('ru-RU')} ${lessonPlural(amount)}`;
}

function lessonPlural(value) {
  const integer = Math.abs(Math.trunc(value));
  const lastTwo = integer % 100;
  const last = integer % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'занятий';
  }

  if (last === 1) {
    return 'занятие';
  }

  if (last >= 2 && last <= 4) {
    return 'занятия';
  }

  return 'занятий';
}
