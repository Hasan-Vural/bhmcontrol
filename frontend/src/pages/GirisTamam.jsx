import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, LogOut } from 'lucide-react';

export function GirisTamam() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {(user?.name || user?.username || '?')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Giriş yapıldı</p>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              {user?.name || user?.username || user?.email || 'Hesap'}
            </h1>
            {user?.username && (
              <p className="text-sm text-slate-500 dark:text-slate-400">@{user.username}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 dark:bg-primary-500 text-white font-medium hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            Panele Git
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
