import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';
import { api } from '../api/client';

const severityColors = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  INFO: 'bg-blue-100 text-blue-700',
};
const severityLabels = {
  CRITICAL: 'Kritik',
  HIGH: 'Yüksek',
  MEDIUM: 'Orta',
  INFO: 'Bilgi',
};

export function FaultCodes() {
  const [faultCodes, setFaultCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ severity: '', category: '' });

  useEffect(() => {
    const params = {};
    if (filter.severity) params.severity = filter.severity;
    if (filter.category) params.category = filter.category;
    api.faultCodes
      .list(Object.keys(params).length ? params : undefined)
      .then(setFaultCodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter.severity, filter.category]);

  if (loading) return <p className="text-slate-500">Yükleniyor...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Hata Kodları</h1>
        <button className="inline-flex items-center gap-2 px-5 py-3 bg-primary-600 text-white text-base font-medium rounded-lg hover:bg-primary-700 min-h-[44px]">
          <Plus className="w-5 h-5" />
          Yeni
        </button>
      </div>
      <div className="flex gap-2">
        <select
          value={filter.severity}
          onChange={(e) => setFilter((f) => ({ ...f, severity: e.target.value }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">Tüm şiddet</option>
          <option value="CRITICAL">Kritik</option>
          <option value="HIGH">Yüksek</option>
          <option value="MEDIUM">Orta</option>
          <option value="INFO">Bilgi</option>
        </select>
        <input
          type="text"
          placeholder="Kategori filtrele"
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white w-48"
        />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Kod</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Başlık</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Şiddet</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Kategori</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Adımlar</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {faultCodes.map((fc) => (
              <tr key={fc.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 font-mono text-sm">{fc.code}</td>
                <td className="py-3 px-4 font-medium text-slate-800">{fc.title}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded ${severityColors[fc.severity] || severityColors.INFO}`}>
                    {severityLabels[fc.severity] || fc.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{fc.category || '-'}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{fc._count?.resolutions ?? 0}</td>
                <td className="py-3 px-4">
                  <Link to={`/fault-codes/${fc.id}`} className="text-sm text-primary-600 hover:underline">
                    Detay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
