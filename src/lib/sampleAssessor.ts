import type {
  AssessmentResult,
  CategoryAssessment,
  CitedEvidence,
  PrioritizedImprovement,
  ProjectInput,
  RubricCriterion,
} from '../types/buildrank.ts';
import { computeWeightedScore, getReadinessLabel } from './rubric.ts';

export const ASSESSMENT_DISCLAIMER =
  'This is feedback based on the information provided, not a prediction of judging results.';

export const SAMPLE_MODE_NOTICE =
  'Sample assessment mode is active because no AI provider key is configured on the server. Scores and feedback below are generated deterministically from your submitted text using transparent rubric checks. An administrator can enable AI rubric review by setting GEMINI_API_KEY in the server environment or Settings > Secrets.';

function truncateExcerpt(text: string, maxLen = 175): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function findMatchingKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw));
}

function evaluateCriterionDeterministically(
  criterion: RubricCriterion,
  project: ProjectInput
): CategoryAssessment {
  const idLower = criterion.id.toLowerCase();
  const nameLower = criterion.name.toLowerCase();
  const readmeCombined = [
    project.readmeText.trim(),
    project.githubContext?.readmeExcerpt?.trim() ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const allText = [
    project.problem,
    project.intendedUsers,
    project.solution,
    project.workingStatus,
    project.technologies,
    readmeCombined,
  ]
    .filter(Boolean)
    .join(' ');

  const evidence: CitedEvidence[] = [];
  let score = 0;
  let missingInformation: string | null = null;
  let followUpQuestion: string | null = null;
  let rationale = '';
  let evidenceStatus: CategoryAssessment['evidenceStatus'] = 'Sufficient evidence';

  if (idLower.includes('problem') || nameLower.includes('problem')) {
    const problemWords = countWords(project.problem);
    const userWords = countWords(project.intendedUsers);
    const specificityHits = findMatchingKeywords(project.problem, [
      'because',
      'miss',
      'waste',
      'hour',
      'minute',
      'delay',
      'cost',
      'manual',
      'difficult',
      'fail',
      'struggle',
      'without',
      'gap',
      'error',
      'often',
      '%',
    ]);

    if (project.problem.trim()) {
      evidence.push({ sourceField: 'Problem being solved', excerpt: truncateExcerpt(project.problem) });
    }
    if (project.intendedUsers.trim()) {
      evidence.push({ sourceField: 'Intended users', excerpt: truncateExcerpt(project.intendedUsers) });
    }

    if (problemWords < 12 || userWords < 4) {
      evidenceStatus = 'Not enough information';
      score = Math.min(48, 25 + problemWords * 2);
      rationale =
        'The submission names a problem area, but does not yet provide enough concrete context about why it happens or who feels it most acutely.';
      missingInformation =
        'Specific friction, current workaround, or frequency/scale of the problem for the intended users.';
      followUpQuestion =
        'What concrete pain or delay do your intended users experience today when trying to solve this without your project?';
    } else {
      const depthBonus = Math.min(28, Math.round(problemWords * 0.7));
      const userBonus = Math.min(18, userWords * 2);
      const specificBonus = Math.min(18, specificityHits.length * 6);
      score = Math.min(92, 30 + depthBonus + userBonus + specificBonus);
      if (specificityHits.length === 0) {
        evidenceStatus = 'Partial evidence';
        rationale =
          'The problem and intended audience are clearly stated, though adding a concrete example or measurable friction would strengthen judge conviction.';
        missingInformation = 'Observable consequence or baseline workaround currently used.';
        followUpQuestion = 'How do users handle this today, and where does that workaround break down?';
      } else {
        rationale =
          'Both the core pain point and target audience are articulated with concrete friction cues grounded in your project summary.';
      }
    }
  } else if (idLower.includes('innovation') || nameLower.includes('innovation') || nameLower.includes('creativ')) {
    const solutionWords = countWords(project.solution);
    const uniquenessHits = findMatchingKeywords(`${project.solution} ${readmeCombined}`, [
      'without',
      'instead',
      'under ',
      'real-time',
      'live',
      'automat',
      'lightweight',
      'novel',
      'unique',
      'different',
      'unlike',
      'first',
      'direct',
      'zero',
      'offline',
      'local',
    ]);

    if (project.solution.trim()) {
      evidence.push({ sourceField: 'Proposed solution', excerpt: truncateExcerpt(project.solution) });
    }
    if (readmeCombined) {
      evidence.push({ sourceField: 'README / project notes', excerpt: truncateExcerpt(readmeCombined) });
    }

    if (solutionWords < 14 && uniquenessHits.length === 0) {
      evidenceStatus = 'Not enough information';
      score = 38;
      rationale =
        'Your submission outlines what the product does, but does not clearly state what makes the approach distinct from existing alternatives.';
      missingInformation =
        'Comparison to existing alternatives or the specific design trade-off that makes your approach new.';
      followUpQuestion =
        'What is the single biggest difference between your approach and how teams or users handle this today?';
    } else if (uniquenessHits.length === 0) {
      evidenceStatus = 'Partial evidence';
      score = Math.min(72, 48 + Math.min(20, solutionWords));
      rationale =
        'The proposed solution is understandable, but the text does not explicitly explain why this design is novel compared with standard tools.';
      missingInformation = 'Explicit differentiation from existing tools or workflows.';
      followUpQuestion =
        'Why could a user not already accomplish this just as easily with a generic spreadsheet, form, or existing app?';
    } else {
      score = Math.min(89, 56 + Math.min(18, solutionWords * 0.5) + Math.min(15, uniquenessHits.length * 5));
      rationale =
        'Your solution description highlights clear design choices and differentiators that separate it from heavier or manual alternatives.';
    }
  } else if (
    idLower.includes('technical') ||
    nameLower.includes('technical') ||
    nameLower.includes('execution') ||
    nameLower.includes('engineering')
  ) {
    const workingWords = countWords(project.workingStatus);
    const techItems = project.technologies
      .split(/[,;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (project.workingStatus.trim()) {
      evidence.push({ sourceField: 'What is currently working', excerpt: truncateExcerpt(project.workingStatus) });
    }
    if (techItems.length > 0) {
      evidence.push({ sourceField: 'Technologies used', excerpt: techItems.join(', ') });
    }
    if (project.githubContext?.fullName) {
      evidence.push({
        sourceField: 'Public GitHub metadata',
        excerpt: `${project.githubContext.fullName}${project.githubContext.language ? ` (${project.githubContext.language})` : ''}`,
      });
    }

    if (workingWords < 10 || (techItems.length === 0 && !readmeCombined)) {
      evidenceStatus = 'Not enough information';
      score = Math.min(46, 22 + workingWords * 2 + techItems.length * 4);
      rationale =
        'There is not enough technical detail yet to verify how much of the system is genuinely implemented versus planned.';
      missingInformation =
        'Clear separation of working functionality from planned/stubbed parts, plus the technologies powering the build.';
      followUpQuestion =
        'Which specific user flow works end-to-end right now, and which parts (if any) are still mocked or unbuilt?';
    } else {
      const honestMarkers = findMatchingKeywords(`${project.workingStatus} ${readmeCombined}`, [
        'working',
        'end-to-end',
        'stub',
        'mock',
        'api',
        'database',
        'sqlite',
        'postgres',
        'persist',
        'gap',
        'deploy',
        'endpoint',
        'test',
      ]);
      const base = 42 + Math.min(22, workingWords * 0.8) + Math.min(16, techItems.length * 4) + Math.min(12, honestMarkers.length * 4);
      score = Math.min(91, Math.round(base));
      if (techItems.length === 0) {
        evidenceStatus = 'Partial evidence';
        rationale =
          'Working scope is described, though listing the core technologies or architecture components would help technical judges assess feasibility.';
        missingInformation = 'Core stack or architecture details.';
        followUpQuestion = 'What frameworks, APIs, or storage layer power the working prototype?';
      } else {
        rationale =
          'The submission pairs an explicit stack with concrete notes on what is currently implemented, making technical scope easy to evaluate.';
      }
    }
  } else if (idLower.includes('impact') || nameLower.includes('impact') || nameLower.includes('user')) {
    const userWords = countWords(project.intendedUsers);
    const solutionWords = countWords(project.solution);
    const outcomeHits = findMatchingKeywords(`${project.solution} ${project.problem} ${readmeCombined}`, [
      'save',
      'reduce',
      'minute',
      'second',
      'faster',
      'prevent',
      'access',
      'student',
      'team',
      'patient',
      'customer',
      'staff',
      'coordinator',
      'without creating',
      'check-in',
    ]);

    if (project.intendedUsers.trim()) {
      evidence.push({ sourceField: 'Intended users', excerpt: truncateExcerpt(project.intendedUsers) });
    }
    if (project.solution.trim()) {
      evidence.push({ sourceField: 'Proposed solution', excerpt: truncateExcerpt(project.solution) });
    }

    if (userWords < 5 || outcomeHits.length === 0) {
      evidenceStatus = 'Not enough information';
      score = Math.min(48, 28 + userWords * 2);
      rationale =
        'Intended users are mentioned briefly, but there is insufficient detail about the measurable or practical benefit they get from using the product.';
      missingInformation = 'Concrete user outcome (time saved, errors avoided, or access improved) and adoption constraints.';
      followUpQuestion =
        'If an intended user opens your app for the first time, what tangible improvement do they achieve in the first 2 minutes?';
    } else {
      score = Math.min(90, 48 + Math.min(18, userWords * 1.5) + Math.min(14, solutionWords * 0.4) + Math.min(12, outcomeHits.length * 4));
      rationale =
        'The intended user group is well scoped and the proposed workflow maps directly to practical constraints they face.';
    }
  } else if (idLower.includes('demo') || nameLower.includes('demo') || nameLower.includes('presentation')) {
    const hasReadme = countWords(readmeCombined) >= 20;
    const hasWorkingFlow = countWords(project.workingStatus) >= 12;
    const hasGithub = Boolean(project.githubContext?.readmeExcerpt);

    if (project.workingStatus.trim()) {
      evidence.push({ sourceField: 'What is currently working', excerpt: truncateExcerpt(project.workingStatus) });
    }
    if (readmeCombined) {
      evidence.push({
        sourceField: project.uploadedFileName ? `Uploaded file (${project.uploadedFileName})` : 'README / project notes',
        excerpt: truncateExcerpt(readmeCombined),
      });
    }

    if (!hasReadme && !hasWorkingFlow) {
      evidenceStatus = 'Not enough information';
      score = 32;
      rationale =
        'There is not enough supporting README context or step-by-step working flow to verify that the project is ready for a live demo.';
      missingInformation = 'A concise README or step-by-step walkthrough of what judges will see in a 3-minute live demo.';
      followUpQuestion =
        'What are the exact 3 steps you will click through during your live demo, and what is your backup if a network call fails?';
    } else if (!hasReadme || !hasWorkingFlow) {
      evidenceStatus = 'Partial evidence';
      score = hasWorkingFlow ? 64 : 56;
      rationale = hasWorkingFlow
        ? 'You describe working functionality, but adding a concise README or demo script would make judge handoff much stronger.'
        : 'Documentation notes are present, though the exact live working flow still needs sharper definition before demo time.';
      missingInformation = hasReadme
        ? 'Step-by-step confirmation of the live demo path.'
        : 'README summary or setup/walkthrough notes for judges reviewing asynchronously.';
      followUpQuestion = hasReadme
        ? 'Which exact screens or endpoints are safe to demonstrate live to judges?'
        : 'Can you add a short README summarizing setup, the working demo flow, and known limitations?';
      if (!hasGithub && !readmeCombined && evidence.length === 0) {
        evidenceStatus = 'Not enough information';
      }
    } else {
      score = Math.min(90, 66 + (hasGithub ? 10 : 0) + Math.min(14, Math.floor(countWords(readmeCombined) / 10)));
      rationale =
        'Both working product scope and written README context are present, giving judges a clear narrative for a live presentation.';
    }
  } else {
    // Custom criterion added by the user: evaluate dynamically against criterion name & description terms
    const criterionTerms = `${criterion.name} ${criterion.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !['with', 'that', 'this', 'from', 'have', 'they', 'your', 'about', 'what', 'when', 'how'].includes(word));

    const matchedTerms = Array.from(new Set(findMatchingKeywords(allText, criterionTerms)));
    const totalWords = countWords(allText);

    if (project.solution.trim()) {
      evidence.push({ sourceField: 'Proposed solution', excerpt: truncateExcerpt(project.solution) });
    }
    if (project.workingStatus.trim()) {
      evidence.push({ sourceField: 'What is currently working', excerpt: truncateExcerpt(project.workingStatus) });
    }

    if (matchedTerms.length === 0 || totalWords < 45) {
      evidenceStatus = 'Not enough information';
      score = Math.min(44, 24 + matchedTerms.length * 8);
      rationale = `Your submitted project details do not directly address "${criterion.name}" yet.`;
      missingInformation = `Explicit evidence showing how the project satisfies "${criterion.name}".`;
      followUpQuestion = `What specific detail in your build or user workflow demonstrates "${criterion.name}"?`;
    } else if (matchedTerms.length < 2) {
      evidenceStatus = 'Partial evidence';
      score = 64;
      rationale = `Related context appears in your submission (${matchedTerms.join(', ')}), though expanding on "${criterion.name}" would make the case explicit.`;
      missingInformation = `Deeper detail specifically addressing "${criterion.name}".`;
      followUpQuestion = `How would you summarize your strongest proof point for "${criterion.name}" in one sentence?`;
    } else {
      score = Math.min(86, 60 + matchedTerms.length * 6);
      rationale = `Your submission contains relevant context matching "${criterion.name}" (${matchedTerms.slice(0, 4).join(', ')}).`;
    }
  }

  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const weightedContribution = Math.round(((roundedScore * criterion.weight) / 100) * 10) / 10;

  return {
    criterionId: criterion.id,
    criterionName: criterion.name,
    weight: criterion.weight,
    score: roundedScore,
    weightedContribution,
    evidenceStatus,
    rationale,
    citedEvidence: evidence.slice(0, 3),
    missingInformation,
    followUpQuestion,
  };
}

function buildPrioritizedImprovements(
  categories: CategoryAssessment[],
  project: ProjectInput
): PrioritizedImprovement[] {
  const sortedByImpactGap = [...categories].sort((a, b) => {
    const gapA = ((100 - a.score) * a.weight) / 100 + (a.evidenceStatus === 'Not enough information' ? 12 : 0);
    const gapB = ((100 - b.score) * b.weight) / 100 + (b.evidenceStatus === 'Not enough information' ? 12 : 0);
    return gapB - gapA;
  });

  const improvements: PrioritizedImprovement[] = [];

  for (let i = 0; i < Math.min(3, sortedByImpactGap.length); i++) {
    const cat = sortedByImpactGap[i];
    const priority = (i + 1) as 1 | 2 | 3;

    if (cat.evidenceStatus === 'Not enough information') {
      improvements.push({
        priority,
        title: `Supply missing evidence for ${cat.criterionName}`,
        targetCriterion: cat.criterionName,
        reason: `${cat.criterionName} carries ${cat.weight}% of the rubric weight and is currently flagged "Not enough information", which pulls down readiness.`,
        nextAction:
          cat.followUpQuestion ??
          `Add 2–3 concrete sentences addressing ${cat.criterionName} in the project assessment form and re-run.`,
      });
    } else if (cat.criterionId === 'demo-readiness' && !project.readmeText.trim() && !project.githubContext?.readmeExcerpt) {
      improvements.push({
        priority,
        title: 'Add a short judge-facing README or demo script',
        targetCriterion: cat.criterionName,
        reason: 'Judges often skim READMEs before or after a 3-minute pitch; without one, working features are easy to overlook.',
        nextAction:
          'Write a 150-word README listing the 3-step live demo flow, core stack, and any mocked/unbuilt pieces, then paste or upload it.',
      });
    } else if (cat.criterionId === 'technical-execution' && !project.technologies.trim()) {
      improvements.push({
        priority,
        title: 'Document your stack and working architecture',
        targetCriterion: cat.criterionName,
        reason: `Technical execution carries ${cat.weight}% weight; naming the frameworks, data layer, and APIs clarifies real engineering effort.`,
        nextAction:
          'Fill in the "Technologies used" field and specify which parts run live versus mocked in "What is currently working".',
      });
    } else {
      improvements.push({
        priority,
        title: `Sharpen concrete proof for ${cat.criterionName}`,
        targetCriterion: cat.criterionName,
        reason: `${cat.criterionName} (${cat.weight}% weight) scored ${cat.score}/100 and offers the next-highest weighted gain on your rubric.`,
        nextAction:
          cat.followUpQuestion ??
          `Review the rationale for ${cat.criterionName} and add one specific user example or measurable detail grounded in what you built.`,
      });
    }
  }

  // Ensure exactly 3 improvements even if user created a 1- or 2-criterion custom rubric
  const fallbackTemplates: Array<Omit<PrioritizedImprovement, 'priority'>> = [
    {
      title: 'Rehearse a 90-second live demo path with a fallback',
      targetCriterion: categories[0]?.criterionName ?? 'Overall presentation',
      reason: 'Short hackathon pitches leave little time for setup; starting directly on the working user flow keeps judges focused.',
      nextAction: 'Record or dry-run the exact clicks from problem statement to working outcome and verify offline/error states.',
    },
    {
      title: 'State clear scope boundaries between built and planned features',
      targetCriterion: categories[0]?.criterionName ?? 'Technical honesty',
      reason: 'Judges trust teams who clearly separate working code from future roadmap items instead of overclaiming.',
      nextAction: 'Add a one-line "What is live vs. mocked" note in your README and submission summary.',
    },
    {
      title: 'Tie your closing takeaway back to the intended user',
      targetCriterion: categories[0]?.criterionName ?? 'User impact',
      reason: 'Ending on the concrete before-and-after difference for the target user reinforces why the build matters.',
      nextAction: 'Write one closing sentence stating who benefits and what friction disappears when they use your working prototype.',
    },
  ];

  let templateIdx = 0;
  while (improvements.length < 3 && templateIdx < fallbackTemplates.length) {
    improvements.push({
      priority: (improvements.length + 1) as 1 | 2 | 3,
      ...fallbackTemplates[templateIdx],
    });
    templateIdx += 1;
  }

  return improvements.slice(0, 3);
}

export function runSampleAssessment(
  project: ProjectInput,
  rubric: RubricCriterion[],
  options?: { fallbackReason?: string | null; isSampleData?: boolean }
): AssessmentResult {
  const categories = rubric.map((criterion) => evaluateCriterionDeterministically(criterion, project));
  const overallScore = computeWeightedScore(categories);
  const insufficientCount = categories.filter((c) => c.evidenceStatus === 'Not enough information').length;
  const readinessLabel = getReadinessLabel(overallScore, insufficientCount);

  const calculationParts = categories.map(
    (c) => `${c.criterionName}: ${c.score} × ${c.weight}% = ${c.weightedContribution}`
  );
  const calculationFormula = `${calculationParts.join(' + ')} → ${overallScore} / 100`;

  let overallExplanation = '';
  if (readinessLabel === 'Demo-ready') {
    overallExplanation =
      'Based only on the submitted information, every rubric category has supporting evidence and a clear narrative ready for a hackathon submission or demo.';
  } else if (readinessLabel === 'Promising') {
    overallExplanation =
      'Based only on the submitted information, the core project direction is clear, though tightening specific evidence gaps will strengthen your pitch before judging.';
  } else {
    overallExplanation =
      'Based only on the submitted information, key judging categories are missing concrete evidence. Filling those gaps will make your submission much clearer to judges.';
  }

  const improvements = buildPrioritizedImprovements(categories, project);

  return {
    id: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    mode: 'sample',
    modeNotice: SAMPLE_MODE_NOTICE,
    modelName: null,
    fallbackReason: options?.fallbackReason ?? null,
    overallScore,
    readinessLabel,
    overallExplanation,
    calculationFormula,
    categories,
    improvements,
    disclaimer: ASSESSMENT_DISCLAIMER,
    projectSnapshot: project,
    rubricSnapshot: rubric,
    isSampleData: options?.isSampleData ?? false,
  };
}
