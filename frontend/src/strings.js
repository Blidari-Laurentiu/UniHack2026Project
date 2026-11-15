// Shared: every word of the top bar, footer, the auth parts, Home, Me, NotFound and ErrorBox, in
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

  // Top bar and footer
  skip: 'Skip to content',
  'brand.home': 'Timișoara Newcomer Hub, home',
  'theme.dark': 'Switch to dark theme',
  'theme.light': 'Switch to light theme',
  'account.label': (name) => `Your account: ${name}`,
  'account.fallback': 'Account',
  'footer.text': 'Timișoara Newcomer Hub. A UniHack project, built in 48 hours.',
  'footer.account': 'Account',

  // Home (the landing page)
  'home.eyebrow': 'Bun venit · Welcome',
  'home.titleBefore': 'New in ',
  'home.titleAfter': '? Start here.',
  'home.lead': 'Check your lease before you sign, and find people to go out with.',
  'home.findGroup': 'Find a group',
  'home.privacy':
    'Your CNP, IBAN and ID series are removed from the lease before it is analysed or saved.',
  'home.caption': 'Timi, new in town. The street lamps have been on since 1884.',
  'home.art':
    'Line drawing of a street in Timișoara: cathedral spires, a row of old houses, a tram and a street lamp. Timi, a small house on legs, has just arrived with a suitcase.',
  'home.leaseTitle': 'Lease check',
  'home.leaseHeading': 'Know what you are signing',
  'home.leaseText':
    'Paste a Romanian rental contract, or upload the PDF. You get the clauses to worry about, the ones that are missing, and how the rent compares.',
  'home.lease1': 'Risky clauses quoted from your contract, with what to ask for instead',
  'home.lease2': 'A price verdict against similar listings in the same neighbourhood',
  'home.lease3': 'The report in English or Romanian, saved so you can come back to it',
  'home.leaseCta': 'Check a lease',
  'home.leaseFine': 'A first check, not legal advice.',
  'home.eventsTitle': 'Event groups',
  'home.eventsHeading': 'Never go alone',
  'home.eventsText':
    'Pick an event you want to go to. We put you in a group of 3 to 5 people who like the same things and are free at the same time.',
  'home.events1': 'Say what you like and when you are usually free',
  'home.events2': 'Tap “I want to go” on an event',
  'home.events3': 'Get your group, where to meet, and one line on why you match',
  'home.eventsCta': 'Browse events',
  'home.timiEyebrow': 'Your picture',
  'home.timiTitle': 'Meet Timi',
  'home.timiText':
    'A small house on legs, still looking for its street. Every account starts with a Timi of its own, in two colours picked at random, until you add a photo.',
  'home.timiCta': 'See yours',

  // NotFound
  'notFound.title': 'This street is not on the map',
  'notFound.text': 'The page you asked for does not exist, or it has moved.',
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
  'me.noEmail': 'No email address shared with us',
  'me.details': 'Account details',
  'me.idsTitle': 'Account ids',
  'me.idsText':
    'Only needed if we ask for one to look into a problem. They stay blurred so they do not end up in a screenshot or on a shared screen.',
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

  skip: 'Sari la conținut',
  'brand.home': 'Hub nou-veniți Timișoara, pagina principală',
  'theme.dark': 'Treci la tema întunecată',
  'theme.light': 'Treci la tema luminoasă',
  'account.label': (name) => `Contul tău: ${name}`,
  'account.fallback': 'Cont',
  'footer.text': 'Hub nou-veniți Timișoara. Un proiect UniHack, construit în 48 de ore.',
  'footer.account': 'Cont',

  'home.eyebrow': 'Bun venit · Welcome',
  'home.titleBefore': 'Nou în ',
  'home.titleAfter': '? Începe de aici.',
  'home.lead':
    'Verifică-ți contractul de închiriere înainte să semnezi și găsește oameni cu care să ieși în oraș.',
  'home.findGroup': 'Găsește un grup',
  'home.privacy':
    'CNP-ul, IBAN-ul și seria actului de identitate sunt șterse din contract înainte să fie analizat sau salvat.',
  'home.caption': 'Timi, nou în oraș. Felinarele de pe străzi ard din 1884.',
  'home.art':
    'Desen în linii al unei străzi din Timișoara: turlele catedralei, un șir de case vechi, un tramvai și un felinar. Timi, o căsuță pe picioare, tocmai a sosit cu o valiză.',
  'home.leaseTitle': 'Verificare contract',
  'home.leaseHeading': 'Află ce semnezi',
  'home.leaseText':
    'Lipește un contract de închiriere în limba română sau încarcă PDF-ul. Afli clauzele la care să fii atent, ce lipsește și cum se compară chiria.',
  'home.lease1': 'Clauzele riscante, citate din contractul tău, cu ce să ceri în schimb',
  'home.lease2': 'Un verdict de preț față de anunțuri asemănătoare din același cartier',
  'home.lease3': 'Raportul în engleză sau în română, salvat ca să revii la el',
  'home.leaseCta': 'Verifică un contract',
  'home.leaseFine': 'O primă verificare, nu consultanță juridică.',
  'home.eventsTitle': 'Grupuri pentru evenimente',
  'home.eventsHeading': 'Nu mai merge singur',
  'home.eventsText':
    'Alege un eveniment la care vrei să mergi. Te punem într-un grup de 3–5 oameni cărora le plac aceleași lucruri și care sunt liberi în același timp.',
  'home.events1': 'Spune ce îți place și când ești de obicei liber',
  'home.events2': 'Apasă „Vreau să merg” la un eveniment',
  'home.events3': 'Primești grupul, locul de întâlnire și un rând despre ce aveți în comun',
  'home.eventsCta': 'Vezi evenimentele',
  'home.timiEyebrow': 'Poza ta',
  'home.timiTitle': 'Fă cunoștință cu Timi',
  'home.timiText':
    'O căsuță pe picioare care încă își caută strada. Fiecare cont începe cu propriul Timi, în două culori alese la întâmplare, până adaugi o poză.',
  'home.timiCta': 'Vezi-l pe al tău',

  'notFound.title': 'Strada asta nu e pe hartă',
  'notFound.text': 'Pagina căutată nu există sau a fost mutată.',
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
  'me.noEmail': 'Nu avem o adresă de email pentru acest cont',
  'me.details': 'Detaliile contului',
  'me.idsTitle': 'ID-urile contului',
  'me.idsText':
    'Ai nevoie de ele doar dacă îți cerem unul ca să cercetăm o problemă. Rămân estompate ca să nu ajungă într-o captură de ecran sau pe un ecran partajat.',
};

export const useT = createT({ en, ro });
