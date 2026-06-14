import { STUDENT_STATUSES } from '../domain/statuses.js';
import { SCHEDULE_DAYS, SCHEDULE_TIMES } from '../domain/schedule.js';
import { createElement } from './dom.js';

const DEFAULT_DIRECTIONS = Object.freeze([
  'Scratch',
  'WEB-разработка',
  'Python',
  'Roblox Studio',
  'ИИ',
  'EV3',
  'Unity',
  'Другое',
]);
const ADD_DIRECTION_VALUE = '__add_new__';

export function openStudentForm({ title, student, onSubmit }) {
  const dialog = createElement('dialog', { className: 'dialog' });
  const form = createElement('form', { className: 'student-form', attrs: { method: 'dialog' } });
  const heading = createElement('h2', { text: title });
  const error = createElement('p', { className: 'form-error', attrs: { role: 'alert' } });

  const fullName = createInput('ФИО', 'fullName', student?.fullName ?? '', true);
  const nickname = createInput('Псевдоним', 'nickname', student?.nickname ?? '');
  const direction = createDirectionSelect(student?.direction ?? '');
  const duration = createInput(
    'Длительность занятия, минут',
    'defaultLessonDurationMinutes',
    String(student?.defaultLessonDurationMinutes ?? 60),
    true,
    'number',
  );
  duration.input.min = '15';
  duration.input.step = '5';

  const startedAt = createInput('Дата старта', 'startedAt', student?.startedAt ?? '', false, 'date');
  const status = createStatusSelect(student?.status ?? 'new');
  const regularLessons = createRegularLessonsFields(student?.regularLessons ?? []);
  const billing = createBillingFields(student?.billing ?? {});
  const contacts = createContactsFields(student?.contacts ?? []);
  const notes = createTextarea('Заметки', 'notes', student?.notes ?? '');

  const actions = createElement('div', {
    className: 'form-actions',
    children: [
      createElement('button', { className: 'secondary-button', text: 'Отмена', attrs: { type: 'button' } }),
      createElement('button', { className: 'primary-button', text: 'Сохранить', attrs: { type: 'submit' } }),
    ],
  });

  actions.firstElementChild.addEventListener('click', () => dialog.close());

  form.append(
    heading,
    error,
    fullName.field,
    nickname.field,
    direction.field,
    status.field,
    duration.field,
    startedAt.field,
    regularLessons.field,
    billing.field,
    contacts.field,
    notes.field,
    actions,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';

    try {
      await onSubmit({
        fullName: fullName.input.value,
        nickname: nickname.input.value,
        direction: direction.getValue(),
        status: status.input.value,
        defaultLessonDurationMinutes: duration.input.value,
        startedAt: startedAt.input.value,
        regularLessons: regularLessons.getRegularLessons(),
        billing: billing.getBilling(),
        contacts: contacts.getContacts(),
        notes: notes.input.value,
      });

      dialog.close();
    } catch (formError) {
      error.textContent = formError.message;
    }
  });

  dialog.append(form);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  fullName.input.focus();
}

function createDirectionSelect(value) {
  const initialValue = value === ADD_DIRECTION_VALUE ? '' : value;
  const input = createElement('select', { attrs: { name: 'direction', 'aria-label': 'Направление' } });
  const customInput = createElement('input', {
    className: 'direction-custom-input',
    attrs: {
      type: 'text',
      'aria-label': 'Новое направление',
      placeholder: 'Введите новое направление',
      hidden: 'hidden',
    },
  });
  const normalizedValue = DEFAULT_DIRECTIONS.includes(initialValue) || !initialValue ? initialValue : 'custom_existing';

  input.append(createElement('option', { text: 'Выберите направление', attrs: { value: '' } }));

  for (const direction of DEFAULT_DIRECTIONS) {
    const option = createElement('option', { text: direction, attrs: { value: direction } });
    option.selected = direction === initialValue;
    input.append(option);
  }

  if (normalizedValue === 'custom_existing') {
    const customOption = createElement('option', { text: initialValue, attrs: { value: initialValue } });
    customOption.selected = true;
    input.append(customOption);
  }

  input.append(createElement('option', { text: '+ добавить новое', attrs: { value: ADD_DIRECTION_VALUE } }));

  input.addEventListener('change', () => {
    if (input.value !== ADD_DIRECTION_VALUE) {
      customInput.hidden = true;
      customInput.value = '';
      return;
    }

    customInput.hidden = false;
    customInput.focus();
  });

  const field = createElement('div', {
    className: 'field direction-field',
    children: [createElement('span', { text: 'Направление' }), input, customInput],
  });

  return {
    field,
    input,
    getValue() {
      if (input.value !== ADD_DIRECTION_VALUE) {
        return input.value;
      }

      return customInput.value.trim();
    },
  };
}

function createInput(labelText, name, value, required = false, type = 'text') {
  const input = createElement('input', {
    attrs: {
      name,
      type,
      value,
      required: required ? 'required' : undefined,
    },
  });

  const field = createElement('label', {
    className: 'field',
    children: [createElement('span', { text: labelText }), input],
  });

  return { field, input };
}

function createStatusSelect(value) {
  const input = createElement('select', { attrs: { name: 'status' } });

  for (const status of STUDENT_STATUSES) {
    const option = createElement('option', {
      text: status.label,
      attrs: { value: status.value },
    });

    option.selected = status.value === value;
    input.append(option);
  }

  const field = createElement('label', {
    className: 'field',
    children: [createElement('span', { text: 'Статус' }), input],
  });

  return { field, input };
}

function createRegularLessonsFields(regularLessons) {
  const list = createElement('div', { className: 'regular-lessons-list' });
  const addButton = createElement('button', {
    className: 'secondary-button compact-button',
    text: '+ Добавить второе занятие',
    attrs: { type: 'button' },
  });

  function addLessonRow(lesson = {}) {
    if (list.children.length >= 2) {
      return;
    }

    const weekday = createSelectField(
      'День недели',
      'lessonWeekday',
      [{ value: '', label: 'Не выбрано' }, ...SCHEDULE_DAYS.map((day) => ({ value: day.key, label: day.label }))],
      lesson.weekday ?? '',
    );
    const startTime = createSelectField(
      'Время МСК',
      'lessonStartTime',
      [{ value: '', label: 'Не выбрано' }, ...SCHEDULE_TIMES.map((time) => ({ value: time, label: time }))],
      lesson.startTime ?? '',
    );
    const remove = createElement('button', {
      className: 'danger-button compact-button',
      text: 'Убрать',
      attrs: { type: 'button' },
    });
    const row = createElement('div', {
      className: 'regular-lesson-row',
      children: [weekday.field, startTime.field, remove],
    });

    row.dataset.lessonId = lesson.id ?? '';
    remove.addEventListener('click', () => {
      row.remove();

      if (list.children.length === 0) {
        addLessonRow();
      }

      updateAddButton();
    });
    list.append(row);
    updateAddButton();
  }

  function updateAddButton() {
    addButton.hidden = list.children.length >= 2;
  }

  for (const lesson of regularLessons) {
    addLessonRow(lesson);
  }

  if (list.children.length === 0) {
    addLessonRow();
  }

  addButton.addEventListener('click', () => addLessonRow());

  const field = createElement('section', {
    className: 'form-section field-wide',
    children: [
      createElement('h3', { text: 'Регулярные занятия (МСК)' }),
      createElement('p', {
        className: 'muted',
        text: 'Укажите одно или два постоянных занятия в московском часовом поясе. Расписание обновится автоматически.',
      }),
      list,
      addButton,
    ],
  });

  return {
    field,
    getRegularLessons() {
      return [...list.querySelectorAll('.regular-lesson-row')]
        .map((row) => ({
          id: row.dataset.lessonId,
          weekday: row.querySelector('[name="lessonWeekday"]').value,
          startTime: row.querySelector('[name="lessonStartTime"]').value,
        }))
        .filter((lesson) => lesson.weekday && lesson.startTime);
    },
  };
}

function createBillingFields(billing) {
  const subscriptionPrice = createInput(
    'Стоимость абонемента',
    'subscriptionPrice',
    String(billing.subscriptionPrice || ''),
    false,
    'number',
  );
  const lessonsPerSubscription = createInput(
    'Занятий в абонементе',
    'lessonsPerSubscription',
    String(billing.lessonsPerSubscription || ''),
    false,
    'number',
  );
  const singleLessonPrice = createInput(
    'Стоимость 1 занятия',
    'singleLessonPrice',
    String(billing.singleLessonPrice || ''),
    false,
    'number',
  );

  subscriptionPrice.input.min = '0';
  subscriptionPrice.input.step = '100';
  lessonsPerSubscription.input.min = '0';
  lessonsPerSubscription.input.step = '1';
  singleLessonPrice.input.readOnly = true;

  function updateSingleLessonPrice() {
    const price = Number(subscriptionPrice.input.value || 0);
    const lessons = Number(lessonsPerSubscription.input.value || 0);
    const value = price > 0 && lessons > 0 ? Math.round((price / lessons) * 100) / 100 : '';
    singleLessonPrice.input.value = value ? String(value) : '';
  }

  subscriptionPrice.input.addEventListener('input', updateSingleLessonPrice);
  lessonsPerSubscription.input.addEventListener('input', updateSingleLessonPrice);

  const field = createElement('section', {
    className: 'form-section field-wide',
    children: [
      createElement('h3', { text: 'Абонемент' }),
      createElement('div', {
        className: 'billing-grid',
        children: [subscriptionPrice.field, lessonsPerSubscription.field, singleLessonPrice.field],
      }),
    ],
  });

  updateSingleLessonPrice();

  return {
    field,
    getBilling() {
      return {
        subscriptionPrice: subscriptionPrice.input.value,
        lessonsPerSubscription: lessonsPerSubscription.input.value,
      };
    },
  };
}

function createSelectField(labelText, name, options, value) {
  const input = createElement('select', { attrs: { name } });

  for (const option of options) {
    const optionElement = createElement('option', { text: option.label, attrs: { value: option.value } });
    optionElement.selected = option.value === value;
    input.append(optionElement);
  }

  const field = createElement('label', {
    className: 'field',
    children: [createElement('span', { text: labelText }), input],
  });

  return { field, input };
}

function createContactsFields(contacts) {
  const phoneContact = contacts.find((contact) => contact.type === 'phone') ?? {};
  const telegramContact = contacts.find((contact) => contact.type === 'telegram') ?? {};
  const vkContact = contacts.find((contact) => contact.type === 'vk') ?? {};
  const extraContacts = contacts.filter((contact) => !['phone', 'telegram', 'vk'].includes(contact.type));

  const phone = createInput('Телефон (основной)', 'phone', phoneContact.value ?? '', false, 'tel');
  const telegram = createInput('Telegram', 'telegram', telegramContact.value ?? '', false, 'text');
  const vk = createInput('VK', 'vk', vkContact.value ?? '', false, 'text');
  const extraList = createElement('div', { className: 'extra-contacts' });
  const addButton = createElement('button', {
    className: 'secondary-button compact-button',
    text: '+ Добавить способ связи',
    attrs: { type: 'button' },
  });

  function addExtraContact(contact = {}) {
    const label = createInput('Название', 'extraContactLabel', contact.label ?? '', false, 'text');
    const value = createInput('Ссылка или контакт', 'extraContactValue', contact.value ?? '', false, 'text');
    const remove = createElement('button', {
      className: 'danger-button compact-button',
      text: 'Удалить',
      attrs: { type: 'button' },
    });
    const row = createElement('div', {
      className: 'extra-contact-row',
      children: [label.field, value.field, remove],
    });

    row.dataset.contactId = contact.id ?? '';
    remove.addEventListener('click', () => row.remove());
    extraList.append(row);
  }

  for (const contact of extraContacts) {
    addExtraContact(contact);
  }

  addButton.addEventListener('click', () => addExtraContact());

  const field = createElement('section', {
    className: 'contacts-section field-wide',
    children: [
      createElement('h3', { text: 'Способ связи' }),
      createElement('p', {
        className: 'muted',
        text: 'Контакты будут открываться как ссылки: телефон, Telegram, VK или любые дополнительные способы связи.',
      }),
      createElement('div', {
        className: 'contacts-grid',
        children: [phone.field, telegram.field, vk.field],
      }),
      extraList,
      addButton,
    ],
  });

  return {
    field,
    getContacts() {
      const result = [
        buildContact(phoneContact.id, 'phone', 'Телефон', phone.input.value, true),
        buildContact(telegramContact.id, 'telegram', 'Telegram', telegram.input.value),
        buildContact(vkContact.id, 'vk', 'VK', vk.input.value),
      ].filter(Boolean);

      for (const row of extraList.querySelectorAll('.extra-contact-row')) {
        const [labelInput, valueInput] = row.querySelectorAll('input');
        const label = labelInput.value.trim();
        const value = valueInput.value.trim();

        if (value) {
          result.push(buildContact(row.dataset.contactId, 'other', label || 'Контакт', value));
        }
      }

      return result;
    },
  };
}

function buildContact(id, type, label, value, primary = false) {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue) {
    return null;
  }

  return {
    id,
    type,
    label,
    value: trimmedValue,
    primary,
  };
}

function createTextarea(labelText, name, value) {
  const input = createElement('textarea', {
    attrs: {
      name,
      rows: '4',
    },
  });
  input.value = value;

  const field = createElement('label', {
    className: 'field field-wide',
    children: [createElement('span', { text: labelText }), input],
  });

  return { field, input };
}
