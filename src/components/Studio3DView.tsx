import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { DEFAULT_RUBRIC } from '../lib/rubric.ts';
import type { MonumentPillarDatum } from '../three/rubricMonument.ts';
import { STUDIO_THEMES, type StudioThemeId } from '../three/themes.ts';
import type { AssessmentResult } from '../types/buildrank.ts';
import {
  type CameraPresetId,
  RubricMonumentViewport,
} from './RubricMonumentViewport.tsx';

interface Studio3DViewProps {
  assessments: AssessmentResult[];
  selectedAssessmentId: string | null;
  onSelectAssessmentId: (id: string | null) => void;
  onOpenReport: (assessment: AssessmentResult) => void;
  onStartNewAssessment: () => void;
  onBackToDashboard: () => void;
}

const DEFAULT_BLUEPRINT_PILLARS: MonumentPillarDatum[] = DEFAULT_RUBRIC.map((c) => ({
  id: c.id,
  name: c.name,
  score: 80,
  weight: c.weight,
  weightedContribution: (80 * c.weight) / 100,
  evidenceStatus: 'Sufficient evidence',
  missingInformation: null,
  followUpQuestion: c.description,
}));

export const Studio3DView: React.FC<Studio3DViewProps> = ({
  assessments,
  selectedAssessmentId,
  onSelectAssessmentId,
  onOpenReport,
  onStartNewAssessment,
  onBackToDashboard,
}) => {
  const [themeId, setThemeId] = useState<StudioThemeId>('sahara');
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('isometric');
  const [presetTrigger, setPresetTrigger] = useState(0);
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Keyboard shortcut 'H' to collapse/expand bottom dock, 'R' to reset view
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        setCameraPreset('isometric');
        setPresetTrigger((n) => n + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeAssessment = useMemo(() => {
    if (!selectedAssessmentId) return null;
    return assessments.find((a) => a.id === selectedAssessmentId) ?? null;
  }, [assessments, selectedAssessmentId]);

  const pillars: MonumentPillarDatum[] = useMemo(() => {
    if (!activeAssessment) return DEFAULT_BLUEPRINT_PILLARS;
    return activeAssessment.categories.map((cat) => ({
      id: cat.criterionId,
      name: cat.criterionName,
      score: cat.score,
      weight: cat.weight,
      weightedContribution: cat.weightedContribution,
      evidenceStatus: cat.evidenceStatus,
      missingInformation: cat.missingInformation,
      followUpQuestion: cat.followUpQuestion,
    }));
  }, [activeAssessment]);

  const overallScore = activeAssessment ? activeAssessment.overallScore : 80;
  const readinessLabel = activeAssessment ? activeAssessment.readinessLabel : 'Demo-ready';

  const activePillarIndex = hoveredIndex ?? selectedIndex;
  const inspectedPillar =
    activePillarIndex !== null && pillars[activePillarIndex]
      ? pillars[activePillarIndex]
      : null;

  const isDarkTheme = STUDIO_THEMES[themeId].isDark;
  // Solid surface styling (NO backdrop-blur over WebGL)
  const cardSurface = isDarkTheme
    ? 'bg-[#231d19] border border-[rgba(216,208,200,0.2)] text-[#f3ebe0]'
    : 'bg-[#fffdf9] border border-[rgba(216,208,200,0.85)] text-[#2a221d]';
  const mutedText = isDarkTheme ? 'text-[#b8a99a]' : 'text-[#7a6d64]';
  const secondaryText = isDarkTheme ? 'text-[#d8cdc0]' : 'text-[#5c5048]';

  const handleSelectCamera = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    setPresetTrigger((n) => n + 1);
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden select-none">
      {/* Dedicated WebGL Viewport Canvas */}
      <RubricMonumentViewport
        pillars={pillars}
        overallScore={overallScore}
        readinessLabel={readinessLabel}
        themeId={themeId}
        cameraPreset={cameraPreset}
        presetTrigger={presetTrigger}
        autoOrbit={autoOrbit}
        selectedIndex={selectedIndex}
        onSelectPillar={(idx) => setSelectedIndex((prev) => (prev === idx ? null : idx))}
        onHoverPillar={setHoveredIndex}
      />

      {/* Top-Left Compact Assessment Context Overlay */}
      <div
        className={`absolute top-4 left-4 sm:top-5 sm:left-6 z-10 rounded-xl shadow-[0_4px_20px_rgba(32,24,18,0.12)] px-4 py-3.5 max-w-[340px] space-y-2.5 ${cardSurface}`}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className={`inline-flex items-center gap-1.5 text-xs font-medium hover:text-[#c2652a] transition-colors cursor-pointer ${secondaryText}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Dashboard</span>
          </button>

          {activeAssessment ? (
            <button
              type="button"
              onClick={() => onOpenReport(activeAssessment)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#c2652a] hover:underline cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Open report</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartNewAssessment}
              className="text-xs font-semibold text-[#c2652a] hover:underline cursor-pointer"
            >
              Assess a project
            </button>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="studio-assessment-select" className={`block text-[11px] font-medium ${mutedText}`}>
            3D Rubric Visualization
          </label>
          <select
            id="studio-assessment-select"
            value={selectedAssessmentId ?? ''}
            onChange={(e) => {
              setSelectedIndex(null);
              onSelectAssessmentId(e.target.value || null);
            }}
            className={`w-full text-xs font-semibold rounded-lg px-2.5 py-1.5 border focus:outline-none focus:border-[#c2652a] cursor-pointer ${
              isDarkTheme
                ? 'bg-[#191512] border-[rgba(216,208,200,0.22)] text-[#f3ebe0]'
                : 'bg-[#faf5ee] border-[rgba(216,208,200,0.85)] text-[#2a221d]'
            }`}
          >
            <option value="">Default Hackathon Rubric (20 / 20 / 25 / 20 / 15)</option>
            {assessments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.projectSnapshot.projectName} ({item.overallScore}/100)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-baseline justify-between pt-1 border-t border-[rgba(216,208,200,0.25)]">
          <div>
            <p className={`text-[11px] ${mutedText}`}>
              {activeAssessment ? 'Weighted score' : 'Blueprint scale'}
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {overallScore} <span className={`text-xs font-normal ${mutedText}`}>/ 100</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`text-[11px] ${mutedText}`}>Status</p>
            <p className="text-xs font-semibold inline-flex items-center gap-1">
              {readinessLabel === 'Demo-ready' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2f6b48]" aria-hidden="true" />
              ) : readinessLabel === 'Promising' ? (
                <Clock className="w-3.5 h-3.5 text-[#c2652a]" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-[#8c3c3c]" aria-hidden="true" />
              )}
              <span>{activeAssessment ? readinessLabel : 'Reference rubric'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Top-Right Pillar Inspector Card (only when a pillar is hovered or clicked) */}
      {inspectedPillar && (
        <div
          className={`absolute top-4 right-4 sm:top-5 sm:right-6 z-10 rounded-xl shadow-[0_4px_20px_rgba(32,24,18,0.12)] px-4 py-3.5 w-[290px] sm:w-[310px] space-y-2 ${cardSurface}`}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug">{inspectedPillar.name}</h3>
            <span className="font-mono text-xs font-semibold text-[#c2652a] tabular-nums shrink-0">
              {inspectedPillar.weight}% wt
            </span>
          </div>

          <div className="flex items-baseline justify-between text-xs pt-1">
            <span className="font-mono font-semibold tabular-nums">
              {inspectedPillar.score} / 100
            </span>
            <span className={`font-mono tabular-nums ${mutedText}`}>
              +{inspectedPillar.weightedContribution.toFixed(1)} pts
            </span>
          </div>

          <div className="text-xs font-medium">
            {inspectedPillar.evidenceStatus === 'Not enough information' ? (
              <span className="text-[#8c3c3c]">Not enough information</span>
            ) : inspectedPillar.evidenceStatus === 'Partial evidence' ? (
              <span className="text-[#c2652a]">Partial evidence</span>
            ) : (
              <span className="text-[#2f6b48]">
                {activeAssessment ? 'Sufficient evidence' : 'Rubric criterion'}
              </span>
            )}
          </div>

          {(inspectedPillar.missingInformation || inspectedPillar.followUpQuestion) && (
            <p className={`text-xs leading-relaxed pt-1.5 border-t border-[rgba(216,208,200,0.25)] ${secondaryText}`}>
              {inspectedPillar.missingInformation ?? inspectedPillar.followUpQuestion}
            </p>
          )}
        </div>
      )}

      {/* Bottom Collapsible Control Dock (<= 15% viewport footprint) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 max-w-[95vw]">
        {!dockCollapsed ? (
          <div
            className={`rounded-xl shadow-[0_4px_24px_rgba(32,24,18,0.14)] px-3.5 py-2.5 flex flex-wrap items-center justify-center gap-3 ${cardSurface}`}
          >
            {/* Camera Presets */}
            <div className="flex items-center gap-1" role="group" aria-label="Camera angles">
              {(
                [
                  { id: 'isometric', label: 'Isometric' },
                  { id: 'top', label: 'Top Dial' },
                  { id: 'hero', label: 'Low Hero' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectCamera(preset.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    cameraPreset === preset.id
                      ? 'bg-[#c2652a] text-white'
                      : isDarkTheme
                        ? 'text-[#d8cdc0] hover:bg-[#322923]'
                        : 'text-[#5c5048] hover:bg-[#f3ebe0]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <span className={`hidden sm:inline-block h-4 w-px ${isDarkTheme ? 'bg-white/15' : 'bg-[#d8d0c8]'}`} />

            {/* Studio Material Finish */}
            <div className="flex items-center gap-1" role="group" aria-label="Studio finish">
              {(Object.keys(STUDIO_THEMES) as StudioThemeId[]).map((id) => {
                const label = id === 'sahara' ? 'Sahara' : id === 'alabaster' ? 'Alabaster' : 'Obsidian';
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeId(id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      themeId === id
                        ? isDarkTheme
                          ? 'bg-[#f3ebe0] text-[#2a221d]'
                          : 'bg-[#2a221d] text-[#fffdf9]'
                        : isDarkTheme
                          ? 'text-[#d8cdc0] hover:bg-[#322923]'
                          : 'text-[#5c5048] hover:bg-[#f3ebe0]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <span className={`hidden sm:inline-block h-4 w-px ${isDarkTheme ? 'bg-white/15' : 'bg-[#d8d0c8]'}`} />

            {/* Auto-Orbit & Reset & Collapse */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoOrbit((v) => !v)}
                aria-label={autoOrbit ? 'Pause orbit' : 'Start orbit'}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isDarkTheme ? 'hover:bg-[#322923]' : 'hover:bg-[#f3ebe0]'
                }`}
              >
                {autoOrbit ? (
                  <Pause className="w-3.5 h-3.5 text-[#c2652a]" aria-hidden="true" />
                ) : (
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Orbit</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCamera('isometric')}
                aria-label="Reset camera view"
                title="Reset camera (R)"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkTheme ? 'hover:bg-[#322923]' : 'hover:bg-[#f3ebe0]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setDockCollapsed(true)}
                aria-label="Hide studio controls"
                title="Hide controls (H)"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkTheme ? 'hover:bg-[#322923]' : 'hover:bg-[#f3ebe0]'
                }`}
              >
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDockCollapsed(false)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl shadow-[0_4px_20px_rgba(32,24,18,0.12)] cursor-pointer ${cardSurface}`}
          >
            <Eye className="w-3.5 h-3.5 text-[#c2652a]" aria-hidden="true" />
            <span>Studio controls</span>
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
