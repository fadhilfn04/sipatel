'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type FontSize = 'normal' | 'large' | 'xl' | 'xxl';
export type FontFamily = 'inter' | 'arial' | 'verdana' | 'georgia';
export type SidebarColor = 'default' | 'blue-dark' | 'blue' | 'navy' | 'green' | 'maroon' | 'gray';

export interface UISettings {
  fontSize: FontSize;
  fontFamily: FontFamily;
  sidebarColor: SidebarColor;
}

export const FONT_SIZES: Record<FontSize, { label: string; px: string; htmlSize: string }> = {
  normal:  { label: 'Normal',       px: '14px', htmlSize: '14px' },
  large:   { label: 'Besar',        px: '16px', htmlSize: '16px' },
  xl:      { label: 'Lebih Besar',  px: '18px', htmlSize: '18px' },
  xxl:     { label: 'Sangat Besar', px: '20px', htmlSize: '20px' },
};

export const FONT_FAMILIES: Record<FontFamily, { label: string; family: string }> = {
  inter:   { label: 'Inter (Default)',   family: 'Inter, sans-serif' },
  arial:   { label: 'Arial',            family: 'Arial, Helvetica, sans-serif' },
  verdana: { label: 'Verdana',          family: 'Verdana, Geneva, sans-serif' },
  georgia: { label: 'Georgia',          family: 'Georgia, "Times New Roman", serif' },
};

export const SIDEBAR_COLORS: Record<SidebarColor, { label: string; bg: string; dark: boolean; preview: string }> = {
  default:   { label: 'Default',    bg: '',        dark: false, preview: 'bg-background border' },
  'blue-dark': { label: 'Biru Tua', bg: '#1e3a5f', dark: true,  preview: 'bg-[#1e3a5f]' },
  blue:      { label: 'Biru',       bg: '#1d4ed8', dark: true,  preview: 'bg-[#1d4ed8]' },
  navy:      { label: 'Navy',       bg: '#0f172a', dark: true,  preview: 'bg-[#0f172a]' },
  green:     { label: 'Hijau',      bg: '#14532d', dark: true,  preview: 'bg-[#14532d]' },
  maroon:    { label: 'Merah Marun',bg: '#7f1d1d', dark: true,  preview: 'bg-[#7f1d1d]' },
  gray:      { label: 'Abu-abu',    bg: '#374151', dark: true,  preview: 'bg-[#374151]' },
};

const DEFAULT_SETTINGS: UISettings = {
  fontSize: 'normal',
  fontFamily: 'inter',
  sidebarColor: 'default',
};

const STORAGE_KEY = 'sipatel_ui_settings';

interface UISettingsContextType {
  uiSettings: UISettings;
  setFontSize: (size: FontSize) => void;
  setFontFamily: (font: FontFamily) => void;
  setSidebarColor: (color: SidebarColor) => void;
  resetSettings: () => void;
}

const UISettingsContext = createContext<UISettingsContextType | undefined>(undefined);

function applySettings(settings: UISettings) {
  if (typeof document === 'undefined') return;

  // Font size — applied to html root so all rem-based sizes scale
  document.documentElement.style.fontSize = FONT_SIZES[settings.fontSize].htmlSize;

  // Font family — override next/font by setting on body
  if (settings.fontFamily === 'inter') {
    document.body.style.fontFamily = '';
  } else {
    document.body.style.fontFamily = FONT_FAMILIES[settings.fontFamily].family;
  }

  // Sidebar color — stored as CSS variables on :root, consumed by Sidebar component
  const colorConfig = SIDEBAR_COLORS[settings.sidebarColor];
  document.documentElement.style.setProperty('--ui-sidebar-bg', colorConfig.bg);
  document.documentElement.style.setProperty('--ui-sidebar-dark', colorConfig.dark ? '1' : '0');
}

export function UISettingsProvider({ children }: { children: React.ReactNode }) {
  const [uiSettings, setUISettings] = useState<UISettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: UISettings = JSON.parse(stored);
        setUISettings(parsed);
        applySettings(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const update = useCallback((partial: Partial<UISettings>) => {
    setUISettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applySettings(next);
      return next;
    });
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => update({ fontSize }), [update]);
  const setFontFamily = useCallback((fontFamily: FontFamily) => update({ fontFamily }), [update]);
  const setSidebarColor = useCallback((sidebarColor: SidebarColor) => update({ sidebarColor }), [update]);
  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUISettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <UISettingsContext.Provider value={{ uiSettings, setFontSize, setFontFamily, setSidebarColor, resetSettings }}>
      {children}
    </UISettingsContext.Provider>
  );
}

export function useUISettings() {
  const ctx = useContext(UISettingsContext);
  if (!ctx) throw new Error('useUISettings must be used inside UISettingsProvider');
  return ctx;
}
