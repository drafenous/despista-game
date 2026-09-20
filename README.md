# Despista! — React Native MVP

Migração do MVP web v44 para **React Native + Expo SDK 55 + Skia**.
O jogo é desenhado nativamente; não usa WebView. Android e iOS são os alvos desta entrega.

## Executar

Requisitos: Node.js 20.19.4+ (ou LTS mais recente compatível), npm e celular/emulador.

```bash
npm ci
npm start
```

Abra o QR code com uma versão do **Expo Go compatível com SDK 55**.
Mantenha computador e celular na mesma rede. O Skia já faz parte do Expo Go compatível.
A instalação normal de dependências precisa de internet, incluindo acesso aos binários do Skia hospedados no GitHub.

- Android com emulador configurado: `npm run android`.
- iOS com simulador no macOS/Xcode: `npm run ios`.
- Se o Expo Go instalado não aceitar SDK 55, use um development build:
  `npx expo run:android` ou `npx expo run:ios` (este último requer macOS/Xcode).
  Esses comandos geram os projetos nativos localmente; a primeira execução pode solicitar identificadores do aplicativo.
- Este pacote contém o projeto-fonte, **não um APK/IPA**. Não houve publicação em lojas.
- O projeto não configura um alvo web. O HTML original está em `tests/original-v44.html` apenas como referência de regressão.

## O que foi migrado

- Cinco dificuldades: Fácil, Médio, Difícil, Pro e Impossível.
- Geração procedural de multidão, obstáculos, policiais e câmeras.
- Movimento em quatro direções, colisões sólidas e cobertura pela multidão.
- Suspeita, reconhecimento, perseguidor principal, anti-camping e desvios policiais.
- Captura por 1,5 segundo de contato; fuga por 3s no Fácil/Médio e 4s no Difícil/Pro.
- Impossível com perseguição permanente (com a exceção temporária do item Fuga).
- Rolagem automática em Difícil/Pro/Impossível; câmera nunca recua.
- Oito itens: Fuga imediata, Sabonete, Patins, Cajado e Moisés, Manto da invisibilidade, Teletransporte, Escudo e Máquina do tempo.
- Inventário de três slots, distribuição variada de itens e indicadores de efeitos.
- Distância percorrida pelo jogador separada da distância de avanço da tela.
- Direcional touch, botões nativos, ícones vetoriais, menus e pausa.
- Pausa ao entrar em segundo plano ou pressionar Voltar no Android.
- Recorde local persistente com AsyncStorage. O recorde do navegador não é importado automaticamente.

A lógica usa uma área de jogo de 360 × 640, escalada proporcionalmente dentro da área segura.
Isso mantém a mesma geometria e dificuldade entre proporções de tela diferentes.
O recorde continua sendo o maior tempo geral, como no MVP; não é um ranking competitivo.


## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `App.tsx` | Menu, HUD, inventário e ciclo de vida do aplicativo |
| `src/game/engine.js` | Regras e desenhos portados do MVP, sem DOM ou armazenamento |
| `src/game/types.ts` | Tipos e opções da interface |
| `src/game/icons.js` | Ícones SVG originais dos itens |
| `src/render/SkiaContext.ts` | Operações de desenho do MVP convertidas em chamadas Skia |
| `src/components/GameCanvas.tsx` | Simulação em passos fixos e gravação das cenas |
| `src/components/Joystick.tsx` | Joystick fixo (canto) em quatro direções |
| `src/components/FloatingJoystick.tsx` | Joystick livre (aparece no ponto do toque) |
| `src/storage/records.ts` | Recorde local e gravações serializadas |
| `tests/engine.test.cjs` | Regressão e comparação determinística com o HTML v44 |
| `tests/render.cjs` | Teste de renderização real com Skia/CanvasKit, sem aparelho |

O motor mantém JavaScript para preservar o port direto e facilitar a comparação com o original.
A camada React Native e o adaptador gráfico usam TypeScript. Não há dependências do navegador no código de produção.

## Validação realizada

```bash
npm run typecheck
npm test
npx expo install --check
npx expo export --platform android --platform ios
```

- TypeScript: passou.
- 12 testes: passaram, incluindo a comparação frame a frame nas cinco dificuldades.
- Dependências: compatíveis com a tabela embarcada no Expo 55.0.31 (verificação offline).
- Bundles Hermes para Android e iOS: exportados com sucesso.
- Renderização de 120 frames com as APIs reais de Skia/CanvasKit: passou; imagem inspecionada visualmente.
- **Ainda não validado em celular/emulador nativo.** Exportar bundles não equivale a compilar ou executar APK/IPA.
- Neste ambiente, o download dos binários nativos Skia foi bloqueado por timeout do proxy.
  A instalação local de validação usou `--ignore-scripts`; não use esse atalho ao preparar um build nativo.
- Os controles, multitouch, persistência entre reinícios e desempenho precisam do teste final em Android/iOS.

Para reproduzir a renderização offscreen (opcional), informe uma fonte TTF disponível no seu computador:

```bash
DESPISTA_TEST_FONT=/caminho/fonte.ttf node tests/render.cjs
```

O teste usa CanvasKit apenas em desenvolvimento; o aplicativo usa Skia nativo.
A imagem gerada por esse teste mostra a cena do motor, sem a interface React Native.

## Ajustes deliberados na migração

1. Itens não podem ser consumidos durante a pausa.
2. Um NPC com o timer de patrulha vencido não volta a andar durante o congelamento do tempo.
3. Reiniciar limpa a direção anterior do controle.
4. O loop usa passos fixos de 1/60s e descarta atrasos excessivos para evitar saltos após interrupções.
5. Título e interface passam a usar Despista!.
6. O recorde local trata leitura/gravação com falhas sem impedir a partida.

## Próximas etapas da release oficial

As decisões de produto continuam preservadas, mas não foram implementadas nesta migração:

- Convidado e autenticação Google, Apple, Facebook e X.
- Identidade interna do jogador, username, ranking global, histórico e sincronização.
- Validação de resultados no servidor; o cliente sozinho não é confiável para ranking competitivo.
- Anúncios moderados fora da partida e recompensas apenas não competitivas.
- Premium, preferencialmente compra única, sem anúncios e com Pro/Impossível ilimitados.
- Sem vantagens competitivas pagas.

Nesta versão todos os modos estão abertos para testar o gameplay. Não há anúncios, compras, login fictício ou serviços externos configurados.

## Referências de implementação

- [Compatibilidade Expo SDK](https://docs.expo.dev/versions/v55.0.0/)
- [Skia no Expo](https://docs.expo.dev/versions/v55.0.0/sdk/skia/)
- [Skia Picture API](https://shopify.github.io/react-native-skia/docs/shapes/pictures/)
- [AsyncStorage no Expo](https://docs.expo.dev/versions/v55.0.0/sdk/async-storage/)
