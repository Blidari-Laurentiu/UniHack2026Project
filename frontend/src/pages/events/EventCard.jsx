import { useEffect, useState } from 'react';
import { getMyGroup, joinEvent, leaveEvent, runMatch } from '../../api.js';
import { LoginButton } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import GroupCard from './GroupCard.jsx';
import { formatWhen, slotLabel } from './slots.js';

const MIN_GROUP = 3;

export default function EventCard({ event, isAuthenticated, myId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [group, setGroup] = useState(null);

  const status = isAuthenticated ? event.my_status : null;

  // Load the group whenever this event shows the user as grouped.
  useEffect(() => {
    if (status !== 'grouped') {
      setGroup(null);
      return undefined;
    }
    let cancelled = false;
    getMyGroup(event.id)
      .then((g) => !cancelled && setGroup(g))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [event.id, status]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const join = () => act(() => joinEvent(event.id));

  const leave = () => {
    if (status === 'grouped' && !window.confirm('Leave your group for this event?')) return;
    act(() => leaveEvent(event.id));
  };

  const match = () =>
    act(async () => {
      const result = await runMatch(event.id);
      const mine = result.groups.some((g) => g.members.some((m) => m.user_id === myId));
      if (!mine) {
        setNotice(
          result.unmatched_count < MIN_GROUP
            ? `Not enough people yet: ${result.unmatched_count} waiting, a group needs ${MIN_GROUP}. Check back soon.`
            : 'No group for you yet. Try again in a moment.',
        );
      }
    });

  return (
    <li className="event">
      <div className="event-head">
        <div className="event-main">
          <strong className="event-title">{event.title}</strong>
          <span className="muted small">
            {formatWhen(event.starts_at)}
            {event.venue && ` · ${event.venue}`}
          </span>
        </div>
        <div className="event-tags">
          {event.interest && <span className="chip">{event.interest.label}</span>}
          {event.slot && <span className="chip">{slotLabel(event.slot)}</span>}
        </div>
      </div>

      {event.description && <p className="event-desc">{event.description}</p>}

      <div className="event-actions">
        <span className="small muted">
          {event.signup_count === 0
            ? 'Be the first to go'
            : `${event.signup_count} ${event.signup_count === 1 ? 'person wants' : 'people want'} to go`}
        </span>

        {!isAuthenticated && <LoginButton className="btn btn-sm" />}

        {isAuthenticated && (status === null || status === 'left') && (
          <button className="btn btn-primary" onClick={join} disabled={busy}>
            I want to go
          </button>
        )}

        {status === 'waiting' && (
          <>
            <span className="badge badge-warn">On the list</span>
            <button className="btn btn-primary" onClick={match} disabled={busy}>
              {busy ? 'Matching…' : 'Find my group'}
            </button>
            <button className="btn" onClick={leave} disabled={busy}>
              Leave
            </button>
          </>
        )}

        {status === 'grouped' && (
          <>
            <span className="badge badge-ok">You have a group</span>
            <button className="btn" onClick={leave} disabled={busy}>
              Leave group
            </button>
          </>
        )}
      </div>

      {notice && <p className="notice">{notice}</p>}
      <ErrorBox error={error} />
      {status === 'grouped' && group && <GroupCard group={group} myId={myId} />}
    </li>
  );
}
