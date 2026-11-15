import Avatar from '../../components/Avatar.jsx';
import { formatWhen } from './slots.js';

/** The user's group for one event: why they match, where to meet, who is in it. */
export default function GroupCard({ group, myId }) {
  return (
    <div className="group-card">
      <h3>Your group</h3>
      <p className="why">{group.why_you_match}</p>
      <ul className="members">
        {group.members.map((m) => (
          <li key={m.user_id} className="member">
            <Avatar userId={m.user_id} src={m.avatar_url} size={36} />
            <span className="member-name">
              {m.display_name || 'Newcomer'}
              {m.user_id === myId && <span className="muted"> (you)</span>}
            </span>
            {m.is_student && <span className="badge badge-ok">Student</span>}
          </li>
        ))}
      </ul>
      {(group.meet_at || group.note) && (
        <p className="small muted">
          {group.meet_at && <>Meet {formatWhen(group.meet_at)}. </>}
          {group.note}
        </p>
      )}
    </div>
  );
}
