export type StudioThemeId = 'sahara' | 'alabaster' | 'obsidian';

export interface StudioThemeConfig {
  id: StudioThemeId;
  label: string;
  isDark: boolean;
  backgroundHex: string;
  fogHex: string;
  fogDensity: number;
  floorHex: string;
  plinthHex: string;
  collarHex: string;
  dialBaseHex: string;
  dialTickHex: string;
  dialAccentHex: string;
  metalPrimaryHex: string;
  metalAccentHex: string;
  pillarStoneHex: string;
  pillarInsufficientHex: string;
  coreReadyHex: string;
  corePromisingHex: string;
  coreNeedsDetailHex: string;
  keyLightHex: string;
  fillSkyHex: string;
  fillGroundHex: string;
}

export const STUDIO_THEMES: Record<StudioThemeId, StudioThemeConfig> = {
  sahara: {
    id: 'sahara',
    label: 'Sahara Travertine',
    isDark: false,
    backgroundHex: '#f5ede1',
    fogHex: '#f5ede1',
    fogDensity: 0.055,
    floorHex: '#f3eadc',
    plinthHex: '#e7dac6',
    collarHex: '#4f3b30',
    dialBaseHex: '#fbf7f0',
    dialTickHex: '#6c5c52',
    dialAccentHex: '#c2652a',
    metalPrimaryHex: '#7d624d',
    metalAccentHex: '#c2652a',
    pillarStoneHex: '#f8f2e8',
    pillarInsufficientHex: '#964747',
    coreReadyHex: '#2f6b48',
    corePromisingHex: '#c2652a',
    coreNeedsDetailHex: '#8c3c3c',
    keyLightHex: '#fff1dc',
    fillSkyHex: '#dce6f2',
    fillGroundHex: '#cbb8a3',
  },
  alabaster: {
    id: 'alabaster',
    label: 'Alabaster Gallery',
    isDark: false,
    backgroundHex: '#efede7',
    fogHex: '#efede7',
    fogDensity: 0.052,
    floorHex: '#edeae3',
    plinthHex: '#dfd9ce',
    collarHex: '#3c3834',
    dialBaseHex: '#faf8f4',
    dialTickHex: '#5a554f',
    dialAccentHex: '#b45a2a',
    metalPrimaryHex: '#8f877d',
    metalAccentHex: '#c2652a',
    pillarStoneHex: '#f6f3ed',
    pillarInsufficientHex: '#8c3c3c',
    coreReadyHex: '#2f6b48',
    corePromisingHex: '#b45a2a',
    coreNeedsDetailHex: '#8c3c3c',
    keyLightHex: '#fff7ea',
    fillSkyHex: '#e2ebf5',
    fillGroundHex: '#c5beb3',
  },
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian Atelier',
    isDark: true,
    backgroundHex: '#191512',
    fogHex: '#191512',
    fogDensity: 0.06,
    floorHex: '#1d1815',
    plinthHex: '#2b2420',
    collarHex: '#171310',
    dialBaseHex: '#231d19',
    dialTickHex: '#b8a99a',
    dialAccentHex: '#d68f49',
    metalPrimaryHex: '#7b6b5d',
    metalAccentHex: '#d68f49',
    pillarStoneHex: '#e6ddd0',
    pillarInsufficientHex: '#a84b4b',
    coreReadyHex: '#4b9b6d',
    corePromisingHex: '#d68f49',
    coreNeedsDetailHex: '#b55252',
    keyLightHex: '#ffe8c7',
    fillSkyHex: '#6c7c96',
    fillGroundHex: '#2d231c',
  },
};
