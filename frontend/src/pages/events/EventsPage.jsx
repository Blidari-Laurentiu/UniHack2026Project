// Person B owns this folder. Placeholder: profile form, filters, join and group card
// come in Phase 2, item 4.
import { listEvents } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';

const SLOT_LABELS = {
  weekday_morning: 'Weekday morning',
  weekday_evening: 'Weekday evening',
  weekend_morning: 'Weekend morning',
  weekend_afternoon: 'Weekend afternoon',
  weekend_evening: 'Weekend evening',
};

export default function EventsPage() {
  const { isAuthenticated } = useAuth();
  const { data, error, loading, reload } = useApi(listEvents, [isAuthenticated]);
  const events = Array.isArray(data) ? data : data?.events || [];

  return (
    <section className="card">
      <h1>Events</h1>
      <p className="muted">Pick an event, and we match you with a small group to go with.</p>

      {loading && <p className="muted">Loading…</p>}
      <ErrorBox error={error} onRetry={reload} />
      {!loading && !error && events.length === 0 && <p className="muted">No upcoming events.</p>}

      <ul className="list">
        {events.map((ev) => (
          <li key={ev.id} className="list-item">
            <div className="list-main">
              <strong>{ev.title}</strong>
              <span className="muted small">
                {ev.venue}
                {ev.starts_at && ` · ${new Date(ev.starts_at).toLocaleString()}`}
              </span>
            </div>
            <div className="list-side">
              {ev.slot && <span className="chip">{SLOT_LABELS[ev.slot] || ev.slot}</span>}
              {ev.interest && <span className="chip">{ev.interest.label}</span>}
              <span className="chip">{ev.signup_count} going</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
