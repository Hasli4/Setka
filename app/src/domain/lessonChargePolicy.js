export const DEFAULT_CHARGE_SETTINGS = Object.freeze({
  autoChargeDoneLessons: true,
  chargeStudentAbsence: false,
  chargeTeacherAbsence: false,
});

export function shouldChargeLesson(lesson, settings = DEFAULT_CHARGE_SETTINGS) {
  if (lesson.charged) {
    return false;
  }

  if (lesson.status === 'done') {
    return Boolean(settings.autoChargeDoneLessons);
  }

  if (lesson.status === 'student_absent') {
    return Boolean(settings.chargeStudentAbsence);
  }

  if (lesson.status === 'teacher_absent') {
    return Boolean(settings.chargeTeacherAbsence);
  }

  return false;
}

export function applyLessonCharge(lesson, subscription, settings = DEFAULT_CHARGE_SETTINGS) {
  if (!shouldChargeLesson(lesson, settings) || !subscription) {
    return { lesson, subscription, charged: false, reason: 'not_chargeable' };
  }

  if (subscription.remainingLessons <= 0) {
    return { lesson, subscription, charged: false, reason: 'no_remaining_lessons' };
  }

  const updatedLesson = {
    ...lesson,
    charged: true,
  };

  const updatedSubscription = {
    ...subscription,
    usedLessons: subscription.usedLessons + 1,
    remainingLessons: subscription.remainingLessons - 1,
  };

  return {
    lesson: updatedLesson,
    subscription: updatedSubscription,
    charged: true,
    reason: 'charged',
  };
}

