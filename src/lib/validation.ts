import type { ProjectInput, RubricCriterion } from '../types/buildrank.ts';
import { sumRubricWeights } from './rubric.ts';

export const MAX_README_FILE_BYTES = 512 * 1024; // 512 KB

export interface ProjectValidationErrors {
  projectName?: string;
  problem?: string;
  intendedUsers?: string;
  solution?: string;
  workingStatus?: string;
  githubUrl?: string;
  rubric?: string;
}

export function isValidGitHubRepoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return false;
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
}

export function parseGitHubOwnerRepo(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/i, '');
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function validateUploadedReadmeFile(file: { name: string; size: number }): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.txt') && !lower.endsWith('.md')) {
    return 'Unsupported file type. Upload a .txt or .md file.';
  }
  if (file.size === 0) {
    return 'The uploaded file is empty.';
  }
  if (file.size > MAX_README_FILE_BYTES) {
    return 'File is larger than 512 KB. Paste the core README sections instead.';
  }
  return null;
}

export function validateProjectAndRubric(
  project: ProjectInput,
  rubric: RubricCriterion[]
): ProjectValidationErrors {
  const errors: ProjectValidationErrors = {};

  if (!project.projectName.trim()) {
    errors.projectName = 'Enter a project name so teams and reports stay identifiable.';
  }
  if (project.problem.trim().length < 15) {
    errors.problem = 'Describe the problem in at least a short sentence (15+ characters).';
  }
  if (project.intendedUsers.trim().length < 8) {
    errors.intendedUsers = 'Specify who the intended users are (8+ characters).';
  }
  if (project.solution.trim().length < 15) {
    errors.solution = 'Explain your proposed solution in at least a short sentence (15+ characters).';
  }
  if (project.workingStatus.trim().length < 10) {
    errors.workingStatus = 'State what is currently working or built so far (10+ characters).';
  }
  if (project.githubUrl.trim() && !isValidGitHubRepoUrl(project.githubUrl)) {
    errors.githubUrl = 'Enter a valid GitHub repository URL (for example, https://github.com/owner/repo).';
  }

  if (rubric.length === 0) {
    errors.rubric = 'Add at least one judging criterion before assessing.';
  } else if (rubric.some((c) => !c.name.trim())) {
    errors.rubric = 'Every judging criterion must have a name.';
  } else if (rubric.some((c) => !Number.isFinite(c.weight) || c.weight <= 0)) {
    errors.rubric = 'Each criterion weight must be greater than 0%.';
  } else {
    const total = sumRubricWeights(rubric);
    if (Math.abs(total - 100) > 0.01) {
      const diff = Math.round((total - 100) * 10) / 10;
      const direction = diff > 0 ? `${diff}% over` : `${Math.abs(diff)}% short of`;
      errors.rubric = `Rubric weights currently total ${total}% (${direction} 100%). Adjust weights or normalize them to 100%.`;
    }
  }

  return errors;
}
