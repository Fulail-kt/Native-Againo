import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme as useOsScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { storageGet, storageSet } from './storage';

const THEME_KEY = 'againo.theme';

export type ThemePref = 'system' | 'light' | 'dark';
export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryDark: string;
  success: string;
  warning: string;
  danger: string;
  accent: string;
};

/** Light = 3 layers (slate canvas / white cards / blue inset). Dark = zinc stack. */
export const palettes: Record<'light' | 'dark', Palette> = {
  dark: {
    bg: '#09090B',
    surface: '#18181B',
    surface2: '#27272A',
    border: '#3F3F46',
    text: '#FAFAFA',
    muted: '#A1A1AA',
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    accent: '#3B82F6',
  },
  light: {
    bg: '#F1F5F9',
    surface: '#FFFFFF',
    surface2: '#EFF6FF',
    border: '#CBD5E1',
    text: '#0F172A',
    muted: '#64748B',
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    accent: '#2563EB',
  },
};

let active: Palette = palettes.dark;

export const colors: Palette = new Proxy({} as Palette, {
  get(_, key: string) {
    return active[key as keyof Palette];
  },
});

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

function cssVarsOf(p: Palette) {
  return vars({
    '--color-bg': p.bg,
    '--color-surface': p.surface,
    '--color-surface2': p.surface2,
    '--color-border': p.border,
    '--color-ink': p.text,
    '--color-muted': p.muted,
    '--color-primary': p.primary,
    '--color-primary-dark': p.primaryDark,
    '--color-success': p.success,
    '--color-warning': p.warning,
    '--color-danger': p.danger,
    '--color-accent': p.accent,
  });
}

function readPrefSync(): ThemePref {
  if (Platform.OS === 'web') {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* ignore */
    }
  }
  return 'system';
}

type ThemeCtx = {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const os = useOsScheme();
  const [pref, setPrefState] = useState<ThemePref>(readPrefSync);

  useEffect(() => {
    void storageGet(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
    });
  }, []);

  const resolved: 'light' | 'dark' = pref === 'system' ? (os === 'light' ? 'light' : 'dark') : pref;
  const palette = palettes[resolved];
  active = palette;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.style.colorScheme = resolved;
    }
  }, [resolved]);

  const value = useMemo<ThemeCtx>(
    () => ({
      pref,
      resolved,
      setPref: (p) => {
        setPrefState(p);
        void storageSet(THEME_KEY, p);
      },
    }),
    [pref, resolved],
  );

  return (
    <Ctx.Provider value={value}>
      <View className="flex-1 bg-bg" style={[{ flex: 1 }, cssVarsOf(palette)]}>
        {children}
      </View>
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme needs ThemeProvider');
  return ctx;
}
