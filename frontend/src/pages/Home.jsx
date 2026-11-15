import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { ArrowIcon } from '../components/Icon.jsx';
import CityArt from '../components/art/CityArt.jsx';
import GroupArt from '../components/art/GroupArt.jsx';
import LeaseArt from '../components/art/LeaseArt.jsx';
import { useT } from '../strings.js';

// Any text works as a seed; these eight just show the range of roofs, legs and colours.
const TIMIS = ['unirii', 'bega', 'fabric', 'iosefin', 'elisabetin', 'cetate', 'mehala', 'lipovei'];

export default function Home() {
  const t = useT();
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="container landing-hero-inner">
          <div>
            <p className="eyebrow">{t('home.eyebrow')}</p>
            <h1 className="display">
              {t('home.titleBefore')}
              <span className="plate">Timișoara</span>
              {t('home.titleAfter')}
            </h1>
            <p className="landing-lead">{t('home.lead')}</p>
            <div className="landing-actions">
              <Link to="/lease" className="btn btn-primary btn-lg">
                {t('home.leaseCta')}
                <ArrowIcon />
              </Link>
              <Link to="/events" className="btn btn-lg">
                {t('home.findGroup')}
              </Link>
            </div>
            <p className="landing-note">{t('home.privacy')}</p>
          </div>
          <figure className="landing-figure">
            <CityArt label={t('home.art')} />
            <figcaption>{t('home.caption')}</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-band" aria-labelledby="home-lease">
        <div className="container feature">
          <div className="feature-art">
            <LeaseArt />
          </div>
          <div>
            <p className="eyebrow">{t('home.leaseTitle')}</p>
            <h2 id="home-lease">{t('home.leaseHeading')}</h2>
            <p>{t('home.leaseText')}</p>
            <ul className="feature-list">
              <li>{t('home.lease1')}</li>
              <li>{t('home.lease2')}</li>
              <li>{t('home.lease3')}</li>
            </ul>
            <Link to="/lease" className="btn btn-primary">
              {t('home.leaseCta')}
              <ArrowIcon />
            </Link>
            <p className="feature-fine muted">{t('home.leaseFine')}</p>
          </div>
        </div>
      </section>

      <section className="landing-band" aria-labelledby="home-events">
        <div className="container feature feature-flip">
          <div className="feature-art">
            <GroupArt />
          </div>
          <div>
            <p className="eyebrow">{t('home.eventsTitle')}</p>
            <h2 id="home-events">{t('home.eventsHeading')}</h2>
            <p>{t('home.eventsText')}</p>
            <ol className="feature-list feature-steps">
              <li>{t('home.events1')}</li>
              <li>{t('home.events2')}</li>
              <li>{t('home.events3')}</li>
            </ol>
            <Link to="/events" className="btn btn-primary">
              {t('home.eventsCta')}
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-band landing-timi" aria-labelledby="home-timi">
        <div className="container timi">
          <div>
            <p className="eyebrow">{t('home.timiEyebrow')}</p>
            <h2 id="home-timi">{t('home.timiTitle')}</h2>
            <p>{t('home.timiText')}</p>
            <Link to="/me" className="btn">
              {t('home.timiCta')}
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
