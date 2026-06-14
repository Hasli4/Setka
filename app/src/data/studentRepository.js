import { deleteStoreItem, getStoreItem, listStore, putStoreItem } from './apiClient.js';
import { STORES } from './schema.js';

export async function listStudents() {
  const students = await listStore(STORES.students);

  return students.sort((first, second) => {
    const nameCompare = first.fullName.localeCompare(second.fullName, 'ru');
    return nameCompare || second.updatedAt.localeCompare(first.updatedAt);
  });
}

export async function getStudent(id) {
  return getStoreItem(STORES.students, id);
}

export async function saveStudent(student) {
  await putStoreItem(STORES.students, student);
}

export async function deleteStudent(id) {
  await deleteStoreItem(STORES.students, id);
}
