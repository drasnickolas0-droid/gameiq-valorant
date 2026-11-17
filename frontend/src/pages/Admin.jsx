import { useEffect, useState } from "react";
import { useOutletContext, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { buildApi, fmtBRL } from "@/lib/api";
import { toast } from "sonner";
import { Shield, Users, CreditCard, Crown, Edit } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function Admin() {
  const { me } = useOutletContext();
  const { getToken } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(["admin", "member"]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (me?.role !== "admin") return;
    const api = buildApi(getToken);
    api.get("/admin/users").then((r) => { setUsers(r.data.users); setRoles(r.data.roles); });
    api.get("/plans").then((r) => setPlans(r.data));
    api.get("/admin/payments").then((r) => setPayments(r.data));
  }, [getToken, me]);

  if (me && me.role !== "admin") return <Navigate to="/dashboard" replace/>;

  const changeRole = async (uid, role) => {
    try {
      await buildApi(getToken).patch(`/admin/users/${uid}/role`, { role });
      setUsers((us) => us.map((u) => (u.user_id === uid ? { ...u, role } : u)));
      toast.success("Role atualizada");
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const savePlan = async () => {
    const payload = {
      name: editing.name, tagline: editing.tagline, price_cents: parseInt(editing.price_cents, 10),
      features: editing.features.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    await buildApi(getToken).patch(`/admin/plans/${editing.slug}`, payload);
    toast.success("Plano atualizado");
    setEditing(null);
    buildApi(getToken).get("/plans").then((r) => setPlans(r.data));
  };

  return (
    <div data-testid="admin-page" className="space-y-6">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2"><Shield size={14}/> Painel Admin</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Controle <span className="gradient-text">GAMEIQ</span></h1>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        {[["users", "Usuários", Users], ["plans", "Planos", Crown], ["payments", "Pagamentos", CreditCard]].map(([k, l, I]) => (
          <button key={k} data-testid={`admin-tab-${k}`} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 border-b-2 -mb-px ${
              tab === k ? "border-purple-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
            <I size={14}/> {l}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="rounded-2xl border border-white/10 bg-[#12141F] overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-white/5 text-xs uppercase tracking-widest text-slate-400">
              <tr>{["Nome", "E-mail", "Plano", "Role", "Criado em"].map(h => <th key={h} className="text-left p-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} data-testid={`admin-user-${u.user_id}`} className="border-t border-white/5">
                  <td className="p-3">{u.name || u.display_name}</td>
                  <td className="p-3 font-mono text-xs">{u.email}</td>
                  <td className="p-3 uppercase">{u.plan_slug}</td>
                  <td className="p-3">
                    <select data-testid={`role-select-${u.user_id}`} value={u.role} onChange={(e) => changeRole(u.user_id, e.target.value)}
                      className="bg-[#0c0e1a] border border-white/10 rounded px-2 py-1">
                      {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="p-3 font-mono text-xs">{u.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "plans" && (
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.slug} className="p-5 rounded-2xl border border-white/10 bg-[#12141F]">
              <div className="flex justify-between items-center mb-3">
                <div className="font-black text-xl uppercase">{p.name}</div>
                <button data-testid={`edit-plan-${p.slug}`} onClick={() => setEditing({ ...p, features: p.features.join("\n") })} className="p-2 rounded-lg hover:bg-white/5"><Edit size={14}/></button>
              </div>
              <div className="font-mono text-2xl text-cyan-400">{p.price_cents === 0 ? "R$ 0" : fmtBRL(p.price_cents)}</div>
              <p className="text-sm text-slate-400 mt-2">{p.tagline}</p>
              <ul className="mt-3 text-xs text-slate-500 space-y-1">{p.features.map((f) => <li key={f}>• {f}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {tab === "payments" && (
        <div className="rounded-2xl border border-white/10 bg-[#12141F] overflow-x-auto">
          {payments.length === 0 ? <div className="p-6 text-sm text-slate-400">Nenhum pagamento.</div> : (
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-white/5 text-xs uppercase tracking-widest text-slate-400">
                <tr>{["Data", "User ID", "Plano", "Valor", "Status"].map(h => <th key={h} className="text-left p-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="p-3 font-mono text-xs">{p.created_at?.slice(0, 16)?.replace("T", " ")}</td>
                    <td className="p-3 font-mono text-xs">{p.user_id}</td>
                    <td className="p-3 uppercase">{p.plan_slug}</td>
                    <td className="p-3 font-mono">{fmtBRL(p.amount_cents)}</td>
                    <td className="p-3">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="edit-plan-dialog" className="bg-[#0c0e1a] border-purple-500/30 text-white">
          <DialogHeader><DialogTitle>Editar plano {editing?.slug}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <input data-testid="edit-plan-name" value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} placeholder="Nome" className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10"/>
              <input data-testid="edit-plan-tagline" value={editing.tagline} onChange={(e) => setEditing({...editing, tagline: e.target.value})} placeholder="Tagline" className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10"/>
              <input data-testid="edit-plan-price" type="number" value={editing.price_cents} onChange={(e) => setEditing({...editing, price_cents: e.target.value})} placeholder="Preço em centavos" className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10 font-mono"/>
              <textarea data-testid="edit-plan-features" value={editing.features} onChange={(e) => setEditing({...editing, features: e.target.value})} placeholder="Uma feature por linha" rows={5} className="w-full px-3 py-2 rounded bg-[#12141F] border border-white/10"/>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-white/10">Cancelar</button>
            <button data-testid="save-plan-btn" onClick={savePlan} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 font-bold">Salvar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
