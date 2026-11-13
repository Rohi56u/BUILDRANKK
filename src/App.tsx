import { useEffect, useState } from 'react';
import { AssessmentFormView } from './components/AssessmentFormView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { type ActiveScreen, Header } from './components/Header.tsx';
import { ResultsView } from './components/ResultsView.tsx';
import { RubricGuideView } from './components/RubricGuideView.tsx';
import { Studio3DView } from './components/Studio3DView.tsx';
import { useAuth } from './contexts/AuthContext.tsx';
import {
  deleteAssessmentFromFirestore,
  saveAssessmentToFirestore,
  subscribeUserAssessments,
} from './lib/firestoreAssessments.ts';
import {
  DEFAULT_RUBRIC,
  EMPTY_PROJECT_INPUT,
  SAMPLE_DEMO_PROJECT,
} from './lib/rubric.ts';
import {
  clearDraft,
  deleteAssessment,
  loadAssessments,
  loadDraft,
  saveAssessment,
  saveDraft,
} from './lib/storage.ts';
import type {
  ApiStatusResponse,
  AssessmentResult,
  ProjectInput,
  RubricCriterion,
} from './types/buildrank.ts';

export default function App() {
  const { user, authReady, isSigningIn, authError, signInWithGoogle, signOutUser } = useAuth();

  const [screen, setScreen] = useState<ActiveScreen>('dashboard');
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null);
  const [assessments, setAssessments] = useState<AssessmentResult[]>(() => loadAssessments());
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<AssessmentResult | null>(
    () => loadAssessments()[0] ?? null
  );
  const [studioAssessmentId, setStudioAssessmentId] = useState<string | null>(
    () => loadAssessments()[0]?.id ?? null
  );

  // Active form state
  const [project, setProject] = useState<ProjectInput>(EMPTY_PROJECT_INPUT);
  const [rubric, setRubric] = useState<RubricCriterion[]>(() => DEFAULT_RUBRIC.map((c) => ({ ...c })));
  const [rubricMode, setRubricMode] = useState<'default' | 'custom'>('default');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [isSampleData, setIsSampleData] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(() => loadDraft()?.updatedAt ?? null);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(() => Boolean(loadDraft()));

  // Request states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{
    message: string;
    canFallbackToSample?: boolean;
  } | null>(null);
  const [isReassessing, setIsReassessing] = useState(false);
  const [reassessError, setReassessError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ApiStatusResponse | null) => {
        if (active && data) {
          setApiStatus(data);
        }
      })
      .catch(() => {
        // Keep apiStatus null if unreachable
      });
    return () => {
      active = false;
    };
  }, []);

  // Subscribe to Firestore assessments ONLY when auth is ready and user is signed in
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      const localItems = loadAssessments();
      setAssessments(localItems);
      setIsLoadingAssessments(false);
      setFirestoreError(null);
      return;
    }

    setIsLoadingAssessments(true);
    setFirestoreError(null);
    const unsubscribe = subscribeUserAssessments(
      user.uid,
      (items) => {
        setAssessments(items);
        setIsLoadingAssessments(false);
        setLatestResult((prev) => prev ?? items[0] ?? null);
      },
      (friendlyMessage) => {
        setFirestoreError(friendlyMessage);
        setIsLoadingAssessments(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const persistDraft = (
    nextProject: ProjectInput,
    nextRubric: RubricCriterion[],
    nextMode: 'default' | 'custom'
  ) => {
    const hasAnyInput =
      Boolean(nextProject.projectName.trim()) ||
      Boolean(nextProject.problem.trim()) ||
      Boolean(nextProject.intendedUsers.trim()) ||
      Boolean(nextProject.solution.trim()) ||
      Boolean(nextProject.workingStatus.trim()) ||
      Boolean(nextProject.readmeText.trim());

    if (hasAnyInput) {
      const timestamp = saveDraft({
        project: nextProject,
        rubric: nextRubric,
        rubricMode: nextMode,
      });
      setDraftUpdatedAt(timestamp);
      setHasSavedDraft(true);
    }
  };

  const handleChangeProject = (next: ProjectInput) => {
    setProject(next);
    if (isSampleData && next.projectName !== SAMPLE_DEMO_PROJECT.projectName) {
      setIsSampleData(false);
    }
    persistDraft(next, rubric, rubricMode);
  };

  const handleChangeRubric = (next: RubricCriterion[], mode: 'default' | 'custom') => {
    setRubric(next);
    setRubricMode(mode);
    persistDraft(project, next, mode);
  };

  const handleStartNewAssessment = () => {
    setProject({ ...EMPTY_PROJECT_INPUT });
    setRubric(DEFAULT_RUBRIC.map((c) => ({ ...c })));
    setRubricMode('default');
    setIsEditingExisting(false);
    setIsSampleData(false);
    setSubmitError(null);
    setScreen('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResumeDraft = () => {
    const draft = loadDraft();
    if (!draft) {
      handleStartNewAssessment();
      return;
    }
    setProject(draft.project);
    setRubric(draft.rubric);
    setRubricMode(draft.rubricMode);
    setDraftUpdatedAt(draft.updatedAt);
    setIsEditingExisting(false);
    setIsSampleData(draft.project.projectName === SAMPLE_DEMO_PROJECT.projectName);
    setSubmitError(null);
    setScreen('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadSampleProject = () => {
    const nextProject = { ...SAMPLE_DEMO_PROJECT };
    const nextRubric = DEFAULT_RUBRIC.map((c) => ({ ...c }));
    setProject(nextProject);
    setRubric(nextRubric);
    setRubricMode('default');
    setIsEditingExisting(false);
    setIsSampleData(true);
    setSubmitError(null);
    persistDraft(nextProject, nextRubric, 'default');
    setScreen('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearDraft = () => {
    clearDraft();
    setProject({ ...EMPTY_PROJECT_INPUT });
    setRubric(DEFAULT_RUBRIC.map((c) => ({ ...c })));
    setRubricMode('default');
    setIsSampleData(false);
    setDraftUpdatedAt(null);
    setHasSavedDraft(false);
    setSubmitError(null);
  };

  const persistResult = async (result: AssessmentResult) => {
    // Always keep local copy as immediate backup, and sync to Firestore when authenticated
    const localList = saveAssessment(result);
    if (!user) {
      setAssessments(localList);
      return;
    }
    try {
      await saveAssessmentToFirestore(user.uid, result);
      setFirestoreError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFirestoreError(
        msg.includes('Quota exceeded')
          ? 'Firestore daily free-tier quota exceeded (resets tomorrow). This assessment was kept locally in your browser.'
          : 'Could not save to Firestore; this assessment was kept locally in your browser.'
      );
      setAssessments(localList);
    }
  };

  const handleSubmitAssessment = async (forceSampleMode = false) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          rubric,
          forceSampleMode,
          isSampleData,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        result?: AssessmentResult;
        error?: string;
        canFallbackToSample?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        setSubmitError({
          message: payload.error ?? 'Could not complete assessment. Please try again.',
          canFallbackToSample: Boolean(payload.canFallbackToSample),
        });
        return;
      }

      await persistResult(payload.result);
      setLatestResult(payload.result);
      setStudioAssessmentId(payload.result.id);
      clearDraft();
      setDraftUpdatedAt(null);
      setHasSavedDraft(false);
      setReassessError(null);
      setScreen('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError({
        message: 'Network error while reaching the assessment server. Check that the server is running and try again.',
        canFallbackToSample: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAssessment = (assessment: AssessmentResult) => {
    setLatestResult(assessment);
    setReassessError(null);
    setScreen('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditAssessment = (assessment: AssessmentResult) => {
    setProject({ ...assessment.projectSnapshot });
    setRubric(assessment.rubricSnapshot.map((c) => ({ ...c })));
    const isDefault =
      assessment.rubricSnapshot.length === DEFAULT_RUBRIC.length &&
      assessment.rubricSnapshot.every(
        (c, i) =>
          c.name === DEFAULT_RUBRIC[i].name && c.weight === DEFAULT_RUBRIC[i].weight
      );
    setRubricMode(isDefault ? 'default' : 'custom');
    setIsEditingExisting(true);
    setIsSampleData(Boolean(assessment.isSampleData));
    setSubmitError(null);
    setScreen('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAssessment = async (id: string) => {
    const nextLocal = deleteAssessment(id);
    if (!user) {
      setAssessments(nextLocal);
      if (latestResult?.id === id) {
        setLatestResult(nextLocal[0] ?? null);
      }
      return;
    }

    try {
      await deleteAssessmentFromFirestore(id);
      if (latestResult?.id === id) {
        setLatestResult((prev) => {
          const remaining = assessments.filter((a) => a.id !== id);
          return prev?.id === id ? remaining[0] ?? null : prev;
        });
      }
    } catch {
      setFirestoreError('Could not delete assessment from Firestore.');
    }
  };

  const handleReassessCurrent = async () => {
    if (!latestResult) return;
    setIsReassessing(true);
    setReassessError(null);

    try {
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: latestResult.projectSnapshot,
          rubric: latestResult.rubricSnapshot,
          isSampleData: Boolean(latestResult.isSampleData),
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        result?: AssessmentResult;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.result) {
        setReassessError(payload.error ?? 'Reassessment failed. Try editing the project or running again.');
        return;
      }
      await persistResult(payload.result);
      setLatestResult(payload.result);
    } catch {
      setReassessError('Network error while re-running assessment.');
    } finally {
      setIsReassessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf5ee] text-[#2a221d] print:bg-white">
      <Header
        activeScreen={screen}
        hasLatestResult={Boolean(latestResult)}
        onNavigate={(nextScreen) => {
          if (nextScreen === 'studio' && !studioAssessmentId && latestResult) {
            setStudioAssessmentId(latestResult.id);
          }
          setScreen(nextScreen);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onStartNewAssessment={handleStartNewAssessment}
      />

      {screen === 'studio' ? (
        <main className="flex-1 w-full">
          <Studio3DView
            assessments={assessments}
            selectedAssessmentId={studioAssessmentId}
            onSelectAssessmentId={setStudioAssessmentId}
            onOpenReport={handleOpenAssessment}
            onStartNewAssessment={handleStartNewAssessment}
            onBackToDashboard={() => setScreen('dashboard')}
          />
        </main>
      ) : (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          {screen === 'dashboard' && (
            <DashboardView
              assessments={assessments}
              isLoadingAssessments={isLoadingAssessments}
              firestoreError={firestoreError}
              user={user}
              authReady={authReady}
              isSigningIn={isSigningIn}
              authError={authError}
              apiStatus={apiStatus}
              hasDraft={hasSavedDraft}
              onSignInWithGoogle={signInWithGoogle}
              onSignOut={signOutUser}
              onStartNewAssessment={handleStartNewAssessment}
              onResumeDraft={handleResumeDraft}
              onLoadSampleProject={handleLoadSampleProject}
              onOpenAssessment={handleOpenAssessment}
              onEditAssessment={handleEditAssessment}
              onDeleteAssessment={handleDeleteAssessment}
              onOpenGuide={() => setScreen('guide')}
              onOpenStudio={(assessmentId) => {
                setStudioAssessmentId(assessmentId ?? latestResult?.id ?? null);
                setScreen('studio');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {screen === 'form' && (
            <AssessmentFormView
              project={project}
              rubric={rubric}
              rubricMode={rubricMode}
              isEditingExisting={isEditingExisting}
              isSampleData={isSampleData}
              draftUpdatedAt={draftUpdatedAt}
              apiStatus={apiStatus}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onChangeProject={handleChangeProject}
              onChangeRubric={handleChangeRubric}
              onLoadSampleProject={handleLoadSampleProject}
              onClearDraft={handleClearDraft}
              onSubmit={handleSubmitAssessment}
              onCancel={() => setScreen('dashboard')}
            />
          )}

          {screen === 'results' && latestResult && (
            <ResultsView
              result={latestResult}
              isReassessing={isReassessing}
              reassessError={reassessError}
              onEditProject={() => handleEditAssessment(latestResult)}
              onReassess={handleReassessCurrent}
              onOpenInStudio={() => {
                setStudioAssessmentId(latestResult.id);
                setScreen('studio');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onBackToDashboard={() => setScreen('dashboard')}
            />
          )}

          {screen === 'guide' && (
            <RubricGuideView
              onStartAssessment={handleStartNewAssessment}
              onBackToDashboard={() => setScreen('dashboard')}
            />
          )}
        </main>
      )}
    </div>
  );
}
