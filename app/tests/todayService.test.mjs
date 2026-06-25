import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markDailyLessonDone } from '../src/services/todayService.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('today service', () => {
  it('charges a completed lesson only once', async () => {
    const stores = {
      students: [
        {
          id: 'student-1',
          fullName: 'Марк',
          nickname: '',
          direction: 'Python',
          status: 'active',
          defaultLessonDurationMinutes: 60,
          startedAt: '',
          regularLessons: [{ id: 'lesson-1', weekday: 'sun', startTime: '10:00' }],
          billing: {
            subscriptionPrice: 8000,
            lessonsPerSubscription: 8,
            remainingLessons: 2,
            singleLessonPrice: 1000,
          },
          contacts: [],
          notes: '',
          createdAt: '2026-06-21T00:00:00.000Z',
          updatedAt: '2026-06-21T00:00:00.000Z',
          revision: 1,
          sourceDeviceId: 'test',
          syncState: 'pending',
        },
      ],
      lessons: [],
      changeLogs: [],
    };
    globalThis.fetch = createStoreFetch(stores);

    const entry = {
      id: '2026-06-21_student-1_lesson-1',
      date: '2026-06-21',
      weekday: 'sun',
      studentId: 'student-1',
      regularLessonId: 'lesson-1',
      sourceLessonId: 'lesson-1',
      startTime: '10:00',
      durationMinutes: 60,
      kind: 'regular',
      status: 'planned',
      topic: '',
      notes: '',
      charged: false,
    };

    await markDailyLessonDone(entry, { topic: 'Циклы', notes: 'Домашка' });
    assert.equal(stores.students[0].billing.remainingLessons, 1);
    assert.equal(stores.lessons[0].charged, true);
    assert.equal(stores.lessons[0].topic, 'Циклы');

    await markDailyLessonDone(entry, { topic: 'Циклы', notes: 'Домашка' });
    assert.equal(stores.students[0].billing.remainingLessons, 1);
    assert.equal(stores.lessons.length, 1);
  });
});

function createStoreFetch(stores) {
  return async (path, options = {}) => {
    const url = String(path);
    const method = options.method ?? 'GET';
    const segments = url.split('/').filter(Boolean);

    if (segments[0] !== 'api' || segments[1] !== 'stores') {
      return jsonResponse(404, { error: 'Not found' });
    }

    const storeName = decodeURIComponent(segments[2]);
    const itemId = segments[3] ? decodeURIComponent(segments.slice(3).join('/')) : null;
    stores[storeName] ??= [];

    if (method === 'GET' && itemId) {
      const item = stores[storeName].find((candidate) => getKey(storeName, candidate) === itemId);
      return item ? jsonResponse(200, { item }) : jsonResponse(404, { error: 'Item not found.' });
    }

    if (method === 'PUT' && itemId) {
      const { item } = JSON.parse(options.body || '{}');
      const index = stores[storeName].findIndex((candidate) => getKey(storeName, candidate) === itemId);

      if (index >= 0) {
        stores[storeName][index] = item;
      } else {
        stores[storeName].push(item);
      }

      return jsonResponse(200, { item });
    }

    return jsonResponse(405, { error: 'Method not allowed.' });
  };
}

function getKey(storeName, item) {
  return storeName === 'appSettings' ? item.key : item.id;
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}
