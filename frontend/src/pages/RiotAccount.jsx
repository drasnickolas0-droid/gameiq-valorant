import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { Gamepad2, Link2, Unlink, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const REGIONS = [
  { v: "br", l: "Brasil (BR)" }, { v: "na", l: "Norte América (NA)" },
  { v: "latam", l: "LATAM" }, { v: "eu", l: "Europa (EU)" },
  { v: "kr", l: "Coreia (KR)" }, { v: "ap", l: "Ásia-Pacífico (AP)" },
];

export default function RiotAccount() {
  const { refreshMe } = useOutletContext();
  const { getToken } = useAuth();
  const [riot, setRiot] = useState(null);
  const [show, setShow] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("br");

  const load = () => buildApi(getToken).get("/riot").then((r) => setRiot(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const link = async () => {
    try {
      await buildApi(getToken).post("/riot/link", { riot_id: riotId, region, manual: true });
      toast.success("Conta Riot vinculada (modo manual)");
      setShow(false); setConfirmReplace(false); setRiotId("");
      load(); refreshMe?.();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const unlink = async () => {
    if (!confirm("Desconectar conta Riot?")) return;
    await buildApi(getToken).delete("/riot");
    toast.success("Conta desconectada"); load(); refreshMe?.();
  };

  const connected = riot?.connected;

  return (
    <div data-testid="riot-page" className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Riot Account</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2 flex items-center gap-3">
          <Gamepad2 className="text-purple-400"/> Conta <span className="gradient-text">Riot</span>
        </h1>
      </div>

      <div data-testid="riot-integration-notice" className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm flex gap-3">
        <AlertTriangle className="shrink-0 mt-0.5" size={18}/>
        <div>
          <b>Integração oficial pendente de aprovação pela Riot Games.</b> Até lá, a vinculação é manual — você informa seu Riot ID e tagline, e cadastra suas partidas manualmente. Não armazenamos sua senha Riot.
        </div>
      </div>

      {connected ? (
        <div className="p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent glow-purple">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 grid place-items-center font-black text-xl">{riot.riot_name?.[0]}</div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-widest text-cyan-400">Riot ID vinculado</div>
              <div className="font-mono text-2xl font-bold mt-1">{riot.riot_id}</div>
              <div className="text-xs text-slate-400 mt-1">Região: <span className="font-mono text-white">{riot.region?.toUpperCase()}</span> · Última sinc.: <span className="font-mono">{riot.last_sync?.slice(0, 10)}</span></div>
              <div className="text-[11px] text-amber-300 mt-1">{riot.integration_status}</div>
            </div>
            <div className="flex gap-2">
              <button data-testid="riot-sync" onClick={() => toast.info("Integração oficial pendente — sincronização manual disponível via página Valorant Performance.")} className="px-4 py-2 rounded-lg border border-white/10 inline-flex items-center gap-2 text-sm"><RefreshCw size={14}/> Sinc.</button>
              <button data-testid="riot-swap" onClick={() => { setConfirmReplace(true); setShow(true); }} className="px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 text-sm">Trocar</button>
              <button data-testid="riot-unlink" onClick={unlink} className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 inline-flex items-center gap-2 text-sm"><Unlink size={14}/> Desconectar</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl border border-white/10 bg-[#12141F] text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/15 grid place-items-center mx-auto mb-4"><Link2 className="text-purple-400"/></div>
          <h2 className="text-xl font-bold">Conectar conta Riot</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">Informe seu Riot ID (formato <span className="font-mono text-cyan-400">Nome#TAG</span>) para vincular à sua conta GAMEIQ.</p>
          <button data-testid="connect-riot-button" onClick={() => setShow(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold glow-purple">
            <Link2 size={16}/> Connect Riot Account
          </button>
        </div>
      )}

      <Dialog open={show} onOpenChange={(o) => { if (!o) { setShow(false); setConfirmReplace(false); } }}>
        <DialogContent data-testid="riot-link-dialog" className="bg-[#0c0e1a] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle>{confirmReplace ? "Substituir conta Riot" : "Vincular conta Riot"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {confirmReplace ? "Isso substitui a conta Riot atualmente vinculada. Suas partidas registradas serão mantidas." : "Vinculação manual — integração oficial pendente de aprovação."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500">Riot ID (Nome#TAG)</label>
              <input data-testid="riot-id-input" value={riotId} onChange={(e) => setRiotId(e.target.value)} placeholder="GAMEIQ#BR1"
                className="w-full mt-1 px-4 py-2.5 rounded-lg bg-[#12141F] border border-white/10 outline-none focus:border-purple-500/50 font-mono"/>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500">Região</label>
              <select data-testid="riot-region-input" value={region} onChange={(e) => setRegion(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-lg bg-[#12141F] border border-white/10 outline-none">
                {REGIONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShow(false)} className="px-4 py-2 rounded-lg border border-white/10">Cancelar</button>
            <button data-testid="riot-link-submit" onClick={link} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 font-bold">Vincular</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
