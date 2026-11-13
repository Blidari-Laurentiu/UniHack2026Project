// Person B owns this folder: profile, event list with filters, join, match and group card.
import { useState } from 'react';
import { getInterests, getMe, getProfile, listEvents } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import EventCard from './EventCard.jsx';
import ProfileForm from './ProfileForm.jsx';
import { slotLabel } from './slots.js';

// Date inputs give YYYY-MM-DD in local time; the API wants full ISO datetimes.
function toQuery({ interest, from, to }) {
  return {
    interest,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
    to: to ? new Date(`${to}T23:59:59`).toISOString() : '',
  };
}

function ProfilePanel({ interests, authUser }) {
  const profile = useApi(getProfile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(null);
  const current = saved || profile.data;

  if (profile.loading && !current) return <p className="muted">Loading your profile…</p>;
  if (profile.error) return <ErrorBox error={profile.error} onRetry={profile.reload} />;
  if (!current) return null;

  const incomplete = current.interests.length === 0;
  if (editing || incomplete) {
    return (
      <>
        <h2>{incomplete ? 'Tell us what you like' : 'Your profile'}</h2>
        {incomplete && (
          <p className="muted">We use this to put you in a group with people like you.</p>
        )}
        <ProfileForm
          profile={current}
          interests={interests}
          defaultName={authUser?.given_name || authUser?.nickname || ''}
          onSaved={(p) => {
            setSaved(p);
            setEditing(false);
          }}
          onCancel={incomplete ? undefined : () => setEditing(false)}
        />
      </>
    );
  }

  return (
    <div className="profile-summary">
      <div>
        <strong>{current.display_name}</strong>{' '}
        {current.is_student && <span className="badge badge-ok">Verified student</span>}
        <ul className="chips">
          {current.interests.map((i) => (
            <li key={i.slug} className="chip">
              {i.label}
            </li>
          ))}
          {current.availability.map((s) => (
            <li key={s} className="chip chip-soft">
              {slotLabel(s)}
            </li>
          ))}
        </ul>
      </div>
      <button className="btn btn-sm" onClick={() => setEditing(true)}>
        Edit profile
      </button>
    </div>
  );
}

export default function EventsPage() {
  const { isAuthenticated, user: authUser } = useAuth();
  const [filters, setFilters] = useState({ interest: '', from: '', to: '' });
  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const hasFilters = Boolean(filters.interest || filters.from || filters.to);

  const interests = useApi(getInterests);
  const me = useApi(() => (isAuthenticated ? getMe() : Promise.resolve(null)), [isAuthenticated]);
  const events = useApi(
    () => listEvents(toQuery(filters)),
    [isAuthenticated, filters.interest, filters.from, filters.to],
  );
  const list = events.data || [];

  return (
    <>
      <section className="hero">
        <h1>Events</h1>
        <p className="lead">
          Pick an event. We put you in a group of 3 to 5 people with similar interests, so you
          never have to go alone.
        </p>
      </section>

      {isAuthenticated && (
        <section className="card">
          <ProfilePanel interests={interests.data || []} authUser={authUser} />
        </section>
      )}

      <section className="card">
        <div className="filters">
          <label className="field">
            <span className="field-label">Interest</span>
            <select className="input" value={filters.interest} onChange={setFilter('interest')}>
              <option value="">All interests</option>
              {(interests.data || []).map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input className="input" type="date" value={filters.from} onChange={setFilter('from')} />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input
              className="input"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={setFilter('to')}
            />
          </label>
          {hasFilters && (
            <button className="btn btn-sm" onClick={() => setFilters({ interest: '', from: '', to: '' })}>
              Clear
            </button>
          )}
        </div>

        <ErrorBox error={interests.error} onRetry={interests.reload} />
        <ErrorBox error={events.error} onRetry={events.reload} />
        {events.loading && list.length === 0 && <p className="muted">Loading events…</p>}
        {!events.loading && !events.error && list.length === 0 && (
          <p className="muted">
            {hasFilters ? 'No events match these filters.' : 'No upcoming events.'}
          </p>
        )}

        <ul className="events">
          {list.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              isAuthenticated={isAuthenticated}
              myId={me.data?.id}
              onChanged={events.reload}
            />
          ))}
        </ul>
        {list.length > 0 && <p className="small muted">Sample events for the demo.</p>}
      </section>
    </>
  );
}
