// Profile picture, account ids, Security and Delete account on the account page, in English and Romanian.
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
  // AvatarEditor
  'avatar.title': 'Profile picture',
  'avatar.has': 'People in your group see this picture next to your name.',
  'avatar.none':
    'This is the picture every newcomer starts with. Add a photo and your group sees that instead.',
  'avatar.add': 'Add a picture',
  'avatar.change': 'Change picture',
  'avatar.uploading': 'Uploading…',
  'avatar.remove': 'Remove',
  'avatar.removing': 'Removing…',
  'avatar.updated': 'Picture updated.',
  'avatar.removed': 'Picture removed.',
  // squarePicture.js errors, by key
  'picture.type': 'Choose a JPEG, PNG or WebP picture.',
  'picture.big': 'That picture is over 20 MB. Choose a smaller one.',
  'picture.unreadable': 'That file could not be read as a picture. Try another one.',
  'picture.prepare': 'That picture could not be prepared. Try another one.',

  // SecretValue (the blurred ids); `label` is the id's name, for screen readers
  'secret.hidden': 'Hidden.',
  'secret.show': 'Show',
  'secret.hide': 'Hide',
  'secret.copy': 'Copy',
  'secret.copied': 'Copied',
  'secret.showLabel': (label) => `Show ${label}`,
  'secret.hideLabel': (label) => `Hide ${label}`,
  'secret.copyLabel': (label) => `Copy ${label}`,
  'secret.copiedStatus': (label) => `Copied ${label}.`,
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
  'avatar.title': 'Poza de profil',
  'avatar.has': 'Cei din grupul tău văd această poză lângă numele tău.',
  'avatar.none':
    'Aceasta e imaginea cu care începe fiecare nou-venit. Adaugă o poză și grupul tău o va vedea pe ea.',
  'avatar.add': 'Adaugă o poză',
  'avatar.change': 'Schimbă poza',
  'avatar.uploading': 'Se încarcă…',
  'avatar.remove': 'Șterge',
  'avatar.removing': 'Se șterge…',
  'avatar.updated': 'Poza a fost actualizată.',
  'avatar.removed': 'Poza a fost ștearsă.',
  'picture.type': 'Alege o poză JPEG, PNG sau WebP.',
  'picture.big': 'Poza are peste 20 MB. Alege una mai mică.',
  'picture.unreadable': 'Fișierul nu a putut fi citit ca poză. Încearcă altul.',
  'picture.prepare': 'Poza nu a putut fi pregătită. Încearcă alta.',

  'secret.hidden': 'Ascuns.',
  'secret.show': 'Arată',
  'secret.hide': 'Ascunde',
  'secret.copy': 'Copiază',
  'secret.copied': 'Copiat',
  'secret.showLabel': (label) => `Arată ${label}`,
  'secret.hideLabel': (label) => `Ascunde ${label}`,
  'secret.copyLabel': (label) => `Copiază ${label}`,
  'secret.copiedStatus': (label) => `${label}: copiat.`,
};

export const useT = createT({ en, ro });
