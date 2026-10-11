extends Control
class_name TouchControls

signal move_changed(direction: Vector2)
signal power_requested(slot_index: int)

const FIXED_CENTER := Vector2(74, 556)
const JOYSTICK_RADIUS := 68.0
const DEAD_ZONE := 10.0

var active := false
var control_mode := "fixed"
var primary_touch_id := -1
var origin := Vector2.ZERO
var current_direction := Vector2.ZERO
var free_center := Vector2.ZERO
var inventory_rects: Array[Rect2] = []
var blocked_rects: Array[Rect2] = []
var _mouse_dragging := false

func _ready() -> void:
	set_process_input(true)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	queue_redraw()

func configure(mode: String) -> void:
	control_mode = mode if mode == "fixed" or mode == "free" else "fixed"
	release_primary()
	queue_redraw()

func set_active(value: bool) -> void:
	active = value
	if not active:
		release_primary()
	queue_redraw()

func set_inventory_rects(rects: Array[Rect2]) -> void:
	inventory_rects = rects

func set_blocked_rects(rects: Array[Rect2]) -> void:
	blocked_rects = rects

func _input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventScreenTouch:
		_handle_touch(event)
	elif event is InputEventScreenDrag:
		_handle_drag(event)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_mouse_dragging = true
			_begin_pointer(-99, event.position)
		else:
			_mouse_dragging = false
			if primary_touch_id == -99:
				release_primary()
	elif event is InputEventMouseMotion and _mouse_dragging and primary_touch_id == -99:
		_update_pointer(event.position)

func _handle_touch(event: InputEventScreenTouch) -> void:
	if event.pressed:
		var slot := _slot_at(event.position)
		if slot >= 0:
			power_requested.emit(slot)
			return
		if primary_touch_id == -1:
			_begin_pointer(event.index, event.position)
	elif event.index == primary_touch_id:
		release_primary()

func _handle_drag(event: InputEventScreenDrag) -> void:
	if event.index == primary_touch_id:
		_update_pointer(event.position)
		return
	var slot := _slot_at(event.position)
	if slot >= 0:
		# Activation happens on touch-down; drag is intentionally ignored to
		# avoid repeatedly consuming inventory slots while a finger moves.
		return

func _begin_pointer(pointer_id: int, position: Vector2) -> void:
	for rect in blocked_rects:
		if rect.has_point(position):
			return
	if control_mode == "fixed":
		if position.distance_to(FIXED_CENTER) > JOYSTICK_RADIUS * 1.25:
			return
		origin = FIXED_CENTER
	else:
		origin = _clamp_free_center(position)
		free_center = origin
	primary_touch_id = pointer_id
	_update_pointer(position)
	queue_redraw()

func _update_pointer(position: Vector2) -> void:
	var delta := position - origin
	var next := _direction_from_delta(delta)
	if next == current_direction:
		return
	current_direction = next
	move_changed.emit(current_direction)
	queue_redraw()

func release_primary() -> void:
	if primary_touch_id == -1 and current_direction == Vector2.ZERO:
		return
	primary_touch_id = -1
	current_direction = Vector2.ZERO
	move_changed.emit(Vector2.ZERO)
	queue_redraw()

func _direction_from_delta(delta: Vector2) -> Vector2:
	if delta.length() < DEAD_ZONE:
		return Vector2.ZERO
	if absf(delta.x) > absf(delta.y):
		return Vector2(signf(delta.x), 0)
	return Vector2(0, signf(delta.y))

func _slot_at(position: Vector2) -> int:
	for i in range(inventory_rects.size()):
		if inventory_rects[i].grow(10).has_point(position):
			return i
	return -1

func _clamp_free_center(position: Vector2) -> Vector2:
	return Vector2(
		clampf(position.x, JOYSTICK_RADIUS, GameEngine.W - JOYSTICK_RADIUS),
		clampf(position.y, 96.0 + JOYSTICK_RADIUS, GameEngine.H - JOYSTICK_RADIUS)
	)

func _draw() -> void:
	if not active:
		return
	if control_mode == "fixed":
		_draw_joystick(FIXED_CENTER, current_direction, .65)
	elif primary_touch_id != -1:
		_draw_joystick(free_center, current_direction, .78)

func _draw_joystick(center: Vector2, direction: Vector2, alpha: float) -> void:
	var bg := Color(.04,.07,.10,.34 * alpha)
	draw_circle(center, JOYSTICK_RADIUS, bg)
	draw_rect(Rect2(center + Vector2(-18,-56), Vector2(36,112)), Color(1,1,1,.08 * alpha))
	draw_rect(Rect2(center + Vector2(-56,-18), Vector2(112,36)), Color(1,1,1,.08 * alpha))
	var stick_center := center + direction * JOYSTICK_RADIUS * .34
	draw_rect(Rect2(stick_center - Vector2(22,22), Vector2(44,44)), Color(.80,.88,.95,.42 * alpha))
	draw_rect(Rect2(stick_center - Vector2(22,22), Vector2(44,44)), Color(.88,.94,1,.55 * alpha), false, 2)
