// Person B owns this folder: the review queue for moderators and admins. The API refuses
// everyone else with 403, which shows here as an error.
import { useState } from 'react';
import { approveEvent, getReviewQueue, rejectEvent } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import { interestLabel, useT as useEventsT } from '../events/strings.js';
import { useT } from './strings.js';

function ReviewCard({ event, onDone }) {
  const t = useT();
  const te = useEventsT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function decide(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn(event.id);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const pending = event.status === 'pending';
  const reported = event.reports.length > 0;
  const creator = event.created_by ? event.created_by.display_name || t('someone') : null;

  return (
    <li className="card review">
      <div className="event-head">
        <div className="event-main">
          <strong className="event-title">{event.title}</strong>
          <span className="muted small">
            {t.fmt.weekdayTime(event.starts_at)}
            {event.venue && ` · ${event.venue}`}
          </span>
        </div>
        <div className="event-tags">
          {event.interest && <span className="chip">{interestLabel(te, event.interest)}</span>}
          <span className={pending ? 'badge badge-warn' : 'badge badge-ok'}>
            {t(`status.${event.status}`)}
          </span>
        </div>
      </div>

      {event.description && <p className="event-desc">{event.description}</p>}
      <p className="small muted">
        {creator ? t('createdBy', creator) : t('seeded')} · {t('going', event.signup_count)}
      </p>
      {pending && (
        <p className="notice">{reported ? t('hiddenByReports') : t('newFrom', creator || t('someone'))}</p>
      )}

      {reported && (
        <>
          <h3>{t('reports', event.reports.length)}</h3>
          <ul className="review-reports">
            {event.reports.map((r) => (
              <li key={r.id}>
                <span>{r.reason}</span>
                <span className="small muted">
                  {t('reportBy', r.reporter_name || t('deleted'), t.fmt.dateTime(r.created_at))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <ErrorBox error={error} />
      <div className="form-actions">
        <button className="btn btn-primary" onClick={() => decide(approveEvent)} disabled={busy}>
          {reported ? t('keep') : t('approve')}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => window.confirm(t('confirmReject', event.title)) && decide(rejectEvent)}
          disabled={busy}
        >
          {t('reject')}
        </button>
      </div>
    </li>
  );
}

export default function ModerationPage() {
  const t = useT();
  const queue = useApi(getReviewQueue);
  const list = queue.data || [];

  return (
    <>
      <section className="hero">
        <h1>{t('title')}</h1>
        <p className="lead">{t('lead')}</p>
      </section>

      <ErrorBox error={queue.error} onRetry={queue.reload} />
      {queue.loading && list.length === 0 && <p className="muted">{t('loading')}</p>}
      {!queue.loading && !queue.error && list.length === 0 && (
        <section className="card">
          <p className="muted">{t('empty')}</p>
        </section>
      )}
      <ul className="review-list">
        {list.map((event) => (
          <ReviewCard key={event.id} event={event} onDone={queue.reload} />
        ))}
      </ul>
    </>
  );
}
