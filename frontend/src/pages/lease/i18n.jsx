// Person A: a small English / Romanian layer for the lease pages. No i18n library.
//
// Nothing in this file is about leases, so the events pages can reuse it as it is:
//   const useT = createT({ en: { hello: 'Hello', items: (n) => `${n} items` }, ro: { ... } });
//   const t = useT();     t('hello')   t('items', 3)   t.lang   t.opt('maybe.missing')
//   <LangSwitch />        the EN / RO buttons
//   <LangScope>…</LangScope>  marks its content with the right lang attribute
//
// The language lives in one module-level store, so every page shows the same one without a
// provider in App.jsx. It starts from the saved choice, then the browser language (Romanian
// when the browser is Romanian, otherwise English). The choice is saved in localStorage when
// that is available, and kept in memory for this visit when it is not.
import { useMemo, useSyncExternalStore } from 'react';

export const LANGS = ['en', 'ro'];
const NAMES = { en: 'English', ro: 'Română' };
const STORAGE_KEY = 'newcomer-hub-lang';

function initialLang() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // Storage is blocked (private mode, browser settings): fall through to the browser language.
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return browser.toLowerCase().startsWith('ro') ? 'ro' : 'en';
}

let current = initialLang();
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getLang = () => current;

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not saved; the choice still holds until the page is reloaded.
  }
  listeners.forEach((fn) => fn());
}

/** The current language code ('en' or 'ro'); the component re-renders when it changes. */
export const useLang = () => useSyncExternalStore(subscribe, getLang);

/**
 * Makes a useT() hook for one dictionary: { en: { key: 'text' | (...args) => 'text' }, ro: {…} }.
 * A key missing in the current language falls back to English, then to the key itself.
 */
export function createT(dictionaries) {
  return function useT() {
    const lang = useLang();
    return useMemo(() => {
      const opt = (key, ...args) => {
        const value = dictionaries[lang]?.[key] ?? dictionaries.en?.[key];
        return typeof value === 'function' ? value(...args) : value;
      };
      const t = (key, ...args) => opt(key, ...args) ?? key;
      t.opt = opt; // undefined when the key is unknown, for values that come from the server
      t.lang = lang;
      return t;
    }, [lang]);
  };
}

const TAGS = { b: 'strong', code: 'code', mark: 'mark' };

/**
 * Turns the <b>, <code> and <mark> marks of a translated string into React elements (never
 * raw HTML), so a sentence can keep its emphasis in any word order. `classes` maps a mark to
 * a class name, for example { mark: 'lease-how-redacted' }.
 */
export function rich(text, classes = {}) {
  const pattern = /<(b|code|mark)>(.*?)<\/\1>/g;
  const out = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const Tag = TAGS[match[1]];
    out.push(
      <Tag key={match.index} className={classes[match[1]]}>
        {match[2]}
      </Tag>,
    );
    last = pattern.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

/** The visible EN / RO switch. */
export function LangSwitch({ className = '' }) {
  const lang = useLang();
  return (
    <div className={`lease-chart-toggle lease-lang ${className}`} role="group" aria-label="Language / Limbă">
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className="lease-chart-toggle-btn"
          aria-pressed={lang === code}
          aria-label={NAMES[code]}
          title={NAMES[code]}
          lang={code}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Tells screen readers and the browser which language the content is in, without a box of its own. */
export function LangScope({ children }) {
  const lang = useLang();
  return (
    <div lang={lang} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
