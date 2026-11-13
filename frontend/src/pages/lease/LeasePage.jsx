// Person A owns this folder. Placeholder: replace with the lease form (Phase 2, item 5).
import { getNeighbourhoods } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';

export default function LeasePage() {
  const { isAuthenticated } = useAuth();
  const { data, error, loading, reload } = useApi(getNeighbourhoods, [isAuthenticated]);
  const items = Array.isArray(data) ? data : data?.neighbourhoods || [];

  return (
    <section className="card">
      <h1>Lease check</h1>
      <p className="muted">Coming soon: paste a lease, get a clause checklist and a price verdict.</p>

      <h2>Neighbourhoods</h2>
      {loading && <p className="muted">Loading…</p>}
      <ErrorBox error={error} onRetry={reload} />
      {!loading && !error && items.length === 0 && <p className="muted">No neighbourhoods yet.</p>}
      {items.length > 0 && (
        <ul className="chips">
          {items.map((n) => {
            const name = typeof n === 'string' ? n : n.name || n.neighbourhood;
            return (
              <li key={name} className="chip">
                {name}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
