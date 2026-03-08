import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Bot, Loader2 } from 'lucide-react';

const modes = [
  { id: 'short', label: 'Kısa Cevap' },
  { id: 'detailed', label: 'Detaylı Cevap' },
  { id: 'work_order', label: 'İş Emri Modu' },
];

export function AiConsole() {
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [mode, setMode] = useState('short');
  const [question, setQuestion] = useState('');
  const [autoCreateWorkOrder, setAutoCreateWorkOrder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [workOrderId, setWorkOrderId] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null);

  useEffect(() => {
    api.machines
      .list()
      .then((list) => setMachines(list))
      .catch((e) => console.error(e));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSessionId(null);
    setWorkOrderId(null);
    setFeedbackStatus(null);

    try {
      const body = {
        question: question.trim(),
        mode,
        machineId: machineId || null,
        autoCreateWorkOrder: mode === 'work_order' ? autoCreateWorkOrder : false,
        userId: null,
      };
      const response = await api.ai.query(body);
      setResult(response.ai);
      setSessionId(response.sessionId);
      setWorkOrderId(response.workOrderId);
    } catch (err) {
      setError(err.message || 'AI sorgusu sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (resultValue) => {
    if (!sessionId || loading) return;
    try {
      setFeedbackStatus('saving');
      await api.ai.feedback({
        aiSessionId: sessionId,
        result: resultValue,
        comment: null,
      });
      setFeedbackStatus(resultValue);
    } catch (err) {
      console.error(err);
      setFeedbackStatus('error');
    }
  };

  const currentMachine = machines.find((m) => m.id === machineId);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Bakım AI Konsolu</h1>
          <p className="text-sm text-slate-500 mt-1">
            Hata kodu veya arıza açıklamasına göre kısa/detaylı cevap al, gerekirse otomatik iş emri aç.
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
        {/* Sorgu paneli */}
        <div className="border-r border-slate-200 bg-white p-6 overflow-auto">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Makine</label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Seçilmedi</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mod</label>
              <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium ${
                      mode === m.id ? 'bg-white text-primary-700 shadow-sm border border-primary-200' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Soru / Arıza Açıklaması</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder='Örn: "E202 hatası veriyor, makine durdu. Ne yapmalıyım?"'
                rows={5}
                className="w-full resize-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {mode === 'work_order' && (
              <div className="flex items-center gap-2">
                <input
                  id="autoWO"
                  type="checkbox"
                  checked={autoCreateWorkOrder}
                  onChange={(e) => setAutoCreateWorkOrder(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="autoWO" className="text-sm text-slate-700">
                  Cevaba göre otomatik iş emri aç
                </label>
              </div>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              <span>Sorgula</span>
            </button>

            {currentMachine && (
              <p className="text-xs text-slate-500">
                Seçili makine: <span className="font-medium">{currentMachine.name}</span>
              </p>
            )}
          </form>
        </div>

        {/* Sonuç paneli */}
        <div className="bg-slate-50 p-6 overflow-auto">
          {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <Bot className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm mb-1">Sağ tarafta sonuçlar burada görünecek.</p>
              <p className="text-xs max-w-sm">
                Hata kodu (örn. E202) veya arıza açıklamasını girerek kısa/detaylı cevap alabilir, iş emri modunda otomatik iş emri taslağı
                oluşturabilirsin.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-primary-600" />
                  <h2 className="text-sm font-semibold text-slate-800">AI Cevabı</h2>
                  {result.error_code && (
                    <span className="ml-auto text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {result.error_code}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{result.short_answer}</p>
                {result.detailed_answer && (
                  <details className="mt-3">
                    <summary className="text-xs text-primary-600 cursor-pointer">Detaylı cevabı göster</summary>
                    <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{result.detailed_answer}</div>
                  </details>
                )}
              </div>

              {result.work_order_suggestion && (
                <div className="bg-white border border-primary-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Önerilen İş Emri Taslağı</h3>
                  <p className="text-sm font-medium text-slate-800 mb-1">{result.work_order_suggestion.title}</p>
                  {result.work_order_suggestion.estimated_duration_min != null && (
                    <p className="text-xs text-slate-500 mb-2">
                      Tahmini süre: {result.work_order_suggestion.estimated_duration_min} dakika
                    </p>
                  )}
                  {result.work_order_suggestion.steps?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-slate-600 mb-1">Adımlar:</p>
                      <ol className="list-decimal list-inside text-xs text-slate-700 space-y-1">
                        {result.work_order_suggestion.steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {result.work_order_suggestion.materials?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-slate-600 mb-1">Malzemeler:</p>
                      <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                        {result.work_order_suggestion.materials.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {workOrderId && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 inline-block mt-2">
                      İş emri oluşturuldu (ID: {workOrderId})
                    </p>
                  )}
                  {!workOrderId && mode === 'work_order' && (
                    <p className="text-xs text-slate-500 mt-2">
                      Bu taslağı kullanarak manuel olarak da iş emri açabilirsiniz. (Otomatik açma kutucuğunu işaretlerseniz backend iş emri
                      oluşturur.)
                    </p>
                  )}
                </div>
              )}

              {sessionId && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Oturum ID: <span className="font-mono">{sessionId}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Çözüm işe yaradı mı?</span>
                    <button
                      type="button"
                      onClick={() => sendFeedback('SUCCESS')}
                      disabled={feedbackStatus === 'saving'}
                      className={`text-xs px-2 py-1 rounded border ${
                        feedbackStatus === 'SUCCESS'
                          ? 'bg-green-600 text-white border-green-700'
                          : 'border-slate-300 text-slate-700 hover:bg-green-50'
                      }`}
                    >
                      Evet
                    </button>
                    <button
                      type="button"
                      onClick={() => sendFeedback('FAIL')}
                      disabled={feedbackStatus === 'saving'}
                      className={`text-xs px-2 py-1 rounded border ${
                        feedbackStatus === 'FAIL'
                          ? 'bg-red-600 text-white border-red-700'
                          : 'border-slate-300 text-slate-700 hover:bg-red-50'
                      }`}
                    >
                      Hayır
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

