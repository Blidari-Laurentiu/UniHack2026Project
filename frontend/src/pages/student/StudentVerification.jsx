import { useEffect, useState } from 'react';
import {
  confirmStudentCode,
  getStudentStatus,
  getUniversities,
  startStudentVerification,
} from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';

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
        Student status {s?.is_student && <span className="badge badge-ok">Verified student</span>}
      </h2>
      {status.loading && !s && <p className="muted">Loading…</p>}
      <ErrorBox error={status.error} onRetry={status.reload} />

      {s?.is_student && (
        <p>
          Verified with <b>{s.student_email}</b> at {nameOf(s.university)}
          {s.verified_at && (
            <span className="muted"> on {new Date(s.verified_at).toLocaleDateString()}</span>
          )}
          .
        </p>
      )}

      {s && !s.is_student && !pending && (
        <form className="form" onSubmit={sendCode}>
          <p className="muted">
            Students get a badge on their group card. To get it, confirm your university email: we
            send it a 6-digit code.
          </p>
          <label className="field">
            <span className="field-label">Your university</span>
            <select
              className="input"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              required
            >
              <option value="">Choose your university</option>
              {list.map((u) => (
                <option key={u.slug} value={u.slug}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Your university email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={chosen ? `name@${chosen.domains[0]}` : 'name@university'}
              autoComplete="email"
              maxLength={254}
              required
            />
            {chosen && (
              <span className="small muted">
                Must end in {chosen.domains.map((d) => `@${d}`).join(' or ')}.
              </span>
            )}
          </label>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || !university || !email.trim()}>
              {busy ? 'Sending…' : 'Send me a code'}
            </button>
            {s.pending && (
              <button
                type="button"
                className="btn"
                onClick={() => setChanging(false)}
                disabled={busy}
              >
                Back to the code
              </button>
            )}
          </div>
        </form>
      )}

      {s && !s.is_student && pending && (
        <form className="form" onSubmit={confirm}>
          <p>
            We sent a 6-digit code to <b>{pending.student_email}</b> ({nameOf(pending.university)}).
            It expires at{' '}
            {new Date(pending.expires_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            . <span className="muted">Not there? Look in your spam folder.</span>
          </p>
          <label className="field">
            <span className="field-label">Code</span>
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
              {busy ? 'Checking…' : 'Confirm'}
            </button>
            <button type="button" className="btn" onClick={resend} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? `Send a new code (${resendIn}s)` : 'Send a new code'}
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
              Use another email
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
