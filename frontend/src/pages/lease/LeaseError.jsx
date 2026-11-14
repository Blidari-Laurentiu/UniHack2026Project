// Person A: components/ErrorBox.jsx for the lease pages, with the message and the Retry
// button in the interface language (see errorMessage in strings.js).
import { EMAIL_NOT_VERIFIED } from '../../api.js';
import { VerifyEmailNotice } from '../../auth/index.js';
import { errorMessage, useT } from './strings.js';

export default function LeaseError({ error, onRetry, kind }) {
  const t = useT();
  if (!error) return null;
  // Same as ErrorBox: an unverified account gets the shared notice (auth code, in English).
  if (error.status === 403 && error.message === EMAIL_NOT_VERIFIED) return <VerifyEmailNotice />;
  return (
    <div className="alert" role="alert">
      <span>{errorMessage(error, t, kind)}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
