extends Node

const HUD_REFRESH_INTERVAL := 0.10

var game: GameEngine
var view: GameView
var ui: GameUI
var touch: TouchControls
var tracker: AchievementTracker
var settings: Dictionary
var touch_direction := Vector2.ZERO
var hud_accumulator := 0.0
var last_snapshot := {}
var current_difficulty := DifficultyRules.MEDIUM

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	game = GameEngine.new()
	game.set_best(SaveManager.load_best())
	settings = SaveManager.load_settings()
	tracker = AchievementTracker.new(SaveManager.load_achievements())

	view = GameView.new()
	add_child(view)
	view.setup(game)

	touch = TouchControls.new()
	add_child(touch)
	touch.configure(str(settings.get("control_mode", "fixed")))
	touch.move_changed.connect(_on_touch_move)
	touch.power_requested.connect(_on_power_requested)

	ui = GameUI.new()
	add_child(ui)
	ui.start_requested.connect(_start_run)
	ui.pause_requested.connect(_pause_run)
	ui.resume_requested.connect(_resume_run)
	ui.restart_requested.connect(_restart_run)
	ui.menu_requested.connect(_return_to_menu)
	ui.power_requested.connect(_on_power_requested)
	ui.settings_changed.connect(_on_settings_changed)
	ui.achievements_requested.connect(_show_achievements)
	ui.apply_settings(settings)

	var restored := false
	if SaveManager.has_run():
		var state := SaveManager.load_run()
		restored = game.restore_state(state)
		if not restored:
			SaveManager.clear_run()

	if restored:
		current_difficulty = game.difficulty
		last_snapshot = game.snapshot()
		ui.refresh(last_snapshot)
		ui.show_suspended()
		touch.set_active(false)
	else:
		ui.show_main_menu()
		touch.set_active(false)
	_refresh_touch_regions.call_deferred()
	view.queue_redraw()

func _process(delta: float) -> void:
	if game == null:
		return

	if game.is_playing():
		var physical := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
		var chosen := physical if physical.length() >= .2 else touch_direction
		chosen = _cardinal(chosen)
		game.set_input(chosen.x, chosen.y)
		game.step(delta)
	else:
		game.set_input(0, 0)

	_process_game_events()
	AudioManager.set_chase(game.is_playing() and game.alert)
	view.queue_redraw()

	hud_accumulator += delta
	if hud_accumulator >= HUD_REFRESH_INTERVAL:
		hud_accumulator = 0.0
		_refresh_ui_and_progress()

func _input(event: InputEvent) -> void:
	if game == null:
		return
	if event is InputEventKey and event.pressed and not event.echo and game.is_playing():
		match event.physical_keycode:
			KEY_1: _on_power_requested(0)
			KEY_2: _on_power_requested(1)
			KEY_3: _on_power_requested(2)
			KEY_ESCAPE:
				if game.allows_pause():
					_pause_run()
	elif event is InputEventJoypadButton and event.pressed and game.is_playing():
		match event.button_index:
			JOY_BUTTON_A: _on_power_requested(0)
			JOY_BUTTON_B: _on_power_requested(1)
			JOY_BUTTON_X: _on_power_requested(2)
			JOY_BUTTON_START:
				if game.allows_pause():
					_pause_run()

func _notification(what: int) -> void:
	if game == null:
		return
	if what == NOTIFICATION_APPLICATION_PAUSED:
		_suspend_for_app()
	elif what == NOTIFICATION_APPLICATION_RESUMED:
		if game.suspended:
			touch.set_active(false)
			_refresh_now()
			ui.show_suspended()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if game.is_playing() and game.allows_pause():
			_pause_run()
		elif bool(last_snapshot.get("started", false)):
			_suspend_for_app()

func _start_run(mode: String) -> void:
	current_difficulty = mode
	SaveManager.clear_run()
	game.start(mode)
	tracker.begin_run(game.best)
	touch_direction = Vector2.ZERO
	touch.configure(str(settings.get("control_mode", "fixed")))
	touch.set_active(true)
	ui.show_gameplay()
	_refresh_now()

func _restart_run() -> void:
	var mode := game.difficulty if DifficultyRules.is_valid(game.difficulty) else current_difficulty
	_start_run(mode)

func _pause_run() -> void:
	if not game.allows_pause():
		return
	game.set_paused(true)
	touch_direction = Vector2.ZERO
	touch.set_active(false)
	_refresh_now()
	ui.show_pause()

func _resume_run() -> void:
	if game.suspended:
		game.resume_suspended()
		SaveManager.clear_run()
	else:
		game.set_paused(false)
	touch_direction = Vector2.ZERO
	touch.set_active(true)
	ui.show_gameplay()
	_refresh_now()

func _return_to_menu() -> void:
	SaveManager.clear_run()
	game.return_to_menu()
	AudioManager.stop_all()
	touch_direction = Vector2.ZERO
	touch.set_active(false)
	last_snapshot = game.snapshot()
	ui.show_main_menu()
	view.queue_redraw()

func _suspend_for_app() -> void:
	if not game.started or game.game_over:
		return
	game.suspend_app()
	touch_direction = Vector2.ZERO
	touch.set_active(false)
	SaveManager.save_run(game.export_state())
	_refresh_now()

func _on_touch_move(direction: Vector2) -> void:
	touch_direction = direction

func _on_power_requested(slot_index: int) -> void:
	if not game.is_playing():
		return
	if game.use_power_up(slot_index):
		_refresh_now()

func _on_settings_changed(next: Dictionary) -> void:
	settings = next.duplicate(true)
	SaveManager.save_settings(settings)
	touch.configure(str(settings.get("control_mode", "fixed")))
	_refresh_touch_regions.call_deferred()

func _show_achievements() -> void:
	ui.show_achievements(tracker.list_items())

func _process_game_events() -> void:
	for event in game.consume_events():
		match str(event.get("type", "")):
			"power_pickup":
				AudioManager.play_pickup()
			"power_use":
				AudioManager.play_power_use()
			"best":
				var new_best := float(event.get("best", 0.0))
				SaveManager.save_best(new_best)
				tracker.mark_best_beaten()
				_persist_achievements()
			"run_end":
				var snap: Dictionary = event.get("snapshot", game.snapshot())
				tracker.finish_run(snap)
				_persist_achievements()
				SaveManager.clear_run()
				touch.set_active(false)
				AudioManager.set_chase(false)
				last_snapshot = snap
				ui.refresh(snap)
				ui.show_gameover(snap)
				_show_new_unlocks()

func _refresh_ui_and_progress() -> void:
	var snapshot := game.snapshot()
	last_snapshot = snapshot
	ui.refresh(snapshot)
	if game.is_playing():
		tracker.live(snapshot)
		var unlocks := tracker.consume_unlocks()
		if not unlocks.is_empty():
			SaveManager.save_achievements(tracker.get_progress())
			for item in unlocks:
				ui.show_achievement_toast(str(item.name))
	_refresh_touch_regions()

func _refresh_now() -> void:
	last_snapshot = game.snapshot()
	ui.refresh(last_snapshot)
	_refresh_touch_regions.call_deferred()
	view.queue_redraw()

func _persist_achievements() -> void:
	SaveManager.save_achievements(tracker.get_progress())

func _show_new_unlocks() -> void:
	var unlocks := tracker.consume_unlocks()
	if unlocks.is_empty():
		return
	for item in unlocks:
		ui.show_achievement_toast(str(item.name))

func _refresh_touch_regions() -> void:
	if ui == null or touch == null:
		return
	touch.set_inventory_rects(ui.inventory_rects())
	touch.set_blocked_rects(ui.interactive_rects())

func _cardinal(value: Vector2) -> Vector2:
	if value.length() < .2:
		return Vector2.ZERO
	if absf(value.x) > absf(value.y):
		return Vector2(signf(value.x), 0)
	return Vector2(0, signf(value.y))
