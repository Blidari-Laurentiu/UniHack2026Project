// Security and Delete account cards on the account page, in English and Romanian.
// Marks <b> are turned into elements by rich() in i18n.jsx.
import { createT } from '../../i18n.jsx';

const en = {
  loading: 'Loading…',
  retry: 'Retry',
  cancel: 'Cancel',
  spamHint: 'Not there? Look in your spam folder.',

  // SecurityCard
  'security.title': 'Security',
  'password.title': 'Password',
  'password.sent': (email) => `We sent a link to <b>${email}</b>. Open it to choose a new password.`,
  'password.how':
    'We email you a link to choose a new password. Your current password keeps working until you use it.',
  'password.sending': 'Sending…',
  'password.again': 'Send the link again',
  'password.change': 'Change password',
  'password.none': (how) => `This account has no password: you sign in with ${how}.`,
  'signIn.google': 'Google',
  'signIn.github': 'GitHub',
  'signIn.email_code': 'a code sent to your email',
  'signIn.dev': 'the dev user',
  'signIn.other': 'another provider',
  'mfa.title': 'Two-factor authentication',
  'mfa.on': 'On',
  'mfa.off': 'Off',
  'mfa.unavailable': 'Two-factor authentication cannot be managed for this account here.',
  'mfa.unknown': 'We could not check it right now.',
  'mfa.offText':
    'Add an authenticator app (Google Authenticator, Authy). After that, logging in asks for a 6-digit code from the app.',
  'mfa.adminMustHave': ' Admin accounts must have it on.',
  'mfa.turnOn': 'Turn on',
  'mfa.onText': 'Logging in asks for a 6-digit code from your authenticator app.',
  'mfa.adminMustKeep': ' Admin accounts must keep it on.',
  'mfa.signInWithCode': 'Sign in with my code',
  'mfa.turningOff': 'Turning off…',
  'mfa.turnOff': 'Turn off',
  'mfa.confirmOff': 'Turn off two-factor authentication? Logging in will no longer ask for a code.',

  // DeleteAccount
  'delete.title': 'Delete account',
  'delete.notSetUp': 'Deleting accounts is not set up on this server yet.',
  'delete.what':
    'Deletes your profile, your saved lease checks, your event signups and groups, your student verification and your login. This cannot be undone.',
  'delete.open': 'Delete my account',
  'delete.confirmText':
    'This deletes your profile, your saved lease checks, your event signups and groups, your student verification and your login. <b>It cannot be undone.</b>',
  'delete.word': 'DELETE',
  'delete.typeWord': (word) => `Type ${word} to confirm`,
  'delete.deleting': 'Deleting…',
  'delete.submit': 'Delete my account for good',
};

const ro = {
  loading: 'Se încarcă…',
  retry: 'Reîncearcă',
  cancel: 'Anulează',
  spamHint: 'Nu l-ai primit? Uită-te în folderul de spam.',

  'security.title': 'Securitate',
  'password.title': 'Parolă',
  'password.sent': (email) =>
    `Ți-am trimis un link la <b>${email}</b>. Deschide-l ca să alegi o parolă nouă.`,
  'password.how':
    'Îți trimitem pe email un link ca să alegi o parolă nouă. Parola actuală merge în continuare până folosești linkul.',
  'password.sending': 'Se trimite…',
  'password.again': 'Trimite din nou linkul',
  'password.change': 'Schimbă parola',
  'password.none': (how) => `Acest cont nu are parolă: te autentifici cu ${how}.`,
  'signIn.google': 'Google',
  'signIn.github': 'GitHub',
  'signIn.email_code': 'un cod trimis pe email',
  'signIn.dev': 'utilizatorul de dezvoltare',
  'signIn.other': 'alt furnizor',
  'mfa.title': 'Autentificare în doi pași',
  'mfa.on': 'Activă',
  'mfa.off': 'Inactivă',
  'mfa.unavailable': 'Autentificarea în doi pași nu poate fi gestionată aici pentru acest cont.',
  'mfa.unknown': 'Nu am putut verifica acum.',
  'mfa.offText':
    'Adaugă o aplicație de autentificare (Google Authenticator, Authy). După aceea, la autentificare ți se cere un cod din 6 cifre din aplicație.',
  'mfa.adminMustHave': ' Conturile de administrator trebuie s-o aibă activă.',
  'mfa.turnOn': 'Activează',
  'mfa.onText': 'La autentificare ți se cere un cod din 6 cifre din aplicația de autentificare.',
  'mfa.adminMustKeep': ' Conturile de administrator trebuie s-o păstreze activă.',
  'mfa.signInWithCode': 'Autentifică-te cu codul',
  'mfa.turningOff': 'Se dezactivează…',
  'mfa.turnOff': 'Dezactivează',
  'mfa.confirmOff':
    'Dezactivezi autentificarea în doi pași? La autentificare nu ți se va mai cere un cod.',

  'delete.title': 'Șterge contul',
  'delete.notSetUp': 'Ștergerea conturilor nu este configurată încă pe acest server.',
  'delete.what':
    'Șterge profilul, verificările de contract salvate, înscrierile la evenimente și grupurile, verificarea de student și contul de autentificare. Acțiunea nu poate fi anulată.',
  'delete.open': 'Șterge-mi contul',
  'delete.confirmText':
    'Se șterg profilul, verificările de contract salvate, înscrierile la evenimente și grupurile, verificarea de student și contul de autentificare. <b>Acțiunea nu poate fi anulată.</b>',
  'delete.word': 'ȘTERGE',
  'delete.typeWord': (word) => `Scrie ${word} ca să confirmi`,
  'delete.deleting': 'Se șterge…',
  'delete.submit': 'Șterge-mi contul definitiv',
};

export const useT = createT({ en, ro });
