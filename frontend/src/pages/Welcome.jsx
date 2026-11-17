import { Link } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Sparkles, ChevronRight } from "lucide-react";

export default function Welcome() {
  const { user } = useUser();
  const first = user?.firstName || user?.username || "jogador";
  return (
    <div className="min-h-screen bg-[#090A0F] text-white grid place-items-center bg-grid p-4 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[160px] pointer-events-none"/>
      <div className="relative max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-300 mb-8">
          <Sparkles size={14}/> Bem-vindo ao GAMEIQ
        </div>
        <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tight">
          Olá, <span className="gradient-text">{first}</span>!
        </h1>
        <p className="mt-6 text-lg text-slate-300 leading-relaxed">
          Sua conta GAMEIQ foi criada. Agora é hora de conectar sua conta Riot, cadastrar suas primeiras partidas
          e deixar o AI Coach traçar seu plano de evolução.
        </p>
        <div className="mt-12 grid sm:grid-cols-3 gap-4 text-left">
          {[
            { n: 1, t: "Conecte sua conta Riot", d: "Vincule seu Riot ID para começar" },
            { n: 2, t: "Registre partidas", d: "Entrada manual ou integração oficial futura" },
            { n: 3, t: "Converse com o AI Coach", d: "Receba orientações personalizadas" },
          ].map((s) => (
            <div key={s.n} className="p-5 rounded-xl border border-white/10 bg-white/5">
              <div className="font-mono text-cyan-400 text-sm">PASSO 0{s.n}</div>
              <div className="font-bold mt-1">{s.t}</div>
              <div className="text-xs text-slate-400 mt-2">{s.d}</div>
            </div>
          ))}
        </div>
        <Link to="/dashboard" data-testid="welcome-continue"
          className="inline-flex mt-10 items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold glow-purple hover:scale-[1.02] transition-transform">
          Ir para o Dashboard <ChevronRight size={18}/>
        </Link>
      </div>
    </div>
  );
}
