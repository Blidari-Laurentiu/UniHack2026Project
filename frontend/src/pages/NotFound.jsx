import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { useT } from '../strings.js';

export default function NotFound() {
  const t = useT();
  return (
    <section className="notfound">
      <Avatar userId="lost" size={96} />
      <h1>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.text')}</p>
      <Link to="/" className="btn btn-primary">
        {t('notFound.back')}
      </Link>
    </section>
  );
}
