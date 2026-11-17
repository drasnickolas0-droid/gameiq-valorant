import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Check, Trash2 } from "lucide-react";

export default function Challenges() {
  const { getToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => buildApi(getToken).get("/challenges").then((r) => setItems(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const generate = async () => {
    setLoading(true);
    try {
      await buildApi(getToken).post("/ai/generate-challenge");
      toast.success("Novo desafio gerado pela IA"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
    finally { setLoading(false); }
  };

  const toggle = async (id, completed) => {
    await buildApi(getToken).patch(`/challenges/${id}`, { completed: !completed }); load();
  };

  return (
    <div data-testid="challenges-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Challenge Generator</div>
          <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Desafios <span className="gradient-text">diários</span></h1>
        </div>
        <button data-testid="generate-challenge-btn" onClick={generate} disabled={loading}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold inline-flex items-center gap-2 glow-purple disabled:opacity-50">
          <Sparkles size={16}/> {loading ? "Gerando..." : "Gerar com IA"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.length === 0 && <div className="col-span-full p-12 rounded-2xl border border-white/10 bg-[#12141F] text-center text-slate-400">Nenhum desafio ainda. Clique em "Gerar com IA".</div>}
        {items.map((c) => (
          <div key={c.id} data-testid={`challenge-${c.id}`} className={`p-5 rounded-2xl border bg-[#12141F] ${c.completed ? "border-emerald-500/40 opacity-70" : "border-white/10"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-widest font-mono text-cyan-400">{c.difficulty}</span>
                  {c.ai_generated && <span className="text-[10px] uppercase tracking-widest text-purple-400">· IA</span>}
                </div>
                <h3 className={`font-bold ${c.completed ? "line-through text-slate-500" : ""}`}>{c.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{c.description}</p>
              </div>
              <button data-testid={`toggle-${c.id}`} onClick={() => toggle(c.id, c.completed)}
                className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${c.completed ? "bg-emerald-500 text-white" : "border border-white/20"}`}>
                <Check size={16}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
