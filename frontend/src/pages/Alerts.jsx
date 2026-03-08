import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Plus } from 'lucide-react';
import { api } from '../api/client';
import { usePoll } from '../hooks/usePoll';

const statusLabels = { OPEN: 'Açık', ACKNOWLEDGED: 'Okundu', RESOLVED: 'Çözüldü' };
const statusColors = {
  OPEN: 'bg-red-100 text-red-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
};
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
const roleLabels = {
  electrical_maintenance: 'Elektrik Bakım',
  hydraulic_maintenance: 'Hidrolik Bakım',
  periodic_maintenance: 'Periyodik Bakım',
  general: 'Genel',
};

export function Alerts() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: alerts, loading, error } = usePoll(
    () => api.alerts.list(statusFilter ? { status: statusFilter } : undefined),
    5000
  );
  const [creating, setCreating] = useState(false);

  const handleCreateTest = () => {
    setCreating(true);
    api.alerts.createTest().then(() => setCreating(false)).catch(() => setCreating(false));
  };

  const list = alerts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Uyarılar</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">Tümü</option>
            <option value="OPEN">Açık</option>
            <option value="ACKNOWLEDGED">Okundu</option>
            <option value="RESOLVED">Çözüldü</option>
          </select>
          <button
            onClick={handleCreateTest}
            disabled={creating}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary-600 text-white text-base font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 min-h-[44px]"
          >
            <Plus className="w-5 h-5" />
            Test Uyarısı
          </button>
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && list.length === 0 && <p className="text-slate-500">Yükleniyor...</p>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-4 px-4 text-base font-medium text-slate-600">Makine</th>
              <th className="text-left py-4 px-4 text-base font-medium text-slate-600">Hata</th>
              <th className="text-left py-4 px-4 text-base font-medium text-slate-600">Şiddet</th>
              <th className="text-left py-4 px-4 text-base font-medium text-slate-600">Sorumlu</th>
              <th className="text-left py-4 px-4 text-base font-medium text-slate-600">Durum</th>
              <th className="text-left py-4 px-4 text-base font-medium text-slate-600">Tarih</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-4 px-4 font-medium text-base text-slate-800">{a.machine?.name}</td>
                <td className="py-4 px-4">
                  <span className="font-mono text-base">{a.faultCode?.code}</span>
                  <span className="text-slate-600 ml-1 text-base">- {a.faultCode?.title}</span>
                </td>
                <td className="py-4 px-4">
                  <span className={`text-sm px-2 py-1 rounded ${severityColors[a.severity] || severityColors.INFO}`}>
                    {severityLabels[a.severity] || a.severity}
                  </span>
                </td>
                <td className="py-4 px-4 text-base text-slate-600">
                  {a.faultCode?.responsibleRole ? roleLabels[a.faultCode.responsibleRole] || a.faultCode.responsibleRole : '-'}
                </td>
                <td className="py-4 px-4">
                  <span className={`text-sm px-2 py-1 rounded ${statusColors[a.status] || ''}`}>
                    {statusLabels[a.status]}
                  </span>
                </td>
                <td className="py-4 px-4 text-base text-slate-500">
                  {new Date(a.createdAt).toLocaleString('tr-TR')}
                </td>
                <td className="py-4 px-4">
                  <Link to={`/alerts/${a.id}`} className="inline-block px-3 py-2 text-base text-primary-600 hover:bg-primary-50 rounded-lg min-h-[44px] flex items-center">
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
