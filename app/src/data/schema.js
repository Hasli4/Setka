export const DATABASE_NAME = 'setka-local-db';
export const DATABASE_VERSION = 2;

export const STORES = Object.freeze({
  students: 'students',
  parentContacts: 'parentContacts',
  studentParentContacts: 'studentParentContacts',
  lessons: 'lessons',
  subscriptions: 'subscriptions',
  schedulePlans: 'schedulePlans',
  scheduleSlots: 'scheduleSlots',
  messageTemplates: 'messageTemplates',
  syncLogs: 'syncLogs',
  changeLogs: 'changeLogs',
  appSettings: 'appSettings',
});

export function createSchema(database, transaction) {
  const students = ensureStore(database, transaction, STORES.students, { keyPath: 'id' });
  ensureIndex(students, 'by_status', 'status');
  ensureIndex(students, 'by_direction', 'direction');
  ensureIndex(students, 'by_updatedAt', 'updatedAt');
  ensureIndex(students, 'by_fullName', 'fullName');

  const parentContacts = ensureStore(database, transaction, STORES.parentContacts, { keyPath: 'id' });
  ensureIndex(parentContacts, 'by_fullName', 'fullName');
  ensureIndex(parentContacts, 'by_phone', 'phone');

  const studentParentContacts = ensureStore(database, transaction, STORES.studentParentContacts, { keyPath: 'id' });
  ensureIndex(studentParentContacts, 'by_studentId', 'studentId');
  ensureIndex(studentParentContacts, 'by_parentContactId', 'parentContactId');

  const lessons = ensureStore(database, transaction, STORES.lessons, { keyPath: 'id' });
  ensureIndex(lessons, 'by_studentId', 'studentId');
  ensureIndex(lessons, 'by_status', 'status');
  ensureIndex(lessons, 'by_date', 'date');
  ensureIndex(lessons, 'by_subscriptionId', 'subscriptionId');

  const subscriptions = ensureStore(database, transaction, STORES.subscriptions, { keyPath: 'id' });
  ensureIndex(subscriptions, 'by_studentId', 'studentId');
  ensureIndex(subscriptions, 'by_status', 'status');
  ensureIndex(subscriptions, 'by_nextPaymentAt', 'nextPaymentAt');

  const schedulePlans = ensureStore(database, transaction, STORES.schedulePlans, { keyPath: 'id' });
  ensureIndex(schedulePlans, 'by_updatedAt', 'updatedAt');
  ensureIndex(schedulePlans, 'by_includeInExport', 'includeInExport');

  const scheduleSlots = ensureStore(database, transaction, STORES.scheduleSlots, { keyPath: 'id' });
  ensureIndex(scheduleSlots, 'by_studentId', 'studentId');
  ensureIndex(scheduleSlots, 'by_weekday', 'weekday');
  ensureIndex(scheduleSlots, 'by_active', 'active');

  const messageTemplates = ensureStore(database, transaction, STORES.messageTemplates, { keyPath: 'id' });
  ensureIndex(messageTemplates, 'by_category', 'category');

  const syncLogs = ensureStore(database, transaction, STORES.syncLogs, { keyPath: 'id' });
  ensureIndex(syncLogs, 'by_createdAt', 'createdAt');
  ensureIndex(syncLogs, 'by_status', 'status');

  const changeLogs = ensureStore(database, transaction, STORES.changeLogs, { keyPath: 'id' });
  ensureIndex(changeLogs, 'by_entity', ['entityType', 'entityId']);
  ensureIndex(changeLogs, 'by_changedAt', 'changedAt');
  ensureIndex(changeLogs, 'by_status', 'status');

  ensureStore(database, transaction, STORES.appSettings, { keyPath: 'key' });
}

function ensureStore(database, transaction, storeName, options) {
  if (database.objectStoreNames.contains(storeName)) {
    return transaction.objectStore(storeName);
  }

  return database.createObjectStore(storeName, options);
}

function ensureIndex(store, indexName, keyPath, options) {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
}
