import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Gauge, Thermometer, Activity, Wind, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { usePoll } from '../hooks/usePoll';

const sensorIcons = { pressure: Gauge, temperature: Thermometer, vibration: Activity, gasFlow: Wind };
const sensorLabels = { pressure: 'Basınç', temperature: 'Sıcaklık', vibration: 'Titreşim', gasFlow: 'Gaz Akışı' };
const sensorIconColors = {
  pressure: 'text-primary-500',
  temperature: 'text-orange-500',
  vibration: 'text-emerald-500',
  gasFlow: 'text-cyan-500',
};

function formatValue(value, unit) {
  if (typeof value !== 'number') return `${value} ${unit}`;
  if (value >= 1000) return `${Math.round(value).toLocaleString('tr-TR')} ${unit}`;
  if (value >= 100) return `${value.toFixed(1)} ${unit}`;
  if (value >= 1) return `${value.toFixed(2)} ${unit}`;
  return `${value.toFixed(2)} ${unit}`;
}

export function MachineDetail() {
  const { id } = useParams();
  const [machine, setMachine] = useState(null);
  const { data: readings } = usePoll(() => api.sensorMock.latestByMachine(id), 6000, [id]);

  useEffect(() => {
    api.machines.get(id).then(setMachine).catch(console.error);
  }, [id]);

  if (!machine) return <p className="text-slate-500">Yükleniyor...</p>;

  const typeLabel = machine.type === 'electrical' ? 'Elektriksel' : 'Hidrolik Pres';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">{machine.name}</h1>
        <p className="text-sm text-slate-500">
          {typeLabel} • {machine.location || 'Konum yok'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(readings || []).map((r) => {
          const Icon = sensorIcons[r.type];
          const iconColor = sensorIconColors[r.type] || 'text-primary-500';
          return (
            <div
              key={r.type}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-md hover:shadow-lg hover:border-primary-200 transition-all duration-200"
            >
              {Icon && <Icon className={`w-8 h-8 shrink-0 ${iconColor}`} />}
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-800 truncate">
                  {formatValue(r.value, r.unit)}
                </p>
                <p className="text-sm text-slate-500">{sensorLabels[r.type] || r.type}</p>
              </div>
            </div>
          );
        })}
      </div>

      {machine.alerts?.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-slate-800 mb-3">Açık Uyarılar</h2>
          <div className="space-y-2">
            {machine.alerts.map((alert) => (
              <Link
                key={alert.id}
                to={`/alerts/${alert.id}`}
                className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-primary-200 hover:shadow-md transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="font-medium">{alert.faultCode?.code} - {alert.faultCode?.title}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : alert.severity === 'HIGH'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <span className="text-sm text-slate-500">Detay →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
