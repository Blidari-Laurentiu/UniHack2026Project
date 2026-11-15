// Person B owns this folder: profile, event list with filters, join, match and group card.
import { useState } from 'react';
import { getInterests, getMe, listEvents } from '../../api.js';
import { VerifyEmailNotice, useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { useProfile } from '../../profile/ProfileContext.jsx';
import useApi from '../../useApi.js';
import CreateEventForm from './CreateEventForm.jsx';
import EventCard from './EventCard.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import { interestLabel, useT } from './strings.js';

// Date inputs give YYYY-MM-DD in local time; the API wants full ISO datetimes.
function toQuery({ interest, from, to }) {
  return {
    interest,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
    to: to ? new Date(`${to}T23:59:59`).toISOString() : '',
  };
}

export default function EventsPage() {
  const t = useT();
  const { isAuthenticated, canUse, user: authUser } = useAuth();
  const [filters, setFilters] = useState({ interest: '', from: '', to: '' });
  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const hasFilters = Boolean(filters.interest || filters.from || filters.to);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // the event just created, for the notice
  const [view, setView] = useState('all'); // 'all', or 'mine': the events this user is going to
  const mine = canUse && view === 'mine';

  const interests = useApi(getInterests);
  const { profile } = useProfile();
  // Moderators and admins (with MFA) get the Remove button on every card; the API checks again.
  const me = useApi(() => (canUse ? getMe() : Promise.resolve(null)), [canUse]);
  const roles = me.data?.roles || [];
  const canModerate = roles.includes('moderator') || (roles.includes('admin') && me.data.mfa);
  // The answer remembers which view it is for, so the other view's events never show under
  // the new tab while it loads.
  const events = useApi(
    () => listEvents({ ...toQuery(filters), mine: mine || '' }).then((items) => ({ items, mine })),
    [canUse, mine, filters.interest, filters.from, filters.to],
  );
  const fresh = events.data?.mine === mine;
  const list = fresh ? events.data.items : [];
  const loading = events.loading || Boolean(events.data && !fresh);

  return (
    <>
      <section className="hero">
        <h1>{t('title')}</h1>
        <p className="lead">{t('lead')}</p>
      </section>

      {isAuthenticated && !canUse && (
        <section className="card">
          <VerifyEmailNotice action="joinEvents" />
        </section>
      )}

      {canUse && (
        <section className="card">
          <ProfilePanel interests={interests.data || []} authUser={authUser} />
        </section>
      )}

      {canUse && (
        <section className="card">
          {creating ? (
            <>
              <h2>{t('createTitle')}</h2>
              <CreateEventForm
                interests={interests.data || []}
                onCreated={(event) => {
                  setCreated(event);
                  setCreating(false);
                  setView('all'); // the notice says "in the list below"; a new event is not in "mine"
                  events.reload();
                }}
                onCancel={() => setCreating(false)}
              />
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCreated(null);
                  setCreating(true);
                }}
              >
                {t('createEvent')}
              </button>
              {created && (
                <p className="notice" role="status">
                  {t(created.status === 'pending' ? 'createdPending' : 'createdActive', created.title)}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="card">
        {canUse && (
          <div className="event-views" role="group" aria-label={t('view.label')}>
            {['all', 'mine'].map((v) => (
              <button
                key={v}
                type="button"
                className="event-view"
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {t(`view.${v}`)}
              </button>
            ))}
          </div>
        )}

        <div className="filters">
          <label className="field">
            <span className="field-label">{t('filter.interest')}</span>
            <select className="input" value={filters.interest} onChange={setFilter('interest')}>
              <option value="">{t('filter.allInterests')}</option>
              {(interests.data || []).map((i) => (
                <option key={i.slug} value={i.slug}>
                  {interestLabel(t, i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('filter.from')}</span>
            <input className="input" type="date" value={filters.from} onChange={setFilter('from')} />
          </label>
          <label className="field">
            <span className="field-label">{t('filter.to')}</span>
            <input
              className="input"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={setFilter('to')}
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setFilters({ interest: '', from: '', to: '' })}
            >
              {t('filter.clear')}
            </button>
          )}
        </div>

        <ErrorBox error={interests.error} onRetry={interests.reload} />
        <ErrorBox error={events.error} onRetry={events.reload} />
        {loading && list.length === 0 && <p className="muted">{t('loadingEvents')}</p>}
        {!loading && !events.error && list.length === 0 && (
          <p className="muted">
            {hasFilters ? t('noMatch') : mine ? t('noMine') : t('noEvents')}
          </p>
        )}

        <ul className="events">
          {list.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              isAuthenticated={canUse}
              needsVerification={isAuthenticated && !canUse}
              canModerate={canModerate}
              myId={profile?.user_id}
              onChanged={events.reload}
            />
          ))}
        </ul>
        {list.length > 0 && !mine && <p className="small muted">{t('sample')}</p>}
      </section>
    </>
  );
}
