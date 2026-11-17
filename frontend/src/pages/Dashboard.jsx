import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { Trophy, Target, Flame, TrendingUp, Zap, Crown } from "lucide-react";

export default function Dashboard() {
  const { me } = useOutletContext();
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    const api = buildApi(getToken);
    api.get("/stats/summary").then((r) => setStats(r.data)).catch(() => {});
    api.get("/challenges").then((r) => setChallenges(r.data.slice(0, 3))).catch(() => {});
  }, [getToken]);

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Dashboard</div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight mt-2">
            Olá, <span className="gradient-text">{me?.display_name || "jogador"}</span>
          </h1>
          <p className="text-slate-400 mt-2">{me?.goal || "Defina seu objetivo competitivo em Minha Conta"}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/plans" data-testid="dashboard-upgrade" className="px-4 py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-sm font-semibold inline-flex items-center gap-2 hover:bg-purple-500/20">
            <Crown size={16}/> Gerenciar plano
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Partidas" value={stats?.total ?? 0} test="stat-total"/>
        <StatCard icon={Target} label="Win Rate" value={`${stats?.win_rate ?? 0}%`} test="stat-wr" accent="cyan"/>
        <StatCard icon={Flame} label="K/D" value={stats?.kd ?? 0} test="stat-kd"/>
        <StatCard icon={TrendingUp} label="ACS Médio" value={stats?.acs ?? 0} test="stat-acs" accent="cyan"/>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#12141F] to-[#0c0e1a]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">Perfil do Jogador</h2>
            <span className="text-xs font-mono uppercase text-slate-500">{me?.game || "VALORANT"}</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <Info label="Patente" value={me?.rank || "—"} />
            <Info label="Objetivo" value={me?.goal || "não definido"} />
            <Info label="Riot ID" value={me?.riot_id || "não conectado"} />
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <div className="flex items-center gap-2 text-cyan-400 mb-2"><Zap size={18}/> Desafios ativos</div>
          <div className="space-y-2 mt-4">
            {challenges.length === 0 && <p className="text-sm text-slate-400">Nenhum desafio ainda. Gere um na página Desafios.</p>}
            {challenges.map((c) => (
              <div key={c.id} data-testid={`dash-challenge-${c.id}`} className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="text-xs text-slate-400 mt-1">{c.description}</div>
              </div>
            ))}
            <Link to="/challenges" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">Ver todos →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, test, accent }) {
  const c = accent === "cyan" ? "text-cyan-400 border-cyan-500/20" : "text-purple-400 border-purple-500/20";
  return (
    <div data-testid={test} className={`p-5 rounded-2xl border bg-[#12141F] ${c}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400"><Icon size={14}/> {label}</div>
      <div className="font-mono text-3xl font-bold mt-3 text-white">{value}</div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-mono text-lg mt-1 text-white break-all">{value}</div>
    </div>
  );
}
