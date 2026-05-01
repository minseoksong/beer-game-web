import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useT } from '../i18n/index.jsx';

export default function Join() {
  const { t } = useT();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const c = code.trim().toUpperCase();
      await api.getSessionByCode(c);
      navigate(`/join/${c}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-8 space-y-4">
      <h2 className="text-2xl font-bold text-[#f4a261]">{t('join.title')}</h2>
      <p className="text-sm text-[#8a96a8]">{t('join.desc')}</p>
      <input
        autoFocus
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        maxLength={6}
        placeholder={t('join.placeholder')}
        className="w-full bg-[#232f44] border border-[#2c3a52] rounded-md px-4 py-4 text-3xl text-center font-mono tracking-widest"
      />
      {error && <div className="bg-red-900/30 border border-red-600 rounded-md p-3 text-sm">{error}</div>}
      <button type="submit" disabled={busy || code.length !== 6}
              className="w-full bg-[#f4a261] text-black font-semibold py-3 rounded-md disabled:opacity-50">
        {busy ? t('join.checking') : t('join.submit') + ' →'}
      </button>
    </form>
  );
}
