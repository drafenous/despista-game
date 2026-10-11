extends Node

const SETTINGS_PATH := "user://settings.json"
const RECORD_PATH := "user://record.json"
const RUN_PATH := "user://suspended_run.json"
const ACHIEVEMENTS_PATH := "user://achievements.json"

const DEFAULT_SETTINGS := {
	"control_mode": "fixed",
	"inventory_corner": "bottom-right",
	"inventory_direction": "horizontal",
}

func _read_json(path: String, fallback: Variant) -> Variant:
	if not FileAccess.file_exists(path):
		return fallback
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return fallback
	var parsed := JSON.parse_string(file.get_as_text())
	return fallback if parsed == null else parsed

func _write_json(path: String, value: Variant) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value))
	return true

func load_settings() -> Dictionary:
	var raw: Variant = _read_json(SETTINGS_PATH, DEFAULT_SETTINGS.duplicate(true))
	if not raw is Dictionary:
		return DEFAULT_SETTINGS.duplicate(true)
	var result := DEFAULT_SETTINGS.duplicate(true)
	var control_mode := str(raw.get("control_mode", result.control_mode))
	if control_mode == "fixed" or control_mode == "free":
		result.control_mode = control_mode
	var corner := str(raw.get("inventory_corner", result.inventory_corner))
	if corner in ["top-left", "top-right", "bottom-left", "bottom-right"]:
		result.inventory_corner = corner
	var direction := str(raw.get("inventory_direction", result.inventory_direction))
	if direction == "horizontal" or direction == "vertical":
		result.inventory_direction = direction
	return result

func save_settings(settings: Dictionary) -> bool:
	return _write_json(SETTINGS_PATH, settings)

func load_best() -> float:
	var raw: Variant = _read_json(RECORD_PATH, {"best": 0.0})
	if raw is Dictionary:
		return maxf(0.0, float(raw.get("best", 0.0)))
	return 0.0

func save_best(best: float) -> bool:
	return _write_json(RECORD_PATH, {"best": maxf(0.0, best)})

func save_run(snapshot: Dictionary) -> bool:
	return _write_json(RUN_PATH, snapshot)

func load_run() -> Dictionary:
	var raw: Variant = _read_json(RUN_PATH, {})
	return raw if raw is Dictionary else {}

func has_run() -> bool:
	return FileAccess.file_exists(RUN_PATH) and not load_run().is_empty()

func clear_run() -> void:
	if FileAccess.file_exists(RUN_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(RUN_PATH))

func load_achievements() -> Dictionary:
	var raw: Variant = _read_json(ACHIEVEMENTS_PATH, {})
	return raw if raw is Dictionary else {}

func save_achievements(progress: Dictionary) -> bool:
	return _write_json(ACHIEVEMENTS_PATH, progress)
