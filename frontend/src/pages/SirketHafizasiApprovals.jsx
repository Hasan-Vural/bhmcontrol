import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Check, X, FileCheck } from 'lucide-react';

export function SirketHafizasiApprovals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const list = await api.sirketHafizasi.pending();
        if (!cancelled) {
          setItems(list);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Kayıtlar yüklenemedi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = items[0] || null;

  const handleApprove = async (id) => {
    try {
      await api.sirketHafizasi.approve(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      alert(`Onaylanamadı: ${e.message}`);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Red sebebi (opsiyonel):') || undefined;
    try {
      await api.sirketHafizasi.reject(id, reason);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      alert(`Reddedilemedi: ${e.message}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <FileCheck className="w-5 h-5 text-primary-600" />
        <h1 className="text-lg font-semibold text-slate-800">Saha Çözümü Onay Paneli</h1>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Meyrem&apos;in CLI akışındaki &quot;yetkili girişi&quot; adımının web arayüzü. Buradan
        saha mühendislerinin kaydettiği çözümleri onaylayabilir veya reddedebilirsiniz.
      </p>
      {loading && <p className="text-sm text-slate-500">Kayıtlar yükleniyor...</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {!loading && !current && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Şu anda onay bekleyen saha çözümü kaydı bulunmuyor.
        </div>
      )}
      {current && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold text-slate-800">Hata Kodu:</span>{' '}
              <span className="font-mono">{current.faultCode}</span>
            </div>
            <div className="text-xs text-slate-500">
              Kaydeden:{' '}
              <span className="font-medium">
                {current.createdBy?.name || current.createdBy?.email || 'Bilinmiyor'}
              </span>{' '}
              ·{' '}
              {new Date(current.createdAt).toLocaleString('tr-TR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </div>
          </div>
          {current.equipmentName && (
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Ekipman:</span> {current.equipmentName}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Problem Tanımı</p>
            <div className="text-sm text-slate-800 whitespace-pre-wrap border border-slate-100 rounded-md px-3 py-2 bg-slate-50">
              {current.problem}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Çözüm Adımları</p>
            <div className="text-sm text-slate-800 whitespace-pre-wrap border border-slate-100 rounded-md px-3 py-2 bg-slate-50">
              {current.solution}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Kalan kayıt sayısı: <span className="font-medium">{items.length}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleReject(current.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
              >
                <X className="w-3 h-3" />
                Reddet
              </button>
              <button
                type="button"
                onClick={() => handleApprove(current.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700"
              >
                <Check className="w-3 h-3" />
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

