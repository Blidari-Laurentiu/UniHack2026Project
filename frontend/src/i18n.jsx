// Shared: a small English / Romanian layer for the whole app. No i18n library.
//
// Each area keeps its own dictionary: src/strings.js (top bar, auth, Home, Me, errors),
// pages/lease/strings.js, pages/events/strings.js, pages/student/strings.js and
// pages/account/strings.js.
//   const useT = createT({ en: { hello: 'Hello', items: (n) => `${n} items` }, ro: { ... } });
//   const t = useT();     t('hello')   t('items', 3)   t.lang   t.opt('maybe.missing')
//   t.fmt.date(iso)  t.fmt.dateTime(iso)  t.fmt.time(iso)  t.fmt.list(items, 'or')
//   <LangSwitch />        the EN / RO buttons; Layout.jsx shows one in the top bar on every page
//   <LangScope>…</LangScope>  marks its content with the right lang attribute
//
// The language lives in one module-level store, so every page shows the same one without a
// provider in App.jsx. It starts from the saved choice, then the browser language (Romanian
// when the browser is Romanian, otherwise English). The choice is saved in localStorage when
// that is available, and kept in memory for this visit when it is not. The store also sets
// <html lang>, so the whole document is marked with the language on screen.
import { useMemo, useSyncExternalStore } from 'react';

export const LANGS = ['en', 'ro'];
const NAMES = { en: 'English', ro: 'Română' };
const STORAGE_KEY = 'newcomer-hub-lang';
// en-GB, not the browser default: day before month and a 24-hour clock, as in Timișoara.
const LOCALES = { en: 'en-GB', ro: 'ro-RO' };

/** Counts with the right plural: enCount(1, 'room', 'rooms') → "1 room". */
export const enCount = (n, one, many) =>
  `${new Intl.NumberFormat('en-IE').format(n)} ${n === 1 ? one : many}`;

/** Romanian counts: 1 anunț, 2 anunțuri, 19 anunțuri, 20 de anunțuri, 101 anunțuri, 120 de anunțuri. */
export function roCount(n, one, many) {
  if (n === 1) return `1 ${one}`;
  const lastTwo = n % 100;
  const de = n !== 0 && (lastTwo === 0 || lastTwo >= 20) ? 'de ' : '';
  return `${new Intl.NumberFormat('ro-RO').format(n)} ${de}${many}`;
}

const formatCache = {};
/** Dates, times and lists in one language's conventions (t.fmt in every useT). */
function formatFor(lang) {
  if (formatCache[lang]) return formatCache[lang];
  const locale = LOCALES[lang] || LOCALES.en;
  const show = (iso, opts) => new Date(iso).toLocaleString(locale, opts);
  const lists = {
    and: new Intl.ListFormat(locale, { type: 'conjunction' }),
    or: new Intl.ListFormat(locale, { type: 'disjunction' }),
  };
  formatCache[lang] = {
    /** "14 Nov 2026" / "14 nov. 2026" */
    date: (iso) => show(iso, { day: 'numeric', month: 'short', year: 'numeric' }),
    /** "14 Nov 2026, 17:57" / "14 nov. 2026, 17:57" */
    dateTime: (iso) =>
      show(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    /** "Sat 14 Nov, 19:00" / "sâm., 14 nov., 19:00" */
    weekdayTime: (iso) =>
      show(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    /** "17:57" */
    time: (iso) => show(iso, { hour: '2-digit', minute: '2-digit' }),
    /** "a, b and c" / "a, b și c"; type 'or' gives "a or b" / "a sau b". */
    list: (items, type = 'and') => lists[type].format(items.map(String)),
  };
  return formatCache[lang];
}

function markDocument(lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

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
markDocument(current);
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getLang = () => current;

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  markDocument(lang);
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
      t.fmt = formatFor(lang);
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
    <div className={`lang-switch ${className}`} role="group" aria-label="Language / Limbă">
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-switch-btn"
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
