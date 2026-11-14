// Person B's folder: every word of the Events pages and the profile form, in English and
// Romanian. Event titles, descriptions and venues come from the database and are not
// translated. In Romanian, interests are translated by slug (the database label is the
// fallback), and the group's "why you match" line and note are rebuilt by groupText.js.
// In English, interests show the database label.
import { createT, enCount, roCount } from '../../i18n.jsx';

// Same slugs and labels as db/seed_events.py INTERESTS (groupText.js reads the English ones
// back out of the "why you match" line). A slug not listed here shows its database label.
export const INTERESTS_EN = {
  theatre: 'Theatre',
  live_music: 'Live music',
  board_games: 'Board games',
  football: 'Football',
  hiking: 'Hiking',
  language_exchange: 'Language exchange',
  cinema: 'Cinema',
  food_drinks: 'Food and drinks',
  art_museums: 'Art and museums',
  cycling: 'Cycling',
};
export const INTERESTS_RO = {
  theatre: 'Teatru',
  live_music: 'Muzică live',
  board_games: 'Jocuri de societate',
  football: 'Fotbal',
  hiking: 'Drumeții',
  language_exchange: 'Schimb de limbi',
  cinema: 'Film',
  food_drinks: 'Mâncare și băuturi',
  art_museums: 'Artă și muzee',
  cycling: 'Ciclism',
};
const prefix = (table, p) => Object.fromEntries(Object.entries(table).map(([k, v]) => [p + k, v]));

const en = {
  'slot.weekday_morning': 'Weekday mornings',
  'slot.weekday_evening': 'Weekday evenings',
  'slot.weekend_morning': 'Weekend mornings',
  'slot.weekend_afternoon': 'Weekend afternoons',
  'slot.weekend_evening': 'Weekend evenings',

  // EventsPage
  title: 'Events',
  lead: 'Pick an event. We put you in a group of 3 to 5 people with similar interests, so you never have to go alone.',
  'filter.interest': 'Interest',
  'filter.allInterests': 'All interests',
  'filter.from': 'From',
  'filter.to': 'To',
  'filter.clear': 'Clear',
  loadingEvents: 'Loading events…',
  noMatch: 'No events match these filters.',
  noEvents: 'No upcoming events.',
  sample: 'Sample events for the demo.',

  // EventCard
  firstToGo: 'Be the first to go',
  wantToGo: (n) => `${enCount(n, 'person wants', 'people want')} to go`,
  verifyToJoin: 'Verify your email to join',
  join: 'I want to go',
  onList: 'On the list',
  matching: 'Matching…',
  findGroup: 'Find my group',
  leave: 'Leave',
  hasGroup: 'You have a group',
  leaveGroup: 'Leave group',
  confirmLeaveGroup: 'Leave your group for this event?',
  notEnough: (waiting, min) =>
    `Not enough people yet: ${waiting} waiting, a group needs ${min}. Check back soon.`,
  noGroupYet: 'No group for you yet. Try again in a moment.',

  // GroupCard
  yourGroup: 'Your group',
  newcomer: 'Newcomer',
  you: ' (you)',
  student: 'Student',
  meet: (when) => `Meet ${when}.`,

  // ProfilePanel and ProfileForm
  loadingProfile: 'Loading your profile…',
  tellUs: 'Tell us what you like',
  yourProfile: 'Your profile',
  whyAsk: 'We use this to put you in a group with people like you.',
  verifiedStudent: 'Verified student',
  editProfile: 'Edit profile',
  firstName: 'Your first name',
  firstNamePlaceholder: 'How your group will see you',
  likes: 'What do you like?',
  free: 'When are you usually free?',
  saving: 'Saving…',
  saveProfile: 'Save profile',
  cancel: 'Cancel',
};

const ro = {
  ...prefix(INTERESTS_RO, 'interest.'),
  'slot.weekday_morning': 'Zile lucrătoare, dimineața',
  'slot.weekday_evening': 'Zile lucrătoare, seara',
  'slot.weekend_morning': 'Weekend, dimineața',
  'slot.weekend_afternoon': 'Weekend, după-amiaza',
  'slot.weekend_evening': 'Weekend, seara',

  title: 'Evenimente',
  lead: 'Alege un eveniment. Te punem într-un grup de 3–5 persoane cu interese asemănătoare, ca să nu mergi niciodată singur.',
  'filter.interest': 'Interes',
  'filter.allInterests': 'Toate interesele',
  'filter.from': 'De la',
  'filter.to': 'Până la',
  'filter.clear': 'Resetează',
  loadingEvents: 'Se încarcă evenimentele…',
  noMatch: 'Niciun eveniment nu se potrivește cu aceste filtre.',
  noEvents: 'Nu există evenimente viitoare.',
  sample: 'Evenimente de exemplu pentru demo.',

  firstToGo: 'Fii primul care se înscrie',
  wantToGo: (n) =>
    `${roCount(n, 'persoană vrea', 'persoane vor')} să meargă`,
  verifyToJoin: 'Verifică-ți emailul ca să te înscrii',
  join: 'Vreau să merg',
  onList: 'Pe listă',
  matching: 'Se caută grupul…',
  findGroup: 'Găsește-mi grupul',
  leave: 'Renunț',
  hasGroup: 'Ai un grup',
  leaveGroup: 'Ieși din grup',
  confirmLeaveGroup: 'Ieși din grupul tău pentru acest eveniment?',
  notEnough: (waiting, min) =>
    `Încă nu sunt destui oameni: ${roCount(waiting, 'persoană așteaptă', 'persoane așteaptă')}, iar un grup are nevoie de ${min}. Revino în curând.`,
  noGroupYet: 'Încă nu ai un grup. Încearcă din nou peste câteva momente.',

  yourGroup: 'Grupul tău',
  newcomer: 'Nou-venit',
  you: ' (tu)',
  student: 'Student',
  meet: (when) => `Întâlnire: ${when}.`,

  loadingProfile: 'Se încarcă profilul…',
  tellUs: 'Spune-ne ce îți place',
  yourProfile: 'Profilul tău',
  whyAsk: 'Folosim asta ca să te punem într-un grup cu oameni ca tine.',
  verifiedStudent: 'Student verificat',
  editProfile: 'Editează profilul',
  firstName: 'Prenumele tău',
  firstNamePlaceholder: 'Așa te va vedea grupul',
  likes: 'Ce îți place?',
  free: 'Când ești de obicei liber?',
  saving: 'Se salvează…',
  saveProfile: 'Salvează profilul',
  cancel: 'Anulează',
};

export const useT = createT({ en, ro });

/** An interest ({ slug, label } from the API) in the current language. */
export const interestLabel = (t, interest) =>
  (t.lang === 'en' ? null : t.opt(`interest.${interest.slug}`)) ?? interest.label;

/** An availability slot ('weekend_evening') in the current language. */
export const slotLabel = (t, slot) => t.opt(`slot.${slot}`) ?? slot;
