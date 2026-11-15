import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';

export default function NotFound() {
  return (
    <section className="notfound">
      <Avatar userId="lost" size={96} />
      <h1>This street is not on the map</h1>
      <p className="muted">The page you asked for does not exist, or it has moved.</p>
      <Link to="/" className="btn btn-primary">
        Back home
      </Link>
    </section>
  );
}
