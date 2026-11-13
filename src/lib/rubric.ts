import type { ProjectInput, ReadinessLabel, RubricCriterion } from '../types/buildrank.ts';

export const DEFAULT_RUBRIC: RubricCriterion[] = [
  {
    id: 'problem-clarity',
    name: 'Problem clarity and relevance',
    description: 'How clearly the team defines the pain point, who experiences it, and why solving it matters now.',
    weight: 20,
  },
  {
    id: 'innovation',
    name: 'Innovation',
    description: 'What is genuinely distinctive about the approach compared with existing workflows or tools.',
    weight: 20,
  },
  {
    id: 'technical-execution',
    name: 'Technical execution',
    description: 'Evidence of a real working build, clear architecture, stack choices, and honest scope.',
    weight: 25,
  },
  {
    id: 'user-impact',
    name: 'User impact',
    description: 'How concretely intended users benefit and whether the workflow fits real-world constraints.',
    weight: 20,
  },
  {
    id: 'demo-readiness',
    name: 'Demo and presentation readiness',
    description: 'Whether documentation, live working flow, and framing are ready for a short judge demo.',
    weight: 15,
  },
];

export const EMPTY_PROJECT_INPUT: ProjectInput = {
  projectName: '',
  problem: '',
  intendedUsers: '',
  solution: '',
  workingStatus: '',
  technologies: '',
  githubUrl: '',
  readmeText: '',
  uploadedFileName: undefined,
  githubContext: null,
};

export const SAMPLE_DEMO_PROJECT: ProjectInput = {
  projectName: 'Sample Project: Campus Pantry Connect',
  problem:
    'Student food pantries at mid-sized universities often throw away fresh produce on Friday afternoons because students do not know what arrived that morning, while busy commuters miss limited pickup windows.',
  intendedUsers:
    'University pantry coordinators (2-3 staff per campus) and food-insecure students commuting between classes.',
  solution:
    'A lightweight web board where pantry staff post same-day inventory batches in under 60 seconds and students reserve a 15-minute pickup slot without creating a full account.',
  workingStatus:
    'Staff batch creation form, student pickup reservation view, and local SQLite persistence are working end-to-end in our local demo. SMS reminder webhooks are stubbed for post-hackathon work.',
  technologies: 'React, TypeScript, Tailwind CSS, Express, SQLite',
  githubUrl: '',
  readmeText:
    '# Campus Pantry Connect (Sample Demo Data)\n\nBuilt during a 36-hour campus civic hackathon.\n\n## Working flow\n- Staff enters item category, quantity, and pickup cutoff time.\n- Live public board updates slot counts immediately.\n- QR reservation code renders for pickup check-in.\n\n## Known gaps\n- No university SSO yet; uses temporary 4-digit pickup codes.\n- No mobile push notifications; only on-screen confirmation.',
  uploadedFileName: undefined,
  githubContext: null,
};

export function sumRubricWeights(criteria: RubricCriterion[]): number {
  return criteria.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);
}

export function normalizeRubricWeights(criteria: RubricCriterion[]): RubricCriterion[] {
  if (criteria.length === 0) return [];
  const cleanWeights = criteria.map((c) => Math.max(0, Number.isFinite(c.weight) ? c.weight : 0));
  const total = cleanWeights.reduce((acc, w) => acc + w, 0);

  if (total === 0) {
    const even = Math.floor(100 / criteria.length);
    const remainder = 100 - even * criteria.length;
    return criteria.map((c, idx) => ({
      ...c,
      weight: even + (idx === 0 ? remainder : 0),
    }));
  }

  const rawScaled = cleanWeights.map((w) => (w / total) * 100);
  const floored = rawScaled.map((v) => Math.floor(v));
  let remainder = 100 - floored.reduce((acc, v) => acc + v, 0);

  const fractions = rawScaled
    .map((val, idx) => ({ idx, frac: val - floored[idx] }))
    .sort((a, b) => b.frac - a.frac);

  let pointer = 0;
  while (remainder > 0 && fractions.length > 0) {
    floored[fractions[pointer % fractions.length].idx] += 1;
    remainder -= 1;
    pointer += 1;
  }

  return criteria.map((c, idx) => ({
    ...c,
    weight: floored[idx],
  }));
}

export function getReadinessLabel(overallScore: number, insufficientCount: number): ReadinessLabel {
  if (insufficientCount >= 2 || overallScore < 55) {
    return 'Needs more detail';
  }
  if (overallScore >= 78 && insufficientCount === 0) {
    return 'Demo-ready';
  }
  return 'Promising';
}

export function computeWeightedScore(
  categories: Array<{ score: number; weight: number }>
): number {
  const total = categories.reduce((sum, cat) => sum + (cat.score * cat.weight) / 100, 0);
  return Math.round(total * 10) / 10;
}
