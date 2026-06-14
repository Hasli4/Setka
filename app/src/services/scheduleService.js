import {
  assignStudentToSlot,
  clearSlot,
  createSchedulePlan,
  duplicateSchedulePlan,
  moveAssignment,
  normalizeSchedulePlan,
  togglePaintedSlot,
  touchSchedulePlan,
} from '../domain/schedule.js';
import { getLocalDeviceId } from '../data/device.js';
import { addChangeLog } from '../data/changeLogRepository.js';
import * as repository from '../data/scheduleRepository.js';

export async function getScheduleWorkspace() {
  let plans = (await repository.listSchedulePlans()).map(normalizeSchedulePlan);

  if (plans.length === 0) {
    const firstPlan = createSchedulePlan('Расписание 1', getLocalDeviceId());
    await repository.saveSchedulePlan(firstPlan);
    await addScheduleChange(firstPlan.id, 'create', null, firstPlan);
    plans = [firstPlan];
  }

  const ui = await repository.getScheduleUiSettings();
  const activePlanId = plans.some((plan) => plan.id === ui.activePlanId) ? ui.activePlanId : plans[0].id;
  const comparePlanId = plans.some((plan) => plan.id === ui.comparePlanId) ? ui.comparePlanId : activePlanId;

  return {
    plans,
    ui: {
      activePlanId,
      comparePlanId,
      compareMode: Boolean(ui.compareMode),
    },
  };
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
