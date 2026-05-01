import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';

export default function Home() {
  const { t } = useT();
  return (
    <div className="space-y-6">
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2">{t('home.title')}</h1>
        <p className="text-[#8a96a8] mb-6">{t('home.subtitle')}</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/admin"
            className="block bg-[#232f44] border border-[#2c3a52] rounded-xl p-6 hover:border-[#f4a261] transition">
            <div className="text-2xl mb-2">🎓</div>
            <div className="text-lg font-semibold">{t('home.admin_card_title')}</div>
            <div className="text-sm text-[#8a96a8] mt-1">{t('home.admin_card_desc')}</div>
          </Link>
          <Link to="/join"
            className="block bg-[#232f44] border border-[#2c3a52] rounded-xl p-6 hover:border-[#f4a261] transition">
            <div className="text-2xl mb-2">👥</div>
            <div className="text-lg font-semibold">{t('home.join_card_title')}</div>
            <div className="text-sm text-[#8a96a8] mt-1">{t('home.join_card_desc')}</div>
          </Link>
        </div>
      </div>

      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6 text-sm text-[#8a96a8] space-y-2">
        <div>
          <strong className="text-white">{t('home.info_features_title')}</strong>{' '}
          {t('home.info_features')}
        </div>
        <div>
          <strong className="text-white">{t('home.info_start_title')}</strong>{' '}
          {t('home.info_start')}
        </div>
      </div>
    </div>
  );
}
