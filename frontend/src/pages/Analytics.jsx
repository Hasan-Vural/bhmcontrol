import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { BarChart2, Activity, TrendingUp, Clock } from 'lucide-react';

export function Analytics() {
  const [overview, setOverview] = useState(null);
  const [machineRanking, setMachineRanking] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    Promise.all([
      api.analytics.overview({ since: sinceIso }),
      api.analytics.machineRanking({ since: sinceIso }),
      api.analytics.aiUsage({ since: sinceIso }),
    ])
      .then(([ov, rank, ai]) => {
        setOverview(ov);
        setMachineRanking(rank);
        setAiUsage(ai);
      })
      .catch((e) => setError(e.message || 'Raporlar yüklenirken hata oluştu.'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Bakım Raporları</h1>
          <p className="text-sm text-slate-500 mt-1">Son 30 güne ait arıza, iş emri ve AI kullanım özetleri.</p>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {/* Özet kartlar */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Toplam İş Emri</p>
              <p className="text-2xl font-semibold text-slate-800">{overview.workOrders.total}</p>
              <p className="text-xs text-slate-500">
                Açık: <span className="font-medium">{overview.workOrders.open}</span>
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Ortalama Kapanma Süresi</p>
              <p className="text-2xl font-semibold text-slate-800">
                {overview.workOrders.avgCloseMinutes != null ? `${overview.workOrders.avgCloseMinutes} dk` : '—'}
              </p>
              <p className="text-xs text-slate-500">Sadece kapatılmış iş emirleri için</p>
            </div>
          </div>
          {aiUsage && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Toplam AI Oturumu</p>
                <p className="text-2xl font-semibold text-slate-800">{aiUsage.totalSessions}</p>
                <p className="text-xs text-slate-500">
                  İş Emri Modu:{' '}
                  <span className="font-medium">{aiUsage.byMode?.WORK_ORDER != null ? aiUsage.byMode.WORK_ORDER : 0}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* En çok hata veren makineler ve hata kodları */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-800">En Çok Hata Veren Makineler</h2>
          </div>
          {!overview?.topFaultMachines?.length && (
            <p className="text-xs text-slate-500">Son dönemde kayıtlı arıza bulunmuyor.</p>
          )}
          <ul className="space-y-1">
            {overview?.topFaultMachines?.map((m) => (
              <li key={m.machineId} className="flex items-center justify-between text-xs text-slate-700">
                <span>{m.machineName}</span>
                <span className="font-mono">{m.faultCount}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-800">En Sık Görülen Hata Kodları</h2>
          </div>
          {!overview?.topFaultCodes?.length && (
            <p className="text-xs text-slate-500">Son dönemde kayıtlı arıza kodu bulunmuyor.</p>
          )}
          <ul className="space-y-1">
            {overview?.topFaultCodes?.map((fc) => (
              <li key={fc.faultCodeId} className="flex items-center justify-between text-xs text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="font-mono">{fc.code}</span>
                  <span className="text-slate-500">{fc.title}</span>
                </span>
                <span className="font-mono">{fc.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Makine sıralaması */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-800">Makine Sıralaması (Arıza Sayısına Göre)</h2>
        </div>
        {!machineRanking.length && <p className="text-xs text-slate-500">Veri bulunmuyor.</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="text-left py-2 pr-4">Makine</th>
                <th className="text-right py-2">Arıza Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {machineRanking.map((row) => (
                <tr key={row.machineId} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-4 text-slate-700">{row.machineName}</td>
                  <td className="py-1.5 text-right font-mono text-slate-800">{row.faultCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

