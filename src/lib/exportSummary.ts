import type { AssessmentResult } from '../types/buildrank.ts';

export function formatAssessmentAsMarkdown(result: AssessmentResult): string {
  const lines: string[] = [];
  const formattedDate = new Date(result.createdAt).toLocaleString();

  lines.push(`# BuildRank Assessment — ${result.projectSnapshot.projectName}`);
  lines.push(`Date: ${formattedDate}`);
  lines.push(
    `Mode: ${result.mode === 'gemini' ? `AI Rubric Review (${result.modelName ?? 'Gemini'})` : 'Sample assessment mode (deterministic rubric check)'}`
  );
  lines.push(`Overall Score: ${result.overallScore} / 100 (${result.readinessLabel})`);
  lines.push('');
  lines.push(result.overallExplanation);
  lines.push('');
  lines.push(`Calculation: ${result.calculationFormula}`);
  lines.push('');
  lines.push('## Category Breakdown');

  for (const cat of result.categories) {
    lines.push(
      `### ${cat.criterionName} — ${cat.score} / 100 (Weight: ${cat.weight}%, Contribution: ${cat.weightedContribution})`
    );
    lines.push(`Evidence Status: ${cat.evidenceStatus}`);
    lines.push(`Rationale: ${cat.rationale}`);
    if (cat.citedEvidence.length > 0) {
      lines.push('Cited Evidence:');
      for (const ev of cat.citedEvidence) {
        lines.push(`- [${ev.sourceField}] "${ev.excerpt}"`);
      }
    }
    if (cat.missingInformation) {
      lines.push(`Missing Information: ${cat.missingInformation}`);
    }
    if (cat.followUpQuestion) {
      lines.push(`Follow-up Question: ${cat.followUpQuestion}`);
    }
    lines.push('');
  }

  lines.push('## Top 3 Prioritized Improvements');
  for (const imp of result.improvements) {
    lines.push(`${imp.priority}. **${imp.title}** (${imp.targetCriterion})`);
    lines.push(`   - Why it matters: ${imp.reason}`);
    lines.push(`   - Next action: ${imp.nextAction}`);
  }

  lines.push('');
  lines.push(`> ${result.disclaimer}`);
  return lines.join('\n');
}
