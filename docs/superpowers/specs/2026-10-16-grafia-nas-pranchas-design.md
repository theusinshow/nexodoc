# Grafia nas pranchas — desenho (16/10/2026)

## O pedido

Enrijecer a conferência antes de montar o volume: achar palavra errada no texto
das pranchas e dos selos. Caso real: "BOXA" (bocha) num volume de topografia de
terceirizado.

## O que a medição mudou

- **O dicionário pt-BR aceita "boxa"** (verbo boxar) e "calcada" (calcar). Um
  corretor de dicionário não pega o caso que motivou o pedido: o erro é de
  CONTEXTO.
- **O texto único de um volume é pequeno.** 138-26 (33 pranchas): 48 mil
  caracteres extraídos, 306 linhas únicas, ~7 mil caracteres, ~2 mil tokens.
  Ler tudo com `gpt-6-luna` custa ~US$ 0,0003.
- `nspell` leva mais de 2 min para carregar o dicionário pt; `hunspell-asm`
  (o hunspell em WebAssembly) carrega em ~250 ms.

## Desenho

1. **Onde:** no mesmo botão "Conferir" do card de conferência, em paralelo à
   conferência leve. Os achados entram no MESMO resultado (campo `grafia`) — e
   por isso na coluna da conferência do canvas, por arquivo.
2. **Extração (cliente, sem IA):** pdf.js por folha lida (`selos`), reparo de
   fonte de CAD (`repararTextoCad`), linhas por posição. O que veio de fonte
   quebrada fica marcado `recuperada` (os acentos dele não valem); o que nem o
   reparo salvou é descartado. Linhas sem 3 letras seguidas saem. Linha
   repetida vira uma só, com as folhas onde aparece.
3. **Teto:** 60 mil caracteres de linhas únicas. Passou, o resultado diz
   "grafia conferida em X de Y folhas" — nunca corte calado.
4. **Servidor (`/api/nexo/grafia-check`):**
   - **Rede do dicionário:** hunspell pt-BR + exceções do escritório (siglas,
     normas). Palavra fora do dicionário vira SUSPEITA, sempre, sem variar entre
     corridas. Não roda em linha `recuperada`.
   - **IA:** lê as linhas numeradas e as suspeitas; devolve erros
     `{linha, errado, certo, motivo}` e um juízo por suspeita (erro ou nome
     próprio/termo técnico).
   - **Trava:** achado só vale se `errado` existe literalmente na linha, e
     `certo` é diferente. Em linha `recuperada`, erro só de acento é descartado.
5. **Gravidade:** erro da IA → `aviso`. Suspeita do dicionário que a IA chamou
   de erro → `aviso`; que a IA NÃO julgou → `info` ("fora do dicionário,
   conferir"); que a IA disse ser nome/termo → some. Grafia nunca vira
   "Não emitir".
6. **Falha:** se a grafia falhar (rede, teto), a conferência leve sai igual e
   ganha um `aviso` "grafia não conferida: motivo".

## Prova

- Unidade: remoção de repetição, legibilidade, trava, mescla dicionário+IA.
- Corrida real: 138-26 (não pode inventar erro grave) e o volume de topografia
  com "boxa" (tem de achar — arquivo a pedir ao Matheus).
