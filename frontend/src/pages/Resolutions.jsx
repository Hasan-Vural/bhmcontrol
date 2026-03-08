import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { api } from '../api/client';

export function Resolutions() {
  const [resolutions, setResolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faultCodeId, setFaultCodeId] = useState('');
  const [faultCodes, setFaultCodes] = useState([]);

  useEffect(() => {
    api.faultCodes.list().then(setFaultCodes).catch(console.error);
  }, []);

  useEffect(() => {
    const params = faultCodeId ? { faultCodeId } : undefined;
    api.resolutions
      .list(params)
      .then(setResolutions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [faultCodeId]);

  const tools = (r) => (Array.isArray(r.toolsRequired) ? r.toolsRequired : []);

  if (loading) return <p className="text-slate-500">Yükleniyor...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Çözüm Adımları</h1>
        <select
          value={faultCodeId}
          onChange={(e) => setFaultCodeId(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">Tüm hata kodları</option>
          {faultCodes.map((fc) => (
            <option key={fc.id} value={fc.id}>
              {fc.code} - {fc.title}
            </option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Hata Kodu</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Sıra</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Başlık</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Gerekli Malzemeler</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Tahmini Süre</th>
            </tr>
          </thead>
          <tbody>
            {resolutions.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">
                  <Link
                    to={`/fault-codes/${r.faultCode?.id || r.faultCodeId}`}
                    className="text-primary-600 hover:underline font-mono text-sm"
                  >
                    {r.faultCode?.code || r.faultCodeId}
                  </Link>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{r.stepOrder}</td>
                <td className="py-3 px-4 font-medium text-slate-800">{r.title}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{tools(r).join(', ') || '-'}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{r.estimatedMinutes != null ? `${r.estimatedMinutes} dk` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
