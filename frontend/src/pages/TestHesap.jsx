import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { LogIn, User, Shield, UserCog } from 'lucide-react';

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

export function TestHesap() {
  const { user, impersonate } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const list = await api.admin.users.list();
        setUsers(list);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSwitch = async (targetUser) => {
    if (targetUser.id === user?.id) return;
    setSwitching(targetUser.id);
    try {
      await impersonate(targetUser.id);
    } finally {
      setSwitching(null);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">
          Bu sayfa sadece Admin kullanıcılar tarafından kullanılabilir.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Hızlı Hesap Geçişi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Test amaçlı olarak herhangi bir hesaba tek tıkla geçiş yapabilirsiniz. Aynı anda yalnızca bir hesaba girişli
          kalırsınız.
        </p>
      </div>

      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        <strong>Şu an girişli:</strong> {user?.name} ({user?.username})
      </div>

      {loading ? (
        <div className="text-slate-500">Yükleniyor...</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const Icon = ROLE_ICONS[u.role] || User;
            const isCurrent = u.id === user?.id;
            const isSwitching = switching === u.id;
            return (
              <div
                key={u.id}
                className={
                  'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ' +
                  (isCurrent
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50')
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      'w-10 h-10 rounded-full flex items-center justify-center ' +
                      (isCurrent ? 'bg-primary-200' : 'bg-slate-200')
                    }
                  >
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">
                      {u.name}
                      {isCurrent && (
                        <span className="ml-2 text-xs font-normal text-primary-600">(girişli)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      @{u.username} · {ROLE_LABELS[u.role]}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitch(u)}
                  disabled={isCurrent || isSwitching}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSwitching ? (
                    'Geçiş yapılıyor...'
                  ) : isCurrent ? (
                    'Girişli'
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Giriş yap
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
