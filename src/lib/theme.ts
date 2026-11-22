// Tema de la interfaz: automático (según el sistema), claro u oscuro.
export type ThemePref = 'auto' | 'light' | 'dark';
const KEY = 'geovia-tema';

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131f2c' : '#003163');
}

export function setThemePref(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref); } catch { /* sin almacenamiento */ }
  applyTheme(pref);
}

/** Sigue los cambios del sistema mientras la preferencia sea «automático». */
export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const on = () => { if (getThemePref() === 'auto') applyTheme('auto'); };
  mq.addEventListener?.('change', on);
}
