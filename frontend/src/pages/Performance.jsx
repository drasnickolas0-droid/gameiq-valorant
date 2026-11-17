import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { toast } from "sonner";
import { label } from "@/lib/labels";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const AGENTS = ["Jett", "Reyna", "Raze", "Phoenix", "Yoru", "Neon", "ISO", "Omen", "Brimstone",
  "Viper", "Astra", "Harbor", "Clove", "Sova", "Cypher", "Killjoy", "Chamber", "KAY/O", "Fade",
  "Breach", "Skye", "Sage", "Deadlock", "Gekko", "Tejo", "Vyse", "Waylay"];
const MAPS = ["Ascent", "Bind", "Haven", "Split", "Icebox", "Breeze", "Fracture", "Pearl",
  "Lotus", "Sunset", "Abyss", "Corrode"];

export default function Performance() {
  const { getToken } = useAuth();
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ agent: "Jett", map: "Ascent", result: "win", kills: 0, deaths: 0, assists: 0, acs: 0, adr: 0, kast: 70 });

  const load = () => {
    const api = buildApi(getToken);
    api.get("/matches").then((r) => setMatches(r.data));
    api.get("/stats/summary").then((r) => setStats(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    try {
      await buildApi(getToken).post("/matches", form);
      toast.success("Partida registrada"); setShow(false); load();
    } catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Valores inválidos — confira os campos"); }
  };
  const del = async (id) => { await buildApi(getToken).delete(`/matches/${id}`); load(); };

  return (
    <div data-testid="performance-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Valorant Performance</div>
          <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Análise de <span className="gradient-text">partidas</span></h1>
          <p className="text-xs text-slate-500 mt-2">Última atualização: {stats?.last_updated?.slice(0, 16)?.replace("T", " ") || "—"} · Fonte: entrada manual</p>
        </div>
        <button data-testid="add-match-btn" onClick={() => setShow(true)}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold inline-flex items-center gap-2 glow-purple">
          <Plus size={16}/> Registrar partida
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[["K/D", stats?.kd], ["ACS", stats?.acs], ["ADR", stats?.adr], ["KAST", stats?.kast + "%"], ["WR", stats?.win_rate + "%"]].map(([l, v]) => (
          <div key={l} className="p-4 rounded-xl border border-white/10 bg-[#12141F]">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">{l}</div>
            <div className="font-mono text-2xl text-cyan-400 mt-1">{v ?? "—"}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Block title="Desempenho por agente">
          {!stats?.by_agent?.length ? <Empty/> : stats.by_agent.map((a) => (
            <Row key={a.name} name={a.name} games={a.games} kd={a.kd} wr={a.win_rate} acs={a.acs}/>
          ))}
        </Block>
        <Block title="Desempenho por mapa">
          {!stats?.by_map?.length ? <Empty/> : stats.by_map.map((m) => (
            <Row key={m.name} name={m.name} games={m.games} kd={m.kd} wr={m.win_rate} acs={m.acs}/>
          ))}
        </Block>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">Histórico de partidas</h2>
        <div className="rounded-2xl border border-white/10 bg-[#12141F] overflow-x-auto">
          {matches.length === 0 ? <div className="p-6 text-sm text-slate-400">Nenhuma partida ainda.</div> : (
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-slate-400">
                <tr>{["Data", "Agente", "Mapa", "Resultado", "K/D/A", "ACS", "ADR", "KAST", ""].map(h => <th key={h} className="text-left p-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} data-testid={`match-row-${m.id}`} className="border-t border-white/5">
                    <td className="p-3 font-mono text-xs">{m.played_at?.slice(0, 10)}</td>
                    <td className="p-3">{m.agent}</td>
                    <td className="p-3">{m.map}</td>
                    <td className="p-3"><span className={`font-mono text-xs px-2 py-0.5 rounded-full ${m.result === "win" ? "bg-emerald-500/15 text-emerald-300" : m.result === "loss" ? "bg-red-500/15 text-red-300" : "bg-slate-500/15"}`}>{label(m.result)}</span></td>
                    <td className="p-3 font-mono">{m.kills}/{m.deaths}/{m.assists}</td>
                    <td className="p-3 font-mono">{m.acs}</td>
                    <td className="p-3 font-mono">{m.adr}</td>
                    <td className="p-3 font-mono">{m.kast}%</td>
                    <td className="p-3"><button data-testid={`delete-match-${m.id}`} onClick={() => del(m.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent data-testid="match-form-dialog" className="bg-[#0c0e1a] border-purple-500/30 text-white max-w-xl">
          <DialogHeader><DialogTitle>Nova partida</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field l="Agente"><select data-testid="match-agent" value={form.agent} onChange={(e) => setForm({...form, agent: e.target.value})} className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10">{AGENTS.map(a => <option key={a}>{a}</option>)}</select></Field>
            <Field l="Mapa"><select data-testid="match-map" value={form.map} onChange={(e) => setForm({...form, map: e.target.value})} className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10">{MAPS.map(m => <option key={m}>{m}</option>)}</select></Field>
            <Field l="Resultado"><select data-testid="match-result" value={form.result} onChange={(e) => setForm({...form, result: e.target.value})} className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10"><option value="win">Vitória</option><option value="loss">Derrota</option><option value="draw">Empate</option></select></Field>
            <Field l="Kills"><NumInput v={form.kills} on={(v) => setForm({...form, kills: v})} t="match-kills"/></Field>
            <Field l="Deaths"><NumInput v={form.deaths} on={(v) => setForm({...form, deaths: v})} t="match-deaths"/></Field>
            <Field l="Assists"><NumInput v={form.assists} on={(v) => setForm({...form, assists: v})} t="match-assists"/></Field>
            <Field l="ACS"><NumInput v={form.acs} on={(v) => setForm({...form, acs: v})} t="match-acs"/></Field>
            <Field l="ADR"><NumInput v={form.adr} on={(v) => setForm({...form, adr: v})} t="match-adr"/></Field>
            <Field l="KAST (%)"><NumInput v={form.kast} on={(v) => setForm({...form, kast: v})} t="match-kast"/></Field>
          </div>
          <DialogFooter>
            <button onClick={() => setShow(false)} className="px-4 py-2 rounded-lg border border-white/10">Cancelar</button>
            <button data-testid="save-match-btn" onClick={save} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 font-bold">Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Block({ title, children }) {
  return <div className="rounded-2xl border border-white/10 bg-[#12141F] p-5"><h3 className="font-bold mb-3">{title}</h3><div className="space-y-2">{children}</div></div>;
}
function Row({ name, games, kd, wr, acs }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-sm">
      <div className="font-semibold">{name} <span className="text-xs text-slate-500 font-normal">· {games}j</span></div>
      <div className="flex gap-4 font-mono text-xs">
        <span>K/D <span className="text-cyan-400">{kd}</span></span>
        <span>WR <span className="text-cyan-400">{wr}%</span></span>
        <span>ACS <span className="text-cyan-400">{acs}</span></span>
      </div>
    </div>
  );
}
function Empty() { return <div className="text-sm text-slate-500 text-center py-6">Registre partidas para ver análises</div>; }
function Field({ l, children }) { return <div><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{l}</div>{children}</div>; }
function NumInput({ v, on, t }) {
  return <input data-testid={t} type="number" value={v} onChange={(e) => on(parseInt(e.target.value || "0", 10))} className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10 font-mono"/>;
}
