import {
  assignStudentToSlot,
  clearSlot,
  createSchedulePlan,
  duplicateSchedulePlan,
  clearScheduleLesson,
  moveAssignment,
  moveScheduleLesson,
  normalizeSchedulePlan,
  SCHEDULE_PLAN_TYPES,
  togglePaintedSlot,
  touchSchedulePlan,
  upsertScheduleLesson,
} from '../domain/schedule.js';
import { getLocalDeviceId } from '../data/device.js';
import { addChangeLog } from '../data/changeLogRepository.js';
import * as repository from '../data/scheduleRepository.js';

const CURRENT_WEEK_PLAN_ID = 'setka-current-week';
const PERMANENT_PLAN_ID = 'setka-permanent';

export async function getScheduleWorkspace() {
  let plans = (await repository.listSchedulePlans()).map(normalizeSchedulePlan);

  const fixedPlans = ensureFixedPlans(plans);

  if (JSON.stringify(plans) !== JSON.stringify(fixedPlans)) {
    await repository.replaceSchedulePlans(fixedPlans);
    await addScheduleChange(CURRENT_WEEK_PLAN_ID, 'ensure_fixed_plans', plans, fixedPlans);
  }

  plans = fixedPlans;

  const ui = await repository.getScheduleUiSettings();
  const activePlanId = plans.some((plan) => plan.id === ui.activePlanId) ? ui.activePlanId : CURRENT_WEEK_PLAN_ID;
  const comparePlanId = plans.some((plan) => plan.id === ui.comparePlanId) ? ui.comparePlanId : PERMANENT_PLAN_ID;

  return {
    plans,
    ui: {
      activePlanId,
      comparePlanId,
      compareMode: Boolean(ui.compareMode),
    },
  };
}

function ensureFixedPlans(plans) {
  const normalizedPlans = plans.map(normalizeSchedulePlan);
  const currentSource =
    normalizedPlans.find((plan) => plan.type === SCHEDULE_PLAN_TYPES.currentWeek) ??
    normalizedPlans.find((plan) => /текущ|current/i.test(plan.title)) ??
    normalizedPlans[0] ??
    null;
  const permanentSource =
    normalizedPlans.find((plan) => plan.type === SCHEDULE_PLAN_TYPES.permanent) ??
    normalizedPlans.find((plan) => /постоян|permanent/i.test(plan.title)) ??
    normalizedPlans.find((plan) => plan.id !== currentSource?.id) ??
    null;

  const currentPlan = normalizeSchedulePlan({
    ...(currentSource ?? createSchedulePlan(currentWeekTitle(), getLocalDeviceId())),
    id: CURRENT_WEEK_PLAN_ID,
    title: currentSource?.title || currentWeekTitle(),
    type: SCHEDULE_PLAN_TYPES.currentWeek,
    fixed: true,
    lessonsInitialized: true,
  });
  const permanentPlan = normalizeSchedulePlan({
    ...(permanentSource ?? createSchedulePlan('Постоянное расписание', getLocalDeviceId())),
    id: PERMANENT_PLAN_ID,
    title: permanentSource?.title || 'Постоянное расписание',
    type: SCHEDULE_PLAN_TYPES.permanent,
    fixed: true,
    lessons: [],
    assignments: {},
    hiddenRegularLessonIds: [],
    lessonsInitialized: false,
  });

  return [currentPlan, permanentPlan];
}

function currentWeekTitle(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `Текущая неделя (${formatShortDate(start)}-${formatShortDate(end)})`;
}

function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function saveScheduleUi(ui) {
  await repository.saveScheduleUiSettings(ui);
}

export async function exportScheduleBackup() {
  const workspace = await getScheduleWorkspace();

  return {
    type: 'setka.schedule.backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    plans: workspace.plans,
    ui: workspace.ui,
  };
}

export async function importScheduleBackup(payload) {
  const source = payload?.type === 'setka.schedule.backup' ? payload : payload?.state || payload;
  const plans = Array.isArray(source?.plans) ? source.plans.map(normalizeSchedulePlan) : [];

  if (plans.length === 0) {
    throw new Error('В файле не найдено расписание для импорта.');
  }

  await repository.replaceSchedulePlans(plans);

  const activePlanId = plans.some((plan) => plan.id === source?.ui?.activePlanId) ? source.ui.activePlanId : plans[0].id;
  const comparePlanId = plans.some((plan) => plan.id === source?.ui?.comparePlanId)
    ? source.ui.comparePlanId
    : activePlanId;
  const ui = {
    activePlanId,
    comparePlanId,
    compareMode: Boolean(source?.ui?.compareMode),
  };

  await repository.saveScheduleUiSettings(ui);
  await addScheduleChange(activePlanId, 'import_backup', null, { plans, ui });

  return { plans, ui };
}

export async function createPlan(title) {
  const plan = createSchedulePlan(title, getLocalDeviceId());
  await repository.saveSchedulePlan(plan);
  await addScheduleChange(plan.id, 'create', null, plan);
  return plan;
}

export async function duplicatePlan(sourcePlan) {
  const plan = duplicateSchedulePlan(sourcePlan);
  await repository.saveSchedulePlan(plan);
  await addScheduleChange(plan.id, 'create', null, plan);
  return plan;
}

export async function updatePlan(plan, patch) {
  const updatedPlan = touchSchedulePlan(plan, patch);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'update', plan, updatedPlan);
  return updatedPlan;
}

export async function removePlan(plan) {
  await repository.deleteSchedulePlan(plan.id);
  await addScheduleChange(plan.id, 'delete', plan, null);
}

export async function assignStudent(plan, slot, studentId) {
  const updatedPlan = assignStudentToSlot(plan, slot, studentId);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'assign_student', plan, updatedPlan);
  return updatedPlan;
}

export async function moveStudent(plan, sourceSlot, targetSlot) {
  const updatedPlan = moveAssignment(plan, sourceSlot, targetSlot);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'move_student', plan, updatedPlan);
  return updatedPlan;
}

export async function clearStudent(plan, slot) {
  const updatedPlan = clearSlot(plan, slot);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'clear_slot', plan, updatedPlan);
  return updatedPlan;
}

export async function saveLesson(plan, lesson) {
  const updatedPlan = upsertScheduleLesson(plan, lesson);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'save_lesson', plan, updatedPlan);
  return updatedPlan;
}

export async function moveLesson(plan, lessonId, targetSlot) {
  const updatedPlan = moveScheduleLesson(plan, lessonId, targetSlot);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'move_lesson', plan, updatedPlan);
  return updatedPlan;
}

export async function clearLesson(plan, lessonId) {
  const updatedPlan = clearScheduleLesson(plan, lessonId);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'clear_lesson', plan, updatedPlan);
  return updatedPlan;
}

export async function togglePriority(plan, slot, priority) {
  const updatedPlan = togglePaintedSlot(plan, slot, priority);
  await repository.saveSchedulePlan(updatedPlan);
  await addScheduleChange(updatedPlan.id, 'paint_slot', plan, updatedPlan);
  return updatedPlan;
}

async function addScheduleChange(entityId, changeType, before, after) {
  await addChangeLog({
    entityType: 'schedulePlan',
    entityId,
    changeType,
    before,
    after,
  });
}
