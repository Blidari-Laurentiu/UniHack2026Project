// Person B owns this folder: profile, event list with filters, join, match and group card.
import { useState } from 'react';
import { getInterests, getMe, listEvents } from '../../api.js';
import { VerifyEmailNotice, useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
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

  const interests = useApi(getInterests);
  const me = useApi(() => (canUse ? getMe() : Promise.resolve(null)), [canUse]);
  const events = useApi(
    () => listEvents(toQuery(filters)),
    [canUse, filters.interest, filters.from, filters.to],
  );
  const list = events.data || [];

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

      <section className="card">
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
        {events.loading && list.length === 0 && <p className="muted">{t('loadingEvents')}</p>}
        {!events.loading && !events.error && list.length === 0 && (
          <p className="muted">
            {hasFilters ? t('noMatch') : t('noEvents')}
          </p>
        )}

        <ul className="events">
          {list.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              isAuthenticated={canUse}
              needsVerification={isAuthenticated && !canUse}
              myId={me.data?.id}
              onChanged={events.reload}
            />
          ))}
        </ul>
        {list.length > 0 && <p className="small muted">{t('sample')}</p>}
      </section>
    </>
  );
}
