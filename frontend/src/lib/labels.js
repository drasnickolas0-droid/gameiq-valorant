const MAP = {
  active: "Ativo", active_demo: "Ativo (demonstração)", cancelled: "Cancelado", demo: "Demonstração",
  win: "Vitória", loss: "Derrota", draw: "Empate",
  easy: "Fácil", medium: "Médio", hard: "Difícil",
  manual_linked_pending_riot_approval: "Vinculada manualmente · integração oficial pendente de aprovação Riot",
  pending_riot_approval: "Integração oficial pendente de aprovação Riot",
  admin: "Admin", member: "Membro",
};
export const label = (v) => MAP[v] || v;
