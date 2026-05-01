import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Admin from './pages/Admin.jsx';
import AdminSession from './pages/AdminSession.jsx';
import AdminTeam from './pages/AdminTeam.jsx';
import Join from './pages/Join.jsx';
import TeamSelect from './pages/TeamSelect.jsx';
import Lobby from './pages/Lobby.jsx';
import Play from './pages/Play.jsx';
import Results from './pages/Results.jsx';
import { useT, LocaleSwitcher } from './i18n/index.jsx';

export default function App() {
  const { t } = useT();
  return (
    <div className="min-h-screen text-[#e7eaee]">
      <header className="border-b border-[#2c3a52] bg-[#1a2332]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            🍺 {t('nav.title')} <span className="text-sm text-[#8a96a8] font-normal">— {t('nav.subtitle')}</span>
          </Link>
          <nav className="flex gap-3 text-sm items-center">
            <Link to="/admin" className="text-[#8a96a8] hover:text-white">{t('nav.admin')}</Link>
            <Link to="/join" className="text-[#8a96a8] hover:text-white">{t('nav.join')}</Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:sessionId" element={<AdminSession />} />
          <Route path="/admin/:sessionId/team/:teamId" element={<AdminTeam />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:code" element={<TeamSelect />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/play" element={<Play />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </main>
    </div>
  );
}
