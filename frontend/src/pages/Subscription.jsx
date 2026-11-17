import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { buildApi, fmtBRL } from "@/lib/api";
import { toast } from "sonner";
import { label } from "@/lib/labels";

export default function Subscription() {
  const { me, refreshMe } = useOutletContext();
  const { getToken } = useAuth();
  const [sub, setSub] = useState(null);
  const [payments, setPayments] = useState([]);

  const load = () => {
    const api = buildApi(getToken);
    api.get("/subscription").then((r) => setSub(r.data));
    api.get("/payments").then((r) => setPayments(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const cancel = async () => {
    if (!confirm("Voltar ao plano Free agora? O tempo restante do plano pago será perdido e não há reembolso automático.")) return;
    await buildApi(getToken).post("/subscription/cancel");
    toast.success("Você voltou ao plano Free");
    refreshMe?.(); load();
  };

  if (!sub) return null;
  const isPaid = sub.plan_slug !== "free";
  const expDate = sub.expires_at ? new Date(sub.expires_at) : null;
  const daysLeft = expDate ? Math.max(0, Math.ceil((expDate - Date.now()) / 86400000)) : null;

  return (
    <div data-testid="subscription-page" className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Minha Assinatura</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Detalhes do <span className="gradient-text">plano</span></h1>
      </div>

      {isPaid && daysLeft !== null && daysLeft <= 5 && (
        <div data-testid="renew-banner" className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
          Seu plano vence em <b>{daysLeft} {daysLeft === 1 ? "dia" : "dias"}</b>. Renove para não perder o acesso — o tempo novo é somado ao que resta.
        </div>
      )}

      <div className="p-6 rounded-2xl border border-white/10 bg-[#12141F] grid sm:grid-cols-2 gap-5">
        <Row label="Plano atual" value={sub.plan_slug.toUpperCase()} highlight/>
        <Row label="Status" value={<span className={`font-bold ${sub.status === "cancelled" ? "text-red-400" : "text-emerald-400"}`}>{label(sub.status)}</span>}/>
        <Row label="Conta GAMEIQ" value={me?.email}/>
        <Row label="Valor pago" value={sub.price_cents === 0 ? "Gratuito" : fmtBRL(sub.price_cents)}/>
        <Row label="Início" value={sub.started_at?.slice(0, 10) || "—"}/>
        <Row label="Válido até" value={expDate ? `${expDate.toLocaleDateString("pt-BR")} (${daysLeft}d)` : "—"}/>
        <Row label="Forma de pagamento" value={sub.payment_method || "—"}/>
        <Row label="E-mail da assinatura" value={sub.account_email}/>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/plans" data-testid="sub-change-plan" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-semibold">{isPaid ? "Renovar ou trocar plano" : "Fazer upgrade"}</Link>
        {isPaid && (
          <button data-testid="sub-cancel" onClick={cancel} className="px-5 py-2.5 rounded-xl border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/10">Voltar ao Free agora</button>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">Histórico de pagamentos</h2>
        <div className="rounded-2xl border border-white/10 bg-[#12141F] overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">Nenhum pagamento registrado ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-slate-400">
                <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Plano</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} data-testid={`payment-row-${p.id}`} className="border-t border-white/5">
                    <td className="p-3 font-mono">{p.created_at?.slice(0, 10)}</td>
                    <td className="p-3 uppercase">{p.plan_slug}</td>
                    <td className="p-3 font-mono">{fmtBRL(p.amount_cents)}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-300">{label(p.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
function Row({ label, value, highlight }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 font-mono ${highlight ? "text-xl text-purple-300 font-bold" : "text-white"} break-all`}>{value}</div>
    </div>
  );
}
