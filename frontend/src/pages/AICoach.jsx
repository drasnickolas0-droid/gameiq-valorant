import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { API } from "@/lib/api";
import { buildApi } from "@/lib/api";
import { Send, Trash2, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export default function AICoach() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  const load = () => buildApi(getToken).get("/ai/history").then((r) => setMessages(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e6, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Erro no AI Coach");
        setMessages((m) => m.slice(0, -1));
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const p of parts) {
          const line = p.replace(/^\n+/, "");
          if (!line.startsWith("data: ")) continue;
          const chunk = line.slice(6);
          if (chunk === "[DONE]") continue;
          const decoded = chunk.replace(/\\n/g, "\n");
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + decoded };
            return copy;
          });
        }
      }
    } finally { setStreaming(false); }
  };

  const clear = async () => {
    await buildApi(getToken).delete("/ai/history");
    setMessages([]); toast.success("Histórico apagado");
  };

  return (
    <div data-testid="ai-coach-page" className="h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-purple-400">AI Coach</div>
          <h1 className="text-3xl font-black uppercase tracking-tight mt-1 flex items-center gap-3">
            <Brain className="text-purple-400"/> Treinador <span className="gradient-text">Virtual</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Powered by Claude Sonnet 5.5 — pergunte sobre mira, utility, posicionamento, agentes.</p>
        </div>
        <button data-testid="ai-clear-btn" onClick={clear} className="p-2.5 rounded-lg border border-white/10 hover:bg-white/5"><Trash2 size={16}/></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl border border-white/10 bg-[#0c0e1a]">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            Nenhuma conversa ainda. Comece pedindo:<br/>
            <span className="text-purple-300">"Qual agente combina com meu estilo defensivo?"</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} data-testid={`ai-msg-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-gradient-to-br from-purple-600 to-purple-500 text-white"
                : "bg-[#12141F] border border-white/10 text-slate-200"}`}>
              {m.role === "assistant" && m.content ? (
                <div className="prose-coach"><ReactMarkdown>{m.content}</ReactMarkdown></div>
              ) : m.content || (streaming && i === messages.length - 1 ? <span className="pulse-dot inline-block w-2 h-2 rounded-full bg-cyan-400"/> : null)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input data-testid="ai-coach-input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Pergunte ao coach..."
          className="flex-1 px-4 py-3 rounded-xl bg-[#12141F] border border-white/10 focus:border-purple-500/50 outline-none" />
        <button data-testid="ai-coach-send-button" onClick={send} disabled={streaming}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-semibold inline-flex items-center gap-2 disabled:opacity-50 glow-purple">
          <Send size={16}/> Enviar
        </button>
      </div>
    </div>
  );
}
