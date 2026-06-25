import { STUDENT_STATUSES, getStatusLabel } from '../domain/statuses.js';
import { SCHEDULE_DAYS } from '../domain/schedule.js';
import { buildFinanceReport, buildIncomeForecast } from '../domain/finance.js';
import { buildPaymentMessage } from '../domain/paymentMessage.js';
import * as studentService from '../services/studentService.js';
import { listChangeLogs } from '../data/changeLogRepository.js';
import { clear, createElement, formatDate } from './dom.js';
import { mountScheduleScreen } from './scheduleScreen.js';
import { mountCurrentDayScreen } from './currentDayScreen.js';
import { openStudentForm } from './studentForm.js';

const SIDEBAR_COLLAPSED_KEY = 'setka.sidebarCollapsed';
const FINANCE_TABS = Object.freeze([
  { key: 'income-forecast', label: 'Прогноз дохода' },
  { key: 'overview', label: 'Общая информация' },
]);

const state = {
  screen: 'students',
  financeTab: 'income-forecast',
  students: [],
  selectedStudentId: null,
  search: '',
  status: 'all',
  changeLogs: [],
  sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
};

export function startApp(root) {
  renderShell(root);
  refresh();
}

async function refresh() {
  state.students = await studentService.listStudents();
  state.changeLogs = await listChangeLogs(6);

  if (!state.selectedStudentId && state.students.length > 0) {
    state.selectedStudentId = state.students[0].id;
  }

  if (state.selectedStudentId && !state.students.some((student) => student.id === state.selectedStudentId)) {
    state.selectedStudentId = state.students[0]?.id ?? null;
  }

  renderMain();
}

function renderShell(root) {
  root.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);

  const collapseButton = createElement('button', {
    className: 'secondary-button sidebar-collapse-button',
    text: 'Скрыть панель',
    attrs: { type: 'button' },
  });
  collapseButton.addEventListener('click', () => setSidebarCollapsed(true));

  const restoreButton = createElement('button', {
    className: 'secondary-button sidebar-restore-button',
    text: 'Показать меню',
    attrs: { type: 'button' },
  });
  restoreButton.addEventListener('click', () => setSidebarCollapsed(false));

  root.append(
    createElement('aside', {
      className: 'sidebar',
      children: [
        collapseButton,
        createElement('div', {
          className: 'brand',
          children: [
            createElement('span', { className: 'brand-mark', text: 'S' }),
            createElement('div', {
              children: [
                createElement('strong', { text: 'Setka' }),
                createElement('small', { text: 'локальная база преподавателя' }),
              ],
            }),
          ],
        }),
        createNavButton('students', 'Ученики'),
        createNavButton('today', 'Текущий день'),
        createNavButton('schedule', 'Расписание'),
        createNavButton('finance', 'Финансы'),
      ],
    }),
    createElement('main', {
      className: 'main',
      children: [restoreButton, createElement('div', { attrs: { id: 'main' } })],
    }),
  );
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  document.querySelector('#app')?.classList.toggle('sidebar-collapsed', collapsed);
}

function createNavButton(screen, label) {
  const button = createElement('button', {
    className: `nav-button ${state.screen === screen ? 'active' : ''}`,
    text: label,
    attrs: { type: 'button', 'data-screen': screen },
  });

  button.addEventListener('click', () => {
    state.screen = screen;
    renderMain();
    updateActiveNavButton();
  });

  return button;
}

function openStudentFromSchedule(studentId) {
  state.selectedStudentId = studentId;
  state.screen = 'students';
  renderMain();
  updateActiveNavButton();
}

function updateActiveNavButton() {
  document.querySelectorAll('.nav-button').forEach((item) => {
    item.classList.toggle('active', item.dataset.screen === state.screen);
  });
}

function renderMain() {
  const main = document.querySelector('#main');
  clear(main);

  if (state.screen === 'schedule') {
    const scheduleRoot = createElement('section', { className: 'workspace' });
    main.append(scheduleRoot);
    mountScheduleScreen(scheduleRoot, state.students, {
      onOpenStudent: openStudentFromSchedule,
      onStudentsChanged: refresh,
    });
    return;
  }

  if (state.screen === 'today') {
    const todayRoot = createElement('section', { className: 'workspace' });
    main.append(todayRoot);
    mountCurrentDayScreen(todayRoot, state.students, {
      onStudentsChanged: refresh,
    });
    return;
  }

  if (state.screen === 'finance') {
    main.append(renderFinanceScreen());
    return;
  }

  main.append(renderStudentsScreen());
}

function renderStudentsScreen() {
  const filteredStudents = getFilteredStudents();
  const selectedStudent = state.students.find((student) => student.id === state.selectedStudentId) ?? null;

  return createElement('section', {
    className: 'workspace',
    children: [
      renderHeader(),
      renderStats(),
      createElement('div', {
        className: 'student-workspace',
        children: [renderStudentList(filteredStudents), renderStudentDetails(selectedStudent)],
      }),
    ],
  });
}

function renderFinanceScreen() {
  const activeTab = FINANCE_TABS.find((tab) => tab.key === state.financeTab) ?? FINANCE_TABS[0];

  return createElement('section', {
    className: 'workspace',
    children: [
      createElement('header', {
        className: 'page-header',
        children: [
          createElement('div', {
            children: [
              createElement('p', { className: 'eyebrow', text: 'Финансы' }),
              createElement('h1', { text: activeTab.label }),
            ],
          }),
          createElement('p', {
            className: 'muted finance-note',
            text: 'Финансовые прогнозы считаются по активным ученикам и постоянным занятиям из карточек.',
          }),
        ],
      }),
      renderFinanceTabs(),
      activeTab.key === 'income-forecast'
        ? renderIncomeForecastTab(buildIncomeForecast(state.students))
        : renderFinanceOverviewTab(buildFinanceReport(state.students)),
    ],
  });
}

function renderFinanceTabs() {
  return createElement('div', {
    className: 'finance-tabs',
    attrs: { role: 'tablist', 'aria-label': 'Разделы финансов' },
    children: FINANCE_TABS.map((tab) => {
      const button = createElement('button', {
        className: `finance-tab ${state.financeTab === tab.key ? 'active' : ''}`,
        text: tab.label,
        attrs: { type: 'button', role: 'tab', 'aria-selected': state.financeTab === tab.key ? 'true' : 'false' },
      });

      button.addEventListener('click', () => {
        state.financeTab = tab.key;
        renderMain();
      });

      return button;
    }),
  });
}

function renderIncomeForecastTab(forecast) {
  return createElement('div', {
    className: 'finance-tab-panel',
    children: [
      createElement('div', {
        className: 'stats',
        children: [
          renderStat('Сумма к оплате на 30 число месяца', formatCurrency(forecast.totalDue)),
          renderStat('Дата расчета', formatIsoDateLabel(forecast.today)),
          renderStat('Прогноз до', formatIsoDateLabel(forecast.targetDate)),
          renderStat('Учеников к оплате', forecast.dueStudents),
        ],
      }),
      createElement('section', {
        className: 'info-block finance-block',
        children: [
          createElement('h3', { text: 'Кто попадает в прогноз' }),
          createElement('p', {
            className: 'muted',
            text: 'Если остаток занятий к дате прогноза станет 0 или ниже, ученик попадает в сумму оплаты одним абонементом.',
          }),
          renderPaymentForecastBreakdown(forecast.rows),
        ],
      }),
    ],
  });
}

function renderFinanceOverviewTab(report) {
  return createElement('div', {
    className: 'finance-tab-panel',
    children: [
      createElement('div', {
        className: 'stats',
        children: [
          renderStat('За неделю', formatCurrency(report.weeklyTotal)),
          renderStat('За месяц', formatCurrency(report.monthlyTotal)),
          renderStat('Занятий в неделю', report.weeklyLessons),
          renderStat('Активных учеников', report.activeStudents),
        ],
      }),
      createElement('section', {
        className: 'info-block finance-block',
        children: [
          createElement('h3', { text: 'Расчет по ученикам' }),
          renderFinanceBreakdown(report.rows),
        ],
      }),
    ],
  });
}

function renderPaymentForecastBreakdown(rows) {
  if (rows.length === 0) {
    return createElement('p', {
      className: 'muted',
      text: 'Пока нет активных учеников для прогноза.',
    });
  }

  return createElement('div', {
    className: 'finance-breakdown',
    children: [
      createElement('div', {
        className: 'finance-row payment-forecast-row finance-row-head',
        children: [
          createElement('span', { text: 'Ученик' }),
          createElement('span', { text: 'Остаток сейчас' }),
          createElement('span', { text: 'Уроков до даты' }),
          createElement('span', { text: 'Остаток к дате' }),
          createElement('span', { text: 'Абонемент' }),
          createElement('span', { text: 'Статус' }),
          createElement('span', { text: 'Сообщение' }),
        ],
      }),
      ...rows.map((row) => {
        const copyButton = createElement('button', {
          className: 'secondary-button compact-button',
          text: 'Скопировать',
          attrs: { type: 'button' },
        });
        copyButton.addEventListener('click', async () => {
          copyButton.disabled = true;

          try {
            await copyToClipboard(buildPaymentMessage(row.student));
            copyButton.textContent = 'Скопировано';
            window.setTimeout(() => {
              copyButton.textContent = 'Скопировать';
              copyButton.disabled = false;
            }, 1400);
          } catch (error) {
            window.alert(`Не удалось скопировать сообщение: ${error.message}`);
            copyButton.disabled = false;
          }
        });

        return createElement('div', {
          className: `finance-row payment-forecast-row ${row.needsPayment ? 'payment-due' : ''}`,
          children: [
            createElement('strong', { text: studentDisplayName(row.student) }),
            createElement('span', { text: formatLessonBalance(row.remainingLessons) }),
            createElement('span', { text: String(row.projectedLessons) }),
            createElement('span', { text: formatLessonBalance(row.projectedBalance) }),
            createElement('span', { text: formatCurrency(row.subscriptionPrice) }),
            createElement('span', { className: row.needsPayment ? 'payment-status due' : 'payment-status', text: paymentForecastStatus(row) }),
            copyButton,
          ],
        });
      }),
    ],
  });
}

function paymentForecastStatus(row) {
  if (row.needsPayment) {
    return 'К оплате';
  }

  if (row.projectedBalance <= 0 && row.subscriptionPrice <= 0) {
    return 'Нет цены';
  }

  if (row.projectedLessons === 0) {
    return 'Нет занятий';
  }

  if (row.projectedBalance > 0) {
    return 'Запас есть';
  }

  return 'Нет цены';
}

function renderFinanceBreakdown(rows) {
  if (rows.length === 0) {
    return createElement('p', {
      className: 'muted',
      text: 'Пока нет активных учеников для расчета.',
    });
  }

  return createElement('div', {
    className: 'finance-breakdown',
    children: [
      createElement('div', {
        className: 'finance-row finance-row-head',
        children: [
          createElement('span', { text: 'Ученик' }),
          createElement('span', { text: 'Постоянных занятий' }),
          createElement('span', { text: 'Цена занятия' }),
          createElement('span', { text: 'За неделю' }),
        ],
      }),
      ...rows.map((row) =>
        createElement('div', {
          className: 'finance-row',
          children: [
            createElement('strong', { text: studentDisplayName(row.student) }),
            createElement('span', { text: String(row.lessonsPerWeek) }),
            createElement('span', { text: formatCurrency(row.singleLessonPrice) }),
            createElement('span', { text: formatCurrency(row.weeklyTotal) }),
          ],
        }),
      ),
    ],
  });
}

function renderHeader() {
  const search = createElement('input', {
    className: 'search-input',
    attrs: { type: 'search', placeholder: 'Поиск по ФИО, псевдониму или направлению', value: state.search },
  });
  search.addEventListener('input', () => {
    state.search = search.value;
    renderMain();
  });

  const statusFilter = createElement('select', { className: 'status-filter' });
  statusFilter.append(createElement('option', { text: 'Все статусы', attrs: { value: 'all' } }));

  for (const status of STUDENT_STATUSES) {
    const option = createElement('option', { text: status.label, attrs: { value: status.value } });
    option.selected = state.status === status.value;
    statusFilter.append(option);
  }

  statusFilter.addEventListener('change', () => {
    state.status = statusFilter.value;
    renderMain();
  });

  const addButton = createElement('button', {
    className: 'primary-button',
    text: 'Добавить ученика',
    attrs: { type: 'button' },
  });
  addButton.addEventListener('click', () => {
    openStudentForm({
      title: 'Новый ученик',
      onSubmit: async (input) => {
        const student = await studentService.createStudentProfile(input);
        state.selectedStudentId = student.id;
        await refresh();
      },
    });
  });

  return createElement('header', {
    className: 'page-header',
    children: [
      createElement('div', {
        children: [
          createElement('p', { className: 'eyebrow', text: 'Этап 1' }),
          createElement('h1', { text: 'Ученики' }),
        ],
      }),
      createElement('div', {
        className: 'header-tools',
        children: [search, statusFilter, addButton],
      }),
    ],
  });
}

function renderStats() {
  const active = state.students.filter((student) => student.status === 'active').length;
  const paused = state.students.filter((student) => student.status === 'paused').length;
  const completed = state.students.filter((student) => student.status === 'completed').length;

  return createElement('div', {
    className: 'stats',
    children: [
      renderStat('Всего', state.students.length),
      renderStat('Активные', active),
      renderStat('Пауза', paused),
      renderStat('Завершили', completed),
    ],
  });
}

function renderStat(label, value) {
  return createElement('div', {
    className: 'stat',
    children: [createElement('span', { text: label }), createElement('strong', { text: String(value) })],
  });
}

function renderStudentList(students) {
  const list = createElement('div', { className: 'student-list' });

  if (students.length === 0) {
    list.append(
      createElement('div', {
        className: 'empty-state',
        children: [
          createElement('h2', { text: 'Пока нет учеников' }),
          createElement('p', { text: 'Добавьте первого ученика, и он сохранится в локальной базе.' }),
        ],
      }),
    );
    return list;
  }

  for (const student of students) {
    const button = createElement('button', {
      className: `student-row ${student.id === state.selectedStudentId ? 'selected' : ''}`,
      attrs: { type: 'button' },
      children: [
        createElement('span', {
          className: 'student-avatar',
          text: getInitials(student.fullName),
        }),
        createElement('span', {
          className: 'student-row-body',
          children: [
            createElement('strong', { text: student.fullName }),
            createElement('small', { text: student.direction || 'Направление не указано' }),
          ],
        }),
        createElement('span', {
          className: `status-pill status-${student.status}`,
          text: getStatusLabel(STUDENT_STATUSES, student.status),
        }),
      ],
    });

    button.addEventListener('click', () => {
      state.selectedStudentId = student.id;
      renderMain();
    });
    list.append(button);
  }

  return list;
}

function renderStudentDetails(student) {
  if (!student) {
    return createElement('aside', {
      className: 'details-panel',
      children: [
        createElement('h2', { text: 'Карточка ученика' }),
        createElement('p', { className: 'muted', text: 'Выберите ученика из списка.' }),
      ],
    });
  }

  const editButton = createElement('button', {
    className: 'secondary-button',
    text: 'Редактировать',
    attrs: { type: 'button' },
  });
  editButton.addEventListener('click', () => {
    openStudentForm({
      title: 'Редактировать ученика',
      student,
      onSubmit: async (input) => {
        await studentService.updateStudentProfile(student.id, input);
        await refresh();
      },
    });
  });

  const deleteButton = createElement('button', {
    className: 'danger-button',
    text: 'Удалить',
    attrs: { type: 'button' },
  });
  deleteButton.addEventListener('click', async () => {
    const confirmed = window.confirm(`Удалить ученика "${student.fullName}"?`);

    if (confirmed) {
      await studentService.deleteStudentProfile(student.id);
      await refresh();
    }
  });

  return createElement('aside', {
    className: 'details-panel',
    children: [
      createElement('div', {
        className: 'details-heading',
        children: [
          createElement('div', {
            children: [
              createElement('p', { className: 'eyebrow', text: getStatusLabel(STUDENT_STATUSES, student.status) }),
              createElement('h2', { text: student.fullName }),
            ],
          }),
          createElement('span', { className: 'student-avatar large', text: getInitials(student.fullName) }),
        ],
      }),
      createElement('div', {
        className: 'details-grid',
        children: [
          renderDetail('Псевдоним', student.nickname || 'Не указан'),
          renderDetail('Направление', student.direction || 'Не указано'),
          renderDetail('Длительность', `${student.defaultLessonDurationMinutes} мин`),
          renderDetail('Дата старта', formatDate(student.startedAt)),
        ],
      }),
      renderRegularLessons(student),
      renderBilling(student.billing),
      renderStudentContacts(student.contacts ?? []),
      createElement('div', {
        className: 'notes-block',
        children: [
          createElement('h3', { text: 'Заметки' }),
          createElement('p', { text: student.notes || 'Пока пусто.' }),
        ],
      }),
      createElement('div', {
        className: 'details-actions',
        children: [editButton, deleteButton],
      }),
    ],
  });
}

function renderUpcomingBlocks() {
  return createElement('div', {
    className: 'next-modules',
    children: [
      createElement('section', {
        children: [
          createElement('h3', { text: 'Расписание' }),
          createElement('p', { text: 'Здесь появятся регулярные недельные слоты ученика.' }),
        ],
      }),
      createElement('section', {
        children: [
          createElement('h3', { text: 'Абонементы' }),
          createElement('p', { text: 'Списание занятий уже вынесено в бизнес-логику.' }),
        ],
      }),
    ],
  });
}

function renderChangeLog() {
  if (state.changeLogs.length === 0) {
    return createElement('div', { className: 'change-log muted', text: 'Журнал изменений пока пуст.' });
  }

  return createElement('div', {
    className: 'change-log',
    children: [
      createElement('h3', { text: 'Последние изменения' }),
      ...state.changeLogs.map((log) =>
        createElement('p', {
          text: `${new Date(log.changedAt).toLocaleString('ru-RU')} - ${log.entityType}:${log.changeType}`,
        }),
      ),
    ],
  });
}

function renderDetail(label, value) {
  return createElement('div', {
    className: 'detail-item',
    children: [createElement('span', { text: label }), createElement('strong', { text: value })],
  });
}

function renderRegularLessons(student) {
  const lessons = student.regularLessons ?? [];

  return createElement('div', {
    className: 'info-block',
    children: [
      createElement('h3', { text: 'Регулярные занятия (МСК)' }),
      lessons.length
        ? createElement('div', {
            className: 'regular-lessons-view',
            children: lessons.map((lesson) =>
              createElement('p', {
                text: `${weekdayLabel(lesson.weekday)} ${lesson.startTime} - ${student.defaultLessonDurationMinutes} мин`,
              }),
            ),
          })
        : createElement('p', { className: 'muted', text: 'Постоянное время пока не указано.' }),
    ],
  });
}

function renderBilling(billing = {}) {
  return createElement('div', {
    className: 'info-block',
    children: [
      createElement('h3', { text: 'Абонемент' }),
      createElement('div', {
        className: 'billing-view',
        children: [
          renderDetail('Стоимость абонемента', formatMoney(billing.subscriptionPrice)),
          renderDetail('Занятий в абонементе', String(billing.lessonsPerSubscription || 0)),
          renderDetail('Стоимость 1 занятия', formatMoney(billing.singleLessonPrice)),
          renderDetail('Остаток занятий', formatLessonBalance(billing.remainingLessons)),
        ],
      }),
    ],
  });
}

function weekdayLabel(weekday) {
  return SCHEDULE_DAYS.find((day) => day.key === weekday)?.label ?? weekday;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `${amount.toLocaleString('ru-RU')} ₽` : 'Не указано';
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function formatIsoDateLabel(value) {
  const [year, month, day] = String(value).split('-');
  return `${day}.${month}.${year}`;
}

function formatLessonBalance(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('ru-RU');
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function renderStudentContacts(contacts) {
  if (contacts.length === 0) {
    return createElement('div', {
      className: 'contact-links',
      children: [
        createElement('h3', { text: 'Способ связи' }),
        createElement('p', { className: 'muted', text: 'Контакты пока не указаны.' }),
      ],
    });
  }

  return createElement('div', {
    className: 'contact-links',
    children: [
      createElement('h3', { text: 'Способ связи' }),
      ...contacts.map((contact) => {
        const href = contact.href || contact.value;
        const opensNewTab = !href.startsWith('tel:') && !href.startsWith('mailto:');

        return createElement('a', {
          className: contact.primary ? 'contact-link primary-contact' : 'contact-link',
          text: `${contact.label}: ${contact.value}`,
          attrs: {
            href,
            target: opensNewTab ? '_blank' : undefined,
            rel: opensNewTab ? 'noreferrer' : undefined,
          },
        });
      }),
    ],
  });
}

function getFilteredStudents() {
  const query = state.search.trim().toLowerCase();

  return state.students.filter((student) => {
    const matchesStatus = state.status === 'all' || student.status === state.status;
    const matchesQuery =
      !query ||
      student.fullName.toLowerCase().includes(query) ||
      student.nickname.toLowerCase().includes(query) ||
      student.direction.toLowerCase().includes(query);

    return matchesStatus && matchesQuery;
  });
}

function getInitials(fullName) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function studentDisplayName(student) {
  return student.nickname || student.fullName;
}
