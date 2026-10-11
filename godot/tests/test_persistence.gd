extends SceneTree

var failures := 0

func _init() -> void:
	var saver_script := load("res://scripts/core/SaveManager.gd")
	var saver: Node = saver_script.new()
	root.add_child(saver)

	var game := GameEngine.new(24680)
	game.start("hard")
	game.set_input(1.0, 0.0)
	for _i in range(45):
		game.step(1.0 / 60.0)
	game.suspend_app()

	var before := game.snapshot()
	_check(saver.save_run(game.export_state()), "SaveManager deve gravar a run em JSON")
	_check(saver.has_run(), "Run gravada deve ser detectável")

	var serialized: Dictionary = saver.load_run()
	_check(not serialized.is_empty(), "Run serializada deve poder ser lida")

	var restored := GameEngine.new(999)
	_check(restored.restore_state(serialized), "Estado vindo do JSON deve restaurar no motor")
	var after := restored.snapshot()
	_check(restored.suspended, "Run restaurada deve permanecer suspensa")
	_check(str(after.difficulty) == "hard", "Dificuldade deve sobreviver ao JSON")
	_check(absf(float(before.elapsed) - float(after.elapsed)) < .001, "Tempo deve sobreviver ao JSON")
	_check(absf(float(before.player.x) - float(after.player.x)) < .001, "Posição X deve sobreviver ao JSON")
	_check(absf(float(before.camera_y) - float(after.camera_y)) < .001, "Câmera deve sobreviver ao JSON")

	var settings := {
		"control_mode": "free",
		"inventory_corner": "top-left",
		"inventory_direction": "vertical",
	}
	_check(saver.save_settings(settings), "Configurações devem ser graváveis")
	var loaded_settings: Dictionary = saver.load_settings()
	_check(str(loaded_settings.control_mode) == "free", "Modo de controle deve persistir")
	_check(str(loaded_settings.inventory_corner) == "top-left", "Canto do inventário deve persistir")
	_check(str(loaded_settings.inventory_direction) == "vertical", "Direção do inventário deve persistir")

	saver.clear_run()
	_check(not saver.has_run(), "clear_run deve remover a partida suspensa")

	if failures == 0:
		print("Despista persistence tests: OK")
		quit(0)
	else:
		push_error("Despista persistence tests: %d failure(s)" % failures)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)
