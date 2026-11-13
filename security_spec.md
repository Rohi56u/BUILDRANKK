# BuildRank Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership**: Every document in `/users/{userId}` belongs exclusively to the verified user whose `request.auth.uid == userId`. No user can read, list, create, update, or delete another user's profile.
2. **Assessment Isolation**: Every document in `/assessments/{assessmentId}` MUST contain `ownerId == request.auth.uid` on creation and MUST enforce `incoming().ownerId == existing().ownerId` on update (immutable owner).
3. **Verified Identity**: All read and write operations require `request.auth != null && request.auth.token.email_verified == true`.
4. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` on `create`. On `update`, `createdAt` is immutable (`incoming().createdAt == existing().createdAt`) and `updatedAt == request.time`.
5. **Bounded Payloads & Strict Keys**: Every collection enforces `keys().hasAll(...)` and `keys().hasOnly(...)` on create, and `affectedKeys().hasOnly(...)` on update, plus `.size()` caps on every string and array.
6. **ID Hardening**: Document path variables (`userId`, `assessmentId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/list** on `/assessments` or `/users/{uid}`.
2. **Unverified email write** (`email_verified: false`) attempting to create `/assessments/{id}`.
3. **Cross-user profile read** (`uid_A` calling `get(/users/uid_B)`).
4. **User directory scraping** (`uid_A` calling `list(/users)`).
5. **Identity spoofing on create** (`uid_A` creating `/assessments/a1` with `ownerId: "uid_B"`).
6. **Shadow / ghost field injection** (`uid_A` creating `/assessments/a1` with extra `isAdmin: true` field).
7. **Cross-user assessment read/list** (`uid_A` querying `/assessments` without `where("ownerId", "==", uid_A)` or reading `uid_B`'s assessment).
8. **Owner reassignment on update** (`uid_A` updating `/assessments/a1` to change `ownerId` to `"uid_B"`).
9. **Immutable timestamp tampering** (`uid_A` creating `/assessments/a1` with a backdated `createdAt` != `request.time`).
10. **Path ID poisoning** (creating `/assessments/` with a 500-character ID or invalid characters like `../admin`).
11. **Denial-of-wallet oversized array/string** (`categories` list with 25 items > max 20, or `overallExplanation` > 2000 chars).
12. **Type-poisoned update** (`uid_A` updating `/assessments/a1` setting `overallScore` to `"100"` string instead of `number`).
