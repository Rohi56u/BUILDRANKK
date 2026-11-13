/**
 * BuildRank Firestore Rules Adversarial Verification Spec ("Dirty Dozen")
 * Intended for @firebase/rules-unit-testing when running against a local Firestore emulator.
 */

export const DIRTY_DOZEN_TEST_CASES = [
  {
    name: '01. Unauthenticated read on /assessments/{id}',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '02. Unverified email user attempting to create /assessments/{id}',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '03. Cross-user profile read (uid_A reading /users/uid_B)',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '04. User collection listing (list /users)',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '05. Identity spoofing on create (uid_A writing ownerId: uid_B)',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '06. Shadow field injection (isAdmin: true on /assessments/{id})',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '07. Unscoped list query on /assessments without ownerId == request.auth.uid',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '08. Owner reassignment on update (changing ownerId)',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '09. Backdated createdAt timestamp != request.time',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Path ID poisoning (>128 chars or invalid characters)',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Oversized categories list (>20 items) or string (>2000 chars)',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Type-poisoned update (overallScore set to string instead of number)',
    expected: 'PERMISSION_DENIED',
  },
] as const;
