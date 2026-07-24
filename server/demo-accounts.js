/** Canonical demo logins — see docs/qa/accounts.csv */
export const DEMO_PASSWORD = 'demo123';

export const DEMO_EMAILS = [
  'owner@eduos.app',
  'admin@brightminds.demo',
  'anita@tutorhub.com',
  'vikram@tutorhub.com',
  'sharma@family.demo',
];

export const DEMO_IDS = {
  center: 'center_brightminds_demo',
  branch: 'branch_brightminds_main',
  teacherAnita: 'teacher_anita_demo',
  teacherVikram: 'teacher_vikram_demo',
  studentAarav: 'student_aarav_demo',
  studentPriya: 'student_priya_demo',
  studentRohan: 'student_rohan_demo',
  batchScience: 'batch_grade10_science_demo',
  batchMath: 'batch_grade8_math_demo',
  userOwner: 'user_platform_owner_demo',
  userAdmin: 'user_center_admin_demo',
  userAnita: 'user_teacher_anita_demo',
  userVikram: 'user_teacher_vikram_demo',
  userSharma: 'user_family_sharma_demo',
};

export function isDemoEmail(email) {
  return DEMO_EMAILS.includes(String(email || '').trim().toLowerCase());
}
