import { Link } from 'react-router-dom';
import { Home, FileQuestion } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-8">
          <FileQuestion className="w-14 h-14" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-800 dark:text-slate-100 mb-3">
          Sayfa bulunamadı
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir. Ana sayfaya dönerek devam edebilirsiniz.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-3 px-6 py-3 text-lg rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Home className="w-5 h-5" />
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
