import { createStudent, normalizeStudentStatus, updateStudent } from '../domain/student.js';
import { getLocalDeviceId } from '../data/device.js';
import { addChangeLog } from '../data/changeLogRepository.js';
import * as repository from '../data/studentRepository.js';

export async function listStudents() {
  return (await repository.listStudents()).map(normalizeStudent);
}

export async function getStudent(id) {
  const student = await repository.getStudent(id);
  return student ? normalizeStudent(student) : null;
}

export async function createStudentProfile(input) {
  const student = createStudent(input, getLocalDeviceId());
  await repository.saveStudent(student);
  await addChangeLog({
    entityType: 'student',
    entityId: student.id,
    changeType: 'create',
    after: student,
  });

  return student;
}

function normalizeStudent(student) {
  const status = normalizeStudentStatus(student.status);
  return status === student.status ? student : { ...student, status };
}

export async function updateStudentProfile(id, input) {
  const existingStudent = await repository.getStudent(id);

  if (!existingStudent) {
    throw new Error('Ученик не найден.');
  }

  const student = updateStudent(existingStudent, input);
  await repository.saveStudent(student);
  await addChangeLog({
    entityType: 'student',
    entityId: student.id,
    changeType: 'update',
    before: existingStudent,
    after: student,
  });

  return student;
}

export async function updateStudentRegularLessons(id, regularLessons) {
  const existingStudent = await repository.getStudent(id);

  if (!existingStudent) {
    throw new Error('Ученик не найден.');
  }

  const student = updateStudent(existingStudent, {
    ...existingStudent,
    regularLessons,
  });
  await repository.saveStudent(student);
  await addChangeLog({
    entityType: 'student',
    entityId: student.id,
    changeType: 'update_regular_lessons',
    before: existingStudent,
    after: student,
  });

  return normalizeStudent(student);
}

export async function deleteStudentProfile(id) {
  const existingStudent = await repository.getStudent(id);

  if (!existingStudent) {
    return;
  }

  await repository.deleteStudent(id);
  await addChangeLog({
    entityType: 'student',
    entityId: id,
    changeType: 'delete',
    before: existingStudent,
  });
}
