import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bell, Wrench, Check, Loader2, MessageCircle, Send } from 'lucide-react';
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
const statusLabels = { OPEN: 'Açık', ACKNOWLEDGED: 'Okundu', RESOLVED: 'Çözüldü' };

const tools = (r) => (Array.isArray(r.toolsRequired) ? r.toolsRequired : []);

export function AlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [updating, setUpdating] = useState(false);
  /** Tamamlanan adımların id'leri */
  const [completedSteps, setCompletedSteps] = useState(new Set());
  /** Adım bazlı geri bildirim: { stepId: { isOpen, message, aiResponse, loading } } */
  const [stepFeedback, setStepFeedback] = useState({});

  useEffect(() => {
    api.alerts.get(id).then(setAlert).catch(console.error);
  }, [id]);

  // Uyarı id'si değiştiğinde tamamlanan adımları ve geri bildirimi sıfırla
  useEffect(() => {
    if (!id) return;
    try {
      const raw = window.localStorage.getItem(`alert_${id}_completed_steps`);
      setCompletedSteps(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setCompletedSteps(new Set());
    }
    setStepFeedback({});
  }, [id]);

  useEffect(() => {
    if (id) {
      try {
        window.localStorage.setItem(`alert_${id}_completed_steps`, JSON.stringify([...completedSteps]));
      } catch {
        // ignore
      }
    }
  }, [id, completedSteps]);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      const updated = await api.alerts.update(id, { status });
      setAlert(updated);
    } finally {
      setUpdating(false);
    }
  };

  const toggleStepComplete = (stepId) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const openStepFeedback = (stepId) => {
    setStepFeedback((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], isOpen: true, message: '', aiResponse: null, loading: false },
    }));
  };

  const closeStepFeedback = (stepId) => {
    setStepFeedback((prev) => {
      const { [stepId]: _, ...rest } = prev;
      return rest;
    });
  };

  const setStepFeedbackMessage = (stepId, message) => {
    setStepFeedback((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], message },
    }));
  };

  const sendStepFeedbackToAi = async (stepId, resolution, resolutions, stepIndex) => {
    const fb = stepFeedback[stepId];
    if (!fb?.message?.trim()) return;

    setStepFeedback((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], loading: true, aiResponse: null },
    }));

    const completedList = resolutions
      .filter((r) => completedSteps.has(r.id))
      .map((r) => `Adım ${r.stepOrder}: ${r.title} (Gerekli: ${tools(r).join(', ') || 'yok'})`)
      .join('\n');

    const question = `[UYARI ÇÖZÜM BAĞLAMI]
Hata kodu: ${alert.faultCode?.code || ''} - ${alert.faultCode?.title || ''}
Makine: ${alert.machine?.name || ''}

TAMAMLANAN ADIMLAR (başarıyla yapıldı):
${completedList || '(henüz yok)'}

SORUN YAŞANAN ADIM:
Adım ${resolution.stepOrder}: ${resolution.title}
Açıklama: ${resolution.description || ''}
Gerekli malzemeler/aletler: ${tools(resolution).join(', ') || 'belirtilmemiş'}

KULLANICI GERİ BİLDİRİMİ:
${fb.message.trim()}

Bu adımda alternatif çözüm öner (ör: farklı anahtar boyutu, alternatif yöntem). Kısa ve net cevap ver.`;

    try {
      const response = await api.ai.query({
        question,
        mode: 'short',
        machineId: alert.machine?.id,
      });
      const ai = response.ai || {};
      const answer = ai.short_answer || ai.detailed_answer || 'Yanıt alınamadı.';

      setStepFeedback((prev) => ({
        ...prev,
        [stepId]: {
          ...prev[stepId],
          loading: false,
          aiResponse: answer,
        },
      }));
    } catch (err) {
      setStepFeedback((prev) => ({
        ...prev,
        [stepId]: {
          ...prev[stepId],
          loading: false,
          aiResponse: `Hata: ${err.message}. Lütfen tekrar deneyin.`,
        },
      }));
    }
  };

  if (!alert) return <p className="text-slate-500">Yükleniyor...</p>;

  const resolutions = alert.faultCode?.resolutions || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-500" />
              {alert.faultCode?.code} - {alert.faultCode?.title}
            </h1>
            <p className="text-slate-500 mt-1">
              {alert.machine?.name} • {new Date(alert.createdAt).toLocaleString('tr-TR')}
            </p>
            {alert.faultCode?.responsibleRole && (
              <p className="text-sm text-slate-600 mt-1">
                Sorumlu: <span className="font-medium">{roleLabels[alert.faultCode.responsibleRole] || alert.faultCode.responsibleRole}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${severityColors[alert.severity] || severityColors.INFO}`}>
              {severityLabels[alert.severity] || alert.severity}
            </span>
            <span className="text-sm text-slate-600">{statusLabels[alert.status]}</span>
          </div>
        </div>
        {alert.message && <p className="text-slate-600 mb-4">{alert.message}</p>}
        {alert.status !== 'RESOLVED' && (
          <div className="flex gap-2">
            {alert.status === 'OPEN' && (
              <button
                onClick={() => updateStatus('ACKNOWLEDGED')}
                disabled={updating}
                className="px-5 py-3 bg-amber-100 text-amber-800 text-base font-medium rounded-lg hover:bg-amber-200 disabled:opacity-50 min-h-[44px]"
              >
                Okundu işaretle
              </button>
            )}
            <button
              onClick={() => updateStatus('RESOLVED')}
              disabled={updating}
              className="px-5 py-3 bg-green-600 text-white text-base font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 min-h-[44px]"
            >
              Çözüldü işaretle
            </button>
          </div>
        )}
      </div>

      {resolutions.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Çözüm Adımları
          </h2>
          <div className="space-y-4">
            {resolutions.map((r, idx) => {
              const stepId = r.id ?? `step-${r.stepOrder ?? idx}`;
              const isCompleted = completedSteps.has(stepId);
              const fb = stepFeedback[stepId];

              return (
                <div
                  key={stepId}
                  className={`bg-white rounded-xl border p-4 transition-colors ${
                    isCompleted ? 'border-green-200 bg-green-50/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleStepComplete(stepId)}
                      className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                      aria-label={isCompleted ? 'Tamamlandı işaretini kaldır' : 'Tamamlandı olarak işaretle'}
                    >
                      {isCompleted && <Check className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className="font-medium text-slate-800">
                          Adım {r.stepOrder}: {r.title}
                        </span>
                        {r.estimatedMinutes != null && (
                          <span className="text-sm text-slate-500">~{r.estimatedMinutes} dk</span>
                        )}
                      </div>
                      {r.description && <p className="text-sm text-slate-600 mb-2">{r.description}</p>}
                      {tools(r).length > 0 && (
                        <p className="text-sm text-slate-500">Gerekli: {tools(r).join(', ')}</p>
                      )}

                      {!fb?.isOpen ? (
                        <button
                          type="button"
                          onClick={() => openStepFeedback(stepId)}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800 font-medium"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Sorun yaşadım / Yardım al
                        </button>
                      ) : (
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                          <p className="text-sm font-medium text-slate-700">Geri bildiriminizi yazın (örn: 7&apos;lik anahtar yok, 9&apos;luk ile denedim sıktım ama işe yaramadı)</p>
                          <textarea
                            value={fb.message ?? ''}
                            onChange={(e) => setStepFeedbackMessage(stepId, e.target.value)}
                            placeholder="Bu adımda ne denediniz, ne oldu?"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                            rows={2}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => sendStepFeedbackToAi(stepId, r, resolutions, idx)}
                              disabled={fb.loading || !(fb.message ?? '').trim()}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {fb.loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              AI&apos;a sor
                            </button>
                            <button
                              type="button"
                              onClick={() => closeStepFeedback(stepId)}
                              className="text-sm text-slate-600 hover:text-slate-800"
                            >
                              İptal
                            </button>
                          </div>
                          {fb.aiResponse && (
                            <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                              <p className="text-xs font-medium text-primary-800 mb-1">Yapay zeka önerisi</p>
                              <p className="text-sm text-slate-800 whitespace-pre-wrap">{fb.aiResponse}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p>
        <Link to="/fault-codes" className="text-primary-600 hover:underline text-sm">
          ← Hata kodlarına dön
        </Link>
      </p>
    </div>
  );
}
