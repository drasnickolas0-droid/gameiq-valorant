import { Link } from "react-router-dom";
import { Show, SignInButton } from "@clerk/react";
import { Brain, Target, Zap, LineChart, Trophy, Shield, ChevronRight, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-white overflow-hidden">
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="landing-brand" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 grid place-items-center font-black">G</div>
            <span className="font-black tracking-tight text-lg">GAME<span className="gradient-text">IQ</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <a href="#features" className="hover:text-white">Recursos</a>
            <a href="#plans" className="hover:text-white">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link to="/sign-in" data-testid="landing-signin" className="text-sm text-slate-300 hover:text-white">Entrar</Link>
              <Link to="/sign-up" data-testid="landing-signup"
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:to-cyan-500 transition-all glow-purple">
                Criar conta
              </Link>
            </Show>
            <Show when="signed-in">
              <Link to="/dashboard" data-testid="landing-dashboard"
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500">
                Dashboard
              </Link>
            </Show>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 bg-grid">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[180px]"/>
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[120px]"/>
        </div>
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-300 mb-8">
            <Sparkles size={14} /> Powered by Claude Sonnet 5.5 · Valorant Coaching
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight uppercase leading-[0.95]">
            Seu <span className="gradient-text">treinador pessoal</span><br/>
            de Valorant
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-300 leading-relaxed">
            Análises profundas, desafios personalizados e um AI Coach que te leva do Bronze ao Radiante.
            Feito para competidores sérios.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/sign-up" data-testid="hero-cta-signup"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold glow-purple hover:scale-[1.02] transition-transform">
              Começar grátis <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform"/>
            </Link>
            <a href="#features" className="px-6 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 font-semibold">Ver recursos</a>
          </div>

          <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { v: "K/D", l: "Análise Precisa" },
              { v: "ACS", l: "Métricas Pro" },
              { v: "AI", l: "Coaching 24/7" },
              { v: "∞", l: "Evolução" },
            ].map((s) => (
              <div key={s.l} className="p-4 rounded-xl border border-white/10 bg-white/5">
                <div className="font-mono text-2xl font-bold text-cyan-400">{s.v}</div>
                <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-center">
            Tudo que você precisa para <span className="gradient-text">evoluir</span>
          </h2>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { i: Brain, t: "AI Coach", d: "Treinador virtual com Claude Sonnet 5.5 que analisa suas partidas e responde dúvidas em tempo real." },
              { i: Target, t: "Weakness Finder", d: "Questionário inteligente que identifica seus 3 maiores pontos fracos e sugere exercícios concretos." },
              { i: Zap, t: "Challenge Generator", d: "Desafios diários gerados por IA baseados nas suas estatísticas reais." },
              { i: LineChart, t: "Progress Tracker", d: "Gráficos de K/D, ACS, KAST e ADR ao longo do tempo." },
              { i: Trophy, t: "Valorant Performance", d: "Análise por agente, por mapa e histórico completo de partidas." },
              { i: Shield, t: "Riot Account", d: "Vincule sua conta Riot (integração oficial pendente de aprovação). Entrada manual disponível." },
            ].map((f) => (
              <div key={f.t} className="group p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#12141F] to-[#0c0e1a] hover:border-purple-500/40 hover:glow-purple transition-all">
                <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-400 grid place-items-center mb-4 group-hover:bg-purple-500/25">
                  <f.i size={22} />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.t}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="py-20 border-t border-white/5 bg-[#0a0b14]">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">Planos sob medida</h2>
          <p className="mt-4 text-slate-400">Free, Pro ou Elite — escolha o plano que combina com sua jornada.</p>
          <Link to="/plans" data-testid="landing-plans-cta"
            className="inline-flex mt-8 items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 font-bold">
            Ver planos <ChevronRight size={18}/>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 text-center text-sm text-slate-500">
        © 2026 GAMEIQ. Valorant é marca registrada da Riot Games. Integração oficial pendente de aprovação.
      </footer>
    </div>
  );
}
