import { Link } from 'react-router-dom';
import { useT } from '../strings.js';

export default function Home() {
  const t = useT();
  return (
    <>
      <section className="hero">
        <h1>{t('home.title')}</h1>
        <p className="lead">{t('home.lead')}</p>
      </section>

      <div className="cards">
        <Link to="/lease" className="card card-link">
          <h2>{t('home.leaseTitle')}</h2>
          <p>{t('home.leaseText')}</p>
          <span className="card-cta">{t('home.leaseCta')}</span>
        </Link>

        <Link to="/events" className="card card-link">
          <h2>{t('home.eventsTitle')}</h2>
          <p>{t('home.eventsText')}</p>
          <span className="card-cta">{t('home.eventsCta')}</span>
        </Link>
      </div>
    </>
  );
}
