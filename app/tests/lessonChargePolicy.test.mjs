import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyLessonCharge, shouldChargeLesson } from '../src/domain/lessonChargePolicy.js';

describe('lesson charge policy', () => {
  it('charges done lessons when automatic charging is enabled', () => {
    const lesson = { id: 'lesson-1', status: 'done', charged: false };
    const subscription = {
      id: 'subscription-1',
      usedLessons: 2,
      remainingLessons: 6,
    };

    const result = applyLessonCharge(lesson, subscription);

    assert.equal(result.charged, true);
    assert.equal(result.lesson.charged, true);
    assert.equal(result.subscription.usedLessons, 3);
    assert.equal(result.subscription.remainingLessons, 5);
  });

  it('does not charge cancelled, frozen, or moved lessons by default', () => {
    for (const status of ['cancelled', 'frozen', 'moved']) {
      assert.equal(shouldChargeLesson({ status, charged: false }), false);
    }
  });

  it('does not charge a lesson twice', () => {
    assert.equal(shouldChargeLesson({ status: 'done', charged: true }), false);
  });
});

