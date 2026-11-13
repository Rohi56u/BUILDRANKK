import React, { useState } from 'react';
import {
  AlertCircle,
  Box,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  HelpCircle,
  Info,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { formatAssessmentAsMarkdown } from '../lib/exportSummary.ts';
import type { AssessmentResult, CategoryAssessment } from '../types/buildrank.ts';
import { ReadinessIndicator } from './DashboardView.tsx';

interface ResultsViewProps {
  result: AssessmentResult;
  isReassessing: boolean;
  reassessError: string | null;
  onEditProject: () => void;
  onReassess: () => void;
  onOpenInStudio: () => void;
  onBackToDashboard: () => void;
}

function EvidenceStatusLabel({ status }: { status: CategoryAssessment['evidenceStatus'] }) {
  if (status === 'Sufficient evidence') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f6b48] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Sufficient evidence</span>
      </span>
    );
  }
  if (status === 'Partial evidence') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a15d1f] whitespace-nowrap">
        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Partial evidence</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8c3c3c] whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Not enough information</span>
    </span>
  );
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  result,
  isReassessing,
  reassessError,
  onEditProject,
  onReassess,
  onOpenInStudio,
  onBackToDashboard,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = async () => {
    const markdown = formatAssessmentAsMarkdown(result);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy via temporary textarea
      const el = document.createElement('textarea');
      el.value = markdown;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const formattedDate = new Date(result.createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12 print:space-y-6 print:pb-0">
      {/* Print-Only PDF Report Header */}
      <div className="hidden print-only border-b border-[#d8d0c8] pb-3 mb-4">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-xl font-semibold text-[#2a221d]">BuildRank</span>
          <span className="text-xs text-[#5c5048]">
            Rubric Readiness Report · Exported {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Top Action Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(216,208,200,0.65)] pb-5">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="text-sm font-medium text-[#5c5048] hover:text-[#2a221d] self-start cursor-pointer"
        >
          ← All assessments
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenInStudio}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Box className="w-4 h-4 text-[#c2652a]" aria-hidden="true" />
            <span>View in 3D Studio</span>
          </button>

          <button
            type="button"
            onClick={onEditProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Edit3 className="w-4 h-4" aria-hidden="true" />
            <span>Edit project</span>
          </button>

          <button
            type="button"
            onClick={onReassess}
            disabled={isReassessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-[#c2652a] hover:bg-[#a8531e] rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isReassessing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isReassessing ? 'Reassessing…' : 'Reassess'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#2f6b48]" aria-hidden="true" />
                <span>Copied summary</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#2a221d] hover:border-[#c2652a] bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print or Download</span>
          </button>
        </div>
      </div>

      {reassessError && (
        <div role="alert" className="no-print bg-[#faeeee] text-[#8c3c3c] rounded-xl px-5 py-3.5 text-sm">
          {reassessError}
        </div>
      )}

      {/* Overall Readiness Summary Card */}
      <section
        aria-labelledby="overall-score-heading"
        className="print-card bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a6d64]">
              <span>Assessed {formattedDate}</span>
              <span aria-hidden="true">·</span>
              <span>
                {result.mode === 'gemini'
                  ? `AI Rubric Review (${result.modelName ?? 'Gemini'})`
                  : 'Sample assessment mode'}
              </span>
              {result.isSampleData && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#a15d1f]">Sample project data</span>
                </>
              )}
            </div>

            <h1
              id="overall-score-heading"
              className="font-serif text-3xl sm:text-4xl font-semibold text-[#2a221d]"
            >
              {result.projectSnapshot.projectName}
            </h1>

            <p className="text-sm sm:text-base text-[#5c5048] leading-relaxed">
              {result.overallExplanation}
            </p>
          </div>

          <div className="md:text-right shrink-0 space-y-1.5 border-t md:border-t-0 pt-4 md:pt-0 border-[rgba(216,208,200,0.5)]">
            <p className="text-xs font-medium text-[#7a6d64]">Weighted readiness score</p>
            <div className="flex items-baseline md:justify-end gap-1.5">
              <span className="font-serif text-5xl font-semibold text-[#2a221d] tabular-nums">
                {result.overallScore}
              </span>
              <span className="font-mono text-lg text-[#7a6d64] tabular-nums">/ 100</span>
            </div>
            <div className="md:flex md:justify-end">
              <ReadinessIndicator label={result.readinessLabel} />
            </div>
            <p className="text-xs text-[#7a6d64]">Based only on submitted information</p>
          </div>
        </div>

        {/* Mode Notice */}
        <div className="bg-[#f3ebe0] rounded-lg px-4 py-3 text-xs sm:text-sm text-[#5c5048] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#5c5048] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p>{result.modeNotice}</p>
            {result.fallbackReason && (
              <p className="text-xs text-[#7a6d64]">Note: {result.fallbackReason}</p>
            )}
          </div>
        </div>

        {/* Transparent Weighted Calculation Table */}
        <div className="pt-2 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-[#2a221d]">
            How the total score was calculated
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgba(216,208,200,0.65)] text-xs font-semibold text-[#7a6d64]">
                  <th className="py-2 pr-4">Criterion</th>
                  <th className="py-2 px-3 text-right">Category score</th>
                  <th className="py-2 px-3 text-right">Weight</th>
                  <th className="py-2 pl-3 text-right">Weighted points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(216,208,200,0.45)]">
                {result.categories.map((cat) => (
                  <tr key={cat.criterionId}>
                    <td className="py-2 pr-4 font-medium text-[#2a221d]">{cat.criterionName}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#5c5048]">
                      {cat.score} / 100
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#5c5048]">
                      {cat.weight}%
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums font-medium text-[#2a221d]">
                      {cat.weightedContribution.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[rgba(216,208,200,0.85)] font-semibold">
                  <td className="py-2.5 pr-4 text-[#2a221d]">Total weighted score</td>
                  <td className="py-2.5 px-3 text-right text-[#7a6d64]">—</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#5c5048]">
                    100%
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-[#c2652a]">
                    {result.overallScore} / 100
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* Top 3 Prioritized Improvements */}
      <section aria-labelledby="improvements-heading" className="space-y-4">
        <div>
          <h2 id="improvements-heading" className="font-serif text-2xl sm:text-3xl font-semibold text-[#2a221d]">
            Top 3 prioritized improvements
          </h2>
          <p className="text-sm text-[#5c5048] mt-1">
            Ordered by rubric weight and missing evidence so your team focuses on the highest-leverage
            edits first.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:gap-3">
          {result.improvements.map((imp) => (
            <article
              key={imp.priority}
              className="print-card print-break-inside-avoid bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 print:p-4 shadow-[0_2px_16px_rgba(58,48,42,0.04)] flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#7a6d64]">
                  <span className="font-mono font-semibold text-[#c2652a] tabular-nums">
                    Priority 0{imp.priority}
                  </span>
                  <span className="truncate max-w-[170px]">{imp.targetCriterion}</span>
                </div>
                <h3 className="text-base font-semibold text-[#2a221d] leading-snug">{imp.title}</h3>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#7a6d64]">Why it matters</p>
                  <p className="text-sm text-[#5c5048] leading-relaxed">{imp.reason}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(216,208,200,0.5)] space-y-1">
                <p className="text-xs font-semibold text-[#2a221d]">Next action</p>
                <p className="text-sm text-[#2a221d] leading-relaxed">{imp.nextAction}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Category Breakdown */}
      <section aria-labelledby="categories-heading" className="space-y-4">
        <div>
          <h2 id="categories-heading" className="font-serif text-2xl sm:text-3xl font-semibold text-[#2a221d]">
            Category breakdown &amp; cited evidence
          </h2>
          <p className="text-sm text-[#5c5048] mt-1">
            Each score is tied strictly to the details you provided. Categories without enough
            evidence are flagged explicitly.
          </p>
        </div>

        <div className="space-y-5 print:space-y-3">
          {result.categories.map((cat) => {
            const isInsufficient = cat.evidenceStatus === 'Not enough information';
            return (
              <article
                key={cat.criterionId}
                className="print-card print-break-inside-avoid bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 sm:p-7 print:p-4 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-5 print:space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-[#2a221d]">{cat.criterionName}</h3>
                      <span className="text-xs font-mono text-[#7a6d64] tabular-nums">
                        Weight {cat.weight}%
                      </span>
                    </div>
                    <EvidenceStatusLabel status={cat.evidenceStatus} />
                  </div>

                  <div className="sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-2">
                    <div className="font-mono text-xl font-semibold text-[#2a221d] tabular-nums">
                      {cat.score} <span className="text-sm font-normal text-[#7a6d64]">/ 100</span>
                    </div>
                    <div className="text-xs text-[#7a6d64] font-mono tabular-nums">
                      +{cat.weightedContribution.toFixed(1)} pts toward total
                    </div>
                  </div>
                </div>

                {/* Accessible progress bar */}
                <div
                  role="progressbar"
                  aria-valuenow={cat.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${cat.criterionName} score ${cat.score} out of 100`}
                  className="h-2 w-full bg-[#f3ebe0] rounded-full overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isInsufficient ? 'bg-[#8c3c3c]' : 'bg-[#c2652a]'
                    }`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>

                <p className="text-sm text-[#2a221d] leading-relaxed">{cat.rationale}</p>

                {/* Cited Evidence */}
                {cat.citedEvidence.length > 0 && (
                  <div className="pt-3 border-t border-[rgba(216,208,200,0.45)] space-y-2">
                    <p className="text-xs font-semibold text-[#7a6d64]">
                      Evidence cited from your submission
                    </p>
                    <ul className="space-y-2">
                      {cat.citedEvidence.map((ev, idx) => (
                        <li key={idx} className="text-sm text-[#5c5048]">
                          <span className="font-medium text-[#2a221d]">{ev.sourceField}:</span>{' '}
                          <span className="italic">“{ev.excerpt}”</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Missing Information & Follow-Up Question */}
                {(cat.missingInformation || cat.followUpQuestion) && (
                  <div className="pt-3 border-t border-[rgba(216,208,200,0.45)] bg-[#faf5ee] rounded-lg p-4 space-y-2">
                    {cat.missingInformation && (
                      <div className="text-sm text-[#5c5048]">
                        <span className="font-semibold text-[#8c3c3c]">
                          {isInsufficient ? 'Not enough information — what is missing:' : 'Gap to strengthen:'}
                        </span>{' '}
                        {cat.missingInformation}
                      </div>
                    )}
                    {cat.followUpQuestion && (
                      <div className="text-sm text-[#2a221d] flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-[#c2652a] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          <strong className="font-semibold">Follow-up question:</strong>{' '}
                          {cat.followUpQuestion}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Visible Disclaimer */}
      <footer className="border-t border-[rgba(216,208,200,0.65)] pt-6 text-center">
        <p className="text-xs sm:text-sm text-[#7a6d64]">{result.disclaimer}</p>
      </footer>
    </div>
  );
};
