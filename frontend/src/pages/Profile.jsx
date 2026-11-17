import { useOutletContext } from "react-router-dom";
import { Trophy, Target, Flame } from "lucide-react";

export default function Profile() {
  const { me } = useOutletContext();
  if (!me) return null;
  return (
    <div data-testid="profile-page" className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Player Profile</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Perfil <span className="gradient-text">competitivo</span></h1>
      </div>

      <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#12141F] to-[#0c0e1a] flex gap-5">
        {me.avatar_url ? <img src={me.avatar_url} alt="" className="w-24 h-24 rounded-2xl"/> :
          <div className="w-24 h-24 rounded-2xl bg-purple-500/20 grid place-items-center text-3xl font-black">{me.name?.[0]}</div>}
        <div className="flex-1">
          <div className="font-black text-2xl">{me.display_name}</div>
          <div className="text-sm text-slate-400 font-mono">{me.email}</div>
          <div className="text-xs text-purple-300 mt-2">Plano {me.plan_slug?.toUpperCase()}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card icon={Trophy} label="Jogo" value={me.game?.toUpperCase() || "VALORANT"}/>
        <Card icon={Flame} label="Patente" value={me.rank || "—"}/>
        <Card icon={Target} label="Objetivo" value={me.goal || "não definido"}/>
      </div>

      <div className="p-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
        <div className="text-[11px] uppercase tracking-widest text-cyan-400">Riot Account</div>
        <div className="font-mono text-xl mt-1">{me.riot_id || "Não conectado"}</div>
        <div className="text-xs text-slate-400 mt-1">
          {me.riot_connected ? "Status: vinculada manualmente (integração oficial pendente)" : "Conecte na página Riot Account"}
        </div>
      </div>
    </div>
  );
}
function Card({ icon: Icon, label, value }) {
  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-[#12141F]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400"><Icon size={14}/> {label}</div>
      <div className="font-mono text-xl mt-2 text-cyan-400 break-all">{value}</div>
    </div>
  );
}
