// 경량 i18n — Context + 점 표기법 + 변수 치환.
// 외부 의존성 없이 useT() 훅으로 t('home.title') 같이 사용.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TRANSLATIONS, LOCALES, DEFAULT_LOCALE } from './translations.js';

const I18nContext = createContext({ locale: DEFAULT_LOCALE, t: k => k, setLocale: () => {} });

const STORAGE_KEY = 'beer-game.locale';

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
    // 브라우저 언어 자동 감지
    const lang = (window.navigator.language || '').slice(0, 2);
    return TRANSLATIONS[lang] ? lang : DEFAULT_LOCALE;
  });

  const setLocale = useCallback((next) => {
    if (TRANSLATIONS[next]) {
      window.localStorage.setItem(STORAGE_KEY, next);
      setLocaleState(next);
    }
  }, []);

  const t = useCallback((key, vars) => {
    const parts = key.split('.');
    let cur = TRANSLATIONS[locale];
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (cur == null) {
      // 폴백: 기본 로케일 시도
      cur = parts.reduce((c, p) => (c == null ? c : c[p]), TRANSLATIONS[DEFAULT_LOCALE]);
    }
    if (typeof cur !== 'string') return cur ?? key;
    if (vars) {
      return cur.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
    }
    return cur;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, locales: LOCALES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}

// 헤더에 두는 언어 토글 — 클릭하면 다음 언어로 순환
export function LocaleSwitcher() {
  const { locale, setLocale, locales } = useT();
  const idx = locales.findIndex(l => l.code === locale);
  const nextLocale = locales[(idx + 1) % locales.length];
  const currentLabel = locales[idx]?.label || locale;
  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale.code)}
      className="text-xs px-2 py-1 rounded border border-[#2c3a52] text-[#8a96a8] hover:text-white hover:border-[#f4a261]"
      title={`Switch to ${nextLocale.label}`}
    >
      🌐 {currentLabel}
    </button>
  );
}
