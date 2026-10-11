extends SceneTree

var failures := 0

func _init() -> void:
	_test_difficulty_rules()
	_test_pause_rules()
	_test_impossible_pursuit()
	_test_state_roundtrip()
	if failures == 0:
		print("Despista Godot tests: OK")
		quit(0)
	else:
		push_error("Despista Godot tests: %d failure(s)" % failures)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)

func _test_difficulty_rules() -> void:
	_check(DifficultyRules.config("easy").npc_multiplier == 0.8, "Easy deve ter 20% menos NPCs")
	_check(DifficultyRules.config("medium").auto_scroll == 0.0, "Medium não deve ter auto-scroll")
	_check(DifficultyRules.config("hard").auto_scroll == 40.0, "Hard deve ter auto-scroll 40")
	_check(DifficultyRules.config("pro").cop_multiplier == 1.1, "Pro deve ter +10% policiais")
	_check(DifficultyRules.config("impossible").constant_pursuit, "Impossible deve ter perseguição permanente")
	_check(DifficultyRules.pursuit_escape_target("easy") == 3.0, "Easy deve escapar em 3s")
	_check(DifficultyRules.pursuit_escape_target("hard") == 4.0, "Hard deve escapar em 4s")
	_check(is_inf(DifficultyRules.pursuit_escape_target("impossible")), "Impossible não deve ter fuga natural")

func _test_pause_rules() -> void:
	var game := GameEngine.new(12345)
	game.start("easy")
	game.set_paused(true)
	_check(game.paused, "Easy deve permitir pausa")
	game.start("hard")
	game.set_paused(true)
	_check(not game.paused, "Hard não deve permitir pausa manual")
	game.suspend_app()
	_check(game.suspended, "Suspensão do app deve funcionar no Hard")

func _test_impossible_pursuit() -> void:
	var game := GameEngine.new(12345)
	game.start("impossible")
	_check(game.alert, "Impossible deve iniciar em perseguição")
	_check(game.suspicion == 100.0, "Impossible deve iniciar com suspeita máxima")

func _test_state_roundtrip() -> void:
	var game := GameEngine.new(12345)
	game.start("medium")
	game.set_input(1.0, 0.0)
	for _i in range(30):
		game.step(1.0 / 60.0)
	var before := game.snapshot()
	var saved := game.export_state()
	var restored := GameEngine.new(999)
	_check(restored.restore_state(saved), "Estado salvo deve restaurar")
	var after := restored.snapshot()
	_check(absf(float(before.elapsed) - float(after.elapsed)) < 0.001, "Tempo deve ser preservado")
	_check(absf(float(before.player.x) - float(after.player.x)) < 0.001, "Posição do player deve ser preservada")
	_check(restored.suspended, "Run restaurada deve voltar suspensa")
