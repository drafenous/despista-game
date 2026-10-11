extends SceneTree

var failures := 0
var last_move := Vector2.ZERO
var powers: Array[int] = []

func _init() -> void:
	var controls := TouchControls.new()
	root.add_child(controls)
	controls.move_changed.connect(func(direction: Vector2): last_move = direction)
	controls.power_requested.connect(func(slot: int): powers.append(slot))
	controls.set_active(true)
	controls.configure("fixed")
	controls.set_inventory_rects([
		Rect2(220, 560, 40, 56),
		Rect2(264, 560, 40, 56),
		Rect2(308, 560, 40, 56),
	])

	controls._begin_pointer(11, TouchControls.FIXED_CENTER)
	controls._update_pointer(TouchControls.FIXED_CENTER + Vector2(52, 4))
	_check(controls.primary_touch_id == 11, "Primeiro dedo deve permanecer como dono do joystick")
	_check(last_move == Vector2.RIGHT, "Joystick deve apontar para a direita")

	var second_down := InputEventScreenTouch.new()
	second_down.index = 22
	second_down.position = Vector2(280, 580)
	second_down.pressed = true
	controls._handle_touch(second_down)
	_check(powers == [1], "Segundo dedo deve ativar o slot 2")
	_check(controls.primary_touch_id == 11, "Power-up não pode roubar o dedo do joystick")
	_check(last_move == Vector2.RIGHT, "Usar power-up não pode parar o movimento")

	var second_up := InputEventScreenTouch.new()
	second_up.index = 22
	second_up.position = Vector2(280, 580)
	second_up.pressed = false
	controls._handle_touch(second_up)
	_check(controls.primary_touch_id == 11, "Soltar o segundo dedo não pode liberar o joystick")

	var first_up := InputEventScreenTouch.new()
	first_up.index = 11
	first_up.position = TouchControls.FIXED_CENTER + Vector2(52, 4)
	first_up.pressed = false
	controls._handle_touch(first_up)
	_check(controls.primary_touch_id == -1, "Soltar o primeiro dedo deve liberar o joystick")
	_check(last_move == Vector2.ZERO, "Joystick deve zerar ao soltar o dedo primário")

	controls.configure("free")
	controls._begin_pointer(33, Vector2(180, 360))
	controls._update_pointer(Vector2(182, 305))
	_check(last_move == Vector2.UP, "Joystick livre deve usar as mesmas quatro direções")
	controls.release_primary()

	if failures == 0:
		print("Despista control tests: OK")
		quit(0)
	else:
		push_error("Despista control tests: %d failure(s)" % failures)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)
