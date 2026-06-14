/**
 * @typedef {'active'|'new'|'paused'|'frozen'|'completed'|'archive'|'debt'} StudentStatus
 * @typedef {'planned'|'done'|'not_done'|'cancelled'|'moved'|'frozen'|'student_absent'|'teacher_absent'} LessonStatus
 *
 * @typedef {Object} Student
 * @property {string} id
 * @property {string} fullName
 * @property {string} nickname
 * @property {string} direction
 * @property {StudentStatus} status
 * @property {number} defaultLessonDurationMinutes
 * @property {string} startedAt
 * @property {string} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} revision
 * @property {string} sourceDeviceId
 * @property {'local'|'pending'|'synced'|'conflict'} syncState
 *
 * @typedef {Object} Lesson
 * @property {string} id
 * @property {string} studentId
 * @property {string} date
 * @property {string} time
 * @property {number} durationMinutes
 * @property {LessonStatus} status
 * @property {string} changeReason
 * @property {boolean} charged
 * @property {string|null} subscriptionId
 *
 * @typedef {Object} Subscription
 * @property {string} id
 * @property {string} studentId
 * @property {string} paymentType
 * @property {number} lessonCount
 * @property {number} usedLessons
 * @property {number} remainingLessons
 * @property {number} price
 * @property {string} paidAt
 * @property {string} nextPaymentAt
 * @property {string} status
 */

export {};

