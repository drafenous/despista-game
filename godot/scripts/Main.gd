extends Node

func _ready() -> void:
	var background := ColorRect.new()
	background.color = Color("#080d16")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	var label := Label.new()
	label.text = "DESPISTA!\nMigração Godot inicializada"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	label.add_theme_font_size_override("font_size", 22)
	background.add_child(label)
