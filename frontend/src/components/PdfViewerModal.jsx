import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { KaynakChatPanel } from './KaynakChatPanel';

export function PdfViewerModal({
  isOpen,
  onClose,
  source,
  initialPage = 1,
  label = '',
  attachments = [],
  currentIndex = 0,
  onNavigate,
}) {
  const currentAtt = attachments.length ? attachments[currentIndex] : null;
  const effectiveSource = currentAtt?.source ?? source;
  const effectivePage = currentAtt ? Math.max(1, parseInt(currentAtt.page ?? currentAtt.sayfa ?? 1, 10) || 1) : initialPage;
  const effectiveLabel = currentAtt?.label ?? label ?? source ?? 'PDF Görüntüleyici';
  const canPrev = attachments.length > 1 && currentIndex > 0;
  const canNext = attachments.length > 1 && currentIndex < attachments.length - 1;

  const [resolveUrl, setResolveUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPdf = useCallback(async () => {
    if (!effectiveSource || !isOpen) return;
    setLoading(true);
    setError(null);
    setResolveUrl(null);
    try {
      const r = await api.docsPublicResolve(effectiveSource, effectivePage);
      if (!r.ok) {
        setError(r.error || 'Dosya bulunamadı.');
        setLoading(false);
        return;
      }
      setResolveUrl(r.url);
    } catch (e) {
      setError(e.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }, [effectiveSource, effectivePage, isOpen]);

  useEffect(() => {
    if (isOpen && effectiveSource) {
      loadPdf();
    } else {
      setResolveUrl(null);
      setError(null);
    }
  }, [isOpen, effectiveSource, loadPdf]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleOpenInNewTab = () => {
    const url = resolveUrl || (effectiveSource ? api.docsPublicOpenUrl(effectiveSource, effectivePage) : null);
    if (url) window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - daha temiz */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
          <h2 id="pdf-modal-title" className="truncate flex-1 mr-4 text-sm font-semibold text-slate-800">
            {effectiveLabel}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Daha detaylı incele
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* İçerik alanı: Sol PDF (~65%), Sağ KaynakChatPanel (~35%) */}
        <div className="flex flex-1 overflow-hidden relative min-h-[60vh]">
          {/* Sol PDF alanı */}
          <div className="flex-[0_0_65%] min-w-0 flex flex-col overflow-hidden relative">
          {/* Sol ok */}
          {canPrev && onNavigate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:shadow-xl transition-all"
              aria-label="Önceki kaynak"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {/* Sağ ok */}
          {canNext && onNavigate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:shadow-xl transition-all"
              aria-label="Sonraki kaynak"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* PDF iframe - tarayıcı yerleşik görüntüleyicisi, worker sorunu yok */}
          <div className="flex-1 overflow-hidden bg-slate-100 p-4">
            {loading && (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <p className="text-sm text-slate-500">PDF yükleniyor...</p>
                </div>
              </div>
            )}
            {error && !resolveUrl && (
              <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl bg-amber-50/80 p-8 text-center">
                <p className="text-sm text-amber-800">{error}</p>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Tarayıcıda aç
                </button>
              </div>
            )}
            {resolveUrl && !loading && (
              <iframe
                src={resolveUrl}
                title={effectiveLabel}
                className="w-full h-[70vh] min-h-[500px] border-0 rounded-xl bg-white shadow-inner"
              />
            )}
          </div>
          </div>
          {/* Sağ: Kaynak Chat Paneli */}
          <KaynakChatPanel
            documentName={effectiveSource}
            currentPage={effectivePage}
          />
        </div>
      </div>
    </div>
  );
}
