/**
 * Os limites do formulário de contato, num módulo SEM dependência de servidor.
 *
 * Eles moravam em [[lib/contato-do-responsavel]], e isso derrubou a tela de
 * login inteira com 500: aquele arquivo importa o correio, o correio importa
 * `node:fs`, e o componente do formulário é `"use client"` — bastou a constante
 * do `maxLength` para arrastar o `fs` para dentro do pacote do navegador.
 *
 * Constante compartilhada entre os dois lados precisa de casa própria. O
 * alternativa era escrever 1200 duas vezes, que é como o `maxLength` do campo e
 * o corte do servidor passam a discordar sem ninguém perceber.
 */
export const LIMITE_DE_MENSAGEM = 1200;
export const LIMITE_DE_EMAIL = 254;
