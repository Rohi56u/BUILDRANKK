import { GoogleGenAI, Type } from '@google/genai';
import { computeWeightedScore, getReadinessLabel } from '../src/lib/rubric.ts';
import { ASSESSMENT_DISCLAIMER } from '../src/lib/sampleAssessor.ts';
import type {
  AssessmentResult,
  CategoryAssessment,
  PrioritizedImprovement,
  ProjectInput,
  RubricCriterion,
} from '../src/types/buildrank.ts';

export const GEMINI_MODEL = 'gemini-4-hydrogen';

interface RawGeminiCategory {
  criterionId: string;
  score: number;
  evidenceStatus: string;
  rationale: string;
  citedEvidence: Array<{ sourceField: string; excerpt: string }>;
  missingInformation?: string;
  followUpQuestion?: string;
}

interface RawGeminiImprovement {
  priority: number;
  title: string;
  targetCriterion: string;
  reason: string;
  nextAction: string;
}

interface RawGeminiResponse {
  overallExplanation: string;
  categories: RawGeminiCategory[];
  improvements: RawGeminiImprovement[];
}

function normalizeEvidenceStatus(raw: string): CategoryAssessment['evidenceStatus'] {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('not enough')) return 'Not enough information';
  if (lower.includes('partial')) return 'Partial evidence';
  return 'Sufficient evidence';
}

export async function runGeminiAssessment(
  apiKey: string,
  project: ProjectInput,
  rubric: RubricCriterion[],
  isSampleData = false
): Promise<AssessmentResult> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = [
    'You are BuildRank, an objective hackathon preparation reviewer evaluating a team’s submitted project against an explicit weighted judging rubric.',
    'Rules you must follow strictly:',
    '1. Base every score, rationale, cited evidence excerpt, and recommendation ONLY on the text provided by the user below.',
    '2. NEVER invent or assume product features, users served, metrics, benchmarks, test coverage, integrations, or source code details that were not explicitly provided.',
    '3. Note that if a GitHub URL is listed without README content, or with only a README excerpt, you have NOT inspected source code.',
    '4. For any criterion where the submitted information is too thin or missing to judge fairly, set evidenceStatus to "Not enough information", explain exactly what is missing in missingInformation, ask one clear followUpQuestion, and keep the score conservative (<= 48).',
    '5. When evidence exists, cite brief verbatim excerpts in citedEvidence along with the exact sourceField name (e.g., "Problem being solved", "What is currently working", "README / project notes").',
    '6. Return exactly one category assessment per rubric criterion using the exact criterionId provided, and exactly 3 prioritized improvements ordered 1, 2, 3.',
    '7. Never predict judging outcomes, ranks, prizes, or percentile standings.',
  ].join('\n');

  const submissionContext = {
    project: {
      projectName: project.projectName,
      problem: project.problem,
      intendedUsers: project.intendedUsers,
      solution: project.solution,
      workingStatus: project.workingStatus,
      technologies: project.technologies || '(Not provided)',
      githubUrl: project.githubUrl || '(Not provided)',
      githubPublicReadme: project.githubContext
        ? {
            repository: project.githubContext.fullName,
            description: project.githubContext.description,
            primaryLanguage: project.githubContext.language,
            readmeExcerpt: project.githubContext.readmeExcerpt,
          }
        : null,
      pastedOrUploadedReadme: project.readmeText || '(Not provided)',
    },
    rubric: rubric.map((c) => ({
      criterionId: c.id,
      name: c.name,
      description: c.description,
      weightPercent: c.weight,
    })),
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Evaluate the following hackathon project submission against the provided rubric:\n\n${JSON.stringify(
      submissionContext,
      null,
      2
    )}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallExplanation: {
            type: Type.STRING,
            description:
              '2-3 sentences summarizing what the overall score means based strictly on the submitted information, without predicting judge outcomes.',
          },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                criterionId: { type: Type.STRING },
                score: {
                  type: Type.NUMBER,
                  description: 'Integer score from 0 to 100 based solely on provided evidence.',
                },
                evidenceStatus: {
                  type: Type.STRING,
                  description: 'One of: "Sufficient evidence", "Partial evidence", or "Not enough information".',
                },
                rationale: { type: Type.STRING },
                citedEvidence: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sourceField: { type: Type.STRING },
                      excerpt: { type: Type.STRING },
                    },
                    required: ['sourceField', 'excerpt'],
                  },
                },
                missingInformation: {
                  type: Type.STRING,
                  description: 'What is missing if evidenceStatus is not Sufficient evidence, else empty string.',
                },
                followUpQuestion: {
                  type: Type.STRING,
                  description: 'One clear follow-up question if information is missing, else empty string.',
                },
              },
              required: ['criterionId', 'score', 'evidenceStatus', 'rationale', 'citedEvidence'],
            },
          },
          improvements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                priority: { type: Type.INTEGER },
                title: { type: Type.STRING },
                targetCriterion: { type: Type.STRING },
                reason: { type: Type.STRING },
                nextAction: { type: Type.STRING },
              },
              required: ['priority', 'title', 'targetCriterion', 'reason', 'nextAction'],
            },
          },
        },
        required: ['overallExplanation', 'categories', 'improvements'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Model returned an empty response.');
  }

  let parsed: RawGeminiResponse;
  try {
    parsed = JSON.parse(rawText) as RawGeminiResponse;
  } catch {
    throw new Error('Model response was not valid JSON.');
  }

  if (
    !parsed ||
    typeof parsed.overallExplanation !== 'string' ||
    !Array.isArray(parsed.categories) ||
    !Array.isArray(parsed.improvements)
  ) {
    throw new Error('Model response did not match the required assessment structure.');
  }

  const categoryById = new Map<string, RawGeminiCategory>();
  for (const item of parsed.categories) {
    if (item && typeof item.criterionId === 'string') {
      categoryById.set(item.criterionId, item);
    }
  }

  const categories: CategoryAssessment[] = rubric.map((criterion) => {
    const rawCat = categoryById.get(criterion.id);
    if (!rawCat) {
      throw new Error(`Model response omitted rubric criterion "${criterion.name}".`);
    }
    const rawScore = Number(rawCat.score);
    if (!Number.isFinite(rawScore)) {
      throw new Error(`Invalid numeric score returned for "${criterion.name}".`);
    }

    const evidenceStatus = normalizeEvidenceStatus(String(rawCat.evidenceStatus ?? 'Partial evidence'));
    const clampedScore =
      evidenceStatus === 'Not enough information'
        ? Math.max(0, Math.min(48, Math.round(rawScore)))
        : Math.max(0, Math.min(100, Math.round(rawScore)));
    const weightedContribution = Math.round(((clampedScore * criterion.weight) / 100) * 10) / 10;

    const citedEvidence = Array.isArray(rawCat.citedEvidence)
      ? rawCat.citedEvidence
          .filter((ev) => ev && typeof ev.sourceField === 'string' && typeof ev.excerpt === 'string' && ev.excerpt.trim())
          .slice(0, 3)
          .map((ev) => ({ sourceField: ev.sourceField.trim(), excerpt: ev.excerpt.trim() }))
      : [];

    const missingInformation =
      typeof rawCat.missingInformation === 'string' && rawCat.missingInformation.trim()
        ? rawCat.missingInformation.trim()
        : evidenceStatus === 'Not enough information'
          ? `Concrete details supporting "${criterion.name}" were not found in the submission.`
          : null;

    const followUpQuestion =
      typeof rawCat.followUpQuestion === 'string' && rawCat.followUpQuestion.trim()
        ? rawCat.followUpQuestion.trim()
        : evidenceStatus === 'Not enough information'
          ? `What specific evidence or build progress demonstrates "${criterion.name}"?`
          : null;

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      weight: criterion.weight,
      score: clampedScore,
      weightedContribution,
      evidenceStatus,
      rationale: String(rawCat.rationale ?? '').trim() || 'Evaluated against the submitted project information.',
      citedEvidence,
      missingInformation,
      followUpQuestion,
    };
  });

  const improvements: PrioritizedImprovement[] = parsed.improvements
    .slice(0, 3)
    .map((imp, idx) => ({
      priority: (idx + 1) as 1 | 2 | 3,
      title: String(imp.title ?? '').trim() || `Improvement ${idx + 1}`,
      targetCriterion: String(imp.targetCriterion ?? '').trim() || rubric[0]?.name || 'General',
      reason: String(imp.reason ?? '').trim() || 'Addresses a gap in the current rubric evidence.',
      nextAction: String(imp.nextAction ?? '').trim() || 'Update the project submission with concrete details.',
    }));

  if (improvements.length === 0) {
    throw new Error('Model response did not include prioritized improvements.');
  }

  const overallScore = computeWeightedScore(categories);
  const insufficientCount = categories.filter((c) => c.evidenceStatus === 'Not enough information').length;
  const readinessLabel = getReadinessLabel(overallScore, insufficientCount);

  const calculationFormula = `${categories
    .map((c) => `${c.criterionName}: ${c.score} × ${c.weight}% = ${c.weightedContribution}`)
    .join(' + ')} → ${overallScore} / 100`;

  return {
    id: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    mode: 'gemini',
    modeNotice: `Evaluated via server-side AI rubric review (${GEMINI_MODEL}) using only the information you submitted.`,
    modelName: GEMINI_MODEL,
    fallbackReason: null,
    overallScore,
    readinessLabel,
    overallExplanation: parsed.overallExplanation.trim(),
    calculationFormula,
    categories,
    improvements,
    disclaimer: ASSESSMENT_DISCLAIMER,
    projectSnapshot: project,
    rubricSnapshot: rubric,
    isSampleData,
  };
}
