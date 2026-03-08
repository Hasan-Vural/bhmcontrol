import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Plus } from 'lucide-react';
import { api } from '../api/client';

export function Machines() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.machines.list().then(setMachines).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Yükleniyor...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Makineler</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" />
          Yeni
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Makine</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Tip</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Konum</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Açık Uyarı</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4">
                  <Link to={`/machines/${m.id}`} className="font-medium text-primary-600 hover:underline">
                    {m.name}
                  </Link>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">
                  {m.type === 'electrical' ? 'Elektriksel' : 'Hidrolik'}
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{m.location || '-'}</td>
                <td className="py-3 px-4">
                  {m._count?.alerts > 0 ? (
                    <span className="text-red-600 font-medium">{m._count.alerts}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Link
                    to={`/machines/${m.id}`}
                    className="text-sm text-primary-600 hover:underline"
                  >
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
