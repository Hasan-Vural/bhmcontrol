import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { LogIn, User, Shield, UserCog, Search, Lock } from 'lucide-react';

const STORAGE_KEY = 'test_hesap_token';

const ROLE_ICONS = {
  ADMIN: Shield,
  KIDEMLI_MUHENDIS: UserCog,
  SAHA_MUHENDISI: User,
};

const ROLE_LABELS = {
  ADMIN: 'Admin',
  KIDEMLI_MUHENDIS: 'Kıdemli Teknisyen',
  SAHA_MUHENDISI: 'Teknisyen / Bakımcı',
};

const ROLE_BADGE_CLASS = {
  ADMIN: 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-700',
  KIDEMLI_MUHENDIS: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  SAHA_MUHENDISI: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700',
};

export function TestHesap() {
  const { user, impersonate } = useAuth();
  const [token, setToken] = useState(() => window.sessionStorage.getItem(STORAGE_KEY));
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(!!token);
  const [switching, setSwitching] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  // Sayfa şifresi formu
  const [pagePassword, setPagePassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const loadUsers = async (t) => {
    const tkn = t ?? token;
    if (!tkn) return;
    try {
      const list = await api.testHesap.users(tkn);
      setUsers(list);
    } catch (e) {
      if (e.message && (e.message.includes('401') || e.message.includes('Geçersiz'))) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        setToken(null);
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadUsers();
  }, [token]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordLoading(true);
    try {
      const res = await api.authVerifyTestHesap(pagePassword);
      if (res.token) {
        window.sessionStorage.setItem(STORAGE_KEY, res.token);
        setToken(res.token);
        setPagePassword('');
        setLoading(true);
        await loadUsers(res.token);
      }
    } catch (err) {
      setPasswordError(err.message || 'Geçersiz sayfa şifresi.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = users;
    const q = (search || '').trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }
    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }
    return list;
  }, [users, search, roleFilter]);

  const counts = useMemo(() => {
    const byRole = { ADMIN: 0, KIDEMLI_MUHENDIS: 0, SAHA_MUHENDISI: 0 };
    users.forEach((u) => {
      if (byRole[u.role] !== undefined) byRole[u.role]++;
    });
    return byRole;
  }, [users]);

  const handleSwitch = async (targetUser) => {
    if (targetUser.id === user?.id) return;
    setSwitching(targetUser.id);
    try {
      await impersonate(targetUser.id, token);
      const url = `${window.location.origin}/giris-tamam`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setSwitching(null);
    }
  };

  // Sayfa şifresi girilmediyse giriş kartı göster
  if (!token) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Test Hesapları</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Bu sayfaya erişmek için sayfa şifresini girin.
              </p>
            </div>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            {passwordError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {passwordError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="pagePassword">
                Sayfa şifresi
              </label>
              <input
                id="pagePassword"
                type="password"
                value={pagePassword}
                onChange={(e) => setPagePassword(e.target.value)}
                placeholder="Şifreyi girin"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={passwordLoading || !pagePassword.trim()}
              className="w-full rounded-lg bg-primary-600 dark:bg-primary-500 text-white text-sm font-medium px-4 py-2.5 hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {passwordLoading ? 'Kontrol ediliyor...' : 'Erişimi aç'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Test Hesapları</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Yöneticinizden aldığınız test hesabı şifrelerini kullanın.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASS.ADMIN}`}
        >
          <Shield className="w-3.5 h-3.5" />
          {counts.ADMIN}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASS.KIDEMLI_MUHENDIS}`}
        >
          <UserCog className="w-3.5 h-3.5" />
          {counts.KIDEMLI_MUHENDIS}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASS.SAHA_MUHENDISI}`}
        >
          <User className="w-3.5 h-3.5" />
          {counts.SAHA_MUHENDISI}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
          Toplam: {users.length}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 mb-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Filtreler</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="İsim veya e-posta ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 w-full"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tüm Roller</option>
            <option value="ADMIN">Admin</option>
            <option value="KIDEMLI_MUHENDIS">Kıdemli Teknisyen</option>
            <option value="SAHA_MUHENDISI">Teknisyen / Bakımcı</option>
          </select>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {filtered.length} hesap gösteriliyor
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Filtreye uyan hesap bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Kullanıcı
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    E-posta
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Rol
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Aksiyon
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const Icon = ROLE_ICONS[u.role] || User;
                  const isCurrent = u.id === user?.id;
                  const isSwitching = switching === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${
                        isCurrent ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              isCurrent ? 'bg-primary-200 dark:bg-primary-800' : 'bg-slate-200 dark:bg-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {u.name}
                              {isCurrent && (
                                <span className="ml-1.5 text-xs font-normal text-primary-600 dark:text-primary-400">
                                  (girişli)
                                </span>
                              )}
                            </span>
                            {u.username && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">@{u.username}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{u.email || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_BADGE_CLASS[u.role] || ROLE_BADGE_CLASS.SAHA_MUHENDISI}`}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleSwitch(u)}
                          disabled={isCurrent || isSwitching}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSwitching ? (
                            'Geçiş yapılıyor...'
                          ) : isCurrent ? (
                            'Girişli'
                          ) : (
                            <>
                              <LogIn className="w-4 h-4" />
                              Giriş Yap
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
