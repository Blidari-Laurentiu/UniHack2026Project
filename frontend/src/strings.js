// Shared: every word of the top bar, the auth parts, Home, Me, NotFound and ErrorBox, in
// English and Romanian. Each feature has its own file (pages/lease, events, student, account);
// the Romanian text of server errors is in serverErrors.js. Marks <b> and <code> are turned
// into elements by rich() in i18n.jsx.
import { createT } from './i18n.jsx';

const en = {
  title: 'Timișoara Newcomer Hub',
  brand: 'Newcomer Hub',
  'nav.label': 'Main',
  'nav.lease': 'Lease check',
  'nav.events': 'Events',
  'nav.me': 'Me',
  loading: 'Loading…',
  retry: 'Retry',

  // Auth
  'auth.login': 'Log in',
  'auth.logout': 'Log out',
  'auth.loginDisabled': 'Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID',
  'auth.dev': (name) => `dev: ${name}`,
  'auth.checking': 'Checking your session…',
  'auth.verifyTitle': 'Verify your email',
  'auth.loginTitle': 'Log in to continue',
  'auth.notConfigured':
    'Auth0 is not configured. Fill in <code>frontend/.env</code>, or set <code>VITE_DEV_USER</code> to use the dev bypass.',

  // VerifyEmailNotice: "Check your email to <action>."
  'verify.action.continue': 'continue',
  'verify.action.joinEvents': 'join events and get matched into a group',
  'verify.action.checkLease': 'check a lease and keep your past checks',
  'verify.verified': 'Your email is verified. Sign in again to refresh your session.',
  'verify.signInAgain': 'Sign in again',
  'verify.sent': (action, email) =>
    `Check your email to ${action}. We sent a verification link to <b>${email}</b>. Open it, then come back here.`,
  'verify.noEmail': (action) =>
    `Your account has no email address we can verify. Log out and sign in with Google or with an email code to ${action}.`,
  'verify.done': 'I’ve verified it',
  spamHint: 'Not there? Look in your spam folder.',

  // Home
  'home.title': 'New in Timișoara?',
  'home.lead': 'Check your lease before you sign, and find people to go out with.',
  'home.leaseTitle': 'Lease check',
  'home.leaseText':
    'Paste a Romanian rental contract. We flag risky clauses, list what is missing, and compare the rent with similar listings in the neighbourhood.',
  'home.leaseCta': 'Check a lease →',
  'home.eventsTitle': 'Event groups',
  'home.eventsText':
    'Pick an event you want to go to. We put you in a small group of 3 to 5 people with similar interests, so you never have to go alone.',
  'home.eventsCta': 'Browse events →',

  // NotFound
  'notFound.title': 'Page not found',
  'notFound.back': 'Back home',

  // Me
  'me.title': 'Your account',
  'me.verifiedStudent': 'Verified student',
  'me.name': 'Name',
  'me.email': 'Email',
  'me.emailMissing': 'not shared by Auth0 yet',
  'me.student': 'Student',
  'me.yes': 'yes',
  'me.no': 'no',
  'me.roles': 'Roles',
  'me.noRoles': 'none',
  'role.admin': 'admin',
  'role.moderator': 'moderator',
  'me.auth0Id': 'Auth0 id',
  'me.userId': 'User id',
  'me.joined': 'Joined',
};

const ro = {
  title: 'Hub nou-veniți Timișoara',
  brand: 'Hub nou-veniți',
  'nav.label': 'Principal',
  'nav.lease': 'Verificare contract',
  'nav.events': 'Evenimente',
  'nav.me': 'Contul meu',
  loading: 'Se încarcă…',
  retry: 'Reîncearcă',

  'auth.login': 'Autentificare',
  'auth.logout': 'Deconectare',
  'auth.loginDisabled': 'Setează VITE_AUTH0_DOMAIN și VITE_AUTH0_CLIENT_ID',
  'auth.dev': (name) => `dev: ${name}`,
  'auth.checking': 'Se verifică sesiunea…',
  'auth.verifyTitle': 'Verifică-ți emailul',
  'auth.loginTitle': 'Autentifică-te ca să continui',
  'auth.notConfigured':
    'Auth0 nu este configurat. Completează <code>frontend/.env</code> sau setează <code>VITE_DEV_USER</code> ca să folosești accesul de dezvoltare.',

  'verify.action.continue': 'continui',
  'verify.action.joinEvents': 'te înscrii la evenimente și să intri într-un grup',
  'verify.action.checkLease': 'verifici un contract și să păstrezi verificările anterioare',
  'verify.verified': 'Emailul tău este verificat. Autentifică-te din nou ca să reîmprospătezi sesiunea.',
  'verify.signInAgain': 'Autentifică-te din nou',
  'verify.sent': (action, email) =>
    `Verifică-ți emailul ca să ${action}. Ți-am trimis un link de verificare la <b>${email}</b>. Deschide-l, apoi revino aici.`,
  'verify.noEmail': (action) =>
    `Contul tău nu are o adresă de email pe care s-o putem verifica. Deconectează-te și autentifică-te cu Google sau cu un cod primit pe email ca să ${action}.`,
  'verify.done': 'L-am verificat',
  spamHint: 'Nu l-ai primit? Uită-te în folderul de spam.',

  'home.title': 'Nou în Timișoara?',
  'home.lead':
    'Verifică-ți contractul de închiriere înainte să semnezi și găsește oameni cu care să ieși în oraș.',
  'home.leaseTitle': 'Verificare contract',
  'home.leaseText':
    'Lipește un contract de închiriere în limba română. Semnalăm clauzele riscante, spunem ce lipsește și comparăm chiria cu anunțuri asemănătoare din cartier.',
  'home.leaseCta': 'Verifică un contract →',
  'home.eventsTitle': 'Grupuri pentru evenimente',
  'home.eventsText':
    'Alege un eveniment la care vrei să mergi. Te punem într-un grup mic, de 3–5 persoane cu interese asemănătoare, ca să nu mergi niciodată singur.',
  'home.eventsCta': 'Vezi evenimentele →',

  'notFound.title': 'Pagina nu a fost găsită',
  'notFound.back': 'Înapoi la pagina principală',

  'me.title': 'Contul tău',
  'me.verifiedStudent': 'Student verificat',
  'me.name': 'Nume',
  'me.email': 'Email',
  'me.emailMissing': 'Auth0 nu l-a trimis încă',
  'me.student': 'Student',
  'me.yes': 'da',
  'me.no': 'nu',
  'me.roles': 'Roluri',
  'me.noRoles': 'niciunul',
  'role.admin': 'administrator',
  'role.moderator': 'moderator',
  'me.auth0Id': 'ID Auth0',
  'me.userId': 'ID utilizator',
  'me.joined': 'Cont creat',
};

export const useT = createT({ en, ro });
