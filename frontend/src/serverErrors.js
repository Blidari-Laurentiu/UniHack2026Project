// Shared: the Romanian text of the errors the backend sends outside the lease pages (auth,
// account, student, profile, events, the database). The server always answers in English, so
// English shows its text as it is; Romanian looks the text up here, then falls back to a
// message for the HTTP status. The lease pages have their own (pages/lease/strings.js).
//
// Keep in step with the detail strings in backend/auth.py, main.py and routers/
// (account, student, profile, events, moderation). A text not listed here still gets the status message.
import { roCount } from './i18n.jsx';

const HOW_RO = {
  google: 'Google',
  github: 'GitHub',
  'a code sent to your email': 'un cod trimis pe email',
  'the dev header': 'antetul de dezvoltare',
  'another provider': 'alt furnizor',
};

// Exact server texts (compared in lower case) → Romanian.
const EXACT = {
  // backend/auth.py
  'auth is not configured on the server': 'Autentificarea nu este configurată pe server.',
  'token expired': 'Sesiunea a expirat. Autentifică-te din nou.',
  'invalid token': 'Sesiunea nu este validă. Autentifică-te din nou.',
  'invalid x-dev-user header': 'Antetul X-Dev-User nu este valid.',
  'missing bearer token': 'Trebuie să fii autentificat. Autentifică-te și încearcă din nou.',
  'verify your email address first': 'Verifică-ți mai întâi adresa de email.',
  'you do not have permission to do this': 'Nu ai permisiunea să faci asta.',
  'admin accounts must sign in with multi-factor authentication':
    'Conturile de administrator trebuie să se autentifice în doi pași.',
  // backend/main.py
  'the database is unavailable right now. please try again.':
    'Baza de date nu este disponibilă momentan. Încearcă din nou.',
  // routers/account.py
  'this account has no email address': 'Acest cont nu are o adresă de email.',
  'account management is not set up on the server':
    'Gestionarea contului nu este configurată pe server.',
  'the login service could not be reached, try again in a few minutes':
    'Serviciul de autentificare nu a putut fi contactat. Încearcă din nou peste câteva minute.',
  'two-factor authentication is not on': 'Autentificarea în doi pași nu este activă.',
  'admin accounts must keep two-factor authentication on':
    'Conturile de administrator trebuie să păstreze activă autentificarea în doi pași.',
  'sign in again with your authenticator code to turn two-factor authentication off':
    'Autentifică-te din nou cu codul din aplicația de autentificare ca să dezactivezi autentificarea în doi pași.',
  // routers/student.py
  'unknown university': 'Universitate necunoscută. Alege una din listă.',
  'use your university email without a +tag': 'Folosește emailul universitar fără partea cu „+”.',
  'sending email is not set up on the server': 'Trimiterea emailurilor nu este configurată pe server.',
  'you are already a verified student': 'Ești deja student verificat.',
  'this university email is already used by another account':
    'Acest email universitar este deja folosit de alt cont.',
  'too many codes in the last hour, try again later':
    'Prea multe coduri în ultima oră. Încearcă din nou mai târziu.',
  'no code to confirm, ask for a new one': 'Nu există niciun cod de confirmat. Cere unul nou.',
  'this code has expired, ask for a new one': 'Codul a expirat. Cere unul nou.',
  'too many wrong codes, ask for a new one': 'Prea multe coduri greșite. Cere unul nou.',
  'the email could not be sent right now, try again in a few minutes':
    'Emailul nu a putut fi trimis acum. Încearcă din nou peste câteva minute.',
  // routers/profile.py
  'display_name must not be empty': 'Prenumele nu poate fi gol.',
  'the file is empty': 'Fișierul este gol.',
  'the picture is too large (512 kb at most)': 'Poza este prea mare (cel mult 512 KB).',
  'use a jpeg, png or webp picture': 'Folosește o poză JPEG, PNG sau WebP.',
  'no profile picture': 'Nu există o poză de profil.',
  // routers/events.py
  'event not found': 'Evenimentul nu a fost găsit.',
  'this event has already started': 'Evenimentul a început deja.',
  'you have not joined this event': 'Nu te-ai înscris la acest eveniment.',
  'join this event before matching': 'Înscrie-te la eveniment înainte să cauți un grup.',
  'not in a group yet': 'Încă nu ești într-un grup.',
  'this event is not open right now': 'Evenimentul nu este disponibil momentan.',
  'the event must start in the future': 'Evenimentul trebuie să înceapă în viitor.',
  'the event must start within a year': 'Evenimentul trebuie să înceapă în cel mult un an.',
  'you cannot report your own event': 'Nu poți raporta propriul eveniment.',
  'you have already reported this event': 'Ai raportat deja acest eveniment.',
};

// Server texts with a name or a number in them.
const PATTERNS = [
  [
    /^this account has no password: you sign in with (.+)$/i,
    (how) => `Acest cont nu are parolă: te autentifici cu ${HOW_RO[how.toLowerCase()] || how}.`,
  ],
  [
    /^use your student email for (\S+) \((.+)\)$/i,
    (uni, domains) => `Folosește emailul de student pentru ${uni} (${domains.replace(/ or /g, ' sau ')}).`,
  ],
  [
    /^wait (\d+) seconds before asking for a new code$/i,
    (n) => `Așteaptă ${roCount(Number(n), 'secundă', 'secunde')} înainte să ceri un cod nou.`,
  ],
  [
    /^wrong code, (\d+) tr(?:y|ies) left$/i,
    (n) =>
      `Cod greșit. Mai ai ${n === '1' ? 'o încercare' : roCount(Number(n), 'încercare', 'încercări')}.`,
  ],
  [/^unknown interest: (.+)$/i, (slugs) => `Interes necunoscut: ${slugs}.`],
  [
    /^you can create (\d+) events? a day, try again tomorrow$/i,
    (n) =>
      `Poți crea ${n === '1' ? 'un eveniment' : roCount(Number(n), 'eveniment', 'evenimente')} pe zi. Încearcă din nou mâine.`,
  ],
];

// When the text is not known: a message for the HTTP status (0 = the server could not be reached).
const BY_STATUS = {
  0: 'Nu putem contacta serverul. Verifică internetul și încearcă din nou; serverul poate avea nevoie de un minut ca să pornească.',
  400: 'Cererea nu este validă.',
  401: 'Trebuie să fii autentificat. Autentifică-te și încearcă din nou.',
  403: 'Nu ai permisiunea să faci asta.',
  404: 'Nu a fost găsit.',
  409: 'Acțiunea nu se poate face acum.',
  422: 'Datele trimise nu sunt valide. Verifică formularul și încearcă din nou.',
  429: 'Prea multe încercări. Așteaptă puțin și încearcă din nou.',
  503: 'Serviciul nu este disponibil momentan. Încearcă din nou peste puțin timp.',
};

/** The text to show for an error from api.js, in `lang` ('en' or 'ro'). */
export function errorMessage(error, lang) {
  const text = error?.message || String(error);
  if (lang !== 'ro') return text;
  const status = error?.status;
  if (typeof status !== 'number') return text; // not from the server (a bug in the page)

  const exact = EXACT[text.trim().toLowerCase()];
  if (exact) return exact;
  for (const [pattern, toRo] of PATTERNS) {
    const match = text.trim().match(pattern);
    if (match) return toRo(...match.slice(1));
  }
  return BY_STATUS[status] || `Cererea a eșuat (${status}). Încearcă din nou.`;
}
