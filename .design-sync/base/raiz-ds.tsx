import type { CSSProperties, ReactNode } from "react";

/**
 * A raiz do sistema ds: o equivalente, fora do app Next, ao `<div className={`ds ${FONTES_DS}`}>`
 * que toda tela migrada tem. Sem ela os componentes ficam sem estilo — todo o `app/ds.css`
 * mora sob `.ds` — e sem a Geist. Envolva a tela (ou o protótipo) inteiro uma vez.
 */
export function RaizDs({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="ds"
      style={{
        ["--font-ds-sans" as string]: '"Geist"',
        ["--font-ds-mono" as string]: '"Geist Mono"',
        minHeight: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
