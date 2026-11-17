import { useState } from "react";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { toast } from "sonner";
import { Target, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

const QUESTIONS = [
  { k: "aim", q: "Como avalia sua mira?", opts: ["Fraca", "Mediana", "Boa", "Excelente"] },
  { k: "movement", q: "Movimentação em combate?", opts: ["Estática", "Melhorando", "Boa", "Fluida"] },
  { k: "utility", q: "Uso de utility (smokes, flashes)?", opts: ["Raramente uso", "Básico", "Tático", "Avançado"] },
  { k: "comms", q: "Comunicação com time?", opts: ["Silencioso", "Básica", "Ativa", "Shotcaller"] },
  { k: "crosshair", q: "Mantém crosshair placement?", opts: ["Nunca", "Às vezes", "Geralmente", "Sempre"] },
  { k: "economy", q: "Gestão de economia?", opts: ["Fraca", "Melhorando", "Boa", "Ótima"] },
  { k: "mental", q: "Como está seu mental em bad games?", opts: ["Tilt rápido", "Variável", "Resiliente", "Blindado"] },
];

export default function Weakness() {
  const { getToken } = useAuth();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) return toast.error("Responda todas as perguntas");
    setLoading(true);
    try {
      const r = await buildApi(getToken).post("/ai/weakness", { answers });
      setResult(r.data.analysis);
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <div data-testid="weakness-page" className="space-y-6 max-w-3xl">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Weakness Finder</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2 flex items-center gap-3"><Target className="text-purple-400"/> Pontos <span className="gradient-text">fracos</span></h1>
        <p className="text-slate-400 mt-2">Responda com honestidade. A IA vai identificar seus 3 maiores gargalos e sugerir exercícios.</p>
      </div>

      <div className="space-y-4">
        {QUESTIONS.map((Q) => (
          <div key={Q.k} data-testid={`q-${Q.k}`} className="p-5 rounded-2xl border border-white/10 bg-[#12141F]">
            <div className="font-semibold mb-3">{Q.q}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Q.opts.map((o, i) => (
                <button key={o} data-testid={`q-${Q.k}-opt-${i}`} onClick={() => setAnswers((a) => ({ ...a, [Q.k]: o }))}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    answers[Q.k] === o
                      ? "bg-gradient-to-r from-purple-600 to-cyan-500 font-bold text-white"
                      : "border border-white/10 text-slate-300 hover:bg-white/5"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button data-testid="weakness-submit" onClick={submit} disabled={loading}
        className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold inline-flex items-center gap-2 glow-purple disabled:opacity-50">
        <Sparkles size={16}/> {loading ? "Analisando..." : "Analisar com IA"}
      </button>

      {result && (
        <div data-testid="weakness-result" className="p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 text-sm leading-relaxed prose-coach">
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
