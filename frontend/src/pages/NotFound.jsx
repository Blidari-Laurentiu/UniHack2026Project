import { Link } from 'react-router-dom';
import { useT } from '../strings.js';

export default function NotFound() {
  const t = useT();
  return (
    <section className="card center">
      <h1>{t('notFound.title')}</h1>
      <Link to="/" className="btn">
        {t('notFound.back')}
      </Link>
    </section>
  );
}
