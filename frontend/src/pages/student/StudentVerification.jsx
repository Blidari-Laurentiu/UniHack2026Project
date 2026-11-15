import { useEffect, useState } from 'react';
import {
  confirmStudentCode,
  getStudentStatus,
  getUniversities,
  startStudentVerification,
} from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { rich } from '../../i18n.jsx';
import useApi from '../../useApi.js';
import { useT } from './strings.js';

/** Seconds until `iso` (a date string), never below 0; ticks every second. */
function useCountdown(iso) {
  const target = iso ? new Date(iso).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target || target <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/**
 * Student status on the account page. Step 1: university and university email.
 * Step 2: the 6-digit code from that mailbox. Then the user has the student badge.
 */
export default function StudentVerification({ onChange }) {
  const t = useT();
  const status = useApi(getStudentStatus);
  const universities = useApi(getUniversities);
  const list = universities.data || [];

  const [university, setUniversity] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [changing, setChanging] = useState(false); // show step 1 again while a code is pending

  const s = status.data;
  // After the year is over the user verifies again: start from the mailbox they used.
  useEffect(() => {
    if (!s?.expired) return;
    setUniversity((u) => u || s.university || '');
    setEmail((e) => e || s.student_email || '');
  }, [s?.expired, s?.university, s?.student_email]);
  const pending = s?.pending && !changing ? s.pending : null;
  const resendIn = useCountdown(pending?.resend_after);
  const chosen = list.find((u) => u.slug === university);
  const nameOf = (slug) => list.find((u) => u.slug === slug)?.name || slug?.toUpperCase();

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (e) => {
    e?.preventDefault();
    run(async () => {
      await startStudentVerification({ university, email });
      setCode('');
      setChanging(false);
      status.reload();
    });
  };

  const resend = () =>
    run(async () => {
      await startStudentVerification({
        university: pending.university,
        email: pending.student_email,
      });
      setCode('');
      status.reload();
    });

  const confirm = (e) => {
    e.preventDefault();
    run(async () => {
      await confirmStudentCode(code);
      status.reload();
      onChange?.();
    });
  };

  return (
    <section className="card">
      <h2>
        {t('title')}{' '}
        {s?.is_student && <span className="badge badge-ok">{t('verifiedStudent')}</span>}
      </h2>
      {status.loading && !s && <p className="muted">{t('loading')}</p>}
      <ErrorBox error={status.error} onRetry={status.reload} />

      {s?.is_student && (
        <p>
          {rich(t('verifiedWith', s.student_email, nameOf(s.university)))}
          {s.verified_at && <span className="muted">{t('verifiedOn', t.fmt.date(s.verified_at))}</span>}
          .{s.expires_at && <> {rich(t('validUntil', t.fmt.date(s.expires_at)))}</>}
        </p>
      )}

      {s?.expired && !pending && (
        <p role="status">{rich(t('expired', t.fmt.date(s.expires_at)))}</p>
      )}

      {s && !s.is_student && !pending && (
        <form className="form" onSubmit={sendCode}>
          <p className="muted">{t('intro')}</p>
          <label className="field">
            <span className="field-label">{t('university')}</span>
            <select
              className="input"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              required
            >
              <option value="">{t('chooseUniversity')}</option>
              {list.map((u) => (
                <option key={u.slug} value={u.slug}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('email')}</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder', chosen?.domains[0])}
              autoComplete="email"
              maxLength={254}
              required
            />
            {chosen && (
              <span className="small muted">
                {t('mustEndIn', t.fmt.list(chosen.domains.map((d) => `@${d}`), 'or'))}
              </span>
            )}
          </label>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || !university || !email.trim()}>
              {busy ? t('sending') : t('sendCode')}
            </button>
            {s.pending && (
              <button
                type="button"
                className="btn"
                onClick={() => setChanging(false)}
                disabled={busy}
              >
                {t('backToCode')}
              </button>
            )}
          </div>
        </form>
      )}

      {s && !s.is_student && pending && (
        <form className="form" onSubmit={confirm}>
          <p>
            {rich(
              t(
                'codeSent',
                pending.student_email,
                nameOf(pending.university),
                t.fmt.time(pending.expires_at),
              ),
            )}{' '}
            <span className="muted">{t('spamHint')}</span>
          </p>
          <label className="field">
            <span className="field-label">{t('code')}</span>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
            />
          </label>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || code.length !== 6}>
              {busy ? t('checking') : t('confirm')}
            </button>
            <button type="button" className="btn" onClick={resend} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? t('resendIn', resendIn) : t('resend')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setUniversity(pending.university);
                setEmail(pending.student_email);
                setChanging(true);
                setError(null);
              }}
              disabled={busy}
            >
              {t('otherEmail')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
