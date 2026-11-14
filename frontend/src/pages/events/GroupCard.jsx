import { groupNote, whyYouMatch } from './groupText.js';
import { useT } from './strings.js';

/** The user's group for one event: why they match, where to meet, who is in it. */
export default function GroupCard({ group, myId }) {
  const t = useT();
  const note = groupNote(t, group.note);
  return (
    <div className="group-card">
      <h3>{t('yourGroup')}</h3>
      <p className="why">{whyYouMatch(t, group.why_you_match)}</p>
      <ul className="members">
        {group.members.map((m) => (
          <li key={m.user_id} className="member">
            <span className="avatar" aria-hidden="true">
              {(m.display_name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span>
              {m.display_name || t('newcomer')}
              {m.user_id === myId && <span className="muted">{t('you')}</span>}
            </span>
            {m.is_student && <span className="badge badge-ok">{t('student')}</span>}
          </li>
        ))}
      </ul>
      {(group.meet_at || note) && (
        <p className="small muted">
          {group.meet_at && <>{t('meet', t.fmt.weekdayTime(group.meet_at))} </>}
          {note}
        </p>
      )}
    </div>
  );
}
