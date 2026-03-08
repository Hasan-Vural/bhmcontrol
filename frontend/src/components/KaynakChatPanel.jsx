import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Plus, ExternalLink } from 'lucide-react';
import { api } from '../api/client';

const PAGE_SCOPE_OPTIONS = [
  { id: 'current', label: 'Mevcut sayfa' },
  { id: 'range', label: 'Sayfa aralığı seç' },
  { id: 'list', label: 'Belirli sayfalar' },
  { id: 'all', label: 'Tüm belge' },
];

export function KaynakChatPanel({
  documentName,
  currentPage = 1,
  onClose,
}) {
  const [pageScopeType, setPageScopeType] = useState('current');
  const [pageRangeMin, setPageRangeMin] = useState('');
  const [pageRangeMax, setPageRangeMax] = useState('');
  const [pageList, setPageList] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const messagesEndRef = useRef(null);

  const messages = activeConversation?.messages || [];

  const getPageScope = () => {
    if (pageScopeType === 'current') return String(currentPage);
    if (pageScopeType === 'all') return 'all';
    if (pageScopeType === 'range') {
      const min = parseInt(pageRangeMin, 10);
      const max = parseInt(pageRangeMax, 10);
      if (!isNaN(min) && !isNaN(max) && min <= max) return `${min}-${max}`;
      return null;
    }
    if (pageScopeType === 'list') {
      const parts = pageList.split(/[,\s]+/).filter(Boolean);
      const nums = parts.map((p) => parseInt(p, 10)).filter((n) => !isNaN(n));
      if (nums.length > 0) return nums.join(',');
      return null;
    }
    return null;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!documentName?.trim()) return;
    let cancelled = false;
    async function load() {
      try {
        setLoadingConversations(true);
        const list = await api.docChat.listConversations(documentName);
        if (cancelled) return;
        setConversations(list);
        if (list.length > 0) {
          const lastId = list[0].id;
          setActiveConversationId(lastId);
        } else {
          setActiveConversationId(null);
          setActiveConversation(null);
        }
      } catch (e) {
        console.error('Doc chat sohbetleri yüklenemedi:', e);
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [documentName]);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversation(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const conv = await api.docChat.getConversation(activeConversationId);
        if (!cancelled) setActiveConversation(conv);
      } catch (e) {
        console.error('Sohbet yüklenemedi:', e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeConversationId]);

  const handleNewConversation = async () => {
    if (!documentName?.trim()) return;
    try {
      const conv = await api.docChat.createConversation({
        documentName,
        pageScope: getPageScope(),
        title: `Sohbet ${conversations.length + 1}`,
      });
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setActiveConversation(conv);
    } catch (e) {
      console.error('Yeni sohbet oluşturulamadı:', e);
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading || !documentName?.trim()) return;

    setInput('');
    const pageScope = getPageScope();

    const prevMessages = messages.map((m) => ({ role: m.role, content: m.content || '' }));

    setLoading(true);
    try {
      const res = await api.docChat.query({
        question,
        conversationId: activeConversationId || undefined,
        documentName,
        pageScope: pageScope || undefined,
        messages: prevMessages,
      });

      if (res.conversationId && !activeConversationId) {
        setActiveConversationId(res.conversationId);
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === res.conversationId);
          if (exists) return prev;
          return [{ id: res.conversationId, title: res.conversation?.title, documentName, pageScope }, ...prev];
        });
      }

      setActiveConversation((prev) => {
        const msgs = prev?.messages || [];
        return {
          ...prev,
          id: res.conversationId,
          messages: [
            ...msgs,
            res.userMessage,
            { ...res.assistantMessage, content: res.assistantMessage.content, attachments: res.assistantMessage.attachments || [] },
          ],
        };
      });
    } catch (e) {
      console.error('Soru gönderilemedi:', e);
      setActiveConversation((prev) => ({
        ...prev,
        messages: [
          ...(prev?.messages || []),
          { role: 'user', content: question },
          { role: 'assistant', content: `Hata: ${e.message}`, error: true },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col w-[320px] min-w-[320px] border-l border-slate-200 bg-slate-50/80 overflow-hidden">
      {/* Sayfa seçici */}
      <div className="p-3 border-b border-slate-200 bg-white">
        <p className="text-xs font-medium text-slate-600 mb-2">Sayfa kapsamı</p>
        <div className="space-y-2">
          {PAGE_SCOPE_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pageScope"
                checked={pageScopeType === opt.id}
                onChange={() => setPageScopeType(opt.id)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-slate-700">{opt.label}</span>
            </label>
          ))}
          {pageScopeType === 'current' && (
            <p className="text-[11px] text-slate-500 ml-5">S.{currentPage}</p>
          )}
          {pageScopeType === 'range' && (
            <div className="flex gap-2 ml-5">
              <input
                type="number"
                min={1}
                value={pageRangeMin}
                onChange={(e) => setPageRangeMin(e.target.value)}
                placeholder="Min"
                className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                type="number"
                min={1}
                value={pageRangeMax}
                onChange={(e) => setPageRangeMax(e.target.value)}
                placeholder="Max"
                className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
          )}
          {pageScopeType === 'list' && (
            <input
              type="text"
              value={pageList}
              onChange={(e) => setPageList(e.target.value)}
              placeholder="173, 174, 180"
              className="ml-5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          )}
        </div>
      </div>

      {/* Sohbet tabları */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white overflow-x-auto">
        <div className="flex gap-1.5 shrink-0">
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveConversationId(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeConversationId === c.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {c.title || `Sohbet`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleNewConversation}
          className="shrink-0 p-1.5 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
          title="Yeni sohbet"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Mesaj listesi */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {loadingConversations && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}
        {!loadingConversations && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <Bot className="w-10 h-10 mb-2 text-slate-300" />
            <p className="text-xs">Bu belge hakkında soru sorun</p>
            <button
              type="button"
              onClick={handleNewConversation}
              className="mt-2 text-xs text-primary-600 hover:underline"
            >
              + Yeni sohbet başlat
            </button>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary-600" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : msg.error
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.attachments?.length > 0 && msg.role === 'assistant' && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  {msg.attachments.map((att, i) => {
                    const src = att.source || att.dosya;
                    const pageNum = Math.max(1, parseInt(att.page ?? att.sayfa ?? 1, 10) || 1);
                    const lbl = att.label || (src || '') + ' - S.' + pageNum;
                    return (
                      <a
                        key={i}
                        href={src ? api.docsPublicOpenUrl(src, pageNum) : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-primary-600 hover:underline mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {lbl}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-slate-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-primary-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Giriş alanı */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Belge hakkında soru sorun..."
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] max-h-[80px]"
            rows={1}
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
