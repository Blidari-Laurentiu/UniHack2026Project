import { getAccount, getInterests, getMe } from '../api.js';
import { useAuth } from '../auth/index.js';
import ErrorBox from '../components/ErrorBox.jsx';
import { useT } from '../strings.js';
import useApi from '../useApi.js';
import DeleteAccount from './account/DeleteAccount.jsx';
import SecurityCard from './account/SecurityCard.jsx';
import ProfilePanel from './events/ProfilePanel.jsx';
import StudentVerification from './student/StudentVerification.jsx';

export default function Me() {
  const t = useT();
  const { user: authUser } = useAuth();
  const { data: me, error, loading, reload } = useApi(getMe);
  const interests = useApi(getInterests);
  const account = useApi(getAccount);

  return (
    <>
      <section className="card">
        <h1>
          {t('me.title')}{' '}
          {me?.is_student && <span className="badge badge-ok">{t('me.verifiedStudent')}</span>}
        </h1>
        {loading && <p className="muted">{t('loading')}</p>}
        <ErrorBox error={error} onRetry={reload} />
        {me && (
          <dl className="kv">
            <dt>{t('me.name')}</dt>
            <dd>{me.display_name || '—'}</dd>
            <dt>{t('me.email')}</dt>
            <dd>{me.email || <span className="muted">{t('me.emailMissing')}</span>}</dd>
            <dt>{t('me.student')}</dt>
            <dd>{me.is_student ? t('me.yes') : t('me.no')}</dd>
            <dt>{t('me.roles')}</dt>
            <dd>
              {me.roles?.length
                ? me.roles.map((role) => t.opt(`role.${role}`) ?? role).join(', ')
                : t('me.noRoles')}
            </dd>
            <dt>{t('me.auth0Id')}</dt>
            <dd>
              <code>{me.auth0_sub}</code>
            </dd>
            <dt>{t('me.userId')}</dt>
            <dd>
              <code>{me.id}</code>
            </dd>
            <dt>{t('me.joined')}</dt>
            <dd>{me.created_at ? t.fmt.dateTime(me.created_at) : '—'}</dd>
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
