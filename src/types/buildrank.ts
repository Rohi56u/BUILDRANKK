export type ReadinessLabel = 'Needs more detail' | 'Promising' | 'Demo-ready';

export type AssessmentMode = 'gemini' | 'sample';

export interface GitHubRepoContext {
  url: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  readmeExcerpt: string;
  fetchedAt: string;
}

export interface ProjectInput {
  projectName: string;
  problem: string;
  intendedUsers: string;
  solution: string;
  workingStatus: string;
  technologies: string;
  githubUrl: string;
  readmeText: string;
  uploadedFileName?: string;
  githubContext?: GitHubRepoContext | null;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface CitedEvidence {
  sourceField: string;
  excerpt: string;
}

export interface CategoryAssessment {
  criterionId: string;
  criterionName: string;
  weight: number;
  score: number;
  weightedContribution: number;
  evidenceStatus: 'Sufficient evidence' | 'Partial evidence' | 'Not enough information';
  rationale: string;
  citedEvidence: CitedEvidence[];
  missingInformation: string | null;
  followUpQuestion: string | null;
}

export interface PrioritizedImprovement {
  priority: 1 | 2 | 3;
  title: string;
  targetCriterion: string;
  reason: string;
  nextAction: string;
}

export interface AssessmentResult {
  id: string;
  createdAt: string;
  mode: AssessmentMode;
  modeNotice: string;
  modelName: string | null;
  fallbackReason?: string | null;
  overallScore: number;
  readinessLabel: ReadinessLabel;
  overallExplanation: string;
  calculationFormula: string;
  categories: CategoryAssessment[];
  improvements: PrioritizedImprovement[];
  disclaimer: string;
  projectSnapshot: ProjectInput;
  rubricSnapshot: RubricCriterion[];
  isSampleData?: boolean;
}

export interface ApiStatusResponse {
  aiConfigured: boolean;
  mode: AssessmentMode;
  model: string | null;
}

export interface GitHubFetchResponse {
  ok: boolean;
  context?: GitHubRepoContext;
  reason?: string;
  message: string;
}
