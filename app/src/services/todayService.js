import { updateStudent } from '../domain/student.js';
import { buildCurrentDayLessonEntries, getMoscowDateInfo } from '../domain/today.js';
import { SCHEDULE_PLAN_TYPES } from '../domain/schedule.js';
import { addChangeLog } from '../data/changeLogRepository.js';
import * as lessonRepository from '../data/lessonRepository.js';
import * as studentRepository from '../data/studentRepository.js';
import * as scheduleService from './scheduleService.js';

export async function listCurrentDayLessons(students, today = new Date()) {
  const todayInfo = getMoscowDateInfo(today);
  const lessonLogs = await lessonRepository.listLessonsByDate(todayInfo.date);
  const scheduleWorkspace = await scheduleService.getScheduleWorkspace();
  const currentWeekPlan =
    scheduleWorkspace.plans.find((plan) => plan.type === SCHEDULE_PLAN_TYPES.currentWeek) ?? null;

  return buildCurrentDayLessonEntries(students, lessonLogs, today, currentWeekPlan);
}

export async function saveDailyLessonDetails(entry, details) {
  const existingLesson = await lessonRepository.getLesson(entry.id);
  const lesson = buildLessonRecord(entry, existingLesson, {
    topic: details.topic,
    notes: details.notes,
  });

  await lessonRepository.saveLesson(lesson);
  await addChangeLog({
    entityType: 'lesson',
    entityId: lesson.id,
    changeType: 'update_details',
    before: existingLesson,
    after: lesson,
  });

  return lesson;
}

export async function markDailyLessonDone(entry, details = {}) {
  const existingLesson = await lessonRepository.getLesson(entry.id);
  let updatedStudent = null;
  let chargedAt = existingLesson?.chargedAt || '';

  if (!existingLesson?.charged) {
    updatedStudent = await chargeStudentLesson(entry.studentId);
    chargedAt = new Date().toISOString();
  }

  const lesson = buildLessonRecord(entry, existingLesson, {
    status: 'done',
    topic: details.topic,
    notes: details.notes,
    charged: true,
    chargedAt,
    doneAt: existingLesson?.doneAt || new Date().toISOString(),
  });

  await lessonRepository.saveLesson(lesson);
  await addChangeLog({
    entityType: 'lesson',
    entityId: lesson.id,
    changeType: 'mark_done',
    before: existingLesson,
    after: lesson,
  });

  return { lesson, updatedStudent };
}

async function chargeStudentLesson(studentId) {
  const existingStudent = await studentRepository.getStudent(studentId);

  if (!existingStudent) {
    throw new Error('Ученик не найден.');
  }

  const remainingLessons = Number(existingStudent.billing?.remainingLessons || 0) - 1;
  const updatedStudent = updateStudent(existingStudent, {
    ...existingStudent,
    billing: {
      ...existingStudent.billing,
      remainingLessons,
    },
  });

  await studentRepository.saveStudent(updatedStudent);
  await addChangeLog({
    entityType: 'student',
    entityId: updatedStudent.id,
    changeType: 'charge_lesson',
    before: existingStudent,
    after: updatedStudent,
  });

  return updatedStudent;
}

function buildLessonRecord(entry, existingLesson, patch = {}) {
  const now = new Date().toISOString();

  return {
    id: entry.id,
    studentId: entry.studentId,
    regularLessonId: entry.regularLessonId,
    sourceLessonId: entry.sourceLessonId,
    kind: entry.kind,
    date: entry.date,
    weekday: entry.weekday,
    startTime: entry.startTime,
    durationMinutes: entry.durationMinutes,
    status: patch.status ?? existingLesson?.status ?? entry.status ?? 'planned',
    topic: String(patch.topic ?? existingLesson?.topic ?? entry.topic ?? ''),
    notes: String(patch.notes ?? existingLesson?.notes ?? entry.notes ?? ''),
    charged: patch.charged ?? Boolean(existingLesson?.charged),
    chargedAt: patch.chargedAt ?? existingLesson?.chargedAt ?? '',
    doneAt: patch.doneAt ?? existingLesson?.doneAt ?? '',
    createdAt: existingLesson?.createdAt ?? now,
    updatedAt: now,
  };
}
