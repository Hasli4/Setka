export const STUDENT_STATUSES = Object.freeze([
  { value: 'active', label: 'Активен' },
  { value: 'paused', label: 'Пауза' },
  { value: 'completed', label: 'Завершил курс' },
]);

export const LESSON_STATUSES = Object.freeze([
  { value: 'planned', label: 'Запланирован' },
  { value: 'done', label: 'Проведен' },
  { value: 'not_done', label: 'Не проведен' },
  { value: 'cancelled', label: 'Отменен' },
  { value: 'moved', label: 'Перенесен' },
  { value: 'frozen', label: 'Заморожен' },
  { value: 'student_absent', label: 'Пропуск ученика' },
  { value: 'teacher_absent', label: 'Пропуск преподавателя' },
]);

export function getStatusLabel(statuses, value) {
  return statuses.find((status) => status.value === value)?.label ?? value;
}
