import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Cpu, AlertTriangle, Wrench, Bell, Search, User, MessageSquare, BarChart2, FileCheck, Settings, UserCog, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/machines', icon: Cpu, label: 'Makineler' },
  { to: '/fault-codes', icon: AlertTriangle, label: 'Hata Kodları' },
  { to: '/resolutions', icon: Wrench, label: 'Çözüm Adımları' },
  { to: '/alerts', icon: Bell, label: 'Uyarılar' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chatbot' },
  { to: '/analytics', icon: BarChart2, label: 'Raporlar' },
  {
    to: '/approvals',
    icon: FileCheck,
    label: 'Saha Çözümü Onayı',
    roles: ['KIDEMLI_MUHENDIS', 'ADMIN'],
  },
  {
    to: '/admin',
    icon: Settings,
    label: 'Admin Portal',
    roles: ['ADMIN'],
  },
  { to: '/test/hesap', icon: UserCog, label: 'Test Hesaplar' },
];

const breadcrumbMap = {
  '/': 'Üretim > Üretim Katı',
  '/machines': 'Üretim > Makineler',
  '/fault-codes': 'Bakım > Hata Kodları',
  '/resolutions': 'Bakım > Çözüm Adımları',
  '/alerts': 'Bakım > Uyarılar',
  '/chat': 'AI > Chatbot',
  '/analytics': 'Bakım > Raporlar',
  '/approvals': 'Bakım > Saha Çözümü Onayı',
  '/admin': 'Yönetim > Kullanıcılar',
  '/test/hesap': 'Test > Hızlı Giriş',
  '/giris-tamam': 'Giriş Tamamlandı',
};

function getBreadcrumb(pathname) {
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname];
  if (pathname.startsWith('/machines/')) return 'Üretim > Pres Detay';
  if (pathname.startsWith('/fault-codes/')) return 'Bakım > Hata Kodu Detay';
  if (pathname.startsWith('/alerts/')) return 'Bakım > Uyarı Detay';
  return pathname.slice(1) || 'Dashboard';
}

/** Arama metnine göre en alakalı menü öğelerini döndürür (her harf için güncellenir). */
function getSearchResults(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const normalized = navItems.map((item) => ({
    ...item,
    searchText: item.label.toLowerCase(),
  }));
  const contains = normalized.filter((item) => item.searchText.includes(q));
  const startsWith = contains.filter((item) => item.searchText.startsWith(q));
  const rest = contains.filter((item) => !item.searchText.startsWith(q));
  return [...startsWith, ...rest];
}

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const breadcrumb = getBreadcrumb(location.pathname);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchResults = getSearchResults(searchQuery);
  const showDropdown = searchFocused && searchQuery.trim().length > 0;
  const searchContainerRef = useRef(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Kıdemli mühendis / admin için onay bekleyen kayıt sayısı
  useEffect(() => {
    if (!user || (user.role !== 'KIDEMLI_MUHENDIS' && user.role !== 'ADMIN')) {
      setPendingApprovals(0);
      return;
    }
    let cancelled = false;
    async function loadCount() {
      try {
        const list = await api.sirketHafizasi.pending();
        if (!cancelled) {
          setPendingApprovals(Array.isArray(list) ? list.length : 0);
        }
      } catch {
        if (!cancelled) setPendingApprovals(0);
      }
    }
    loadCount();
    const id = setInterval(loadCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  const handleSelectResult = (to) => {
    navigate(to);
    setSearchQuery('');
    setSearchFocused(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sol navigation panel */}
      <aside className="w-60 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex flex-col shrink-0 shadow-md border-r border-slate-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-wide uppercase text-slate-500">
            Bakım Destek
          </span>
          <div className="w-7 h-7 rounded-full bg-primary-100 border border-primary-300 flex items-center justify-center text-[10px] font-semibold text-primary-700">
            AI
          </div>
        </div>
        <nav className="px-2 py-3 flex-1 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
            .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-slate-700 hover:text-primary-800 dark:hover:text-primary-300'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur flex items-center gap-4 px-6 shrink-0 shadow-sm">
          <span className="text-sm text-slate-500 dark:text-slate-400">{breadcrumb}</span>
          <div className="flex-1 flex justify-center relative min-w-0 max-w-md mx-auto" ref={searchContainerRef}>
            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 w-full max-w-md shadow-inner">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="search"
                placeholder="Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="bg-transparent border-0 outline-none text-sm w-full placeholder:text-slate-400"
                autoComplete="off"
              />
            </div>
            {showDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 max-h-72 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Eşleşen sayfa bulunamadı.</div>
                ) : (
                  searchResults.map(({ to, icon: Icon, label }) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => handleSelectResult(to)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-800 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={theme === 'dark' ? 'Açık mod' : 'Koyu mod'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {user && (user.role === 'KIDEMLI_MUHENDIS' || user.role === 'ADMIN') && pendingApprovals > 0 && (
              <button
                type="button"
                onClick={() => navigate('/approvals')}
                className="relative inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-200 dark:border-amber-700"
              >
                <FileCheck className="w-3 h-3 mr-1" />
                {pendingApprovals} onay bekliyor
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-primary-700 dark:hover:text-primary-400"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium truncate max-w-[160px]">
                {user?.name || user?.username || user?.email || 'Personel'}
              </span>
            </button>
          </div>
        </header>

        <main
          className={`flex-1 ${
            location.pathname === '/chat' ? 'p-0' : 'p-6'
          } overflow-auto`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
