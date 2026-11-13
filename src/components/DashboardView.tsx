import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Box,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  LogIn,
  LogOut,
  Maximize2,
  Search,
  Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { DEFAULT_RUBRIC } from '../lib/rubric.ts';
import type { MonumentPillarDatum } from '../three/rubricMonument.ts';
import type { ApiStatusResponse, AssessmentResult, ReadinessLabel } from '../types/buildrank.ts';
import { RubricMonumentViewport } from './RubricMonumentViewport.tsx';

interface DashboardViewProps {
  assessments: AssessmentResult[];
  isLoadingAssessments: boolean;
  firestoreError: string | null;
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  apiStatus: ApiStatusResponse | null;
  hasDraft: boolean;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
  onStartNewAssessment: () => void;
  onResumeDraft: () => void;
  onLoadSampleProject: () => void;
  onOpenAssessment: (assessment: AssessmentResult) => void;
  onEditAssessment: (assessment: AssessmentResult) => void;
  onDeleteAssessment: (id: string) => void;
  onOpenGuide: () => void;
  onOpenStudio: (assessmentId?: string | null) => void;
}

export function ReadinessIndicator({ label }: { label: ReadinessLabel }) {
  if (label === 'Demo-ready') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f6b48] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Demo-ready</span>
      </span>
    );
  }
  if (label === 'Promising') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a15d1f] whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Promising</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8c3c3c] whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Needs more detail</span>
    </span>
  );
}

const DEFAULT_PREVIEW_PILLARS: MonumentPillarDatum[] = DEFAULT_RUBRIC.map((c) => ({
  id: c.id,
  name: c.name,
  score: 80,
  weight: c.weight,
  weightedContribution: (80 * c.weight) / 100,
  evidenceStatus: 'Sufficient evidence',
}));

export const DashboardView: React.FC<DashboardViewProps> = ({
  assessments,
  isLoadingAssessments,
  firestoreError,
  user,
  authReady,
  isSigningIn,
  authError,
  apiStatus,
  hasDraft,
  onSignInWithGoogle,
  onSignOut,
  onStartNewAssessment,
  onResumeDraft,
  onLoadSampleProject,
  onOpenAssessment,
  onEditAssessment,
  onDeleteAssessment,
  onOpenGuide,
  onOpenStudio,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPillarIndex, setHoveredPillarIndex] = useState<number | null>(null);

  const previewAssessment = assessments[0] ?? null;

  const previewPillars: MonumentPillarDatum[] = useMemo(() => {
    if (!previewAssessment) return DEFAULT_PREVIEW_PILLARS;
    return previewAssessment.categories.map((cat) => ({
      id: cat.criterionId,
      name: cat.criterionName,
      score: cat.score,
      weight: cat.weight,
      weightedContribution: cat.weightedContribution,
      evidenceStatus: cat.evidenceStatus,
    }));
  }, [previewAssessment]);

  const hoveredPillar =
    hoveredPillarIndex !== null && previewPillars[hoveredPillarIndex]
      ? previewPillars[hoveredPillarIndex]
      : null;

  const filteredAssessments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assessments;
    return assessments.filter(
      (item) =>
        item.projectSnapshot.projectName.toLowerCase().includes(q) ||
        item.readinessLabel.toLowerCase().includes(q)
    );
  }, [assessments, searchQuery]);

  return (
    <div className="space-y-12">
      {/* Architectural Editorial Hero + Interactive 3D Rubric Stage */}
      <section className="pt-2 pb-10 border-b border-[rgba(216,208,200,0.65)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6d64]">
                Hackathon &amp; Demo-Day Preparation
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-[#2a221d]">
                Check your project against the judging rubric before you present.
              </h1>
              <p className="text-base sm:text-lg text-[#5c5048] leading-relaxed max-w-2xl">
                BuildRank reviews your project description, working prototype notes, and README
                against a weighted rubric—highlighting cited evidence, missing details, and three
                practical next steps. It never predicts judges’ final decisions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartNewAssessment}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#c2652a] hover:bg-[#a8531e] rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                <span>Assess a project</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onOpenStudio(previewAssessment?.id ?? null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.9)] hover:border-[#c2652a] rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                <Box className="w-4 h-4 text-[#c2652a]" aria-hidden="true" />
                <span>Open 3D Studio</span>
              </button>

              {hasDraft && (
                <button
                  type="button"
                  onClick={onResumeDraft}
                  className="px-4 py-2.5 text-sm font-medium text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.9)] hover:border-[#c2652a] rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  Resume saved draft
                </button>
              )}

              <button
                type="button"
                onClick={onLoadSampleProject}
                className="px-3 py-2.5 text-sm font-medium text-[#5c5048] hover:text-[#2a221d] underline underline-offset-4 decoration-[#d8d0c8] hover:decoration-[#c2652a] transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                Try a sample project
              </button>
            </div>

            <div className="pt-4 border-t border-[rgba(216,208,200,0.55)] grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <p className="font-mono text-base font-semibold text-[#2a221d] tabular-nums">5</p>
                <p className="text-xs text-[#7a6d64]">Weighted rubric criteria</p>
              </div>
              <div>
                <p className="font-mono text-base font-semibold text-[#2a221d] tabular-nums">100%</p>
                <p className="text-xs text-[#7a6d64]">Transparent score math</p>
              </div>
              <div>
                <p className="font-mono text-base font-semibold text-[#2a221d] tabular-nums">Top 3</p>
                <p className="text-xs text-[#7a6d64]">Prioritized next actions</p>
              </div>
            </div>
          </div>

          {/* Interactive 3D Rubric Monument Preview Stage */}
          <div className="lg:col-span-5">
            <div className="relative h-[320px] sm:h-[360px] rounded-2xl overflow-hidden border border-[rgba(216,208,200,0.85)] bg-[#f5ede1] shadow-[0_8px_30px_rgba(58,48,42,0.06)]">
              <RubricMonumentViewport
                pillars={previewPillars}
                overallScore={previewAssessment ? previewAssessment.overallScore : 80}
                readinessLabel={previewAssessment ? previewAssessment.readinessLabel : 'Demo-ready'}
                themeId="sahara"
                cameraPreset="isometric"
                presetTrigger={0}
                autoOrbit={true}
                selectedIndex={null}
                onHoverPillar={setHoveredPillarIndex}
                onSelectPillar={() => onOpenStudio(previewAssessment?.id ?? null)}
                compact={true}
              />

              {/* Solid Top-Left Caption (NO backdrop-blur over WebGL) */}
              <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
                <div className="bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] rounded-lg px-3 py-2 shadow-sm max-w-[78%]">
                  {hoveredPillar ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[#2a221d] truncate">
                        {hoveredPillar.name}
                      </p>
                      <p className="font-mono text-[11px] text-[#5c5048] tabular-nums">
                        {hoveredPillar.score}/100 · {hoveredPillar.weight}% weight
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium text-[#7a6d64]">
                        {previewAssessment ? 'Latest rubric monument' : 'Default rubric monument'}
                      </p>
                      <p className="text-xs font-semibold text-[#2a221d] truncate">
                        {previewAssessment
                          ? `${previewAssessment.projectSnapshot.projectName} · ${previewAssessment.overallScore}/100`
                          : 'Hackathon Rubric (20/20/25/20/15)'}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenStudio(previewAssessment?.id ?? null)}
                  aria-label="Open full 3D Studio"
                  className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#c2652a]" aria-hidden="true" />
                  <span className="hidden sm:inline">3D Studio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Account & Engine Status Notices */}
      <section aria-label="Account and engine status" className="space-y-3">
        {authReady && (
          <div className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_16px_rgba(58,48,42,0.04)]">
            {user ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.displayName ?? 'Signed-in user'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full border border-[rgba(216,208,200,0.8)] shrink-0 object-cover"
                    />
                  )}
                  <div className="text-sm min-w-0">
                    <p className="font-semibold text-[#2a221d] truncate">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-xs text-[#7a6d64] truncate">
                      Signed in with Google · Assessments saved to your Firestore account
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#5c5048] hover:text-[#2a221d] bg-white border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-[#5c5048] space-y-0.5">
                  <p className="font-semibold text-[#2a221d]">Save assessments across devices</p>
                  <p className="text-xs text-[#7a6d64]">
                    Sign in with Google to persist your project assessments privately in Firestore,
                    or continue using local browser storage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#2a221d] bg-white border border-[rgba(216,208,200,0.9)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap self-start sm:self-center disabled:opacity-60 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#c2652a]" aria-hidden="true" />
                  <span>{isSigningIn ? 'Signing in…' : 'Sign in with Google'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {authError && (
          <div role="alert" className="bg-[#faeeee] text-[#8c3c3c] rounded-xl px-5 py-3 text-xs sm:text-sm">
            {authError}
          </div>
        )}

        {apiStatus && (
          <div className="bg-[#f3ebe0] border border-[rgba(216,208,200,0.7)] rounded-xl px-5 py-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-[#5c5048] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-[#5c5048] leading-relaxed">
              {apiStatus.aiConfigured ? (
                <p>
                  <span className="font-semibold text-[#2a221d]">AI rubric review is connected</span>{' '}
                  via server-side Gemini integration ({apiStatus.model}). Assessments stay grounded in
                  the project text you submit.
                </p>
              ) : (
                <p>
                  <span className="font-semibold text-[#2a221d]">Sample assessment mode</span> is
                  active because no AI provider key is configured on the server. BuildRank runs a
                  deterministic, transparent rubric check without fabricating AI output. An
                  administrator can configure{' '}
                  <code className="font-mono text-xs bg-[#fffdf9] px-1.5 py-0.5 rounded border border-[rgba(216,208,200,0.7)]">
                    GEMINI_API_KEY
                  </code>{' '}
                  in the server environment or Settings &gt; Secrets.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Recent Assessments */}
      <section aria-labelledby="recent-assessments-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 id="recent-assessments-heading" className="font-serif text-2xl sm:text-3xl font-semibold text-[#2a221d]">
              Recent assessments
            </h2>
            <p className="text-sm text-[#7a6d64] mt-1">
              {user
                ? `Synced privately to ${user.email ?? 'your Google account'} in Firestore.`
                : 'Stored locally in this browser—sign in with Google above to sync to your account.'}
            </p>
          </div>

          {assessments.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-[#7a6d64] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by project or label"
                aria-label="Filter recent assessments"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[rgba(216,208,200,0.85)] rounded-lg text-[#2a221d] placeholder:text-[#9a8d83] focus:border-[#c2652a] focus:outline-none"
              />
            </div>
          )}
        </div>

        {firestoreError && (
          <div role="alert" className="bg-[#faeeee] text-[#8c3c3c] rounded-xl px-5 py-3.5 text-sm">
            {firestoreError}
          </div>
        )}

        {isLoadingAssessments ? (
          <div className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 space-y-3">
            <div className="h-4 w-48 bg-[#f3ebe0] rounded" />
            <div className="h-10 w-full bg-[#faf5ee] rounded" />
            <div className="h-10 w-full bg-[#faf5ee] rounded" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-8 sm:p-10 shadow-[0_2px_16px_rgba(58,48,42,0.04)] text-center space-y-4">
            <div className="mx-auto w-11 h-11 rounded-lg bg-[#f3ebe0] flex items-center justify-center text-[#5c5048]">
              <ClipboardList className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-semibold text-[#2a221d]">No assessments saved yet</h3>
              <p className="text-sm text-[#5c5048] leading-relaxed">
                Start a new assessment with your project summary and judging rubric, or load our
                clearly labelled sample hackathon project to see how scoring and gap feedback work.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onStartNewAssessment}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#c2652a] hover:bg-[#a8531e] rounded-lg transition-colors cursor-pointer"
              >
                Assess a project
              </button>
              <button
                type="button"
                onClick={onLoadSampleProject}
                className="px-4 py-2 text-sm font-medium text-[#2a221d] bg-white border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors cursor-pointer"
              >
                Load sample project (demo data)
              </button>
            </div>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-8 text-center text-sm text-[#5c5048]">
            No saved assessments match “{searchQuery}”.
          </div>
        ) : (
          <div className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl shadow-[0_2px_16px_rgba(58,48,42,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(216,208,200,0.65)] text-xs font-semibold text-[#7a6d64]">
                    <th className="py-3.5 px-5">Project</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Readiness</th>
                    <th className="py-3.5 px-4 text-right">Score</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(216,208,200,0.45)] text-sm">
                  {filteredAssessments.map((item) => {
                    const dateText = new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-[#faf5ee]/70 transition-colors duration-150"
                      >
                        <td className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() => onOpenAssessment(item)}
                            className="font-semibold text-[#2a221d] hover:text-[#c2652a] text-left cursor-pointer"
                          >
                            {item.projectSnapshot.projectName}
                          </button>
                          <div className="text-xs text-[#7a6d64] mt-0.5 flex items-center gap-2">
                            <span>
                              {item.mode === 'gemini' ? 'AI Rubric Review' : 'Sample assessment mode'}
                            </span>
                            {item.isSampleData && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#a15d1f] font-medium">Sample project data</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#5c5048] tabular-nums whitespace-nowrap">
                          {dateText}
                        </td>
                        <td className="py-3.5 px-4">
                          <ReadinessIndicator label={item.readinessLabel} />
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-[#2a221d] tabular-nums whitespace-nowrap">
                          {item.overallScore} / 100
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onOpenAssessment(item)}
                              className="text-xs font-semibold text-[#c2652a] hover:underline cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditAssessment(item)}
                              className="text-xs font-medium text-[#5c5048] hover:text-[#2a221d] hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteAssessment(item.id)}
                              aria-label={`Delete assessment for ${item.projectSnapshot.projectName}`}
                              className="p-1 text-[#7a6d64] hover:text-[#8c3c3c] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Editorial 3-Step Summary */}
      <section
        aria-labelledby="how-it-works-heading"
        className="pt-4 border-t border-[rgba(216,208,200,0.65)]"
      >
        <div className="flex items-baseline justify-between mb-6">
          <h2 id="how-it-works-heading" className="font-serif text-2xl font-semibold text-[#2a221d]">
            How BuildRank evaluates a submission
          </h2>
          <button
            type="button"
            onClick={onOpenGuide}
            className="text-sm font-medium text-[#c2652a] hover:underline whitespace-nowrap cursor-pointer"
          >
            Read rubric guide
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#7a6d64] tabular-nums">01</p>
            <h3 className="text-base font-semibold text-[#2a221d]">Grounded in your actual text</h3>
            <p className="text-sm text-[#5c5048] leading-relaxed">
              Every category score cites excerpts from your project details or README. Nothing is
              fabricated when details are sparse.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#7a6d64] tabular-nums">02</p>
            <h3 className="text-base font-semibold text-[#2a221d]">Explicitly flags gaps</h3>
            <p className="text-sm text-[#5c5048] leading-relaxed">
              Categories lacking proof are marked “Not enough information” with a clear explanation
              of what is missing and one question to answer.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#7a6d64] tabular-nums">03</p>
            <h3 className="text-base font-semibold text-[#2a221d]">Weighted, editable rubrics</h3>
            <p className="text-sm text-[#5c5048] leading-relaxed">
              Use the 5-part default hackathon rubric or customize criteria and weights. Overall
              scores always show the exact weighted calculation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
