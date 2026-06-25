import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentMessage, toInstrumentalDirection, toInstrumentalName } from '../src/domain/paymentMessage.js';

describe('payment message', () => {
  it('inflects common student names to instrumental case', () => {
    assert.equal(toInstrumentalName('Марк'), 'Марком');
    assert.equal(toInstrumentalName('Миша'), 'Мишей');
    assert.equal(toInstrumentalName('Данила'), 'Данилой');
    assert.equal(toInstrumentalName('Данил'), 'Данилом');
  });

  it('inflects known directions where appropriate', () => {
    assert.equal(toInstrumentalDirection('WEB-разработка'), 'WEB-разработкой');
    assert.equal(toInstrumentalDirection('Python'), 'Python');
    assert.equal(toInstrumentalDirection('Roblox Studio'), 'Roblox Studio');
  });

  it('builds the subscription payment message', () => {
    const message = buildPaymentMessage({
      fullName: 'Марк Иванов',
      direction: 'WEB-разработка',
      billing: {
        lessonsPerSubscription: 8,
        remainingLessons: 1,
      },
    });

    assert.equal(
      message,
      [
        'Здравствуйте! За предыдущие занятия с Марком продолжили работу с WEB-разработкой.',
        '',
        '',
        'У вас в абонементе осталось 1 занятие, подскажите, также будете 8 занятий оплачивать?',
      ].join('\n'),
    );
  });

  it('uses correct remaining lesson wording in the payment question', () => {
    assert.match(
      buildPaymentMessage({
        fullName: 'Марк Иванов',
        direction: 'Python',
        billing: {
          lessonsPerSubscription: 4,
          remainingLessons: 2,
        },
      }),
      /осталось 2 занятия/,
    );
    assert.match(
      buildPaymentMessage({
        fullName: 'Марк Иванов',
        direction: 'Python',
        billing: {
          lessonsPerSubscription: 4,
          remainingLessons: 0,
        },
      }),
      /осталось 0 занятий/,
    );
  });

  it('uses the new subscription wording when the current balance is negative', () => {
    const message = buildPaymentMessage({
      fullName: 'Марк Иванов',
      direction: 'Python',
      billing: {
        lessonsPerSubscription: 4,
        remainingLessons: -1,
      },
    });

    assert.match(message, /Предыдущее занятие было первым в новом абонементе/);
    assert.match(message, /4 занятия оплачивать/);
  });
});
