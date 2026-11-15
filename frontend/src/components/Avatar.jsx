import { useEffect, useState } from 'react';
import { apiUrl } from '../api.js';
import Mascot from './Mascot.jsx';

/**
 * A user's picture: their own (`src`, the avatar_url from the API) or, without one, their
 * Timi drawn from `userId`. Decorative: always shown next to the person's name.
 * `size` is in px; pass null to let CSS size it.
 */
export default function Avatar({ userId, src, size = 32, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const url = failed ? null : apiUrl(src);

  return (
    <span
      className={`avatar ${className}`}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {url ? (
        <img
          src={url}
          alt=""
          width={size || undefined}
          height={size || undefined}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        // No id yet (the profile is still loading): an empty tile, not a Timi that will change.
        userId != null && <Mascot seed={userId} />
      )}
    </span>
  );
}
