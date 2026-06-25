import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStudentStatus, validateStudentInput } from '../src/domain/student.js';

describe('student contacts', () => {
  it('normalizes contact methods into clickable links', () => {
    const student = validateStudentInput({
      fullName: 'Test Student',
      contacts: [
        { type: 'phone', label: 'Телефон', value: '+7 999 123-45-67', primary: true },
        { type: 'telegram', label: 'Telegram', value: '@setka_test' },
        { type: 'vk', label: 'VK', value: 'vk.com/setka_test' },
      ],
    });

    assert.equal(student.contacts[0].href, 'tel:+79991234567');
    assert.equal(student.contacts[0].primary, true);
    assert.equal(student.contacts[1].href, 'https://t.me/setka_test');
    assert.equal(student.contacts[2].href, 'https://vk.com/setka_test');
  });
});

describe('student direction', () => {
  it('does not persist the add-new sentinel value as a direction', () => {
    const student = validateStudentInput({
      fullName: 'Test Student',
      direction: '__add_new__',
    });

    assert.equal(student.direction, '');
  });
});

describe('student status', () => {
  it('maps legacy frozen student status to paused', () => {
    assert.equal(normalizeStudentStatus('frozen'), 'paused');
  });

  it('maps removed student statuses to active', () => {
    assert.equal(normalizeStudentStatus('new'), 'active');
    assert.equal(normalizeStudentStatus('debt'), 'active');
    assert.equal(normalizeStudentStatus('archive'), 'active');
  });
});

describe('student schedule and billing', () => {
  it('stores more than two regular Moscow-time lessons', () => {
    const student = validateStudentInput({
      fullName: 'Test Student',
      regularLessons: [
        { weekday: 'tue', startTime: '08:30' },
        { weekday: 'fri', startTime: '17' },
        { weekday: 'mon', startTime: '09:30' },
      ],
    });

    assert.deepEqual(
      student.regularLessons.map((lesson) => [lesson.weekday, lesson.startTime]),
      [
        ['tue', '08:30'],
        ['fri', '17:00'],
        ['mon', '09:30'],
      ],
    );
  });

  it('calculates a single lesson price from subscription price and lesson count', () => {
    const student = validateStudentInput({
      fullName: 'Test Student',
      billing: {
        subscriptionPrice: 8000,
        lessonsPerSubscription: 8,
      },
    });

    assert.equal(student.billing.singleLessonPrice, 1000);
  });

  it('accepts flexible subscription prices', () => {
    const student = validateStudentInput({
      fullName: 'Test Student',
      billing: {
        subscriptionPrice: '750',
        lessonsPerSubscription: 1,
      },
    });

    assert.equal(student.billing.subscriptionPrice, 750);
    assert.equal(student.billing.singleLessonPrice, 750);
  });

  it('stores a manual lesson balance including negative values', () => {
    const student = validateStudentInput({
      fullName: 'Test Student',
      billing: {
        remainingLessons: '-1,5',
      },
    });

    assert.equal(student.billing.remainingLessons, -1.5);
  });
});
