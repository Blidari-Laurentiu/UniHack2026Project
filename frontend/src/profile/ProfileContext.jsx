import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile } from '../api.js';
import { useAuth } from '../auth/index.js';

// The logged-in user's profile (GET /profile: user_id, name, picture, interests, free time),
// loaded once and shared: the top bar, the Events page and the account page all show it, and
// a change in one place (a new name, a new picture) shows everywhere at once.

const ProfileContext = createContext({
  profile: null,
  loading: false,
  error: null,
  reload: () => {},
  setProfile: () => {},
});

export function ProfileProvider({ children }) {
  const { canUse } = useAuth();
  const [state, setState] = useState({ profile: null, error: null, loading: canUse });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!canUse) {
      setState({ profile: null, error: null, loading: false });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getProfile()
      .then((profile) => !cancelled && setState({ profile, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ profile: null, error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [canUse, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  /** After a save: the API returned the new profile, no need to ask again. */
  const setProfile = useCallback(
    (profile) => setState({ profile, error: null, loading: false }),
    [],
  );

  const value = useMemo(() => ({ ...state, reload, setProfile }), [state, reload, setProfile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/** { profile, loading, error, reload, setProfile }. profile is null when logged out. */
export function useProfile() {
  return useContext(ProfileContext);
}
