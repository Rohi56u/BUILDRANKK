import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  GitBranch,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_RUBRIC,
  normalizeRubricWeights,
  sumRubricWeights,
} from '../lib/rubric.ts';
import {
  type ProjectValidationErrors,
  validateProjectAndRubric,
  validateUploadedReadmeFile,
} from '../lib/validation.ts';
import type {
  ApiStatusResponse,
  GitHubFetchResponse,
  ProjectInput,
  RubricCriterion,
} from '../types/buildrank.ts';

interface AssessmentFormViewProps {
  project: ProjectInput;
  rubric: RubricCriterion[];
  rubricMode: 'default' | 'custom';
  isEditingExisting: boolean;
  isSampleData: boolean;
  draftUpdatedAt: string | null;
  apiStatus: ApiStatusResponse | null;
  isSubmitting: boolean;
  submitError: { message: string; canFallbackToSample?: boolean } | null;
  onChangeProject: (next: ProjectInput) => void;
  onChangeRubric: (next: RubricCriterion[], mode: 'default' | 'custom') => void;
  onLoadSampleProject: () => void;
  onClearDraft: () => void;
  onSubmit: (forceSampleMode?: boolean) => void;
  onCancel: () => void;
}

export const AssessmentFormView: React.FC<AssessmentFormViewProps> = ({
  project,
  rubric,
  rubricMode,
  isEditingExisting,
  isSampleData,
  draftUpdatedAt,
  apiStatus,
  isSubmitting,
  submitError,
  onChangeProject,
  onChangeRubric,
  onLoadSampleProject,
  onClearDraft,
  onSubmit,
  onCancel,
}) => {
  const [errors, setErrors] = useState<ProjectValidationErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [githubFetching, setGithubFetching] = useState(false);
  const [githubFeedback, setGithubFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalWeight = Math.round(sumRubricWeights(rubric) * 10) / 10;
  const weightsValid = Math.abs(totalWeight - 100) <= 0.01;

  const updateField = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    const next = { ...project, [key]: value };
    onChangeProject(next);
    if (hasAttemptedSubmit) {
      setErrors(validateProjectAndRubric(next, rubric));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validationMsg = validateUploadedReadmeFile(file);
    if (validationMsg) {
      setFileError(validationMsg);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (!content.trim()) {
        setFileError('The uploaded file contains no readable text.');
        return;
      }
      onChangeProject({
        ...project,
        readmeText: content.slice(0, 20000),
        uploadedFileName: file.name,
      });
    };
    reader.onerror = () => {
      setFileError('Could not read the selected file. Please paste the text directly.');
    };
    reader.readAsText(file);
  };

  const handleFetchGitHubReadme = async () => {
    setGithubFeedback(null);
    const trimmed = project.githubUrl.trim();
    if (!trimmed) {
      setGithubFeedback({
        type: 'warning',
        message: 'Paste a public GitHub repository URL first, or skip and paste your README below.',
      });
      return;
    }

    setGithubFetching(true);
    try {
      const res = await fetch('/api/github/readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as GitHubFetchResponse;
      if (data.ok && data.context) {
        onChangeProject({
          ...project,
          githubContext: data.context,
        });
        setGithubFeedback({
          type: 'success',
          message: data.message,
        });
      } else {
        onChangeProject({
          ...project,
          githubContext: null,
        });
        setGithubFeedback({
          type: 'warning',
          message: data.message,
        });
      }
    } catch {
      setGithubFeedback({
        type: 'error',
        message:
          'Unable to contact the server to read GitHub. You can still paste your README or project notes below.',
      });
    } finally {
      setGithubFetching(false);
    }
  };

  const handleRubricModeSwitch = (mode: 'default' | 'custom') => {
    if (mode === 'default') {
      const nextRubric = DEFAULT_RUBRIC.map((c) => ({ ...c }));
      onChangeRubric(nextRubric, 'default');
      if (hasAttemptedSubmit) setErrors(validateProjectAndRubric(project, nextRubric));
    } else {
      onChangeRubric(rubric.map((c) => ({ ...c })), 'custom');
    }
  };

  const updateCriterion = (index: number, patch: Partial<RubricCriterion>) => {
    const next = rubric.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChangeRubric(next, 'custom');
    if (hasAttemptedSubmit) {
      setErrors(validateProjectAndRubric(project, next));
    }
  };

  const addCriterion = () => {
    const next: RubricCriterion[] = [
      ...rubric,
      {
        id: `custom-${Date.now().toString(36)}`,
        name: '',
        description: '',
        weight: 10,
      },
    ];
    onChangeRubric(next, 'custom');
  };

  const removeCriterion = (index: number) => {
    if (rubric.length <= 1) return;
    const next = rubric.filter((_, i) => i !== index);
    onChangeRubric(next, 'custom');
    if (hasAttemptedSubmit) {
      setErrors(validateProjectAndRubric(project, next));
    }
  };

  const handleNormalizeWeights = () => {
    const normalized = normalizeRubricWeights(rubric);
    onChangeRubric(normalized, 'custom');
    if (hasAttemptedSubmit) {
      setErrors(validateProjectAndRubric(project, normalized));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    const nextErrors = validateProjectAndRubric(project, rubric);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSubmit(false);
  };

  const inputBase =
    'w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-[#2a221d] placeholder:text-[#9a8d83] focus:outline-none focus:border-[#c2652a] transition-colors';

  return (
    <form onSubmit={handleFormSubmit} noValidate className="max-w-4xl mx-auto space-y-10">
      {/* Top Form Header */}
      <div className="space-y-4 border-b border-[rgba(216,208,200,0.65)] pb-6">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5c5048] hover:text-[#2a221d] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to dashboard</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#2a221d]">
              {isEditingExisting ? 'Edit project assessment' : 'New project assessment'}
            </h1>
            <p className="text-sm text-[#5c5048]">
              Describe what your team is building and select the judging rubric. Drafts save locally
              in this browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={onLoadSampleProject}
              className="px-3 py-1.5 font-medium text-[#2a221d] bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Load sample project
            </button>
            <button
              type="button"
              onClick={onClearDraft}
              className="px-3 py-1.5 font-medium text-[#5c5048] hover:text-[#8c3c3c] transition-colors whitespace-nowrap cursor-pointer"
            >
              Clear form
            </button>
          </div>
        </div>

        {(draftUpdatedAt || isSampleData) && (
          <div className="text-xs text-[#7a6d64] flex flex-wrap items-center gap-2">
            {isSampleData && (
              <span className="font-semibold text-[#a15d1f]">
                Sample project data loaded (for demonstration—replace with your team’s details before submitting)
              </span>
            )}
            {isSampleData && draftUpdatedAt && <span aria-hidden="true">·</span>}
            {draftUpdatedAt && (
              <span>
                Draft saved locally at{' '}
                {new Date(draftUpdatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Section 1: Project Details */}
      <section
        aria-labelledby="project-details-heading"
        className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-6"
      >
        <div className="space-y-1">
          <h2 id="project-details-heading" className="font-serif text-2xl font-semibold text-[#2a221d]">
            1. Project details
          </h2>
          <p className="text-sm text-[#5c5048]">
            Share concrete facts about what exists right now. Honest notes on gaps help BuildRank
            give useful feedback.
          </p>
        </div>

        <div className="space-y-5">
          {/* Project Name */}
          <div className="space-y-1.5">
            <label htmlFor="projectName" className="block text-sm font-semibold text-[#2a221d]">
              Project name <span className="text-[#8c3c3c]">*</span>
            </label>
            <input
              id="projectName"
              type="text"
              value={project.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
              placeholder="e.g., TransitPulse or Campus Pantry Connect"
              aria-invalid={Boolean(errors.projectName)}
              className={`${inputBase} ${
                errors.projectName ? 'border-[#8c3c3c]' : 'border-[rgba(216,208,200,0.85)]'
              }`}
            />
            {errors.projectName && (
              <p className="text-xs font-medium text-[#8c3c3c]">{errors.projectName}</p>
            )}
          </div>

          {/* Problem */}
          <div className="space-y-1.5">
            <label htmlFor="problem" className="block text-sm font-semibold text-[#2a221d]">
              Problem being solved <span className="text-[#8c3c3c]">*</span>
            </label>
            <textarea
              id="problem"
              rows={3}
              value={project.problem}
              onChange={(e) => updateField('problem', e.target.value)}
              placeholder="Example: Clinic intake coordinators spend 15+ minutes manually re-typing handwritten referral notes, causing delayed follow-ups."
              aria-invalid={Boolean(errors.problem)}
              className={`${inputBase} ${
                errors.problem ? 'border-[#8c3c3c]' : 'border-[rgba(216,208,200,0.85)]'
              }`}
            />
            {errors.problem && (
              <p className="text-xs font-medium text-[#8c3c3c]">{errors.problem}</p>
            )}
          </div>

          {/* Intended Users */}
          <div className="space-y-1.5">
            <label htmlFor="intendedUsers" className="block text-sm font-semibold text-[#2a221d]">
              Intended users <span className="text-[#8c3c3c]">*</span>
            </label>
            <input
              id="intendedUsers"
              type="text"
              value={project.intendedUsers}
              onChange={(e) => updateField('intendedUsers', e.target.value)}
              placeholder="Example: Night-shift emergency nurses and triage clerks at community hospitals"
              aria-invalid={Boolean(errors.intendedUsers)}
              className={`${inputBase} ${
                errors.intendedUsers ? 'border-[#8c3c3c]' : 'border-[rgba(216,208,200,0.85)]'
              }`}
            />
            {errors.intendedUsers && (
              <p className="text-xs font-medium text-[#8c3c3c]">{errors.intendedUsers}</p>
            )}
          </div>

          {/* Proposed Solution */}
          <div className="space-y-1.5">
            <label htmlFor="solution" className="block text-sm font-semibold text-[#2a221d]">
              Proposed solution <span className="text-[#8c3c3c]">*</span>
            </label>
            <textarea
              id="solution"
              rows={3}
              value={project.solution}
              onChange={(e) => updateField('solution', e.target.value)}
              placeholder="Example: A two-step browser tool where staff upload a photo of a referral slip, verify extracted fields side-by-side, and export a structured summary."
              aria-invalid={Boolean(errors.solution)}
              className={`${inputBase} ${
                errors.solution ? 'border-[#8c3c3c]' : 'border-[rgba(216,208,200,0.85)]'
              }`}
            />
            {errors.solution && (
              <p className="text-xs font-medium text-[#8c3c3c]">{errors.solution}</p>
            )}
          </div>

          {/* What is currently working */}
          <div className="space-y-1.5">
            <label htmlFor="workingStatus" className="block text-sm font-semibold text-[#2a221d]">
              What is currently working <span className="text-[#8c3c3c]">*</span>
            </label>
            <textarea
              id="workingStatus"
              rows={3}
              value={project.workingStatus}
              onChange={(e) => updateField('workingStatus', e.target.value)}
              placeholder="Example: Upload flow and side-by-side editor work locally with sample records. Automated EHR export is mocked for demo day."
              aria-invalid={Boolean(errors.workingStatus)}
              className={`${inputBase} ${
                errors.workingStatus ? 'border-[#8c3c3c]' : 'border-[rgba(216,208,200,0.85)]'
              }`}
            />
            {errors.workingStatus && (
              <p className="text-xs font-medium text-[#8c3c3c]">{errors.workingStatus}</p>
            )}
          </div>

          {/* Technologies used */}
          <div className="space-y-1.5">
            <label htmlFor="technologies" className="block text-sm font-semibold text-[#2a221d]">
              Technologies used <span className="text-xs font-normal text-[#7a6d64]">(optional, if known)</span>
            </label>
            <input
              id="technologies"
              type="text"
              value={project.technologies}
              onChange={(e) => updateField('technologies', e.target.value)}
              placeholder="Example: React, TypeScript, Express, PostgreSQL"
              className={`${inputBase} border-[rgba(216,208,200,0.85)]`}
            />
          </div>

          {/* GitHub Repository URL */}
          <div className="pt-2 border-t border-[rgba(216,208,200,0.45)] space-y-2">
            <label htmlFor="githubUrl" className="block text-sm font-semibold text-[#2a221d]">
              GitHub repository URL <span className="text-xs font-normal text-[#7a6d64]">(optional, public repos only)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <GitBranch
                  className="w-4 h-4 text-[#7a6d64] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="githubUrl"
                  type="url"
                  value={project.githubUrl}
                  onChange={(e) => updateField('githubUrl', e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  aria-invalid={Boolean(errors.githubUrl)}
                  className={`${inputBase} pl-9 ${
                    errors.githubUrl ? 'border-[#8c3c3c]' : 'border-[rgba(216,208,200,0.85)]'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={handleFetchGitHubReadme}
                disabled={githubFetching}
                className="px-4 py-2.5 text-sm font-medium text-[#2a221d] bg-[#f3ebe0] hover:bg-[#e9ddd0] border border-[rgba(216,208,200,0.85)] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
              >
                {githubFetching ? 'Reading README…' : 'Fetch public README'}
              </button>
            </div>
            <p className="text-xs text-[#7a6d64]">
              Reads the public repository’s README and basic metadata only—source code files are
              never inspected.
            </p>
            {errors.githubUrl && (
              <p className="text-xs font-medium text-[#8c3c3c]">{errors.githubUrl}</p>
            )}
            {githubFeedback && (
              <div
                className={`text-xs px-3.5 py-2.5 rounded-lg flex items-start justify-between gap-3 ${
                  githubFeedback.type === 'success'
                    ? 'bg-[#eef6f0] text-[#2f6b48]'
                    : githubFeedback.type === 'warning'
                      ? 'bg-[#fcf4ea] text-[#a15d1f]'
                      : 'bg-[#faeeee] text-[#8c3c3c]'
                }`}
              >
                <span>{githubFeedback.message}</span>
                {project.githubContext && (
                  <button
                    type="button"
                    onClick={() => updateField('githubContext', null)}
                    className="font-semibold underline whitespace-nowrap cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
            {project.githubContext && !githubFeedback && (
              <div className="text-xs px-3.5 py-2.5 rounded-lg bg-[#eef6f0] text-[#2f6b48] flex items-center justify-between gap-3">
                <span>
                  Attached public README from <strong>{project.githubContext.fullName}</strong> (source
                  code not inspected)
                </span>
                <button
                  type="button"
                  onClick={() => updateField('githubContext', null)}
                  className="font-semibold underline whitespace-nowrap cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* README / File Upload */}
          <div className="pt-2 border-t border-[rgba(216,208,200,0.45)] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="readmeText" className="block text-sm font-semibold text-[#2a221d]">
                README or project description{' '}
                <span className="text-xs font-normal text-[#7a6d64]">(optional—paste or upload .txt / .md)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFileUpload}
                  className="sr-only"
                  id="readme-file-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2a221d] bg-white border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload .txt or .md</span>
                </button>
              </div>
            </div>

            {project.uploadedFileName && (
              <div className="flex items-center justify-between text-xs text-[#5c5048] bg-[#f3ebe0] px-3 py-2 rounded-lg">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  Loaded from <strong>{project.uploadedFileName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeProject({ ...project, readmeText: '', uploadedFileName: undefined })
                  }
                  className="text-[#8c3c3c] font-medium hover:underline cursor-pointer"
                >
                  Clear file
                </button>
              </div>
            )}

            {fileError && (
              <p className="text-xs font-medium text-[#8c3c3c]" role="alert">
                {fileError}
              </p>
            )}

            <textarea
              id="readmeText"
              rows={5}
              value={project.readmeText}
              onChange={(e) => updateField('readmeText', e.target.value)}
              placeholder="Paste your README, architecture notes, demo script, or known limitations here (max 512 KB for file uploads)."
              className={`${inputBase} font-mono text-xs border-[rgba(216,208,200,0.85)]`}
            />
          </div>
        </div>
      </section>

      {/* Section 2: Judging Rubric */}
      <section
        aria-labelledby="rubric-section-heading"
        className="bg-[#fffdf9] border border-[rgba(216,208,200,0.65)] rounded-xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(58,48,42,0.04)] space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 id="rubric-section-heading" className="font-serif text-2xl font-semibold text-[#2a221d]">
              2. Judging rubric
            </h2>
            <p className="text-sm text-[#5c5048]">
              Use the editable sample hackathon rubric or customize criteria and weights to match
              your event.
            </p>
          </div>

          <div
            role="group"
            aria-label="Rubric mode"
            className="inline-flex items-center p-1 bg-[#f3ebe0] rounded-lg self-start shrink-0"
          >
            <button
              type="button"
              onClick={() => handleRubricModeSwitch('default')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                rubricMode === 'default'
                  ? 'bg-[#fffdf9] text-[#2a221d] shadow-sm'
                  : 'text-[#5c5048] hover:text-[#2a221d]'
              }`}
            >
              Default sample rubric
            </button>
            <button
              type="button"
              onClick={() => handleRubricModeSwitch('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                rubricMode === 'custom'
                  ? 'bg-[#fffdf9] text-[#2a221d] shadow-sm'
                  : 'text-[#5c5048] hover:text-[#2a221d]'
              }`}
            >
              Custom rubric
            </button>
          </div>
        </div>

        {/* Criteria List */}
        <div className="divide-y divide-[rgba(216,208,200,0.5)]">
          {rubric.map((criterion, index) => (
            <div
              key={criterion.id}
              className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start"
            >
              <div className="sm:col-span-5 space-y-1">
                <label
                  htmlFor={`crit-name-${criterion.id}`}
                  className="block text-xs font-medium text-[#7a6d64]"
                >
                  Criterion name
                </label>
                <input
                  id={`crit-name-${criterion.id}`}
                  type="text"
                  value={criterion.name}
                  onChange={(e) => updateCriterion(index, { name: e.target.value })}
                  placeholder="e.g., Accessibility & craft"
                  className="w-full px-3 py-2 text-sm font-medium bg-white border border-[rgba(216,208,200,0.85)] rounded-lg text-[#2a221d] focus:border-[#c2652a] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-5 space-y-1">
                <label
                  htmlFor={`crit-desc-${criterion.id}`}
                  className="block text-xs font-medium text-[#7a6d64]"
                >
                  What judges look for
                </label>
                <input
                  id={`crit-desc-${criterion.id}`}
                  type="text"
                  value={criterion.description}
                  onChange={(e) => updateCriterion(index, { description: e.target.value })}
                  placeholder="Brief guidance for this criterion"
                  className="w-full px-3 py-2 text-sm bg-white border border-[rgba(216,208,200,0.85)] rounded-lg text-[#5c5048] focus:border-[#c2652a] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor={`crit-weight-${criterion.id}`}
                    className="block text-xs font-medium text-[#7a6d64]"
                  >
                    Weight (%)
                  </label>
                  <input
                    id={`crit-weight-${criterion.id}`}
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={Number.isNaN(criterion.weight) ? '' : criterion.weight}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      updateCriterion(index, { weight: Math.max(0, Math.min(100, val)) });
                    }}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[rgba(216,208,200,0.85)] rounded-lg text-[#2a221d] focus:border-[#c2652a] focus:outline-none"
                  />
                </div>
                {rubric.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    aria-label={`Remove ${criterion.name || 'criterion'}`}
                    className="p-2 text-[#7a6d64] hover:text-[#8c3c3c] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Rubric Actions & Weight Validation */}
        <div className="pt-4 border-t border-[rgba(216,208,200,0.65)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addCriterion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2a221d] bg-white border border-[rgba(216,208,200,0.85)] hover:border-[#c2652a] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add criterion</span>
            </button>
            <button
              type="button"
              onClick={() => handleRubricModeSwitch('default')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5c5048] hover:text-[#2a221d] transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset to default</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <span className="text-[#5c5048]">Total weight:</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  weightsValid ? 'text-[#2f6b48]' : 'text-[#8c3c3c]'
                }`}
              >
                {totalWeight}%
              </span>
              {weightsValid ? (
                <CheckCircle2 className="w-4 h-4 text-[#2f6b48]" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#8c3c3c]" aria-hidden="true" />
              )}
            </div>

            {!weightsValid && (
              <button
                type="button"
                onClick={handleNormalizeWeights}
                className="px-3 py-1.5 text-xs font-semibold text-[#c2652a] bg-[#fcf4ea] border border-[#c2652a]/40 hover:bg-[#c2652a] hover:text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Normalize to 100%
              </button>
            )}
          </div>
        </div>

        {!weightsValid && (
          <div role="alert" className="bg-[#faeeee] text-[#8c3c3c] rounded-lg px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>
              Custom rubric weights must total 100% (currently{' '}
              <strong className="font-mono tabular-nums">{totalWeight}%</strong>,{' '}
              {totalWeight > 100
                ? `${Math.round((totalWeight - 100) * 10) / 10}% over`
                : `${Math.round((100 - totalWeight) * 10) / 10}% short`}
              ). Adjust individual weights or normalize them proportionally.
            </span>
            <button
              type="button"
              onClick={handleNormalizeWeights}
              className="text-xs font-semibold underline whitespace-nowrap self-start sm:self-center cursor-pointer"
            >
              Normalize weights now
            </button>
          </div>
        )}

        {errors.rubric && weightsValid && (
          <p role="alert" className="text-xs font-medium text-[#8c3c3c]">
            {errors.rubric}
          </p>
        )}
      </section>

      {/* Validation Summary & Server Error Alert */}
      {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
        <div role="alert" className="bg-[#faeeee] text-[#8c3c3c] rounded-xl px-5 py-4 text-sm space-y-1">
          <p className="font-semibold">Please fix the highlighted items before assessing:</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {Object.values(errors).map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="bg-[#faeeee] text-[#8c3c3c] rounded-xl px-5 py-4 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <span>{submitError.message}</span>
          {submitError.canFallbackToSample && (
            <button
              type="button"
              onClick={() => onSubmit(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#8c3c3c] hover:bg-[#722e2e] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Run in Sample assessment mode instead
            </button>
          )}
        </div>
      )}

      {/* Submit Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 pb-8">
        <p className="text-xs text-[#7a6d64]">
          {apiStatus?.aiConfigured
            ? `Using server-side AI rubric review (${apiStatus.model}).`
            : 'Running in Sample assessment mode (deterministic rubric check—no AI key configured).'}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-[#5c5048] hover:text-[#2a221d] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#c2652a] hover:bg-[#a8531e] rounded-lg transition-colors duration-150 disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSubmitting
              ? apiStatus?.aiConfigured
                ? 'Running AI rubric review…'
                : 'Running rubric check…'
              : 'Run rubric assessment'}
          </button>
        </div>
      </div>
    </form>
  );
};
