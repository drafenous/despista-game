# Despista!

**Despista!** é um arcade mobile de perseguição em que o jogador precisa avançar pela cidade, misturar-se à multidão, evitar reconhecimento policial e sobreviver o máximo possível.

## Implementação oficial

A versão em desenvolvimento está em:

```text
godot/
```

Engine:

- **Godot 4.7.2 Standard**
- **GDScript tipado**
- Android e iOS
- viewport lógico 360 × 640 em retrato

Abra diretamente:

```text
godot/project.godot
```

A documentação de arquitetura, controles, testes e export mobile está em [godot/README.md](godot/README.md).

## Estado

A migração Godot já inclui:

- cinco dificuldades;
- geração procedural;
- multidão e obstáculos;
- policiais, reconhecimento, perseguição e BUSTED;
- anti-camping;
- câmeras de vigilância;
- oito power-ups;
- inventário configurável;
- joystick fixo/livre com multitouch;
- HUD, menus, pausa e Game Over;
- áudio;
- recorde e configurações persistentes;
- suspensão/restauração de partidas;
- 50 conquistas;
- suporte de entrada por touch, teclado e gamepad;
- testes headless no GitHub Actions.

## Versão React Native

A implementação React Native/Expo que serviu de etapa intermediária continua temporariamente na raiz para regressão e comparação durante a migração.

A documentação original dessa versão foi preservada em [docs/react-native-mvp.md](docs/react-native-mvp.md).

Ela **não é mais a implementação canônica do jogo**.

## Release

Ainda faltam validações em aparelhos Android/iOS reais e, posteriormente, os serviços online planejados para a release oficial, como conta, ranking global, telemetria competitiva e monetização.
