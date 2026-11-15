import { useEffect, useState } from 'react';
import { CopyIcon, EyeIcon, EyeOffIcon } from '../../components/Icon.jsx';

/**
 * An id the user rarely needs (their user id, their login id): blurred until they ask for
 * it, so it stays off screenshots and shared screens. Copy works without showing it.
 * `label` names the value for screen readers, for example "user id".
 */
export default function SecretValue({ value, label }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setShown(true); // no clipboard access: show it so it can be selected by hand
    }
  };

  return (
    <span className="secret">
      {/* Hidden from screen readers too while blurred: "Show" is how everyone reads it. */}
      <code className="secret-value" data-hidden={!shown} aria-hidden={!shown}>
        {value}
      </code>
      {!shown && <span className="sr-only">Hidden.</span>}
      <span className="secret-actions">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={`${shown ? 'Hide' : 'Show'} ${label}`}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
          {shown ? 'Hide' : 'Show'}
        </button>
        <button type="button" className="btn btn-sm" onClick={copy} aria-label={`Copy ${label}`}>
          <CopyIcon />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </span>
      <span className="sr-only" role="status">
        {copied ? `Copied ${label}.` : ''}
      </span>
    </span>
  );
}
