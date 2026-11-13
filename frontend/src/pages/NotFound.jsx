import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="card center">
      <h1>Page not found</h1>
      <Link to="/" className="btn">
        Back home
      </Link>
    </section>
  );
}
