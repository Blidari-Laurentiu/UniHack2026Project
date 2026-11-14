import { EMAIL_NOT_VERIFIED } from '../api.js';
import VerifyEmailNotice from '../auth/VerifyEmailNotice.jsx';

export default function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  // The backend refused an unverified account (or an old token from before verification).
  if (error.status === 403 && error.message === EMAIL_NOT_VERIFIED) return <VerifyEmailNotice />;
  return (
    <div className="alert" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
