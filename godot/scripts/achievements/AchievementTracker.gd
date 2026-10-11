extends RefCounted
class_name AchievementTracker

var progress := {}
var _newly_unlocked: Array[Dictionary] = []
var _session := {}

func _init(initial: Dictionary = {}) -> void:
	progress = _empty_progress()
	if not initial.is_empty():
		hydrate(initial)
	_reset_session(0.0, false)

func _empty_progress() -> Dictionary:
	return {
		"values": {},
		"unlocked_at": {},
		"meta": {
			"total_play_seconds": 0.0,
			"total_distance_meters": 0.0,
			"games_played": 0,
			"escapes": 0,
			"items_used": 0,
			"play_days": [],
			"collected_items": [],
			"difficulties_survived_60s": [],
			"cameras_clean_total": 0,
		}
	}

func hydrate(value: Dictionary) -> void:
	var clean := _empty_progress()
	if value.has("values") and value.values is Dictionary:
		clean.values = Dictionary(value.values).duplicate(true)
	if value.has("unlocked_at") and value.unlocked_at is Dictionary:
		clean.unlocked_at = Dictionary(value.unlocked_at).duplicate(true)
	if value.has("meta") and value.meta is Dictionary:
		for key in clean.meta.keys():
			if value.meta.has(key):
				clean.meta[key] = value.meta[key]
	progress = clean
	_sync_meta_counters()

func begin_run(best_at_start: float) -> void:
	_reset_session(best_at_start, true)
	_unlock("first_run", 1)

func live(snapshot: Dictionary) -> void:
	if not bool(snapshot.get("started", false)):
		return
	if bool(snapshot.get("paused", false)) or bool(snapshot.get("suspended", false)):
		return
	if not bool(_session.started):
		_reset_session(float(snapshot.get("best", 0.0)), true)
	_apply_live(snapshot)
	_sync_meta_counters()

func finish_run(snapshot: Dictionary) -> void:
	if bool(_session.ended):
		return
	if not bool(_session.started):
		_reset_session(float(snapshot.get("best", 0.0)), true)
	_apply_live(snapshot)
	_session.ended = true
	progress.meta.games_played = int(progress.meta.games_played) + 1
	if str(snapshot.get("reason", "")) == "caught":
		_unlock("first_caught", 1)
	_sync_meta_counters()
	_session.started = false

func mark_best_beaten() -> void:
	_unlock("beat_best_time", 1)
	_sync_meta_counters()

func consume_unlocks() -> Array[Dictionary]:
	var result := _newly_unlocked.duplicate(true)
	_newly_unlocked.clear()
	return result

func get_progress() -> Dictionary:
	return progress.duplicate(true)

func list_items() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for definition in AchievementCatalog.ITEMS:
		var id := str(definition.id)
		var item := definition.duplicate(true)
		var value := int(progress.values.get(id, 0))
		var unlocked: bool = progress.unlocked_at.has(id)
		item.value = mini(int(definition.target), value)
		item.unlocked = unlocked
		item.unlocked_at = progress.unlocked_at.get(id, 0)
		item.visible = not bool(definition.get("hidden", false)) or unlocked
		result.append(item)
	return result

func _reset_session(best_at_start: float, started: bool) -> void:
	_session = {
		"started": started,
		"ended": false,
		"best_at_start": best_at_start,
		"milestones": {},
		"last_elapsed": 0.0,
		"last_distance": 0.0,
		"last_cameras_clean": 0,
		"last_escapes": 0,
		"last_items_used": 0,
	}

func _mark(key: String, condition: bool, id: String, amount: int = 1) -> void:
	if not condition or bool(_session.milestones.get(key, false)):
		return
	_session.milestones[key] = true
	_unlock(id, amount)

func _apply_live(snapshot: Dictionary) -> void:
	var stats: Dictionary = snapshot.get("run_stats", {})
	var elapsed := float(snapshot.get("elapsed", 0.0))
	var distance := float(snapshot.get("distance", 0.0))
	var difficulty := str(snapshot.get("difficulty", DifficultyRules.MEDIUM))

	_mark("survive_60s", elapsed >= 60.0, "survive_60s")
	_mark("run_500m", distance >= 500.0, "run_500m")
	_mark("easy_2min", difficulty == DifficultyRules.EASY and elapsed >= 120.0, "easy_2min")
	_mark("medium_2min", difficulty == DifficultyRules.MEDIUM and elapsed >= 120.0, "medium_2min")
	_mark("hard_90s", difficulty == DifficultyRules.HARD and elapsed >= 90.0, "hard_90s")
	_mark("pro_60s", difficulty == DifficultyRules.PRO and elapsed >= 60.0, "pro_60s")
	_mark("impossible_30s", difficulty == DifficultyRules.IMPOSSIBLE and elapsed >= 30.0, "impossible_30s")
	_mark("impossible_3min", difficulty == DifficultyRules.IMPOSSIBLE and elapsed >= 180.0, "impossible_3min")
	_mark("crowd_cover_10s", float(stats.get("crowd_cover_time", 0.0)) >= 10.0, "crowd_cover_10s")
	_mark("crowd_cover_30s", float(stats.get("crowd_cover_streak_max", 0.0)) >= 30.0, "crowd_cover_30s")
	_mark("low_suspicion_30s", float(stats.get("suspicion_low50_time", 0.0)) >= 30.0, "low_suspicion_30s")
	_mark("suspicion_under_20_60s", float(stats.get("suspicion_low20_time", 0.0)) >= 60.0, "suspicion_under_20_60s")
	_mark("no_camera_90s", float(stats.get("no_camera_time", 0.0)) >= 90.0, "no_camera_90s")
	_mark("direction_50", int(stats.get("direction_changes", 0)) >= 50, "direction_50")
	_mark("no_obstacle_100m", not bool(stats.get("obstacle_hit", false)) and float(stats.get("clean_distance_meters", 0.0)) >= 100.0, "no_obstacle_100m")
	_mark("no_cop_touch_2min", not bool(stats.get("touched_police", false)) and elapsed >= 120.0, "no_cop_touch_2min")
	_mark("inventory_full", bool(stats.get("inventory_full", false)) or Array(snapshot.get("inventory", [])).size() >= 3, "inventory_full")
	_mark("suspicion_99_recover", bool(stats.get("suspicion_recovered", false)), "suspicion_99_recover")
	_mark("first_alert", bool(stats.get("alert_ever", false)) or bool(snapshot.get("alert", false)), "first_alert")
	_mark("survive_anti_camp", bool(stats.get("anti_camp_survived", false)), "survive_anti_camp")
	_mark("use_skates_50m", float(stats.get("skates_meters", 0.0)) >= 50.0, "use_skates_50m")
	_mark("use_escape", bool(stats.get("used_escape_item", false)), "use_escape")
	_mark("use_moses", bool(stats.get("used_staff", false)), "use_moses")
	_mark("use_timemachine", bool(stats.get("used_time", false)), "use_timemachine")
	_mark("use_cloak_alert", bool(stats.get("used_cloak_in_alert", false)), "use_cloak_alert")
	_mark("use_teleport_capture", bool(stats.get("used_teleport_in_busted", false)), "use_teleport_capture")
	_mark("use_shield", bool(stats.get("used_shield_near_cop", false)), "use_shield")
	_mark("survive_90s_no_items", elapsed >= 90.0 and int(stats.get("items_used", 0)) == 0, "survive_90s_no_items")
	_mark("impossible_no_escape_item", difficulty == DifficultyRules.IMPOSSIBLE and elapsed >= 20.0 and not bool(stats.get("used_escape_item", false)), "impossible_no_escape_item")

	var best_at_start := float(_session.best_at_start)
	_mark("near_record", best_at_start > 0.0 and elapsed >= best_at_start - 10.0 and elapsed < best_at_start, "near_record")

	var escapes := int(stats.get("escapes", 0))
	if escapes > int(_session.last_escapes):
		var gained := escapes - int(_session.last_escapes)
		_session.last_escapes = escapes
		progress.meta.escapes = int(progress.meta.escapes) + gained
		_unlock("first_escape", 1)
		if bool(stats.get("escape_no_items", false)): _unlock("escape_no_items", 1)
		if bool(stats.get("escape_one_item", false)): _unlock("escape_one_item", 1)
		if bool(stats.get("near_capture_escape", false)): _unlock("near_capture_escape", 1)
		if bool(stats.get("hard_escape", false)): _unlock("hard_escape_4s", 1)
		if bool(stats.get("used_soap_in_alert", false)): _unlock("use_soap", 1)
		if Array(stats.get("dirs_in_escape", [])).size() >= 4: _unlock("four_directions_escape", 1)

	var items_used := int(stats.get("items_used", 0))
	if items_used > int(_session.last_items_used):
		progress.meta.items_used = int(progress.meta.items_used) + items_used - int(_session.last_items_used)
		_session.last_items_used = items_used

	var cameras_clean := int(stats.get("cameras_clean", 0))
	if cameras_clean > int(_session.last_cameras_clean):
		progress.meta.cameras_clean_total = int(progress.meta.cameras_clean_total) + cameras_clean - int(_session.last_cameras_clean)
		_session.last_cameras_clean = cameras_clean

	for item in Array(stats.get("picked_types", [])):
		var type := str(item)
		if not type in progress.meta.collected_items:
			progress.meta.collected_items.append(type)

	if elapsed >= 60.0 and not difficulty in progress.meta.difficulties_survived_60s:
		progress.meta.difficulties_survived_60s.append(difficulty)

	var today := Time.get_date_string_from_system()
	if not today in progress.meta.play_days:
		progress.meta.play_days.append(today)

	var delta_time := maxf(0.0, elapsed - float(_session.last_elapsed))
	var delta_distance := maxf(0.0, distance - float(_session.last_distance))
	if delta_time > 0.0 and delta_time < 2.0:
		progress.meta.total_play_seconds = float(progress.meta.total_play_seconds) + delta_time
	if delta_distance > 0.0 and delta_distance < 50.0:
		progress.meta.total_distance_meters = float(progress.meta.total_distance_meters) + delta_distance
	_session.last_elapsed = elapsed
	_session.last_distance = distance

func _sync_meta_counters() -> void:
	_unlock("run_2km_total", int(floor(float(progress.meta.total_distance_meters))))
	_unlock("play_30min_total", int(floor(float(progress.meta.total_play_seconds))))
	_unlock("escape_5", int(progress.meta.escapes))
	_unlock("use_20_items", int(progress.meta.items_used))
	_unlock("play_10_games", int(progress.meta.games_played))
	_unlock("play_3_days", Array(progress.meta.play_days).size())
	_unlock("collect_all_8_items", Array(progress.meta.collected_items).size())
	_unlock("survive_3_difficulties", Array(progress.meta.difficulties_survived_60s).size())
	_unlock("cameras_10_clean", int(progress.meta.cameras_clean_total))
	var unlocked_count := 0
	for id in progress.unlocked_at.keys():
		if str(id) != "unlock_25":
			unlocked_count += 1
	_unlock("unlock_25", unlocked_count)

func _unlock(id: String, amount: int) -> void:
	var definition := AchievementCatalog.by_id(id)
	if definition.is_empty():
		return
	var target := int(definition.target)
	var current := int(progress.values.get(id, 0))
	var next := mini(target, maxi(current, amount))
	progress.values[id] = next
	if next >= target and not progress.unlocked_at.has(id):
		progress.unlocked_at[id] = int(Time.get_unix_time_from_system())
		_newly_unlocked.append(definition.duplicate(true))
