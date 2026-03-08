import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
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
const roleLabels = {
  electrical_maintenance: 'Elektrik Bakım',
  hydraulic_maintenance: 'Hidrolik Bakım',
  periodic_maintenance: 'Periyodik Bakım',
  general: 'Genel',
};

export function FaultCodeDetail() {
  const { id } = useParams();
  const [faultCode, setFaultCode] = useState(null);

  useEffect(() => {
    api.faultCodes.get(id).then(setFaultCode).catch(console.error);
  }, [id]);

  if (!faultCode) return <p className="text-slate-500">Yükleniyor...</p>;

  const tools = (r) => (Array.isArray(r.toolsRequired) ? r.toolsRequired : []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-slate-800">{faultCode.code} - {faultCode.title}</h1>
          <span className={`text-xs px-2 py-1 rounded ${severityColors[faultCode.severity] || severityColors.INFO}`}>
            {severityLabels[faultCode.severity] || faultCode.severity}
          </span>
        </div>
        {faultCode.description && (
          <p className="text-slate-600">{faultCode.description}</p>
        )}
        {faultCode.responsibleRole && (
          <p className="text-sm text-slate-600 mt-2">
            Sorumlu: <span className="font-medium">{roleLabels[faultCode.responsibleRole] || faultCode.responsibleRole}</span>
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Çözüm Adımları
        </h2>
        <div className="space-y-4">
          {faultCode.resolutions?.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-800">Adım {r.stepOrder}: {r.title}</span>
                {r.estimatedMinutes != null && (
                  <span className="text-sm text-slate-500">~{r.estimatedMinutes} dk</span>
                )}
              </div>
              {r.description && <p className="text-sm text-slate-600 mb-2">{r.description}</p>}
              {tools(r).length > 0 && (
                <p className="text-sm text-slate-500">
                  Gerekli: {tools(r).join(', ')}
                </p>
              )}
            </div>
          ))}
          {(!faultCode.resolutions || faultCode.resolutions.length === 0) && (
            <p className="text-slate-500">Henüz adım tanımlanmamış.</p>
          )}
        </div>
      </div>
    </div>
  );
}
