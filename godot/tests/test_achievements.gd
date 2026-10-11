extends SceneTree

var failures := 0

func _init() -> void:
	_test_catalog()
	_test_basic_unlocks()
	_test_progress_counters()
	if failures == 0:
		print("Despista achievement tests: OK")
		quit(0)
	else:
		push_error("Despista achievement tests: %d failure(s)" % failures)
		quit(1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)

func _snapshot(overrides: Dictionary = {}) -> Dictionary:
	var stats := {
		"crowd_cover_time": 0.0,
		"crowd_cover_streak_max": 0.0,
		"suspicion_low50_time": 0.0,
		"suspicion_low20_time": 0.0,
		"no_camera_time": 0.0,
		"direction_changes": 0,
		"obstacle_hit": false,
		"clean_distance_meters": 0.0,
		"skates_meters": 0.0,
		"cameras_clean": 0,
		"touched_police": false,
		"escapes": 0,
		"items_used": 0,
		"inventory_full": false,
		"suspicion_recovered": false,
		"alert_ever": false,
		"anti_camp_survived": false,
		"used_escape_item": false,
		"used_staff": false,
		"used_time": false,
		"used_cloak_in_alert": false,
		"used_teleport_in_busted": false,
		"used_shield_near_cop": false,
		"escape_no_items": false,
		"escape_one_item": false,
		"near_capture_escape": false,
		"hard_escape": false,
		"used_soap_in_alert": false,
		"dirs_in_escape": [],
		"picked_types": [],
	}
	var result := {
		"started": true,
		"paused": false,
		"suspended": false,
		"game_over": false,
		"reason": "",
		"difficulty": DifficultyRules.EASY,
		"elapsed": 0.0,
		"distance": 0.0,
		"best": 0.0,
		"alert": false,
		"inventory": [],
		"run_stats": stats,
	}
	for key in overrides:
		if key == "run_stats":
			for stat_key in overrides[key]:
				stats[stat_key] = overrides[key][stat_key]
		else:
			result[key] = overrides[key]
	return result

func _test_catalog() -> void:
	_check(AchievementCatalog.ITEMS.size() == 50, "Catálogo deve conter exatamente 50 conquistas")
	_check(AchievementCatalog.by_id("impossible_3min").get("hidden", false), "Lenda deve permanecer secreta")
	_check(AchievementCatalog.ALL_ITEM_TYPES.size() == 8, "Devem existir exatamente 8 tipos de power-up")

func _test_basic_unlocks() -> void:
	var tracker := AchievementTracker.new()
	tracker.begin_run(0.0)
	tracker.live(_snapshot({"elapsed": 60.0, "distance": 500.0}))
	var ids: Array[String] = []
	for item in tracker.consume_unlocks():
		ids.append(str(item.id))
	_check("first_run" in ids, "Primeiros passos deve desbloquear no início")
	_check("survive_60s" in ids, "60 segundos deve desbloquear")
	_check("run_500m" in ids, "500m deve desbloquear")

	var caught := _snapshot({"started": false, "game_over": true, "reason": "caught", "elapsed": 61.0, "distance": 510.0})
	tracker.finish_run(caught)
	ids.clear()
	for item in tracker.consume_unlocks():
		ids.append(str(item.id))
	_check("first_caught" in ids, "Captura deve desbloquear Quase pego")

func _test_progress_counters() -> void:
	var tracker := AchievementTracker.new()
	tracker.begin_run(0.0)
	var snap := _snapshot({
		"elapsed": 10.0,
		"distance": 20.0,
		"run_stats": {
			"escapes": 1,
			"escape_no_items": true,
			"items_used": 1,
			"picked_types": ["escape", "soap"],
		}
	})
	tracker.live(snap)
	var progress := tracker.get_progress()
	_check(int(progress.meta.escapes) == 1, "Meta global de fugas deve acumular")
	_check(int(progress.meta.items_used) == 1, "Meta global de itens deve acumular")
	_check(Array(progress.meta.collected_items).size() == 2, "Tipos coletados devem ser preservados")
