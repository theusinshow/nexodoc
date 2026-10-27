/*
 * Entrada do design-sync: o recorte "essencial" do sistema ds (components/ds/basicos.tsx)
 * mais a raiz `.ds`. O Orbe fica de fora: ele aponta para /marca/*.png do app, que não
 * existe no Claude Design (ver .design-sync/NOTES.md).
 */
export { Botao, Selo, Segmento, Seletor, Tecla, Avatar, Girando, Esqueleto, NumeroQueChega, Menu } from "../components/ds/basicos";
export { RaizDs } from "./base/raiz-ds";
