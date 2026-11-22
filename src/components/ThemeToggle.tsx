import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';

const NEXT: Record<ThemePref, ThemePref> = { auto: 'dark', dark: 'light', light: 'auto' };
const LABEL: Record<ThemePref, string> = { auto: 'Tema automático', dark: 'Tema oscuro', light: 'Tema claro' };

/** Alterna entre tema automático, oscuro y claro. */
export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getThemePref());
  const Icon = pref === 'auto' ? Monitor : pref === 'dark' ? Moon : Sun;
  return (
    <button className="btn btn-sm btn-ghost icon-btn" onClick={() => { const n = NEXT[pref]; setThemePref(n); setPref(n); }}
      aria-label={`${LABEL[pref]}. Cambiar tema`} title={`${LABEL[pref]} (toque para cambiar)`}>
      <Icon size={20} />
    </button>
  );
}
