import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { ArrowIcon } from '../components/Icon.jsx';
import CityArt from '../components/art/CityArt.jsx';
import GroupArt from '../components/art/GroupArt.jsx';
import LeaseArt from '../components/art/LeaseArt.jsx';

// Any text works as a seed; these eight just show the range of roofs, legs and colours.
const TIMIS = ['unirii', 'bega', 'fabric', 'iosefin', 'elisabetin', 'cetate', 'mehala', 'lipovei'];

export default function Home() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="container landing-hero-inner">
          <div>
            <p className="eyebrow">Bun venit · Welcome</p>
            <h1 className="display">
              New in <span className="plate">Timișoara</span>? Start here.
            </h1>
            <p className="landing-lead">
              Check your lease before you sign, and find people to go out with.
            </p>
            <div className="landing-actions">
              <Link to="/lease" className="btn btn-primary btn-lg">
                Check a lease
                <ArrowIcon />
              </Link>
              <Link to="/events" className="btn btn-lg">
                Find a group
              </Link>
            </div>
            <p className="landing-note">
              Your CNP, IBAN and ID series are removed from the lease before it is analysed or
              saved.
            </p>
          </div>
          <figure className="landing-figure">
            <CityArt />
            <figcaption>Timi, new in town. The street lamps have been on since 1884.</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-band" aria-labelledby="home-lease">
        <div className="container feature">
          <div className="feature-art">
            <LeaseArt />
          </div>
          <div>
            <p className="eyebrow">Lease check</p>
            <h2 id="home-lease">Know what you are signing</h2>
            <p>
              Paste a Romanian rental contract, or upload the PDF. You get the clauses to worry
              about, the ones that are missing, and how the rent compares.
            </p>
            <ul className="feature-list">
              <li>Risky clauses quoted from your contract, with what to ask for instead</li>
              <li>A price verdict against similar listings in the same neighbourhood</li>
              <li>The report in English or Romanian, saved so you can come back to it</li>
            </ul>
            <Link to="/lease" className="btn btn-primary">
              Check a lease
              <ArrowIcon />
            </Link>
            <p className="feature-fine muted">A first check, not legal advice.</p>
          </div>
        </div>
      </section>

      <section className="landing-band" aria-labelledby="home-events">
        <div className="container feature feature-flip">
          <div className="feature-art">
            <GroupArt />
          </div>
          <div>
            <p className="eyebrow">Event groups</p>
            <h2 id="home-events">Never go alone</h2>
            <p>
              Pick an event you want to go to. We put you in a group of 3 to 5 people who like
              the same things and are free at the same time.
            </p>
            <ol className="feature-list feature-steps">
              <li>Say what you like and when you are usually free</li>
              <li>Tap “I want to go” on an event</li>
              <li>Get your group, where to meet, and one line on why you match</li>
            </ol>
            <Link to="/events" className="btn btn-primary">
              Browse events
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-band landing-timi" aria-labelledby="home-timi">
        <div className="container timi">
          <div>
            <p className="eyebrow">Your picture</p>
            <h2 id="home-timi">Meet Timi</h2>
            <p>
              A small house on legs, still looking for its street. Every account starts with a
              Timi of its own, in two colours picked at random, until you add a photo.
            </p>
            <Link to="/me" className="btn">
              See yours
            </Link>
          </div>
          <ul className="timi-row" aria-hidden="true">
            {TIMIS.map((seed) => (
              <li key={seed}>
                <Avatar userId={seed} size={null} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
