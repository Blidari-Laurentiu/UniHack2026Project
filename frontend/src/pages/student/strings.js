// Student status card on the account page, in English and Romanian. University names come
// from the server and are not translated. Marks <b> are turned into elements by rich().
import { createT } from '../../i18n.jsx';

const en = {
  title: 'Student status',
  verifiedStudent: 'Verified student',
  loading: 'Loading…',
  verifiedWith: (email, uni) => `Verified with <b>${email}</b> at ${uni}`,
  verifiedOn: (date) => ` on ${date}`,
  validUntil: (date) =>
    `Valid until <b>${date}</b>, then you confirm your university email again.`,
  expired: (date) =>
    `Your student status ended on <b>${date}</b>. It lasts one year. Confirm your university email again to get the badge back.`,
  intro:
    'Students get a badge on their group card. To get it, confirm your university email: we send it a 6-digit code.',
  university: 'Your university',
  chooseUniversity: 'Choose your university',
  email: 'Your university email',
  emailPlaceholder: (domain) => (domain ? `name@${domain}` : 'name@university'),
  mustEndIn: (domains) => `Must end in ${domains}.`,
  sending: 'Sending…',
  sendCode: 'Send me a code',
  backToCode: 'Back to the code',
  codeSent: (email, uni, time) =>
    `We sent a 6-digit code to <b>${email}</b> (${uni}). It expires at ${time}.`,
  spamHint: 'Not there? Look in your spam folder.',
  code: 'Code',
  checking: 'Checking…',
  confirm: 'Confirm',
  resend: 'Send a new code',
  resendIn: (s) => `Send a new code (${s}s)`,
  otherEmail: 'Use another email',
};

const ro = {
  title: 'Statut de student',
  verifiedStudent: 'Student verificat',
  loading: 'Se încarcă…',
  verifiedWith: (email, uni) => `Verificat cu <b>${email}</b> la ${uni}`,
  verifiedOn: (date) => ` pe ${date}`,
  validUntil: (date) =>
    `Valabil până pe <b>${date}</b>; după aceea îți confirmi din nou emailul universitar.`,
  expired: (date) =>
    `Statutul tău de student a expirat pe <b>${date}</b>. Durează un an. Confirmă din nou emailul universitar ca să primești înapoi insigna.`,
  intro:
    'Studenții primesc o insignă pe cardul grupului. Ca s-o primești, confirmă-ți emailul universitar: îți trimitem acolo un cod din 6 cifre.',
  university: 'Universitatea ta',
  chooseUniversity: 'Alege universitatea',
  email: 'Emailul tău universitar',
  emailPlaceholder: (domain) => (domain ? `nume@${domain}` : 'nume@universitate'),
  mustEndIn: (domains) => `Trebuie să se termine cu ${domains}.`,
  sending: 'Se trimite…',
  sendCode: 'Trimite-mi un cod',
  backToCode: 'Înapoi la cod',
  codeSent: (email, uni, time) =>
    `Ți-am trimis un cod din 6 cifre la <b>${email}</b> (${uni}). Expiră la ${time}.`,
  spamHint: 'Nu l-ai primit? Uită-te în folderul de spam.',
  code: 'Cod',
  checking: 'Se verifică…',
  confirm: 'Confirmă',
  resend: 'Trimite un cod nou',
  resendIn: (s) => `Trimite un cod nou (${s} s)`,
  otherEmail: 'Folosește alt email',
};

export const useT = createT({ en, ro });
