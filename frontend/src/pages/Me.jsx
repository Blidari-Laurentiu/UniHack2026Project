import { getAccount, getInterests, getMe } from '../api.js';
import { LogoutButton, useAuth } from '../auth/index.js';
import Avatar from '../components/Avatar.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import { useProfile } from '../profile/ProfileContext.jsx';
import { useT } from '../strings.js';
import useApi from '../useApi.js';
import AvatarEditor from './account/AvatarEditor.jsx';
import DeleteAccount from './account/DeleteAccount.jsx';
import SecretValue from './account/SecretValue.jsx';
import SecurityCard from './account/SecurityCard.jsx';
import ProfilePanel from './events/ProfilePanel.jsx';
import StudentVerification from './student/StudentVerification.jsx';

export default function Me() {
  const t = useT();
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
            <h1>{name || t('me.title')}</h1>
            {me && (
              <p className="muted">
                {me.email || t('me.noEmail')}{' '}
                {me.is_student && <span className="badge badge-ok">{t('me.verifiedStudent')}</span>}
              </p>
            )}
          </div>
          <LogoutButton className="btn btn-sm" />
        </div>
        {loading && <p className="muted">{t('loading')}</p>}
        <ErrorBox error={error} onRetry={reload} />
        {me && <AvatarEditor />}

        {me && (
          <>
            <h2>{t('me.details')}</h2>
            <dl className="kv">
              <dt>{t('me.student')}</dt>
              <dd>{me.is_student ? t('me.yes') : t('me.no')}</dd>
              <dt>{t('me.roles')}</dt>
              <dd>
                {me.roles?.length
                  ? me.roles.map((role) => t.opt(`role.${role}`) ?? role).join(', ')
                  : t('me.noRoles')}
              </dd>
              <dt>{t('me.joined')}</dt>
              <dd>{me.created_at ? t.fmt.dateTime(me.created_at) : '—'}</dd>
            </dl>

            {/* Nobody needs these day to day; support may ask for one when something is wrong. */}
            <h3>{t('me.idsTitle')}</h3>
            <p className="muted small">{t('me.idsText')}</p>
            <dl className="kv">
              <dt>{t('me.userId')}</dt>
              <dd>
                <SecretValue value={me.id} label={t('me.userId')} />
              </dd>
              <dt>{t('me.auth0Id')}</dt>
              <dd>
                <SecretValue value={me.auth0_sub} label={t('me.auth0Id')} />
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
