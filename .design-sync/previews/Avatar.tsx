import { Avatar } from "nexo-ds";

const quadro = { padding: 24, display: "flex", gap: 12, alignItems: "center" };

export const Equipes = () => (
  <div style={quadro}>
    <Avatar iniciais="MR" cor={{ tom: "arq", admin: false, rotulo: "Arquitetura" }} />
    <Avatar iniciais="LS" cor={{ tom: "est", admin: false, rotulo: "Estrutural" }} />
    <Avatar iniciais="PC" cor={{ tom: "comp", admin: false, rotulo: "Complementares" }} />
    <Avatar iniciais="JV" />
  </div>
);

export const Tamanhos = () => (
  <div style={quadro}>
    <Avatar iniciais="MR" pequeno cor={{ tom: "est", admin: false, rotulo: "Estrutural" }} />
    <Avatar iniciais="MR" cor={{ tom: "est", admin: false, rotulo: "Estrutural" }} />
    <Avatar iniciais="MR" grande cor={{ tom: "est", admin: true, rotulo: "Estrutural · admin" }} />
  </div>
);
