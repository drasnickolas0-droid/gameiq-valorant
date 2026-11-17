import { useOutletContext } from "react-router-dom";
import { useUser, useAuth } from "@clerk/react";
import { useState, useEffect } from "react";
import { buildApi } from "@/lib/api";
import { toast } from "sonner";

export default function Account() {
  const { me, refreshMe } = useOutletContext();
  const { user } = useUser();
  const { getToken, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [goal, setGoal] = useState("");
  const [rank, setRank] = useState("");

  useEffect(() => {
    if (me) { setDisplayName(me.display_name || ""); setGoal(me.goal || ""); setRank(me.rank || ""); }
  }, [me]);

  const save = async () => {
    await buildApi(getToken).patch("/me", { display_name: displayName, goal, rank });
    toast.success("Perfil atualizado"); refreshMe?.();
  };

  const changeEmail = () => user?.createEmailAddress && toast.info("Use o menu do avatar (canto superior direito) → Gerenciar conta → Email para alterar com segurança.");
  const changePassword = () => toast.info("Use o menu do avatar → Gerenciar conta → Senha para alterar com segurança.");
  const uploadAvatar = () => toast.info("Use o menu do avatar → Gerenciar conta → Foto para alterar.");

  const deleteAccount = async () => {
    if (!confirm("Excluir sua conta GAMEIQ? Isso remove todos seus dados e NÃO pode ser desfeito.")) return;
    if (!confirm("Confirma? Última chance.")) return;
    await buildApi(getToken).delete("/me");
    toast.success("Conta excluída");
    await signOut();
  };

  if (!me) return null;

  return (
    <div data-testid="account-page" className="space-y-6 max-w-3xl">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Minha Conta</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Perfil <span className="gradient-text">GAMEIQ</span></h1>
      </div>

      <div className="p-6 rounded-2xl border border-white/10 bg-[#12141F] flex gap-5 items-center">
        {me.avatar_url ? <img src={me.avatar_url} alt="" className="w-20 h-20 rounded-xl"/> :
          <div className="w-20 h-20 rounded-xl bg-purple-500/20 grid place-items-center text-2xl font-black">{me.name?.[0] || "G"}</div>}
        <div className="flex-1">
          <div className="font-bold text-lg">{me.name}</div>
          <div className="text-sm text-slate-400 font-mono">{me.email}</div>
          <div className="text-xs text-slate-500 mt-1">Conta criada: {me.created_at?.slice(0, 10)}</div>
        </div>
        <button data-testid="account-avatar-btn" onClick={uploadAvatar} className="px-3 py-2 rounded-lg border border-white/10 text-sm">Alterar foto</button>
      </div>

      <div className="p-6 rounded-2xl border border-white/10 bg-[#12141F] space-y-4">
        <Field label="Nome de exibição" testId="account-displayname">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-[#0c0e1a] border border-white/10 outline-none focus:border-purple-500/50"/>
        </Field>
        <Field label="Patente atual (ex: Imortal 2)" testId="account-rank">
          <input value={rank} onChange={(e) => setRank(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-[#0c0e1a] border border-white/10 outline-none focus:border-purple-500/50"/>
        </Field>
        <Field label="Objetivo competitivo" testId="account-goal">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: Chegar no Imortal esta temporada" className="w-full px-4 py-2.5 rounded-lg bg-[#0c0e1a] border border-white/10 outline-none focus:border-purple-500/50"/>
        </Field>
        <button data-testid="account-save" onClick={save} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold">Salvar</button>
      </div>

      <div className="p-6 rounded-2xl border border-white/10 bg-[#12141F] space-y-3">
        <h2 className="font-bold text-lg">Segurança</h2>
        <div className="flex flex-wrap gap-2">
          <button data-testid="account-change-email" onClick={changeEmail} className="px-4 py-2 rounded-lg border border-white/10 text-sm">Alterar e-mail</button>
          <button data-testid="account-change-password" onClick={changePassword} className="px-4 py-2 rounded-lg border border-white/10 text-sm">Alterar senha</button>
        </div>
        <p className="text-xs text-slate-500">Essas alterações são feitas no menu do seu avatar (topo da página), com verificação de segurança via Clerk.</p>
      </div>

      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-3">
        <h2 className="font-bold text-lg text-red-300">Zona de perigo</h2>
        <p className="text-sm text-slate-400">Excluir sua conta remove todos seus dados do GAMEIQ. Essa ação é permanente.</p>
        <button data-testid="account-delete" onClick={deleteAccount} className="px-4 py-2 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/10">Excluir conta</button>
      </div>
    </div>
  );
}
function Field({ label, children, testId }) {
  return (
    <div data-testid={testId}>
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
