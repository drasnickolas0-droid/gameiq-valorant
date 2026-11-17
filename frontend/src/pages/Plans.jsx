import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { buildApi, fmtBRL } from "@/lib/api";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export default function Plans() {
  const { me, refreshMe } = useOutletContext();
  const { getToken } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => { buildApi(getToken).get("/plans").then((r) => setPlans(r.data)); }, [getToken]);

  const subscribe = async () => {
    if (!selected) return;
    if (confirmEmail.trim().toLowerCase() !== (me?.email || "").toLowerCase())
      return toast.error("O e-mail digitado não corresponde à sua conta GAMEIQ");
    setBusy(true);
    try {
      const api = buildApi(getToken);
      if (selected.slug === "free") {
        await api.post("/subscription/cancel");
        toast.success("Você voltou ao plano Free");
        setSelected(null); setConfirmEmail(""); refreshMe?.();
        return;
      }
      const r = await api.post("/payments/checkout", {
        plan_slug: selected.slug, confirm_email: confirmEmail, origin_url: window.location.origin,
      });
      window.location.href = r.data.checkout_url;
    } catch (e) { toast.error(e.response?.data?.detail || "Erro ao iniciar pagamento"); }
    finally { setBusy(false); }
  };

  return (
    <div data-testid="plans-page" className="space-y-8">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Planos</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Escolha seu <span className="gradient-text">plano</span></h1>
        <p className="text-slate-400 mt-2">Pagamento mensal avulso com cartão ou Pix. Cada compra libera 30 dias de acesso; renove quando quiser.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div key={p.slug} data-testid={`plan-${p.slug}`}
            className={`relative p-6 rounded-2xl border bg-[#12141F] flex flex-col ${
              p.highlighted ? "border-purple-500/50 glow-purple" : "border-white/10"}`}>
            {p.highlighted && <span className="absolute -top-3 left-6 px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full">Mais popular</span>}
            <div className="flex items-center gap-2"><Crown size={16} className="text-purple-400"/><span className="text-sm font-mono uppercase tracking-widest text-slate-400">{p.name}</span></div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-black">{p.price_cents === 0 ? "R$ 0" : fmtBRL(p.price_cents)}</span>
              {p.price_cents > 0 && <span className="text-xs text-slate-400">/ mês</span>}
            </div>
            <p className="text-sm text-slate-400 mt-2">{p.tagline}</p>
            <ul className="mt-5 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-300"><Check size={16} className="text-cyan-400 mt-0.5 shrink-0"/> {f}</li>
              ))}
            </ul>
            <button data-testid={`plan-select-${p.slug}`} onClick={() => { setSelected(p); setConfirmEmail(""); }}
              disabled={me?.plan_slug === p.slug && p.slug === "free"}
              className={`mt-6 w-full py-3 rounded-xl font-bold transition-all ${
                me?.plan_slug === p.slug && p.slug === "free" ? "bg-white/5 text-slate-400 cursor-not-allowed"
                : p.highlighted ? "bg-gradient-to-r from-purple-600 to-cyan-500 glow-purple hover:scale-[1.02]"
                : "border border-white/10 hover:bg-white/5"}`}>
              {me?.plan_slug === p.slug ? (p.slug === "free" ? "Plano atual" : "Renovar +30 dias") : p.price_cents === 0 ? "Voltar ao Free" : "Assinar 1 mês"}
            </button>
          </div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent data-testid="plan-confirm-dialog" className="bg-[#0c0e1a] border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">Confirmar assinatura do plano {selected?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Por segurança, confirme que esta é a conta GAMEIQ que receberá a assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
              <div className="text-[11px] uppercase tracking-widest text-cyan-400">Conta vinculada</div>
              <div className="font-mono mt-1">{me?.email}</div>
              <div className="text-xs text-slate-400 mt-2">
                Valor: <span className="font-mono text-white">{selected && (selected.price_cents === 0 ? "R$ 0" : fmtBRL(selected.price_cents))}</span>
                {" · "}Pagamento: <span className="text-purple-300 font-semibold">{selected?.slug === "free" ? "nenhum" : "Cartão ou Pix · 30 dias"}</span>
              </div>
            </div>
            <label className="block text-sm">Digite seu e-mail para confirmar</label>
            <input data-testid="confirm-email-input" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={me?.email} className="w-full px-4 py-2.5 rounded-lg bg-[#12141F] border border-white/10 outline-none focus:border-purple-500/50"/>
          </div>
          <DialogFooter>
            <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg border border-white/10">Cancelar</button>
            <button data-testid="confirm-subscribe-btn" onClick={subscribe} disabled={busy}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 font-bold disabled:opacity-50">
              {busy ? "Aguarde..." : selected?.slug === "free" ? "Voltar ao Free" : "Ir para pagamento"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-center text-xs text-slate-500">
        <Link to="/subscription" className="underline hover:text-cyan-400">Ver Minha Assinatura</Link>
      </div>
    </div>
  );
}
