import React from 'react';

export type ActiveScreen = 'dashboard' | 'studio' | 'form' | 'results' | 'guide';

interface HeaderProps {
  activeScreen: ActiveScreen;
  hasLatestResult: boolean;
  onNavigate: (screen: ActiveScreen) => void;
  onStartNewAssessment: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  hasLatestResult,
  onNavigate,
  onStartNewAssessment,
}) => {
  const navLinkClass = (isActive: boolean) =>
    `text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 pb-0.5 border-b ${
      isActive
        ? 'text-[#2a221d] border-[#c2652a]'
        : 'text-[#5c5048] border-transparent hover:text-[#2a221d] hover:border-[#d8d0c8]'
    }`;

  return (
    <header className="no-print border-b border-[rgba(216,208,200,0.75)] bg-[#faf5ee] sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="font-serif text-2xl font-semibold tracking-tight text-[#2a221d] whitespace-nowrap shrink-0 hover:text-[#c2652a] transition-colors cursor-pointer"
        >
          BuildRank
        </button>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`${navLinkClass(activeScreen === 'dashboard')} cursor-pointer`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className={`${navLinkClass(activeScreen === 'studio')} cursor-pointer`}
          >
            3D Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate('form')}
            className={`${navLinkClass(activeScreen === 'form')} cursor-pointer`}
          >
            Assessment Form
          </button>
          {hasLatestResult && (
            <button
              type="button"
              onClick={() => onNavigate('results')}
              className={`${navLinkClass(activeScreen === 'results')} cursor-pointer`}
            >
              Latest Report
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('guide')}
            className={`${navLinkClass(activeScreen === 'guide')} cursor-pointer`}
          >
            Rubric Guide
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onStartNewAssessment}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#c2652a] hover:bg-[#a8531e] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Assess a project
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-[rgba(216,208,200,0.45)] px-4 py-2 flex items-center gap-5 overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={navLinkClass(activeScreen === 'dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className={navLinkClass(activeScreen === 'studio')}
        >
          3D Studio
        </button>
        <button
          type="button"
          onClick={() => onNavigate('form')}
          className={navLinkClass(activeScreen === 'form')}
        >
          Assessment Form
        </button>
        {hasLatestResult && (
          <button
            type="button"
            onClick={() => onNavigate('results')}
            className={navLinkClass(activeScreen === 'results')}
          >
            Latest Report
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate('guide')}
          className={navLinkClass(activeScreen === 'guide')}
        >
          Rubric Guide
        </button>
      </nav>
    </header>
  );
};
