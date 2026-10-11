extends CanvasLayer
class_name GameUI

signal start_requested(difficulty: String)
signal pause_requested
signal resume_requested
signal restart_requested
signal menu_requested
signal power_requested(slot_index: int)
signal settings_changed(settings: Dictionary)
signal achievements_requested

var root: Control
var hud: Control
var menu_overlay: Control
var pause_overlay: Control
var suspended_overlay: Control
var gameover_overlay: Control
var options_overlay: Control
var achievements_overlay: Control

var time_label: Label
var distance_label: Label
var screen_distance_label: Label
var best_label: Label
var suspicion_bar: ProgressBar
var escape_bar: ProgressBar
var busted_bar: ProgressBar
var pause_button: Button
var effects_box: HBoxContainer
var slots: Array[PowerSlot] = []

var difficulty_option: OptionButton
var menu_subtitle: Label
var gameover_title: Label
var gameover_stats: Label
var control_option: OptionButton
var corner_option: OptionButton
var direction_option: OptionButton
var achievement_list: VBoxContainer

var current_settings := SaveManager.DEFAULT_SETTINGS.duplicate(true)
var current_difficulty := DifficultyRules.MEDIUM

func _ready() -> void:
	_build()

func _build() -> void:
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(root)
	_build_hud()
	menu_overlay = _build_menu()
	pause_overlay = _build_pause_overlay("PAUSADO", "A partida está congelada.", false)
	suspended_overlay = _build_pause_overlay("PARTIDA SUSPENSA", "Sua partida foi preservada.", true)
	gameover_overlay = _build_gameover()
	options_overlay = _build_options()
	achievements_overlay = _build_achievements()
	show_main_menu()

func _label(text: String, font_size: int = 12, color: Color = Color.WHITE) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label

func _button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 42)
	button.focus_mode = Control.FOCUS_ALL
	button.add_theme_font_size_override("font_size", 13)
	return button

func _panel() -> PanelContainer:
	var panel := PanelContainer.new()
	var box := StyleBoxFlat.new()
	box.bg_color = Color("#101927f2")
	box.border_color = Color(1,1,1,.16)
	box.set_border_width_all(1)
	box.set_corner_radius_all(12)
	box.set_content_margin_all(14)
	panel.add_theme_stylebox_override("panel", box)
	return panel

func _full_overlay() -> Control:
	var layer := ColorRect.new()
	layer.color = Color(0.02,0.03,0.05,.84)
	layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(layer)
	return layer

func _center_panel(layer: Control, width: float = 300.0) -> VBoxContainer:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)
	var panel := _panel()
	panel.custom_minimum_size.x = width
	center.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	return box

func _build_hud() -> void:
	hud = Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(hud)

	var stats := VBoxContainer.new()
	stats.position = Vector2(10, 10)
	stats.size = Vector2(132, 92)
	stats.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stats.add_theme_constant_override("separation", 1)
	hud.add_child(stats)
	time_label = _label("00:00.00", 15, Color("#ffffff"))
	distance_label = _label("Dist. player 0 m", 9, Color("#d9e6f2"))
	screen_distance_label = _label("Dist. tela 0 m", 9, Color("#9fb4c8"))
	best_label = _label("Recorde 00:00.00", 9, Color("#ffd166"))
	stats.add_child(time_label)
	stats.add_child(distance_label)
	stats.add_child(screen_distance_label)
	stats.add_child(best_label)

	suspicion_bar = _meter("SUSPEITA", Vector2(10, 94), Color("#f6d64a"))
	escape_bar = _meter("FUGA", Vector2(10, 120), Color("#70f2d0"))
	busted_bar = _meter("BUSTED", Vector2(10, 146), Color("#ff5a62"))

	pause_button = _button("Ⅱ")
	pause_button.position = Vector2(158, 10)
	pause_button.size = Vector2(44, 40)
	pause_button.pressed.connect(func(): pause_requested.emit())
	hud.add_child(pause_button)

	effects_box = HBoxContainer.new()
	effects_box.position = Vector2(10, 176)
	effects_box.size = Vector2(340, 22)
	effects_box.add_theme_constant_override("separation", 4)
	effects_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(effects_box)

	for i in range(3):
		var slot := PowerSlot.new()
		slot.slot_index = i
		slot.position = Vector2(360 - 10 - 52 * (3 - i), 568)
		slot.size = Vector2(48, 56)
		hud.add_child(slot)
		slots.append(slot)

func _meter(label_text: String, pos: Vector2, color: Color) -> ProgressBar:
	var label := _label(label_text, 8, color)
	label.position = pos
	label.size = Vector2(60, 12)
	hud.add_child(label)
	var bar := ProgressBar.new()
	bar.position = pos + Vector2(58, 1)
	bar.size = Vector2(95, 9)
	bar.min_value = 0
	bar.max_value = 100
	bar.show_percentage = false
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(1,1,1,.08)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	bar.add_theme_stylebox_override("background", bg)
	bar.add_theme_stylebox_override("fill", fill)
	hud.add_child(bar)
	return bar

func _build_menu() -> Control:
	var layer := _full_overlay()
	var box := _center_panel(layer)
	var title := _label("DESPISTA!", 30, Color("#fff06a"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	menu_subtitle = _label("Corra. Misture-se. Escape.", 11, Color("#aebed0"))
	menu_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(menu_subtitle)
	box.add_child(_label("DIFICULDADE", 9, Color("#7edcff")))
	difficulty_option = OptionButton.new()
	for mode in DifficultyRules.ALL:
		difficulty_option.add_item(DifficultyRules.label(mode))
	difficulty_option.selected = 1
	difficulty_option.focus_mode = Control.FOCUS_ALL
	difficulty_option.item_selected.connect(func(index: int):
		current_difficulty = DifficultyRules.ALL[index]
		menu_subtitle.text = DifficultyRules.description(current_difficulty)
	)
	box.add_child(difficulty_option)
	var start := _button("COMEÇAR")
	start.pressed.connect(func(): start_requested.emit(current_difficulty))
	box.add_child(start)
	var options := _button("OPÇÕES")
	options.pressed.connect(show_options)
	box.add_child(options)
	var achievements := _button("CONQUISTAS")
	achievements.pressed.connect(func(): achievements_requested.emit())
	box.add_child(achievements)
	return layer

func _build_pause_overlay(title_text: String, body: String, is_suspended: bool) -> Control:
	var layer := _full_overlay()
	var box := _center_panel(layer)
	var title := _label(title_text, 25, Color("#fff06a"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var message := _label(body, 11, Color("#afbed0"))
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(message)
	var resume := _button("CONTINUAR")
	resume.pressed.connect(func(): resume_requested.emit())
	box.add_child(resume)
	var restart := _button("REINICIAR PARTIDA")
	restart.pressed.connect(func(): restart_requested.emit())
	box.add_child(restart)
	if is_suspended:
		var menu := _button("ABANDONAR E VOLTAR AO MENU")
		menu.pressed.connect(func(): menu_requested.emit())
		box.add_child(menu)
	return layer

func _build_gameover() -> Control:
	var layer := _full_overlay()
	var box := _center_panel(layer)
	gameover_title = _label("PRESO!", 26, Color("#ff6a6a"))
	gameover_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(gameover_title)
	gameover_stats = _label("", 11, Color("#dce8f4"))
	gameover_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(gameover_stats)
	var restart := _button("JOGAR NOVAMENTE")
	restart.pressed.connect(func(): restart_requested.emit())
	box.add_child(restart)
	var menu := _button("MENU")
	menu.pressed.connect(func(): menu_requested.emit())
	box.add_child(menu)
	return layer

func _build_options() -> Control:
	var layer := _full_overlay()
	var box := _center_panel(layer)
	var title := _label("OPÇÕES", 24, Color("#fff06a"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)

	box.add_child(_label("CONTROLE", 9, Color("#7edcff")))
	control_option = OptionButton.new()
	control_option.add_item("Joystick fixo")
	control_option.add_item("Joystick livre")
	box.add_child(control_option)

	box.add_child(_label("POSIÇÃO DO INVENTÁRIO", 9, Color("#7edcff")))
	corner_option = OptionButton.new()
	for text in ["Superior esquerdo", "Superior direito", "Inferior esquerdo", "Inferior direito"]:
		corner_option.add_item(text)
	box.add_child(corner_option)

	box.add_child(_label("DIREÇÃO DO INVENTÁRIO", 9, Color("#7edcff")))
	direction_option = OptionButton.new()
	direction_option.add_item("Horizontal")
	direction_option.add_item("Vertical")
	box.add_child(direction_option)

	var save := _button("SALVAR")
	save.pressed.connect(_save_options)
	box.add_child(save)
	var back := _button("VOLTAR")
	back.pressed.connect(show_main_menu)
	box.add_child(back)
	return layer

func _build_achievements() -> Control:
	var layer := _full_overlay()
	var panel := _panel()
	panel.position = Vector2(18, 24)
	panel.size = Vector2(324, 592)
	layer.add_child(panel)
	var outer := VBoxContainer.new()
	outer.add_theme_constant_override("separation", 8)
	panel.add_child(outer)
	var title := _label("CONQUISTAS", 22, Color("#fff06a"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	outer.add_child(title)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 490)
	outer.add_child(scroll)
	achievement_list = VBoxContainer.new()
	achievement_list.add_theme_constant_override("separation", 6)
	achievement_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(achievement_list)
	var back := _button("VOLTAR")
	back.pressed.connect(show_main_menu)
	outer.add_child(back)
	return layer

func apply_settings(settings: Dictionary) -> void:
	current_settings = settings.duplicate(true)
	control_option.selected = 0 if str(settings.control_mode) == "fixed" else 1
	var corners := ["top-left", "top-right", "bottom-left", "bottom-right"]
	corner_option.selected = maxi(0, corners.find(str(settings.inventory_corner)))
	direction_option.selected = 0 if str(settings.inventory_direction) == "horizontal" else 1
	_layout_inventory()

func _save_options() -> void:
	var corners := ["top-left", "top-right", "bottom-left", "bottom-right"]
	current_settings = {
		"control_mode": "fixed" if control_option.selected == 0 else "free",
		"inventory_corner": corners[corner_option.selected],
		"inventory_direction": "horizontal" if direction_option.selected == 0 else "vertical",
	}
	_layout_inventory()
	settings_changed.emit(current_settings.duplicate(true))
	show_main_menu()

func _layout_inventory() -> void:
	var corner := str(current_settings.get("inventory_corner", "bottom-right"))
	var vertical := str(current_settings.get("inventory_direction", "horizontal")) == "vertical"
	var slot_size := Vector2(52, 56)
	var gap := 4.0
	var total := Vector2(slot_size.x if vertical else slot_size.x * 3 + gap * 2, slot_size.y * 3 + gap * 2 if vertical else slot_size.y)
	var origin := Vector2(10, 10)
	if corner.ends_with("right"):
		origin.x = GameEngine.W - 10 - total.x
	if corner.begins_with("bottom"):
		origin.y = GameEngine.H - 12 - total.y
	else:
		origin.y = 204
	for i in range(slots.size()):
		slots[i].position = origin + (Vector2(0, (slot_size.y + gap) * i) if vertical else Vector2((slot_size.x + gap) * i, 0))
		slots[i].size = slot_size

func inventory_rects() -> Array[Rect2]:
	var result: Array[Rect2] = []
	for slot in slots:
		result.append(slot.get_global_rect())
	return result

func refresh(snapshot: Dictionary) -> void:
	hud.visible = bool(snapshot.started) or bool(snapshot.game_over)
	time_label.text = str(snapshot.time)
	distance_label.text = "Dist. player %s" % str(snapshot.distance_label)
	screen_distance_label.text = "Dist. tela %s" % str(snapshot.screen_distance_label)
	best_label.text = "Recorde %s" % str(snapshot.best_time)
	suspicion_bar.value = float(snapshot.suspicion)
	busted_bar.value = clampf(float(snapshot.busted_timer) / 1.5 * 100.0, 0.0, 100.0)
	var target := float(snapshot.escape_target)
	escape_bar.value = 0.0 if target == INF else clampf(float(snapshot.pursuit_escape_timer) / maxf(.001, target) * 100.0, 0.0, 100.0)
	pause_button.visible = bool(snapshot.started) and bool(snapshot.allows_pause) and not bool(snapshot.paused) and not bool(snapshot.suspended)

	var inv: Array = snapshot.inventory
	for i in range(3):
		slots[i].set_power(str(inv[i]) if i < inv.size() else "")

	for child in effects_box.get_children():
		child.queue_free()
	for effect in snapshot.effects:
		var effect_label := _label("%s %.1fs" % [str(effect.label), float(effect.remaining)], 8, Color(str(effect.color)))
		effects_box.add_child(effect_label)

func show_main_menu() -> void:
	_hide_overlays()
	menu_overlay.visible = true
	hud.visible = false
	difficulty_option.grab_focus()

func show_options() -> void:
	_hide_overlays()
	options_overlay.visible = true
	control_option.grab_focus()

func show_pause() -> void:
	_hide_overlays()
	pause_overlay.visible = true
	hud.visible = true
	_first_button(pause_overlay)

func show_suspended() -> void:
	_hide_overlays()
	suspended_overlay.visible = true
	hud.visible = true
	_first_button(suspended_overlay)

func show_gameover(snapshot: Dictionary) -> void:
	_hide_overlays()
	gameover_overlay.visible = true
	hud.visible = true
	gameover_title.text = "PRESO!" if str(snapshot.reason) == "caught" else "FICOU PARA TRÁS!"
	gameover_stats.text = "Tempo  %s\nDist. player  %s\nDist. tela  %s\nRecorde  %s" % [
		str(snapshot.time), str(snapshot.distance_label), str(snapshot.screen_distance_label), str(snapshot.best_time)
	]
	_first_button(gameover_overlay)

func show_achievements(items: Array[Dictionary]) -> void:
	_hide_overlays()
	achievements_overlay.visible = true
	for child in achievement_list.get_children():
		child.queue_free()
	for item in items:
		if not bool(item.get("visible", true)):
			continue
		var row := VBoxContainer.new()
		var unlocked := bool(item.get("unlocked", false))
		var name := str(item.get("name", "???")) if unlocked or not bool(item.get("hidden", false)) else "???"
		var title := _label(("✓ " if unlocked else "○ ") + name, 11, Color("#70f2d0") if unlocked else Color("#dbe8f4"))
		row.add_child(title)
		var description := str(item.get("description", "Conquista secreta")) if unlocked or not bool(item.get("hidden", false)) else "Conquista secreta"
		row.add_child(_label(description, 8, Color("#91a4b8")))
		var progress := _label("%d / %d" % [int(item.get("value", 0)), int(item.get("target", 1))], 8, Color("#ffd166"))
		row.add_child(progress)
		achievement_list.add_child(row)
	_first_button(achievements_overlay)

func _hide_overlays() -> void:
	for layer in [menu_overlay, pause_overlay, suspended_overlay, gameover_overlay, options_overlay, achievements_overlay]:
		if layer != null:
			layer.visible = false

func _first_button(layer: Control) -> void:
	var buttons := _find_buttons(layer)
	if not buttons.is_empty():
		buttons[0].grab_focus()

func _find_buttons(node: Node) -> Array[Button]:
	var result: Array[Button] = []
	if node is Button:
		result.append(node)
	for child in node.get_children():
		result.append_array(_find_buttons(child))
	return result
