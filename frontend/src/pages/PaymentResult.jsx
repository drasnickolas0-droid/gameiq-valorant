import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

const MAX_TRIES = 40;

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { getToken } = useAuth();
  const { refreshMe } = useOutletContext();
  const [state, setState] = useState("checking");
  const tries = useRef(0);

  useEffect(() => {
    if (!sessionId) return setState("error");
    let timer;
    const poll = async () => {
      try {
        const r = await buildApi(getToken).get(`/payments/status/${sessionId}`);
        const { payment_status, status } = r.data;
        if (payment_status === "paid") { setState("paid"); refreshMe?.(); return; }
        if (payment_status === "expired" || payment_status === "failed") return setState("failed");
        if (status === "awaiting_payment") setState("awaiting");
      } catch { return setState("error"); }
      tries.current += 1;
      if (tries.current >= MAX_TRIES) return setState((s) => (s === "awaiting" ? "awaiting" : "timeout"));
      timer = setTimeout(poll, 3000);
    };
    poll();
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [sessionId]);

  const views = {
    checking: { icon: Loader2, spin: true, color: "text-cyan-400", t: "Confirmando pagamento...", d: "Isso leva só alguns segundos." },
    awaiting: { icon: Clock, color: "text-amber-300", t: "Aguardando pagamento Pix", d: "Assim que o Pix for confirmado, seu plano é ativado automaticamente. Você pode deixar esta página aberta." },
    paid: { icon: CheckCircle2, color: "text-emerald-400", t: "Pagamento confirmado!", d: "Seu plano foi ativado por 30 dias. Bom treino!" },
    failed: { icon: XCircle, color: "text-red-400", t: "Pagamento não concluído", d: "O pagamento expirou ou falhou. Nenhuma cobrança foi feita." },
    timeout: { icon: Clock, color: "text-amber-300", t: "Ainda processando", d: "Não recebemos a confirmação ainda. Confira Minha Assinatura em alguns minutos." },
    error: { icon: XCircle, color: "text-red-400", t: "Não encontramos esse pagamento", d: "Verifique Minha Assinatura ou tente novamente." },
  };
  const v = views[state];
  return <ResultCard v={v} state={state} />;
}

export function PaymentCancel() {
  return <ResultCard state="cancel" v={{ icon: XCircle, color: "text-slate-400", t: "Pagamento cancelado", d: "Nenhuma cobrança foi feita. Você pode escolher um plano quando quiser." }} />;
}

function ResultCard({ v, state }) {
  const Icon = v.icon;
  return (
    <div data-testid="payment-result-page" className="max-w-lg mx-auto mt-10 p-8 rounded-2xl border border-white/10 bg-[#12141F] text-center">
      <Icon size={52} className={`mx-auto ${v.color} ${v.spin ? "animate-spin" : ""}`} />
      <h1 data-testid={`payment-state-${state}`} className="text-2xl font-black mt-4">{v.t}</h1>
      <p className="text-slate-400 mt-2 text-sm">{v.d}</p>
      <div className="mt-6 flex gap-3 justify-center">
        <Link to="/subscription" data-testid="payment-go-subscription" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-semibold">Minha Assinatura</Link>
        <Link to="/plans" className="px-4 py-2.5 rounded-xl border border-white/10">Planos</Link>
      </div>
    </div>
  );
}
