extends Control
class_name PowerSlot

var slot_index := 0
var power_type := ""
var empty := true
var short_name := "vazio"

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(52, 56)
	queue_redraw()

func set_power(type: String) -> void:
	power_type = type
	empty = type.is_empty()
	if empty:
		short_name = "vazio"
	else:
		short_name = str(GameEngine.POWER_DEFS.get(type, {}).get("short", type))
	queue_redraw()

func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	var bg := Color("#0b1020e8")
	var border := Color(1,1,1,.14) if empty else Color(str(GameEngine.POWER_DEFS.get(power_type, {}).get("color", "#ffffff")))
	draw_style_box(_box(bg, border), rect)
	draw_string(ThemeDB.fallback_font, Vector2(5, 12), str(slot_index + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color(1,1,1,.62))
	if empty:
		var center := Vector2(size.x * .5, 26)
		draw_rect(Rect2(center - Vector2(6.5,6.5), Vector2(13,13)), Color(0.60,0.67,0.75,.45), false, 1.2)
		draw_circle(center, 1.2, Color(0.60,0.67,0.75,.45))
	else:
		var def: Dictionary = GameEngine.POWER_DEFS[power_type]
		PowerIcon.draw_icon(self, power_type, Vector2(size.x * .5, 26), 24, Color(str(def.color)))
	draw_string(ThemeDB.fallback_font, Vector2(2, 51), short_name, HORIZONTAL_ALIGNMENT_CENTER, size.x - 4, 8, Color(1,1,1,.72))

func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(2)
	box.set_corner_radius_all(8)
	return box
