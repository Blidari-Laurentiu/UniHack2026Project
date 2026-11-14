// Person B's folder: the group's "why you match" line and note in Romanian.
//
// The server writes both in English when the group is formed and saves them with the group
// (backend/services/matching.py why_you_match, routers/events.py MEET_NOTE). The sentence has
// a small fixed shape, so Romanian reads the interests and free times back out of it and
// writes the same sentence again. Anything it does not recognise is shown as it is, in English.
// If the wording in matching.py changes, change it here too.
import { INTERESTS_EN, INTERESTS_RO } from './strings.js';

const FALLBACK = 'You are all going to this event and looking for company.';
const MEET_NOTE = 'Meet at the entrance 30 minutes before.';

const SLOTS_EN = {
  weekday_morning: 'weekday mornings',
  weekday_evening: 'weekday evenings',
  weekend_morning: 'weekend mornings',
  weekend_afternoon: 'weekend afternoons',
  weekend_evening: 'weekend evenings',
};
const SLOTS_RO = {
  weekday_morning: 'în zilele lucrătoare dimineața',
  weekday_evening: 'în zilele lucrătoare seara',
  weekend_morning: 'în weekend dimineața',
  weekend_afternoon: 'în weekend după-amiaza',
  weekend_evening: 'în weekend seara',
};
const INTEREST_PHRASES = Object.fromEntries(
  Object.entries(INTERESTS_EN).map(([slug, label]) => [slug, label.toLowerCase()]),
);

/**
 * Splits "a, b and c" into the keys of `phrases` ({ key: 'phrase' }), or null. Tries every
 * way, because a phrase may have " and " in it ("food and drinks").
 */
function splitList(text, phrases) {
  const entries = Object.entries(phrases);
  const walk = (rest) => {
    for (const [key, phrase] of entries) {
      if (!rest.startsWith(phrase)) continue;
      const after = rest.slice(phrase.length);
      if (after === '') return [key];
      for (const sep of [', ', ' and ']) {
        if (!after.startsWith(sep)) continue;
        const tail = walk(after.slice(sep.length));
        if (tail) return [key, ...tail];
      }
    }
    return null;
  };
  return walk(text);
}

/** Romanian for the server's English "why you match" line; `list` is t.fmt.list. */
function whyRo(text, list) {
  if (text === FALLBACK) return 'Toți mergeți la acest eveniment și vă căutați companie.';
  if (!text.endsWith('.')) return null;
  const sentence = text.slice(0, -1);

  let who = null;
  let likes = null;
  let free = null;
  if (sentence.startsWith('You are all free on ')) {
    free = sentence.slice('You are all free on '.length);
  } else {
    const start = ['You all like ', 'Most of you like '].find((p) => sentence.startsWith(p));
    if (!start) return null;
    who = start.startsWith('You all') ? 'all' : 'most';
    const rest = sentence.slice(start.length);
    const cut = rest.indexOf(', and are free on ');
    likes = cut === -1 ? rest : rest.slice(0, cut);
    if (cut !== -1) free = rest.slice(cut + ', and are free on '.length);
  }

  const interests = likes === null ? [] : splitList(likes, INTEREST_PHRASES);
  const slots = free === null ? [] : splitList(free, SLOTS_EN);
  if (!interests || !slots) return null;

  const freeRo = list(slots.map((s) => SLOTS_RO[s]));
  if (!who) return `Sunteți toți liberi ${freeRo}.`;
  const names = list(interests.map((slug) => INTERESTS_RO[slug].toLocaleLowerCase('ro')));
  const likesRo =
    who === 'all'
      ? `Toți sunteți pasionați de ${names}`
      : `Cei mai mulți dintre voi sunteți pasionați de ${names}`;
  return slots.length ? `${likesRo} și sunteți liberi ${freeRo}.` : `${likesRo}.`;
}

/** The group's "why you match" line in the current language. */
export function whyYouMatch(t, text) {
  if (t.lang !== 'ro' || !text) return text;
  return whyRo(text.trim(), t.fmt.list) ?? text;
}

/** The group's note ("Meet at the entrance…") in the current language. */
export function groupNote(t, text) {
  if (t.lang !== 'ro' || !text) return text;
  return text.trim() === MEET_NOTE ? 'Vă vedeți la intrare, cu 30 de minute înainte de început.' : text;
}
