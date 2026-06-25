import * as todayService from '../services/todayService.js';
import { clear, createElement } from './dom.js';

export function mountCurrentDayScreen(root, students, options = {}) {
  const screen = {
    root,
    students,
    entries: [],
    onStudentsChanged: options.onStudentsChanged,
  };

  root.append(renderLoading());
  load(screen);
}

async function load(screen) {
  try {
    screen.entries = await todayService.listCurrentDayLessons(screen.students);
    render(screen);
  } catch (error) {
    clear(screen.root);
    screen.root.append(
      createElement('div', {
        className: 'empty-state',
        children: [
          createElement('h2', { text: 'Не удалось загрузить текущий день' }),
          createElement('p', { text: error.message }),
        ],
      }),
    );
  }
}

function render(screen) {
  clear(screen.root);

  screen.root.append(
    createElement('header', {
      className: 'page-header',
      children: [
        createElement('div', {
          children: [
            createElement('p', { className: 'eyebrow', text: 'Текущий день' }),
            createElement('h1', { text: 'Сегодняшние занятия' }),
          ],
        }),
        createElement('p', {
          className: 'muted today-note',
          text: 'Отметка "Проведено" один раз списывает занятие из остатка ученика.',
        }),
      ],
    }),
    createElement('div', {
      className: 'stats',
      children: [
        renderStat('Занятий сегодня', screen.entries.length),
        renderStat('Проведено', screen.entries.filter((entry) => entry.status === 'done').length),
        renderStat('Ожидают отметки', screen.entries.filter((entry) => entry.status !== 'done').length),
        renderStat('Списано занятий', screen.entries.filter((entry) => entry.charged).length),
      ],
    }),
    renderTodayList(screen),
  );
}

function renderLoading() {
  return createElement('p', { className: 'muted', text: 'Загружаю занятия на сегодня...' });
}

function renderTodayList(screen) {
  if (screen.entries.length === 0) {
    return createElement('section', {
      className: 'info-block today-empty',
      children: [
        createElement('h3', { text: 'Сегодня занятий нет' }),
        createElement('p', { className: 'muted', text: 'Список строится по постоянным занятиям активных учеников.' }),
      ],
    });
  }

  return createElement('section', {
    className: 'today-list',
    children: screen.entries.map((entry) => renderTodayEntry(screen, entry)),
  });
}

function renderTodayEntry(screen, entry) {
  const topic = createElement('textarea', {
    className: 'today-textarea',
    attrs: { rows: '3', placeholder: 'Тема занятия' },
  });
  topic.value = entry.topic;

  const notes = createElement('textarea', {
    className: 'today-textarea',
    attrs: { rows: '3', placeholder: 'Заметки' },
  });
  notes.value = entry.notes;

  const saveButton = createElement('button', {
    className: 'secondary-button',
    text: 'Сохранить тему и заметки',
    attrs: { type: 'button' },
  });
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;

    try {
      await todayService.saveDailyLessonDetails(entry, {
        topic: topic.value,
        notes: notes.value,
      });
      await load(screen);
    } catch (error) {
      window.alert(`Не удалось сохранить занятие: ${error.message}`);
      saveButton.disabled = false;
    }
  });

  const doneButton = createElement('button', {
    className: entry.status === 'done' ? 'secondary-button' : 'primary-button',
    text: entry.status === 'done' ? 'Проведено' : 'Отметить проведено',
    attrs: { type: 'button' },
  });
  doneButton.disabled = entry.status === 'done';
  doneButton.addEventListener('click', async () => {
    doneButton.disabled = true;

    try {
      await todayService.markDailyLessonDone(entry, {
        topic: topic.value,
        notes: notes.value,
      });

      if (screen.onStudentsChanged) {
        await screen.onStudentsChanged();
      } else {
        await load(screen);
      }
    } catch (error) {
      window.alert(`Не удалось отметить занятие: ${error.message}`);
      doneButton.disabled = false;
    }
  });

  return createElement('details', {
    className: `today-lesson ${entry.status === 'done' ? 'done' : ''}`,
    children: [
      createElement('summary', {
        className: 'today-lesson-summary',
        children: [
          createElement('strong', { text: entry.startTime }),
          createElement('span', { text: studentDisplayName(entry.student) }),
          createElement('span', { className: 'today-duration', text: `${entry.durationMinutes} мин` }),
          createElement('span', {
            className: entry.status === 'done' ? 'today-status done' : 'today-status',
            text: entry.status === 'done' ? 'Проведено' : 'Запланировано',
          }),
        ],
      }),
      createElement('div', {
        className: 'today-lesson-body',
        children: [
          createElement('label', {
            className: 'field',
            children: [createElement('span', { text: 'Тема занятия' }), topic],
          }),
          createElement('label', {
            className: 'field',
            children: [createElement('span', { text: 'Заметки' }), notes],
          }),
          createElement('div', {
            className: 'today-actions',
            children: [saveButton, doneButton],
          }),
        ],
      }),
    ],
  });
}

function renderStat(label, value) {
  return createElement('div', {
    className: 'stat',
    children: [createElement('span', { text: label }), createElement('strong', { text: String(value) })],
  });
}

function studentDisplayName(student) {
  return student.nickname || student.fullName;
}
