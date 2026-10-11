# Despista! — Godot

Projeto mobile oficial em **Godot 4 + GDScript tipado**, reconstruído a partir do protótipo validado.

## Abrir

Abra `godot/project.godot` no Godot 4.

A simulação usa uma área lógica fixa de **360 × 640** em retrato para manter gameplay e métricas independentes da resolução física.

## Princípios da migração

- Android e iOS são os alvos atuais.
- Nintendo Switch permanece uma possibilidade futura; lógica de plataforma fica isolada.
- Gameplay não depende diretamente de touch. Touch, teclado e controle geram os mesmos comandos.
- Menus usam controles nativos do Godot para manter navegação por teclado/gamepad.
- A versão React Native permanece na raiz apenas como referência executável durante a migração.
