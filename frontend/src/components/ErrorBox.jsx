export default function ErrorBox({ error, onRetry }) {
  if (!error) return null;
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
