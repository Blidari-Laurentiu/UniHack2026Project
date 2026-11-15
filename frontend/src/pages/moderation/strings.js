// Person B's folder: every word of the Moderation page, in English and Romanian.
import { createT, enCount, roCount } from '../../i18n.jsx';

const en = {
  title: 'Moderation',
  lead: 'Events that are waiting for review, and events that people reported.',
  loading: 'Loading the review queue…',
  empty: 'Nothing to review. New events from people who are not trusted yet, and reported events, show up here.',
  'status.pending': 'Not on the list',
  'status.active': 'On the list',
  newFrom: (name) => `New event from ${name}. It is not published yet.`,
  hiddenByReports: 'Taken off the list because of the reports below.',
  someone: 'someone',
  seeded: 'Sample event',
  createdBy: (name) => `Created by ${name}`,
  going: (n) => `${enCount(n, 'person wants', 'people want')} to go`,
  reports: (n) => enCount(n, 'open report', 'open reports'),
  reportBy: (name, when) => `${name}, ${when}`,
  deleted: 'deleted account',
  approve: 'Publish',
  keep: 'Keep and dismiss reports',
  reject: 'Remove event',
  confirmReject: (title) => `Remove “${title}”? Nobody will be able to see or join it.`,
};

const ro = {
  title: 'Moderare',
  lead: 'Evenimente care așteaptă verificarea și evenimente raportate de utilizatori.',
  loading: 'Se încarcă lista de verificat…',
  empty: 'Nimic de verificat. Aici apar evenimentele noi de la utilizatori care nu sunt încă de încredere și evenimentele raportate.',
  'status.pending': 'Nu este în listă',
  'status.active': 'În listă',
  newFrom: (name) => `Eveniment nou de la ${name}. Nu este publicat încă.`,
  hiddenByReports: 'Scos din listă din cauza raportărilor de mai jos.',
  someone: 'cineva',
  seeded: 'Eveniment de exemplu',
  createdBy: (name) => `Creat de ${name}`,
  going: (n) => `${roCount(n, 'persoană vrea', 'persoane vor')} să meargă`,
  reports: (n) => roCount(n, 'raportare deschisă', 'raportări deschise'),
  reportBy: (name, when) => `${name}, ${when}`,
  deleted: 'cont șters',
  approve: 'Publică',
  keep: 'Păstrează și închide raportările',
  reject: 'Elimină evenimentul',
  confirmReject: (title) => `Elimini „${title}”? Nimeni nu îl va mai putea vedea și nu se va mai putea înscrie.`,
};

export const useT = createT({ en, ro });
