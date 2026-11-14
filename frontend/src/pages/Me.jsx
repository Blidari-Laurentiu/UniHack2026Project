import { getAccount, getInterests, getMe } from '../api.js';
import { useAuth } from '../auth/index.js';
import ErrorBox from '../components/ErrorBox.jsx';
import useApi from '../useApi.js';
import DeleteAccount from './account/DeleteAccount.jsx';
import SecurityCard from './account/SecurityCard.jsx';
import ProfilePanel from './events/ProfilePanel.jsx';
import StudentVerification from './student/StudentVerification.jsx';

export default function Me() {
  const { user: authUser } = useAuth();
  const { data: me, error, loading, reload } = useApi(getMe);
  const interests = useApi(getInterests);
  const account = useApi(getAccount);

  return (
    <>
      <section className="card">
        <h1>
          Your account {me?.is_student && <span className="badge badge-ok">Verified student</span>}
        </h1>
        {loading && <p className="muted">Loading…</p>}
        <ErrorBox error={error} onRetry={reload} />
        {me && (
          <dl className="kv">
            <dt>Name</dt>
            <dd>{me.display_name || '—'}</dd>
            <dt>Email</dt>
            <dd>{me.email || <span className="muted">not shared by Auth0 yet</span>}</dd>
            <dt>Student</dt>
            <dd>{me.is_student ? 'yes' : 'no'}</dd>
            <dt>Roles</dt>
            <dd>{me.roles?.length ? me.roles.join(', ') : 'none'}</dd>
            <dt>Auth0 id</dt>
            <dd>
              <code>{me.auth0_sub}</code>
            </dd>
            <dt>User id</dt>
            <dd>
              <code>{me.id}</code>
            </dd>
            <dt>Joined</dt>
            <dd>{me.created_at ? new Date(me.created_at).toLocaleString() : '—'}</dd>
          </dl>
        )}
      </section>
      {me && (
        <section className="card">
          <ErrorBox error={interests.error} onRetry={interests.reload} />
          <ProfilePanel interests={interests.data || []} authUser={authUser} onSaved={reload} />
        </section>
      )}
      {me && <StudentVerification onChange={reload} />}
      {me && <SecurityCard account={account} />}
      {me && <DeleteAccount account={account} />}
    </>
  );
}
