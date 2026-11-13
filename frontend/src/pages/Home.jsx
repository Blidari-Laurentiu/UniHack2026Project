import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>New in Timișoara?</h1>
        <p className="lead">Check your lease before you sign, and find people to go out with.</p>
      </section>

      <div className="cards">
        <Link to="/lease" className="card card-link">
          <h2>Lease check</h2>
          <p>
            Paste a Romanian rental contract. We flag risky clauses, list what is missing, and
            compare the rent with similar listings in the neighbourhood.
          </p>
          <span className="card-cta">Check a lease →</span>
        </Link>

        <Link to="/events" className="card card-link">
          <h2>Event groups</h2>
          <p>
            Pick an event you want to go to. We put you in a small group of 3 to 5 people with
            similar interests, so you never have to go alone.
          </p>
          <span className="card-cta">Browse events →</span>
        </Link>
      </div>
    </>
  );
}
