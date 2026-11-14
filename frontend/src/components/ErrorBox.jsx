import { EMAIL_NOT_VERIFIED } from '../api.js';
import VerifyEmailNotice from '../auth/VerifyEmailNotice.jsx';
import { errorMessage } from '../serverErrors.js';
import { useT } from '../strings.js';

export default function ErrorBox({ error, onRetry }) {
  const t = useT();
  if (!error) return null;
  // The backend refused an unverified account (or an old token from before verification).
  if (error.status === 403 && error.message === EMAIL_NOT_VERIFIED) return <VerifyEmailNotice />;
  return (
    <div className="alert" role="alert">
      <span>{errorMessage(error, t.lang)}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
