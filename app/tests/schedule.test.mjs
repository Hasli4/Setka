import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignStudentToSlot,
  createSchedulePlan,
  moveAssignment,
  SCHEDULE_DAYS,
  togglePaintedSlot,
} from '../src/domain/schedule.js';
import { buildScheduleExportHtml } from '../src/services/scheduleExportService.js';

describe('schedule domain', () => {
  it('starts the week from Monday', () => {
    assert.deepEqual(
      SCHEDULE_DAYS.map((day) => day.key),
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    );
  });

  it('assigns and moves a student by id', () => {
    const plan = createSchedulePlan('Test plan');
    const assigned = assignStudentToSlot(plan, 'tue_8', 'student-1');
    const moved = moveAssignment(assigned, 'tue_8', 'wed_9');

    assert.equal(assigned.assignments.tue_8, 'student-1');
    assert.equal(moved.assignments.tue_8, undefined);
    assert.equal(moved.assignments.wed_9, 'student-1');
  });

  it('marks empty slots and clears the mark when toggled again', () => {
    const plan = createSchedulePlan('Test plan');
    const painted = togglePaintedSlot(plan, 'tue_8', 'green');
    const cleared = togglePaintedSlot(painted, 'tue_8', 'green');

    assert.equal(painted.painted.tue_8, 'green');
    assert.equal(cleared.painted.tue_8, undefined);
  });
});

describe('schedule export', () => {
  it('hides student names when plan hideNames is enabled', () => {
    const plan = assignStudentToSlot(
      {
        ...createSchedulePlan('Public plan'),
        hideNames: true,
      },
      'tue_8',
      'student-1',
    );

    const html = buildScheduleExportHtml([plan], [{ id: 'student-1', fullName: 'Иван Иванов' }]);

    assert.match(html, /Занято/);
    assert.doesNotMatch(html, /Иван Иванов/);
  });

  it('uses student nickname in exported schedule when it exists', () => {
    const plan = assignStudentToSlot(createSchedulePlan('Public plan'), 'tue_8', 'student-1');

    const html = buildScheduleExportHtml(
      [plan],
      [{ id: 'student-1', fullName: 'Иван Иванович Длинная Фамилия', nickname: 'Ваня' }],
    );

    assert.match(html, /Ваня/);
    assert.doesNotMatch(html, /Иван Иванович Длинная Фамилия/);
  });

  it('exports regular lessons from student cards', () => {
    const plan = createSchedulePlan('Public plan');
    const html = buildScheduleExportHtml(
      [plan],
      [{ id: 'student-1', fullName: 'Иван Иванов', nickname: 'Ваня', regularLessons: [{ weekday: 'tue', startTime: '08:00' }] }],
    );

    assert.match(html, /Ваня/);
  });
});
