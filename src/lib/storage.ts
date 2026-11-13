import type { AssessmentResult, ProjectInput, RubricCriterion } from '../types/buildrank.ts';
import { DEFAULT_RUBRIC, EMPTY_PROJECT_INPUT } from './rubric.ts';

const ASSESSMENTS_KEY = 'buildrank.assessments.v1';
const DRAFT_KEY = 'buildrank.draft.v1';
const MAX_STORED_ASSESSMENTS = 20;

export interface SavedDraft {
  project: ProjectInput;
  rubric: RubricCriterion[];
  rubricMode: 'default' | 'custom';
  updatedAt: string;
}

export function loadAssessments(): AssessmentResult[] {
  try {
    const raw = localStorage.getItem(ASSESSMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveAssessment(result: AssessmentResult): AssessmentResult[] {
  const existing = loadAssessments().filter((item) => item.id !== result.id);
  const next = [result, ...existing].slice(0, MAX_STORED_ASSESSMENTS);
  try {
    localStorage.setItem(ASSESSMENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors gracefully
  }
  return next;
}

export function deleteAssessment(id: string): AssessmentResult[] {
  const next = loadAssessments().filter((item) => item.id !== id);
  try {
    localStorage.setItem(ASSESSMENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function loadDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedDraft>;
    if (!parsed || !parsed.project || !Array.isArray(parsed.rubric)) return null;
    return {
      project: { ...EMPTY_PROJECT_INPUT, ...parsed.project },
      rubric: parsed.rubric.length > 0 ? parsed.rubric : DEFAULT_RUBRIC,
      rubricMode: parsed.rubricMode === 'custom' ? 'custom' : 'default',
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<SavedDraft, 'updatedAt'>): string {
  const updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt }));
  } catch {
    // Ignore storage quota errors
  }
  return updatedAt;
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore
  }
}
