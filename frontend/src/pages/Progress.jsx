import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { buildApi } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

export default function Progress() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => { buildApi(getToken).get("/stats/summary").then((r) => setStats(r.data)); }, [getToken]);

  return (
    <div data-testid="progress-page" className="space-y-6">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Progress Tracker</div>
        <h1 className="text-4xl font-black uppercase tracking-tight mt-2">Evolução <span className="gradient-text">competitiva</span></h1>
      </div>

      {!stats?.timeline?.length ? (
        <div className="p-12 rounded-2xl border border-white/10 bg-[#12141F] text-center text-slate-400">
          Registre pelo menos 1 partida para ver gráficos de evolução.
        </div>
      ) : (
        <>
          <Chart title="ACS ao longo do tempo" data={stats.timeline} key1="acs" color="#A855F7"/>
          <Chart title="K/D ao longo do tempo" data={stats.timeline} key1="kd" color="#06B6D4"/>
          <Chart title="KAST (%) ao longo do tempo" data={stats.timeline} key1="kast" color="#10B981"/>
        </>
      )}
    </div>
  );
}
function Chart({ title, data, key1, color }) {
  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-[#12141F]">
      <h3 className="font-bold mb-4">{title}</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`g${key1}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5}/>
                <stop offset="100%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="date" stroke="#64748b" fontSize={11}/>
            <YAxis stroke="#64748b" fontSize={11}/>
            <Tooltip contentStyle={{ background: "#0c0e1a", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8 }}/>
            <Area type="monotone" dataKey={key1} stroke={color} fill={`url(#g${key1})`} strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
