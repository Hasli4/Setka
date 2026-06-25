import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIncomeForecast } from '../src/domain/finance.js';

describe('income forecast', () => {
  it('adds active students whose subscription ends before the 30th', () => {
    const forecast = buildIncomeForecast(
      [
        {
          fullName: 'Mark',
          status: 'active',
          regularLessons: [
            { weekday: 'mon', startTime: '10:00' },
            { weekday: 'wed', startTime: '10:00' },
            { weekday: 'fri', startTime: '10:00' },
          ],
          billing: {
            remainingLessons: 2,
            subscriptionPrice: 6000,
          },
        },
      ],
      new Date('2026-06-21T09:00:00Z'),
    );

    assert.equal(forecast.today, '2026-06-21');
    assert.equal(forecast.targetDate, '2026-06-30');
    assert.equal(forecast.totalDue, 6000);
    assert.equal(forecast.dueStudents, 1);
    assert.equal(forecast.rows[0].projectedLessons, 4);
    assert.equal(forecast.rows[0].projectedBalance, -2);
  });

  it('ignores paused students and active students with enough remaining lessons', () => {
    const forecast = buildIncomeForecast(
      [
        {
          fullName: 'Enough Lessons',
          status: 'active',
          regularLessons: [{ weekday: 'mon', startTime: '10:00' }],
          billing: {
            remainingLessons: 5,
            subscriptionPrice: 6000,
          },
        },
        {
          fullName: 'Paused Student',
          status: 'paused',
          regularLessons: [{ weekday: 'mon', startTime: '10:00' }],
          billing: {
            remainingLessons: 0,
            subscriptionPrice: 7000,
          },
        },
      ],
      new Date('2026-06-21T09:00:00Z'),
    );

    assert.equal(forecast.totalDue, 0);
    assert.equal(forecast.dueStudents, 0);
    assert.equal(forecast.rows.length, 1);
  });

  it('adds active regular students whose subscription is already empty', () => {
    const forecast = buildIncomeForecast(
      [
        {
          fullName: 'Empty Balance',
          status: 'active',
          regularLessons: [{ weekday: 'sun', startTime: '10:00' }],
          billing: {
            remainingLessons: 0,
            subscriptionPrice: 5000,
          },
        },
      ],
      new Date('2026-06-30T09:00:00Z'),
    );

    assert.equal(forecast.targetDate, '2026-06-30');
    assert.equal(forecast.totalDue, 5000);
    assert.equal(forecast.dueStudents, 1);
  });

  it('uses the next month 30th when the current month target has passed', () => {
    const forecast = buildIncomeForecast([], new Date('2026-07-31T09:00:00Z'));

    assert.equal(forecast.targetDate, '2026-08-30');
  });

  it('sorts payment forecast rows by payment urgency first', () => {
    const forecast = buildIncomeForecast(
      [
        {
          fullName: 'With Reserve',
          status: 'active',
          regularLessons: [{ weekday: 'mon', startTime: '10:00' }],
          billing: {
            remainingLessons: 8,
            subscriptionPrice: 6000,
          },
        },
        {
          fullName: 'Needs Payment',
          status: 'active',
          regularLessons: [{ weekday: 'mon', startTime: '11:00' }],
          billing: {
            remainingLessons: 0,
            subscriptionPrice: 7000,
          },
        },
        {
          fullName: 'Small Reserve',
          status: 'active',
          regularLessons: [{ weekday: 'mon', startTime: '12:00' }],
          billing: {
            remainingLessons: 2,
            subscriptionPrice: 5000,
          },
        },
      ],
      new Date('2026-06-21T09:00:00Z'),
    );

    assert.deepEqual(
      forecast.rows.map((row) => row.student.fullName),
      ['Needs Payment', 'Small Reserve', 'With Reserve'],
    );
  });
});
