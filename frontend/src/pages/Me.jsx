import { getAccount, getInterests, getMe } from '../api.js';
import { LogoutButton, useAuth } from '../auth/index.js';
import Avatar from '../components/Avatar.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import { useProfile } from '../profile/ProfileContext.jsx';
import useApi from '../useApi.js';
import AvatarEditor from './account/AvatarEditor.jsx';
import DeleteAccount from './account/DeleteAccount.jsx';
import SecretValue from './account/SecretValue.jsx';
import SecurityCard from './account/SecurityCard.jsx';
import ProfilePanel from './events/ProfilePanel.jsx';
import StudentVerification from './student/StudentVerification.jsx';

export default function Me() {
  const { user: authUser } = useAuth();
  const { data: me, error, loading, reload } = useApi(getMe);
  const { profile } = useProfile();
  const interests = useApi(getInterests);
  const account = useApi(getAccount);

  const name = profile?.display_name || me?.display_name;

  return (
    <>
      <section className="card">
        <div className="account-head">
          {me && <Avatar userId={me.id} src={profile?.avatar_url} size={88} />}
          <div className="account-head-text">
            <h1>{name || 'Your account'}</h1>
            {me && (
              <p className="muted">
                {me.email || 'No email address shared with us'}{' '}
                {me.is_student && <span className="badge badge-ok">Verified student</span>}
              </p>
            )}
          </div>
          <LogoutButton className="btn btn-sm" />
        </div>
        {loading && <p className="muted">Loading…</p>}
        <ErrorBox error={error} onRetry={reload} />
        {me && <AvatarEditor />}

        {me && (
          <>
            <h2>Account details</h2>
            <dl className="kv">
              <dt>Student</dt>
              <dd>{me.is_student ? 'yes' : 'no'}</dd>
              <dt>Roles</dt>
              <dd>{me.roles?.length ? me.roles.join(', ') : 'none'}</dd>
              <dt>Joined</dt>
              <dd>{me.created_at ? new Date(me.created_at).toLocaleString() : '—'}</dd>
            </dl>

            {/* Nobody needs these day to day; support may ask for one when something is wrong. */}
            <h3>Account ids</h3>
            <p className="muted small">
              Only needed if we ask for one to look into a problem. They stay blurred so they do
              not end up in a screenshot or on a shared screen.
            </p>
            <dl className="kv">
              <dt>User id</dt>
              <dd>
                <SecretValue value={me.id} label="user id" />
              </dd>
              <dt>Login id</dt>
              <dd>
                <SecretValue value={me.auth0_sub} label="login id" />
              </dd>
            </dl>
          </>
        )}
      </section>
      {me && (
        <section className="card">
          <ErrorBox error={interests.error} onRetry={interests.reload} />
          <ProfilePanel
            interests={interests.data || []}
            authUser={authUser}
            onSaved={reload}
            account
          />
        </section>
      )}
      {me && <StudentVerification onChange={reload} />}
      {me && <SecurityCard account={account} />}
      {me && <DeleteAccount account={account} />}
    </>
  );
}
