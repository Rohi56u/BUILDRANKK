import React from 'react';
import { DEFAULT_RUBRIC } from '../lib/rubric.ts';

interface RubricGuideViewProps {
  onStartAssessment: () => void;
  onBackToDashboard: () => void;
}

export const RubricGuideView: React.FC<RubricGuideViewProps> = ({
  onStartAssessment,
  onBackToDashboard,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-12">
      <div className="space-y-3 border-b border-[rgba(216,208,200,0.65)] pb-6">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="text-sm font-medium text-[#5c5048] hover:text-[#2a221d] cursor-pointer"
        >
          ← Back to dashboard
        </button>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#2a221d]">
          Rubric &amp; scoring guide
        </h1>
        <p className="text-base text-[#5c5048] leading-relaxed max-w-2xl">
          BuildRank evaluates only the project details you supply. It never inspects private code,
          invents metrics, or predicts how live judges will rank teams.
        </p>
      </div>

      {/* Default Criteria */}
      <section className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-5">
        <h2 className="font-serif text-2xl font-semibold text-[#2a221d]">
          Default hackathon rubric (100% total)
        </h2>
        <div className="divide-y divide-[rgba(216,208,200,0.5)]">
          {DEFAULT_RUBRIC.map((criterion) => (
            <div key={criterion.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#2a221d]">{criterion.name}</h3>
                <p className="text-sm text-[#5c5048] leading-relaxed">{criterion.description}</p>
              </div>
              <span className="font-mono text-sm font-semibold text-[#c2652a] tabular-nums shrink-0">
                {criterion.weight}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Readiness Labels */}
      <section className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-[#2a221d]">
          What the readiness labels mean
        </h2>
        <div className="space-y-4 text-sm text-[#5c5048] leading-relaxed">
          <div>
            <p className="font-semibold text-[#2f6b48]">Demo-ready (78–100 with no missing-info flags)</p>
            <p>
              Every rubric criterion is supported by concrete project details, working scope is
              clear, and documentation is ready for a short judge walkthrough.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#a15d1f]">Promising (55–77 or 1 minor evidence gap)</p>
            <p>
              The core problem and build direction are understandable, but sharpening proof or demo
              notes in one or two categories will make the pitch stronger.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#8c3c3c]">Needs more detail (below 55 or 2+ “Not enough information” flags)</p>
            <p>
              Critical judging areas lack enough submitted detail to evaluate fairly. Answering the
              follow-up questions in the report is the fastest way to improve.
            </p>
          </div>
        </div>
      </section>

      {/* Boundaries & Privacy */}
      <section className="bg-[#f3ebe0] border border-[rgba(216,208,200,0.7)] rounded-xl p-6 sm:p-8 space-y-3">
        <h2 className="font-serif text-2xl font-semibold text-[#2a221d]">
          Transparency &amp; data handling
        </h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-[#5c5048] leading-relaxed">
          <li>
            <strong>Account &amp; Storage:</strong> Sign in with Google to save and sync your
            assessments privately to your account via Firebase Firestore. If you use BuildRank
            without signing in, recent assessments and form drafts stay in this browser’s local
            storage only.
          </li>
          <li>
            <strong>GitHub URLs:</strong> Entering a public repository URL only attempts to fetch
            its README and public repository summary—BuildRank does not inspect source code files.
          </li>
          <li>
            <strong>AI vs. Sample mode:</strong> When a server-side Gemini API key is configured,
            BuildRank runs structured AI rubric review. Otherwise, it runs a transparent
            deterministic check clearly labelled “Sample assessment mode”.
          </li>
        </ul>
        <div className="pt-3">
          <button
            type="button"
            onClick={onStartAssessment}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#c2652a] hover:bg-[#a8531e] rounded-lg transition-colors cursor-pointer"
          >
            Start an assessment
          </button>
        </div>
      </section>
    </div>
  );
};
