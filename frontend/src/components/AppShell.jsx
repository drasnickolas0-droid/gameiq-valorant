import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Show, UserButton, useUser, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { buildApi } from "@/lib/api";
import {
  LayoutDashboard, Brain, Target, Zap, LineChart, User, Crown, CreditCard,
  Gamepad2, Shield, Settings, Menu, X, Trophy
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, test: "nav-dashboard" },
  { to: "/ai-coach", label: "AI Coach", icon: Brain, test: "nav-ai-coach" },
  { to: "/weakness", label: "Weakness Finder", icon: Target, test: "nav-weakness" },
  { to: "/challenges", label: "Desafios", icon: Zap, test: "nav-challenges" },
  { to: "/progress", label: "Progress Tracker", icon: LineChart, test: "nav-progress" },
  { to: "/performance", label: "Valorant Performance", icon: Trophy, test: "nav-performance" },
  { to: "/profile", label: "Player Profile", icon: User, test: "nav-profile" },
  { to: "/riot", label: "Riot Account", icon: Gamepad2, test: "nav-riot" },
  { to: "/plans", label: "Planos", icon: Crown, test: "nav-plans" },
  { to: "/subscription", label: "Minha Assinatura", icon: CreditCard, test: "nav-subscription" },
  { to: "/account", label: "Minha Conta", icon: Settings, test: "nav-account" },
];

export default function AppShell() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    buildApi(getToken).get("/me").then((r) => setMe(r.data)).catch(() => {});
  }, [user, getToken]);

  return (
    <>
      <Show when="signed-out">
        <Navigate to="/sign-in" replace />
      </Show>
      <Show when="signed-in">
        <div className="min-h-screen bg-[#090A0F] text-white flex">
          {/* Sidebar desktop */}
          <aside className="hidden lg:flex w-72 flex-col border-r border-white/5 bg-[#0c0e1a] fixed inset-y-0">
            <Brand />
            <SidebarNav me={me} />
          </aside>

          {/* Mobile top bar */}
          <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#0c0e1a]/95 backdrop-blur border-b border-white/5 px-4 h-14 flex items-center justify-between">
            <Brand compact />
            <div className="flex items-center gap-3">
              <UserButton />
              <button data-testid="mobile-menu-toggle" onClick={() => setOpen(true)}
                className="p-2 rounded-lg hover:bg-white/5"><Menu size={22} /></button>
            </div>
          </header>

          {open && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/80" onClick={() => setOpen(false)}>
              <div className="absolute right-0 top-0 h-full w-80 bg-[#0c0e1a] border-l border-white/5 p-4"
                   onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <Brand />
                  <button onClick={() => setOpen(false)} className="p-2"><X size={22} /></button>
                </div>
                <SidebarNav me={me} onNav={() => setOpen(false)} />
              </div>
            </div>
          )}

          <main className="flex-1 lg:ml-72 pt-14 lg:pt-0">
            <div className="hidden lg:flex items-center justify-end px-8 py-4 border-b border-white/5 gap-4">
              {me?.plan_slug && (
                <span data-testid="header-plan-badge" className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border border-purple-500/40 text-purple-300 bg-purple-500/10">
                  Plano {me.plan_slug}
                </span>
              )}
              <UserButton />
            </div>
            <div className="p-4 sm:p-6 lg:p-10"><Outlet context={{ me, refreshMe: () => buildApi(getToken).get("/me").then(r => setMe(r.data)) }} /></div>
          </main>
        </div>
      </Show>
    </>
  );
}

function Brand({ compact }) {
  return (
    <Link to="/dashboard" data-testid="brand-link" className={`flex items-center gap-2 ${compact ? "" : "px-6 py-6"}`}>
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 grid place-items-center font-black text-white glow-purple">G</div>
      <div>
        <div className="font-black tracking-tight text-lg leading-none">GAME<span className="gradient-text">IQ</span></div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400">Personal Gaming Coach</div>
      </div>
    </Link>
  );
}

function SidebarNav({ me, onNav }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
      {nav.map((n) => {
        const Icon = n.icon;
        return (
          <NavLink key={n.to} to={n.to} data-testid={n.test} onClick={onNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-purple-500/15 text-white border border-purple-500/30 glow-purple"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`
            }>
            <Icon size={18} /> {n.label}
          </NavLink>
        );
      })}
      {me?.role === "admin" && (
        <NavLink to="/admin" data-testid="nav-admin"
          className={({ isActive }) =>
            `mt-4 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all border ${
              isActive ? "bg-cyan-500/15 text-white border-cyan-500/40 glow-cyan"
                       : "border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10"
            }`
          }>
          <Shield size={18} /> Painel Admin
        </NavLink>
      )}
    </nav>
  );
}
