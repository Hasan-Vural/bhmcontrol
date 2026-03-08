import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Search, Edit2, Check, X, ExternalLink, ZoomIn, FileCheck } from 'lucide-react';
import { api } from '../api/client';
import { PdfViewerModal } from '../components/PdfViewerModal';

const modes = [
  { id: 'short', label: 'Kısa Özet' },
  { id: 'detailed', label: 'Detaylı Cevap' },
  { id: 'work_order', label: 'İş Emri' },
];

export function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('short');
  /** Hangi sohbetin yanıt beklediği (sohbet id). Sekme değişse bile fetch iptal edilmez, sadece bu sohbete özel "Düşünüyor" gösterilir. */
  const [loadingConversationId, setLoadingConversationId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showNewChatBanner, setShowNewChatBanner] = useState(false);
  const [pdfModalAtt, setPdfModalAtt] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [saveModal, setSaveModal] = useState(null);
  const messagesEndRef = useRef(null);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0];
  const messages = activeConversation?.messages || [];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime; // en güncel en üstte
  });

  const searchResults =
    normalizedSearch.length > 0
      ? sortedConversations.filter((conv) => {
          const titleMatch = (conv.title || '').toLowerCase().includes(normalizedSearch);
          const lastMessage =
            conv.messages && conv.messages.length > 0
              ? (conv.messages[conv.messages.length - 1].content || '').toLowerCase()
              : '';
          return titleMatch || lastMessage.includes(normalizedSearch);
        })
      : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sunucudan sohbetleri yükle
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoadingConversations(true);
        const list = await api.conversations.list();
        if (cancelled) return;
        setConversations(list);
        if (list.length > 0) {
          setActiveConversationId(list[0].id);
        } else {
          const now = new Date().toISOString();
          const created = await api.conversations.create({
            title: 'Sohbet 1',
            messages: [],
          });
          if (!cancelled) {
            setConversations([created]);
            setActiveConversationId(created.id);
          }
        }
      } catch (e) {
        console.error('Sohbetler yüklenemedi:', e);
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const createNewConversation = () => {
    const nextIndex = conversations.length + 1;
    api.conversations
      .create({
        title: `Sohbet ${nextIndex}`,
        messages: [],
      })
      .then((conv) => {
        setConversations((prev) => [conv, ...prev]);
        setActiveConversationId(conv.id);
      })
      .catch((e) => {
        console.error('Yeni sohbet oluşturulamadı:', e);
      });
  };

  const renameConversation = (id) => {
    const current = conversations.find((c) => c.id === id);
    if (!current) return;
    setEditingConversationId(id);
    setEditingTitle(current.title || '');
  };

  const applyRenameConversation = () => {
    const newTitle = editingTitle.trim();
    if (!editingConversationId) return;
    if (!newTitle) {
      // Boşsa sadece düzenleme modundan çık
      setEditingConversationId(null);
      setEditingTitle('');
      return;
    }

    const targetId = editingConversationId;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetId
          ? {
              ...c,
              title: newTitle,
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    );
    api.conversations.update(targetId, { title: newTitle }).catch((e) => {
      console.error('Sohbet adı güncellenemedi:', e);
    });
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const cancelRenameConversation = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const handleSend = async () => {
    const convId = activeConversationId;
    if (!input.trim() || loadingConversationId != null) return;

    const userMessage = input.trim();
    setInput('');
    let currentMessages;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const updated = {
          ...c,
          messages: [...c.messages, { role: 'user', content: userMessage }],
          updatedAt: new Date().toISOString(),
        };
        currentMessages = updated.messages;
        return updated;
      }),
    );
    if (convId) {
      api.conversations.update(convId, { messages: currentMessages }).catch((e) => {
        console.error('Sohbet kaydedilemedi:', e);
      });
    }
    setLoadingConversationId(convId);

    try {
      const body = {
        question: userMessage,
        mode,
        machineId: null,
        autoCreateWorkOrder: false, // Kullanıcıya "İş emrine eklensin mi?" sorulacak
      };
      const response = await api.ai.query(body);
      const ai = response.ai || {};

      const answerText =
        mode === 'detailed'
          ? ai.detailed_answer || ai.short_answer || 'Yanıt alınamadı.'
          : ai.short_answer || ai.detailed_answer || 'Yanıt alınamadı.';

      let newMessages;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const updated = {
            ...c,
            messages: [
              ...c.messages,
              {
                role: 'assistant',
                content: answerText,
                error_code: ai.error_code,
                mode: ai.mode || mode,
                short_answer: ai.short_answer,
                detailed_answer: ai.detailed_answer,
                work_order_suggestion: ai.work_order_suggestion,
                attachments: ai.attachments || [],
              },
            ],
            updatedAt: new Date().toISOString(),
          };
          newMessages = updated.messages;
          return updated;
        }),
      );
      if (convId) {
        api.conversations.update(convId, { messages: newMessages }).catch((e) => {
          console.error('Sohbet kaydedilemedi:', e);
        });
      }
    } catch (error) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    role: 'assistant',
                    content: `Hata: ${error.message}. Lütfen tekrar deneyin.`,
                    error: true,
                  },
                ],
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
    } finally {
      setLoadingConversationId((current) => (current === convId ? null : current));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Ek için tarayıcıda açılacak URL (görsel doğrudan; docs-public için open endpoint) */
  const getAttachmentOpenUrl = (att) => {
    if (att.type === 'image' && att.url) return att.url;
    if (att.source) return api.docsPublicOpenUrl(att.source, att.page);
    return null;
  };

  /** Tarayıcıda aç: önce resolve ile kontrol, yoksa hata mesajı (404 JSON yerine) */
  const openAttachmentInBrowser = async (att) => {
    if (att.type === 'image' && att.url) {
      window.open(att.url, '_blank');
      return;
    }
    if (!att.source) return;
    const r = await api.docsPublicResolve(att.source, att.page);
    if (r.ok) window.open(r.url, '_blank');
    else alert(r.error || 'Dosya bulunamadı. Lütfen dosyanın backend/docs-public klasöründe olduğundan emin olun.');
  };

  /** İş emri önerisini iş emrine ekle */
  const addWorkOrderFromMessage = async (convId, msgIdx) => {
    const conv = conversations.find((c) => c.id === convId);
    const msg = conv?.messages?.[msgIdx];
    const wo = msg?.work_order_suggestion;
    if (!wo?.title) return;

    const desc = Array.isArray(wo.steps)
      ? wo.steps.join('\n')
      : msg.detailed_answer || msg.short_answer || msg.content || '';

    try {
      await api.workOrders.create({
        title: wo.title,
        description: desc,
        machineId: wo.machine_id || null,
        priority: wo.priority || 'MEDIUM',
        estimatedMinutes: wo.estimated_duration_min ?? null,
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m, i) =>
                  i === msgIdx ? { ...m, workOrderAdded: true } : m,
                ),
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
    } catch (err) {
      alert(`İş emri oluşturulamadı: ${err.message}`);
    }
  };

  /** İş emri ekleme teklifini reddet */
  const markWorkOrderDeclined = (convId, msgIdx) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m, i) =>
                i === msgIdx ? { ...m, workOrderDeclined: true } : m,
              ),
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    );
  };

  return (
    <div className="flex h-full max-h-[calc(100vh-4rem)] justify-center items-stretch bg-slate-100">
      <div className="flex flex-col w-full max-w-6xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden my-6">
        {/* Chat Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">AI Chatbot Konsolu</h1>
            <p className="text-sm text-slate-500 mt-1">
              Teknik dokümantasyonlardan bilgi almak için sorularınızı yazın. Mod seçerek yanıt tipini belirleyin.
            </p>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sol: sohbet listesi (ChatGPT tarzı) */}
          <aside className="relative w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
            <div className="p-3 border-b border-slate-200 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Sohbet ara..."
                  className="w-full pl-7 pr-2 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
                />
              </div>
            </div>

            {/* Sohbet arama sonuç paneli (GPT tarzı overlay) */}
            {normalizedSearch && (
              <div className="absolute inset-x-2 top-14 z-20">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-h-80 overflow-y-auto">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500">
                      “{searchTerm}” için sohbetlerde ara
                    </p>
                  </div>
                  {searchResults.length === 0 && (
                    <div className="px-4 py-4 text-xs text-slate-400">Eşleşen sohbet bulunamadı.</div>
                  )}
                  {searchResults.map((conv) => {
                    const lastMessage =
                      conv.messages && conv.messages.length > 0
                        ? conv.messages[conv.messages.length - 1].content || ''
                        : '';
                    const dateLabel = new Date(
                      conv.updatedAt || conv.createdAt,
                    ).toLocaleString('tr-TR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => {
                          setActiveConversationId(conv.id);
                          setSearchTerm('');
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex flex-col gap-1 text-xs border-b border-slate-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800 truncate">{conv.title}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{dateLabel}</span>
                        </div>
                        {lastMessage && (
                          <span className="text-[11px] text-slate-500 line-clamp-2">{lastMessage}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {sortedConversations.map((conv) => {
                  const dateLabel = new Date(
                    conv.updatedAt || conv.createdAt,
                  ).toLocaleString('tr-TR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });
                  const isActive = conv.id === activeConversationId;
                  const isEditing = editingConversationId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={'border-b border-slate-200 ' + (isActive ? 'bg-white' : 'hover:bg-slate-100')}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveConversationId(conv.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveConversationId(conv.id);
                          }
                        }}
                        className="w-full text-left px-3 py-2 flex flex-col gap-0.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  applyRenameConversation();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelRenameConversation();
                                }
                              }}
                              className="flex-1 text-xs rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
                              placeholder="Sohbet adı..."
                            />
                          ) : (
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {conv.title}
                            </span>
                          )}

                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyRenameConversation();
                                }}
                                className="p-1 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelRenameConversation();
                                }}
                                className="p-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                renameConversation(conv.id);
                              }}
                              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">{dateLabel}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="p-3 border-t border-slate-200">
              <button
                type="button"
                onClick={createNewConversation}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-md border border-dashed border-slate-400 text-slate-600 hover:bg-slate-100"
              >
                + Yeni sohbet
              </button>
            </div>
          </aside>

          {/* Sağ: mesaj alanı */}
          <div className="flex-1 flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {showNewChatBanner && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-primary-50 border border-primary-200 px-4 py-3 text-sm text-primary-800">
                  <span>Uzun süredir görüşmedik. Yeni bir sohbet başlattık.</span>
                  <button
                    type="button"
                    onClick={() => setShowNewChatBanner(false)}
                    className="shrink-0 p-1 rounded hover:bg-primary-100 transition-colors"
                    aria-label="Kapat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {loadingConversations && (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                  <Loader2 className="w-8 h-8 mb-3 animate-spin text-slate-400" />
                  <p className="text-sm">Sohbetler yükleniyor...</p>
                </div>
              )}
              {!loadingConversations && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                  <Bot className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="text-lg font-medium mb-2">Merhaba! Size nasıl yardımcı olabilirim?</p>
                  <p className="text-sm">Örnek sorular:</p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
                      "yv90 nedir?"
                    </div>
                    <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
                      "400 hata kodu nedir, nasıl çözülür?"
                    </div>
                    <div className="bg-white rounded-lg px-4 py-2 border border-slate-200">
                      "Makine sıcaklığı nedir?"
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={'flex gap-3 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary-600" />
                    </div>
                  )}
                  <div
                    className={'max-w-[75%] rounded-lg px-4 py-3 ' + (msg.role === 'user' ? 'bg-primary-600 text-white' : msg.error ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-white border border-slate-200 text-slate-800')}
                  >
              {/* Ana cevap metni */}
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>

              {/* Detaylı cevabı ayrı göstermek için (varsa) */}
              {msg.detailed_answer && msg.mode !== 'detailed' && (
                <details className="mt-2">
                  <summary className="text-xs text-primary-600 cursor-pointer">Detaylı cevabı göster</summary>
                  <div className="mt-1 text-xs text-slate-800 whitespace-pre-wrap">{msg.detailed_answer}</div>
                </details>
              )}

              {/* Hata kodu rozeti */}
              {msg.error_code && (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                    Hata Kodu: {msg.error_code}
                  </span>
                </div>
              )}

              {/* İlgili sayfalar: attachments varsa kullan, yoksa sources'tan türet (kart + önizleme) */}
              {(() => {
                const rawAttachments = msg.attachments || [];
                const fromSources = !rawAttachments.length && msg.sources?.length
                  ? msg.sources.map((s) => {
                      const str = typeof s === 'string' ? s : (s?.dosya || s?.label || String(s));
                      // S.5, Sayfa 5, 5.30 (bölüm.sayfa), 5.202 formatlarını destekle
                      const pageMatch = str.match(/[Ss]\.\s*(\d+)/i) || str.match(/[Ss]ayfa\s*(\d+)/i)
                        || str.match(/\S\.(\d+)/i) || str.match(/\b(\d+)\s*$/);
                      const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
                      const src = str.replace(/\s*-\s*S\.\d+.*$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
                      return { source: src || str, page, label: str };
                    })
                  : [];
                const displayItems = rawAttachments.length ? rawAttachments : fromSources;
                if (!displayItems.length) return null;
                const pdfOnlyItems = displayItems
                  .map((att) => {
                    const s = att.source || att.dosya;
                    const isSaha = att.type === 'saha_cozumu'
                      || /şirket\s*hafızası|şirket hafızası|\[şirket hafızası\]/i.test(s || att.label || '');
                    const p = Math.max(1, parseInt(att.page ?? att.sayfa ?? 1, 10) || 1);
                    const lbl = att.label || (s || 'Doküman') + ' - S.' + p + ((att.category || att.kategori) ? ' (' + (att.category || att.kategori) + ')' : '');
                    return isSaha ? null : { ...att, source: s || att.source, page: p, label: lbl };
                  })
                  .filter(Boolean);
                return (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">İlgili sayfalar:</p>
                  <div className="flex flex-wrap gap-3">
                    {displayItems.map((att, i) => {
                      const src = att.source || att.dosya;
                      const pageNum = Math.max(1, parseInt(att.page ?? att.sayfa ?? 1, 10) || 1);
                      const label =
                        att.label ||
                        (src || 'Doküman') + (pageNum ? ' - S.' + pageNum : '') +
                        ((att.category || att.kategori) ? ' (' + (att.category || att.kategori) + ')' : '');
                      const isSahaCozumu = att.type === 'saha_cozumu'
                        || /şirket\s*hafızası|şirket hafızası|\[şirket hafızası\]/i.test(src || att.label || '');
                      const snippetSrc =
                        att.image_base64
                          ? ('data:image/png;base64,' + att.image_base64)
                          : att.type === 'image' && att.url
                            ? att.url
                            : !isSahaCozumu && src
                              ? api.docsPublicPagePreviewUrl(src, pageNum)
                              : null;
                      const pdfIndex = pdfOnlyItems.findIndex((p) => (p.source || p.dosya) === (src || att.source) && (p.page ?? p.sayfa) === pageNum);

                      return (
                        <div
                          key={i}
                          className="flex flex-col items-start gap-1 group"
                        >
                          <div
                            className={'relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 transition-shadow min-w-[200px] w-[200px] ' + (isSahaCozumu ? 'cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-primary-400')}
                            onClick={!isSahaCozumu ? () => setPdfModalAtt({ attachments: pdfOnlyItems, currentIndex: pdfIndex >= 0 ? pdfIndex : 0, source: src || att.source, page: pageNum, label }) : undefined}
                            role="button"
                            tabIndex={isSahaCozumu ? -1 : 0}
                            onKeyDown={!isSahaCozumu ? (e) => e.key === 'Enter' && setPdfModalAtt({ attachments: pdfOnlyItems, currentIndex: pdfIndex >= 0 ? pdfIndex : 0, source: src || att.source, page: pageNum, label }) : undefined}
                          >
                            {snippetSrc ? (
                              <img
                                src={snippetSrc}
                                alt={label}
                                className="w-full h-[140px] object-cover object-top"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const fallback = e.target.nextElementSibling;
                                  if (fallback) fallback.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={'w-full min-h-[140px] flex flex-col items-center justify-center text-slate-500 text-xs gap-2 p-3 bg-slate-100 ' + (snippetSrc ? 'hidden absolute inset-0' : '')}>
                              {isSahaCozumu ? (
                                <>
                                  <FileCheck className="w-8 h-8 text-amber-500" />
                                  <span className="font-medium text-slate-600">Saha çözümü</span>
                                  <span className="text-[10px]">PDF önizlemesi yok</span>
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-8 h-8 text-slate-400" />
                                  <span className="font-medium text-slate-600">Tarayıcıda aç</span>
                                  <span className="text-[10px]">Daha detaylı incele</span>
                                </>
                              )}
                            </div>
                            <div
                              className="absolute top-0 right-0 px-2 py-1.5 z-10"
                              role="button"
                              tabIndex={isSahaCozumu ? -1 : 0}
                              onClick={!isSahaCozumu ? (e) => { e.stopPropagation(); openAttachmentInBrowser({ ...att, source: src || att.source, page: pageNum }); } : undefined}
                              onKeyDown={!isSahaCozumu ? (e) => { if (e.key === 'Enter') { e.stopPropagation(); openAttachmentInBrowser({ ...att, source: src || att.source, page: pageNum }); } } : undefined}
                            >
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white bg-primary-600/90 rounded px-2 py-1 hover:bg-primary-600 shadow-sm">
                                <ZoomIn className="w-3 h-3" />
                                Daha detaylı incele
                              </span>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 flex items-center justify-between z-10">
                              <span className="text-[10px] text-white truncate flex-1">S.{pageNum || '?'}</span>
                              <ExternalLink className="w-3 h-3 text-white shrink-0" />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 max-w-[200px] truncate" title={label}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}
              {/* Şirket hafızasına kaydet butonu (sadece asistan cevapları için) */}
              {msg.role === 'assistant' && !msg.error && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      const openSaveModal = () => {
                        const defaultSolution =
                          msg.detailed_answer || msg.short_answer || msg.content || '';
                        setSaveModal({
                          convId: activeConversationId,
                          msgIdx: idx,
                          faultCode: msg.error_code || '',
                          problem: '',
                          solution: defaultSolution,
                          equipmentName: '',
                        });
                      };
                      if (pdfModalAtt && !confirm("Kaynak chat'i kapatmak istediğinize emin misiniz? Açık sohbetler kaydedilir.")) return;
                      if (pdfModalAtt) setPdfModalAtt(null);
                      openSaveModal();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-900 hover:underline"
                  >
                    <FileCheck className="w-4 h-4" />
                    Bu çözümü şirket hafızasına kaydet
                  </button>
                </div>
              )}
              {/* İş emri önerisi varsa: İş emrine eklensin mi? Evet / Hayır */}
              {msg.work_order_suggestion && !msg.workOrderAdded && !msg.workOrderDeclined && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">İş emrine eklensin mi?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addWorkOrderFromMessage(activeConversationId, idx)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      <FileCheck className="w-4 h-4" />
                      Evet
                    </button>
                    <button
                      type="button"
                      onClick={() => markWorkOrderDeclined(activeConversationId, idx)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      Hayır
                    </button>
                  </div>
                </div>
              )}
              {msg.workOrderAdded && (
                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                  <FileCheck className="w-4 h-4" />
                  İş emrine eklendi
                </div>
              )}
              {msg.confidence && (
                <div className="mt-2 text-xs">
                  <span
                    className={'px-2 py-0.5 rounded ' + (msg.confidence === 'high' ? 'bg-green-100 text-green-700' : msg.confidence === 'low' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700')}
                  >
                    {msg.confidence === 'high'
                      ? 'Yüksek Güven'
                      : msg.confidence === 'low'
                        ? 'Düşük Güven'
                        : 'Bilinmiyor'}
                  </span>
                </div>
              )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}

              {loadingConversationId === activeConversationId && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Düşünüyor...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input + Mod alanı */}
            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex flex-col gap-3">
                {/* Mod butonları */}
                <div className="flex flex-wrap gap-3">
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={'flex items-center justify-center px-4 py-2 rounded-lg text-xs sm:text-sm font-medium min-w-[90px] ' + (mode === m.id ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Mesaj alanı + Gönder butonu */}
                <div className="flex gap-3 items-stretch">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Buraya mesajınızı yazın... (Enter ile gönder)"
                    className="flex-1 resize-none border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[60px] max-h-[120px] text-sm"
                    rows={1}
                    disabled={loadingConversationId === activeConversationId}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loadingConversationId === activeConversationId}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[60px] font-medium"
                  >
                    {loadingConversationId === activeConversationId ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span className="hidden sm:inline">Gönder</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pdfModalAtt && (
        <PdfViewerModal
          isOpen={!!pdfModalAtt}
          onClose={() => setPdfModalAtt(null)}
          source={pdfModalAtt.source}
          initialPage={pdfModalAtt.page ?? 1}
          label={pdfModalAtt.label || pdfModalAtt.source}
          attachments={pdfModalAtt.attachments}
          currentIndex={pdfModalAtt.currentIndex ?? 0}
          onNavigate={
            pdfModalAtt.attachments?.length
              ? (newIndex) =>
                  setPdfModalAtt((prev) => ({ ...prev, currentIndex: newIndex }))
              : undefined
          }
        />
      )}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Saha Çözümünü Kaydet</h2>
            <p className="text-xs text-slate-500 mb-4">
              Bu form, Meyrem&apos;in KAYDET akışına uygun olarak çözümü şirket hafızasına ekler. Kayıt
              kıdemli mühendis onayına gidecektir.
            </p>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const faultCode = saveModal.faultCode?.trim();
                const problem = saveModal.problem?.trim();
                const solution = saveModal.solution?.trim();
                const equipmentName = saveModal.equipmentName?.trim();
                if (!faultCode || !problem || !solution) {
                  alert('Hata kodu, problem ve çözüm alanları zorunludur.');
                  return;
                }
                try {
                  await api.sirketHafizasi.create({
                    faultCode,
                    problem,
                    solution,
                    equipmentName: equipmentName || null,
                  });
                  // Mesajı kaydedildi olarak işaretle
                  if (saveModal.convId && typeof saveModal.msgIdx === 'number') {
                    let updatedMessages;
                    setConversations((prev) =>
                      prev.map((c) => {
                        if (c.id !== saveModal.convId) return c;
                        const msgs = c.messages.map((m, i) =>
                          i === saveModal.msgIdx ? { ...m, savedToCompanyMemory: true } : m,
                        );
                        updatedMessages = msgs;
                        return { ...c, messages: msgs, updatedAt: new Date().toISOString() };
                      }),
                    );
                    if (updatedMessages) {
                      api.conversations
                        .update(saveModal.convId, { messages: updatedMessages })
                        .catch((err) => console.error('Sohbet güncellenemedi:', err));
                    }
                  }
                  setSaveModal(null);
                  alert('Çözüm kaydedildi, kıdemli mühendis onayı bekleniyor.');
                } catch (err) {
                  alert(`Çözüm kaydedilemedi: ${err.message}`);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Hata Kodu
                  </label>
                  <input
                    type="text"
                    value={saveModal.faultCode}
                    onChange={(e) =>
                      setSaveModal((prev) => ({ ...prev, faultCode: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Örn: 2013"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ekipman Adı (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={saveModal.equipmentName}
                    onChange={(e) =>
                      setSaveModal((prev) => ({ ...prev, equipmentName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Örn: SACMI PH7200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Problem Tanımı
                </label>
                <textarea
                  value={saveModal.problem}
                  onChange={(e) =>
                    setSaveModal((prev) => ({ ...prev, problem: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder="Kısaca problemi tanımlayın..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Çözüm Adımları
                </label>
                <textarea
                  value={saveModal.solution}
                  onChange={(e) =>
                    setSaveModal((prev) => ({ ...prev, solution: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder="Sahada uygulanan çözüm adımlarını yazın..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
