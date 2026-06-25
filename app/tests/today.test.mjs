import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULE_LESSON_KINDS, SCHEDULE_PLAN_TYPES } from '../src/domain/schedule.js';
import { buildCurrentDayLessonEntries } from '../src/domain/today.js';

describe('current day lessons', () => {
  it('builds today lessons from active student regular lessons', () => {
    const entries = buildCurrentDayLessonEntries(
      [
        {
          id: 'student-1',
          fullName: 'Марк',
          status: 'active',
          defaultLessonDurationMinutes: 60,
          regularLessons: [{ id: 'lesson-1', weekday: 'sun', startTime: '10:00' }],
        },
        {
          id: 'student-2',
          fullName: 'Пауза',
          status: 'paused',
          defaultLessonDurationMinutes: 60,
          regularLessons: [{ id: 'lesson-2', weekday: 'sun', startTime: '11:00' }],
        },
      ],
      [],
      new Date('2026-06-21T09:00:00Z'),
    );

    assert.equal(entries.length, 1);
    assert.equal(entries[0].studentId, 'student-1');
    assert.equal(entries[0].startTime, '10:00');
  });

  it('uses current week overrides and one-off lessons', () => {
    const entries = buildCurrentDayLessonEntries(
      [
        {
          id: 'student-1',
          fullName: 'Марк',
          status: 'active',
          defaultLessonDurationMinutes: 60,
          regularLessons: [{ id: 'regular-1', weekday: 'sun', startTime: '10:00' }],
        },
        {
          id: 'student-2',
          fullName: 'Данила',
          status: 'active',
          defaultLessonDurationMinutes: 90,
          regularLessons: [],
        },
      ],
      [],
      new Date('2026-06-21T09:00:00Z'),
      {
        type: SCHEDULE_PLAN_TYPES.currentWeek,
        lessons: [
          {
            id: 'regular-1',
            studentId: 'student-1',
            weekday: 'sun',
            startTime: '12:00',
            kind: SCHEDULE_LESSON_KINDS.regular,
          },
          {
            id: 'one-off-1',
            studentId: 'student-2',
            weekday: 'sun',
            startTime: '09:00',
            kind: SCHEDULE_LESSON_KINDS.oneOff,
          },
        ],
        hiddenRegularLessonIds: [],
      },
    );

    assert.deepEqual(
      entries.map((entry) => [entry.studentId, entry.startTime, entry.kind]),
      [
        ['student-2', '09:00', SCHEDULE_LESSON_KINDS.oneOff],
        ['student-1', '12:00', SCHEDULE_LESSON_KINDS.regular],
      ],
    );
  });

  it('applies saved lesson status and notes', () => {
    const entries = buildCurrentDayLessonEntries(
      [
        {
          id: 'student-1',
          fullName: 'Марк',
          status: 'active',
          defaultLessonDurationMinutes: 60,
          regularLessons: [{ id: 'lesson-1', weekday: 'sun', startTime: '10:00' }],
        },
      ],
      [
        {
          id: '2026-06-21_student-1_lesson-1',
          date: '2026-06-21',
          status: 'done',
          charged: true,
          topic: 'Циклы',
          notes: 'Повторить условия',
        },
      ],
      new Date('2026-06-21T09:00:00Z'),
    );

    assert.equal(entries[0].status, 'done');
    assert.equal(entries[0].charged, true);
    assert.equal(entries[0].topic, 'Циклы');
    assert.equal(entries[0].notes, 'Повторить условия');
  });
});
