import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  FIREBASE_CONSOLE_UPGRADE_URL,
  OperationType,
  db,
  handleFirestoreError,
} from '../firebase.ts';
import type { AssessmentResult, ProjectInput } from '../types/buildrank.ts';

function clampText(value: string | null | undefined, maxLen: number, fallback = ''): string {
  const str = (value ?? '').trim();
  if (!str) return fallback;
  return str.slice(0, maxLen);
}

function sanitizeProjectSnapshot(project: ProjectInput): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    projectName: clampText(project.projectName, 160, 'Untitled project'),
    problem: clampText(project.problem, 4000, ''),
    intendedUsers: clampText(project.intendedUsers, 1500, ''),
    solution: clampText(project.solution, 4000, ''),
    workingStatus: clampText(project.workingStatus, 4000, ''),
    technologies: clampText(project.technologies, 1000, ''),
    githubUrl: clampText(project.githubUrl, 500, ''),
    readmeText: clampText(project.readmeText, 20000, ''),
  };
  if (project.uploadedFileName) {
    sanitized.uploadedFileName = clampText(project.uploadedFileName, 200);
  }
  if (project.githubContext) {
    sanitized.githubContext = {
      url: clampText(project.githubContext.url, 500),
      fullName: clampText(project.githubContext.fullName, 200),
      description: project.githubContext.description
        ? clampText(project.githubContext.description, 1000)
        : null,
      language: project.githubContext.language
        ? clampText(project.githubContext.language, 100)
        : null,
      stars:
        typeof project.githubContext.stars === 'number' ? project.githubContext.stars : null,
      readmeExcerpt: clampText(project.githubContext.readmeExcerpt, 12000),
      fetchedAt: clampText(project.githubContext.fetchedAt, 64),
    };
  }
  return sanitized;
}

export function subscribeUserAssessments(
  uid: string,
  onData: (items: AssessmentResult[]) => void,
  onError: (friendlyMessage: string) => void
): () => void {
  const path = 'assessments';
  const q = query(collection(db, path), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AssessmentResult[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: String(data.id ?? docSnap.id),
          createdAt: String(data.createdAtIso ?? new Date().toISOString()),
          mode: data.mode === 'gemini' ? 'gemini' : 'sample',
          modeNotice: String(data.modeNotice ?? ''),
          modelName: typeof data.modelName === 'string' ? data.modelName : null,
          fallbackReason: typeof data.fallbackReason === 'string' ? data.fallbackReason : null,
          overallScore: Number(data.overallScore ?? 0),
          readinessLabel: data.readinessLabel ?? 'Needs more detail',
          overallExplanation: String(data.overallExplanation ?? ''),
          calculationFormula: String(data.calculationFormula ?? ''),
          categories: Array.isArray(data.categories) ? data.categories : [],
          improvements: Array.isArray(data.improvements) ? data.improvements : [],
          disclaimer: String(data.disclaimer ?? ''),
          projectSnapshot: data.projectSnapshot as ProjectInput,
          rubricSnapshot: Array.isArray(data.rubricSnapshot) ? data.rubricSnapshot : [],
          isSampleData: Boolean(data.isSampleData),
        };
      });

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(items);
    },
    (error) => {
      const msg = error?.message ?? '';
      if (msg.includes('Quota exceeded')) {
        onError(
          `Firestore daily free-tier read quota exceeded (resets tomorrow). Upgrade details: ${FIREBASE_CONSOLE_UPGRADE_URL}`
        );
      } else {
        onError('Could not load saved assessments from Firestore.');
      }
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Already surfaced user-friendly error via onError callback
      }
    }
  );
}

export async function saveAssessmentToFirestore(
  uid: string,
  result: AssessmentResult
): Promise<void> {
  const cleanId = result.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `assessments/${cleanId}`;
  const docRef = doc(db, 'assessments', cleanId);

  const payload: Record<string, unknown> = {
    id: cleanId,
    ownerId: uid,
    projectName: clampText(result.projectSnapshot.projectName, 160, 'Untitled project'),
    mode: result.mode,
    modeNotice: clampText(result.modeNotice, 600, 'Rubric evaluation completed.'),
    modelName: result.modelName ? clampText(result.modelName, 100) : null,
    fallbackReason: result.fallbackReason ? clampText(result.fallbackReason, 300) : null,
    overallScore: Math.max(0, Math.min(100, Number(result.overallScore) || 0)),
    readinessLabel: result.readinessLabel,
    overallExplanation: clampText(
      result.overallExplanation,
      2000,
      'Evaluation based on provided details.'
    ),
    calculationFormula: clampText(result.calculationFormula, 2000, 'Weighted rubric total'),
    disclaimer: clampText(
      result.disclaimer,
      400,
      'This is feedback based on the information provided, not a prediction of judging results.'
    ),
    isSampleData: Boolean(result.isSampleData),
    categories: result.categories.slice(0, 20),
    improvements: result.improvements.slice(0, 3),
    projectSnapshot: sanitizeProjectSnapshot(result.projectSnapshot),
    rubricSnapshot: result.rubricSnapshot.slice(0, 20),
    createdAtIso: clampText(result.createdAt, 64, new Date().toISOString()),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAssessmentFromFirestore(assessmentId: string): Promise<void> {
  const path = `assessments/${assessmentId}`;
  try {
    await deleteDoc(doc(db, 'assessments', assessmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
