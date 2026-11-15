import { useEffect, useState } from 'react';
import { getMyGroup, joinEvent, leaveEvent, reportEvent, runMatch } from '../../api.js';
import { LoginButton } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import GroupCard from './GroupCard.jsx';
import { dateParts } from './slots.js';
import { interestLabel, slotLabel, useT } from './strings.js';

const MIN_GROUP = 3;

export default function EventCard({ event, isAuthenticated, needsVerification, myId, onChanged }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // { waiting } after a match without this user
  const [group, setGroup] = useState(null);
  // Report: null = closed, a string = the form is open with this text, true = sent.
  const [report, setReport] = useState(null);

  const status = isAuthenticated ? event.my_status : null;
  // Anything but 'active' reaches only the event's creator: waiting for review, or removed.
  const open = event.status === 'active';

  // Load the group whenever this event shows the user as grouped.
  useEffect(() => {
    if (status !== 'grouped') {
      setGroup(null);
      return undefined;
    }
    let cancelled = false;
    getMyGroup(event.id)
      .then((g) => !cancelled && setGroup(g))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [event.id, status]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const join = () => act(() => joinEvent(event.id));

  const leave = () => {
    if (status === 'grouped' && !window.confirm(t('confirmLeaveGroup'))) return;
    act(() => leaveEvent(event.id));
  };

  const match = () =>
    act(async () => {
      const result = await runMatch(event.id);
      const mine = result.groups.some((g) => g.members.some((m) => m.user_id === myId));
      if (!mine) {
        // Keep the counts, not the text, so the notice follows the language switch.
        setNotice({ waiting: result.unmatched_count });
      }
    });

  async function sendReport(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reportEvent(event.id, report.trim());
      setReport(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const when = dateParts(event.starts_at, t.lang);

  return (
    <li className="event">
      <time className="event-date" dateTime={event.starts_at}>
        <span className="event-date-month">{when.month}</span>
        <span className="event-date-day">{when.day}</span>
        <span className="event-date-dow">{when.weekday}</span>
      </time>
      <div className="event-body">
        <div className="event-head">
          <div className="event-main">
            <strong className="event-title">{event.title}</strong>
            <span className="muted small">
              {t.fmt.time(event.starts_at)}
              {event.venue && ` · ${event.venue}`}
            </span>
          </div>
          <div className="event-tags">
            {event.created_by_me && <span className="chip chip-soft">{t('yourEvent')}</span>}
            {event.interest && <span className="chip">{interestLabel(t, event.interest)}</span>}
            {event.slot && <span className="chip">{slotLabel(t, event.slot)}</span>}
          </div>
        </div>

        {event.description && <p className="event-desc">{event.description}</p>}

        <div className="event-actions">
          <span className="small muted">
            {event.signup_count === 0 ? t('firstToGo') : t('wantToGo', event.signup_count)}
          </span>

          {!open && <span className="badge badge-warn">{t(`status.${event.status}`)}</span>}
          {!isAuthenticated && !needsVerification && <LoginButton className="btn btn-sm" />}
          {needsVerification && <span className="badge badge-warn">{t('verifyToJoin')}</span>}

          {isAuthenticated && open && (status === null || status === 'left') && (
            <button className="btn btn-primary" onClick={join} disabled={busy}>
              {t('join')}
            </button>
          )}

          {status === 'waiting' && (
            <>
              <span className="badge badge-warn">{t('onList')}</span>
              {/* Needs myId (from the profile) to tell whether the new groups include this user. */}
              <button className="btn btn-primary" onClick={match} disabled={busy || !myId || !open}>
                {busy ? t('matching') : t('findGroup')}
              </button>
              <button className="btn" onClick={leave} disabled={busy}>
                {t('leave')}
              </button>
            </>
          )}

          {status === 'grouped' && (
            <>
              <span className="badge badge-ok">{t('hasGroup')}</span>
              <button className="btn" onClick={leave} disabled={busy}>
                {t('leaveGroup')}
              </button>
            </>
          )}

          {isAuthenticated && open && !event.created_by_me && report === null && (
            <button type="button" className="btn btn-sm" onClick={() => setReport('')}>
              {t('report')}
            </button>
          )}
        </div>

        {!open && (
          <p className="notice">{t(event.status === 'pending' ? 'pendingText' : 'rejectedText')}</p>
        )}
        {typeof report === 'string' && (
          <form className="form" onSubmit={sendReport}>
            <label className="field">
              <span className="field-label">{t('reportTitle')}</span>
              <textarea
                className="input event-textarea"
                rows={2}
                value={report}
                onChange={(e) => setReport(e.target.value)}
                minLength={5}
                maxLength={500}
                required
                autoFocus
                placeholder={t('reportPlaceholder')}
              />
            </label>
            <div className="form-actions">
              <button className="btn btn-primary btn-sm" disabled={busy || report.trim().length < 5}>
                {busy ? t('reportSending') : t('reportSend')}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setReport(null);
                  setError(null);
                }}
                disabled={busy}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        )}
        {report === true && (
          <p className="small muted" role="status">
            {t('reported')}
          </p>
        )}
        {notice && (
          <p className="notice">
            {notice.waiting < MIN_GROUP
              ? t('notEnough', notice.waiting, MIN_GROUP)
              : t('noGroupYet')}
          </p>
        )}
        <ErrorBox error={error} />
        {status === 'grouped' && group && <GroupCard group={group} myId={myId} />}
      </div>
    </li>
  );
}
