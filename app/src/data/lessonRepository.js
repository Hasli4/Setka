import { getStoreItem, listStore, putStoreItem } from './apiClient.js';
import { STORES } from './schema.js';

export async function listLessonsByDate(date) {
  const lessons = await listStore(STORES.lessons);

  return lessons
    .filter((lesson) => lesson.date === date)
    .sort((first, second) => {
      const timeCompare = String(first.startTime || '').localeCompare(String(second.startTime || ''));
      return timeCompare || String(first.studentId || '').localeCompare(String(second.studentId || ''));
    });
}

export async function getLesson(id) {
  return getStoreItem(STORES.lessons, id);
}

export async function saveLesson(lesson) {
  await putStoreItem(STORES.lessons, lesson);
}
