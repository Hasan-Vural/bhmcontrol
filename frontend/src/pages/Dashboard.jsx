import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Thermometer, Activity, Wind, AlertCircle, Bell } from 'lucide-react';
import { api } from '../api/client';
import { usePoll } from '../hooks/usePoll';

const sensorIcons = {
  pressure: Gauge,
  temperature: Thermometer,
  vibration: Activity,
  gasFlow: Wind,
};

const sensorLabels = {
  pressure: 'Basınç',
  temperature: 'Sıcaklık',
  vibration: 'Titreşim',
  gasFlow: 'Gaz Akışı',
};

const severityColors = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  INFO: 'bg-blue-100 text-blue-700 border-blue-200',
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

export function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const { data: sensorData } = usePoll(api.sensorMock.latest, 6000);

  useEffect(() => {
    api.machines.list().then(setMachines).catch(console.error);
  }, []);

  const { data: countData } = usePoll(() => api.alerts.count({ status: 'OPEN' }), 5000);
  useEffect(() => {
    if (countData?.count != null) setAlertCount(countData.count);
  }, [countData]);

  // Açık alert'leri al
  const { data: openAlerts } = usePoll(() => api.alerts.list({ status: 'OPEN' }), 5000);
  const alertsList = openAlerts || [];

  // Severity bazlı sayıları hesapla
  const severityCounts = {
    CRITICAL: alertsList.filter((a) => a.severity === 'CRITICAL').length,
    HIGH: alertsList.filter((a) => a.severity === 'HIGH').length,
    MEDIUM: alertsList.filter((a) => a.severity === 'MEDIUM').length,
    INFO: alertsList.filter((a) => a.severity === 'INFO').length,
  };

  const machineIds = machines.map((m) => m.id);
  const readingsByMachine = sensorData || {};
  const totalMachines = machines.length;
  const byType = {
    pressure: totalMachines,
    temperature: totalMachines,
    vibration: totalMachines,
    gasFlow: totalMachines,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Pres Hatları</h1>
        <div className="flex gap-2">
          <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
            <option>Son 7 gün</option>
            <option>Son 30 gün</option>
          </select>
          <button className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50">
            Yenile
          </button>
        </div>
      </div>

      {/* Alert Özeti */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-slate-800">Açık Uyarılar</h2>
          <span className="text-sm text-slate-500">({alertCount} toplam)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-lg border-2 p-4 ${severityColors.CRITICAL}`}>
            <p className="text-2xl font-bold">{severityCounts.CRITICAL}</p>
            <p className="text-sm font-medium">Kritik</p>
          </div>
          <div className={`rounded-lg border-2 p-4 ${severityColors.HIGH}`}>
            <p className="text-2xl font-bold">{severityCounts.HIGH}</p>
            <p className="text-sm font-medium">Yüksek</p>
          </div>
          <div className={`rounded-lg border-2 p-4 ${severityColors.MEDIUM}`}>
            <p className="text-2xl font-bold">{severityCounts.MEDIUM}</p>
            <p className="text-sm font-medium">Orta</p>
          </div>
          <div className={`rounded-lg border-2 p-4 ${severityColors.INFO}`}>
            <p className="text-2xl font-bold">{severityCounts.INFO}</p>
            <p className="text-sm font-medium">Bilgi</p>
          </div>
        </div>
        {alertsList.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Son Açık Uyarılar</h3>
            {alertsList.slice(0, 5).map((alert) => (
              <Link
                key={alert.id}
                to={`/alerts/${alert.id}`}
                className="block p-3 rounded-lg border border-slate-200 hover:border-primary-200 hover:bg-primary-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium">{alert.faultCode?.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${severityColors[alert.severity] || severityColors.INFO}`}>
                        {severityLabels[alert.severity] || alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium">{alert.faultCode?.title || alert.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{alert.machine?.name}</span>
                      {alert.faultCode?.responsibleRole && (
                        <span>• {roleLabels[alert.faultCode.responsibleRole] || alert.faultCode.responsibleRole}</span>
                      )}
                      <span>• {new Date(alert.createdAt).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 ml-2" />
                </div>
              </Link>
            ))}
            {alertsList.length > 5 && (
              <Link
                to="/alerts?status=OPEN"
                className="block text-center text-sm text-primary-600 hover:underline py-2"
              >
                Tümünü görüntüle ({alertsList.length})
              </Link>
            )}
          </div>
        )}
        {alertsList.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Açık uyarı bulunmuyor</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-800">{totalMachines}</p>
            <p className="text-sm text-slate-500">Toplam Makine</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-800">{byType.pressure}</p>
            <p className="text-sm text-slate-500">Basınç</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <Thermometer className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-800">{byType.temperature}</p>
            <p className="text-sm text-slate-500">Sıcaklık</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-800">{byType.vibration}</p>
            <p className="text-sm text-slate-500">Titreşim</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
            <Wind className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-800">{byType.gasFlow}</p>
            <p className="text-sm text-slate-500">Gaz Akışı</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map((machine) => {
          const readings = readingsByMachine[machine.id] || [];
          const openAlerts = machine._count?.alerts ?? 0;
          return (
            <Link
              key={machine.id}
              to={`/machines/${machine.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary-200 hover:shadow-md transition-all block shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">{machine.name}</h3>
                {openAlerts > 0 && (
                  <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {openAlerts} Uyarı
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {readings.map((r) => {
                  const Icon = sensorIcons[r.type];
                  return (
                    <div key={r.type} className="flex items-center gap-2 text-sm text-slate-600">
                      {Icon && <Icon className="w-4 h-4 text-slate-400" />}
                      <span>
                        {typeof r.value === 'number' ? (r.value % 1 === 0 ? r.value : r.value.toFixed(1)) : r.value} {r.unit} {sensorLabels[r.type] || r.type}
                      </span>
                    </div>
                  );
                })}
                {readings.length === 0 && (
                  <p className="text-sm text-slate-400">Sensör verisi yükleniyor...</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
