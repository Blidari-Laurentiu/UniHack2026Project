// Person A: components/ErrorBox.jsx for the lease pages, with the message and the Retry
// button in the interface language (see errorMessage in strings.js).
import { errorMessage, useT } from './strings.js';

export default function LeaseError({ error, onRetry, kind }) {
  const t = useT();
  if (!error) return null;
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
