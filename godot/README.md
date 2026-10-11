# Despista! — Godot

Projeto mobile oficial em **Godot 4 + GDScript tipado**, reconstruído a partir do protótipo validado.

## Abrir

Abra `godot/project.godot` no **Godot 4.7.2 Standard**.

A simulação usa uma área lógica fixa de **360 × 640** em retrato para manter gameplay e métricas independentes da resolução física.

## Estado da migração

Já portado:

- 5 dificuldades: Fácil, Médio, Difícil, Pro e Impossível;
- geração procedural de mundo;
- NPCs, obstáculos e separação da multidão;
- policiais, reconhecimento, perseguição, BUSTED e anti-camping;
- quatro tipos de câmera de vigilância;
- 8 power-ups e inventário de 3 slots;
- HUD, menu, pause e Game Over;
- joystick fixo/livre e multitouch;
- teclado/gamepad usando os mesmos comandos do touch;
- áudio de perseguição/coleta/uso;
- recorde, configurações e partida suspensa;
- suspensão/retorno do aplicativo;
- catálogo e progresso das 50 conquistas;
- testes headless e smoke test no GitHub Actions.

## Controles

### Touch

- **Joystick fixo:** canto inferior esquerdo.
- **Joystick livre:** aparece no primeiro toque válido.
- Um segundo dedo pode usar os power-ups sem interromper o joystick.

### Desktop / controle

- Setas/D-pad: movimento.
- Teclas 1, 2 e 3: power-ups.
- Gamepad A, B e X: slots 1, 2 e 3.
- Escape/Start: pause, quando permitido pela dificuldade.

## Export Android

O preset **Android** já usa:

- package: `com.despista.app`;
- arquitetura ARM64;
- modo imersivo;
- versão inicial `0.1.0`.

Configure no Godot os caminhos do **OpenJDK 17** e do **Android SDK** antes de exportar. Assinatura de release/keystore deve permanecer fora do repositório.

## Export iOS

O preset **iOS** já usa o bundle ID `com.despista.app`, ARM64 e orientação retrato.

Antes de exportar no macOS, abra **Project → Export → iOS** e informe o seu **Apple App Store Team ID**. Ele não é commitado aqui.

## Testes

Localmente, com Godot no PATH:

```bash
godot --headless --path godot --script res://tests/test_game_engine.gd
godot --headless --path godot --script res://tests/test_achievements.gd
```

O workflow `Godot CI` também:

1. baixa Godot 4.7.2 Standard;
2. importa e valida o projeto;
3. inicializa a cena principal headless;
4. executa os testes do gameplay;
5. executa os testes de conquistas.

## Arquitetura

- `scripts/game/GameEngine.gd`: simulação e regras;
- `scripts/game/GameView.gd`: renderização;
- `scripts/ui/`: HUD, inventário, ícones e touch;
- `scripts/achievements/`: catálogo e tracking;
- `scripts/core/`: dificuldade, persistência e áudio;
- `scripts/Main.gd`: ciclo do app e integração entre sistemas.

A versão React Native permanece na raiz **somente como referência executável durante a migração**. O código Godot não depende dela.
