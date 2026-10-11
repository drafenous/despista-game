extends RefCounted
class_name GameEngine

const W := 360.0
const H := 640.0
const PLAYER_RADIUS := 12.0
const DISTANCE_UNITS_PER_METER := 16.0
const CHUNK_HEIGHT := 280.0
const MAX_ON_SCREEN_ACTORS := 24
const MAX_ON_SCREEN_CAMERAS := 3
const MAX_LIVE_NPCS := 64
const NPC_MIN_SEPARATION := 24.0

const POWER_DEFS := {
	"escape": {"name": "Fuga imediata", "short": "Fuga", "color": "#f6d64a"},
	"soap": {"name": "Sabonete", "short": "Sabão", "color": "#64d9ff"},
	"skates": {"name": "Patins", "short": "Patins", "color": "#ff8bd5"},
	"staff": {"name": "Cajado e Moisés", "short": "Moisés", "color": "#e9c878"},
	"invis": {"name": "Manto da invisibilidade", "short": "Manto", "color": "#b9a7ff"},
	"teleport": {"name": "Teletransporte", "short": "Tele", "color": "#70f2d0"},
	"shield": {"name": "Escudo de proteção", "short": "Escudo", "color": "#6fa8ff"},
	"time": {"name": "Máquina do tempo", "short": "Tempo", "color": "#ffd166"},
}
const POWER_KEYS: Array[String] = ["escape", "soap", "skates", "staff", "invis", "teleport", "shield", "time"]

var rng := RandomNumberGenerator.new()
var events: Array[Dictionary] = []

var started := false
var game_over := false
var paused := false
var suspended := false
var reason := ""
var difficulty := DifficultyRules.MEDIUM

var elapsed := 0.0
var best := 0.0
var camera_y := 0.0
var generated_until := -100.0
var distance_units := 0.0
var screen_distance_units := 0.0
var last_measured_camera_y := 0.0
var suspicion := 0.0
var alert := false
var busted_timer := 0.0
var pursuit_escape_timer := 0.0
var pursuit_grace_timer := 0.0
var main_pursuer_id := -1
var player_idle_timer := 0.0
var idle_hunter_id := -1
var next_entity_id := 1
var impossible_pursuit_started := false
var spawn_indicator := 0.0

var escape_immunity_timer := 0.0
var soap_timer := 0.0
var skates_timer := 0.0
var staff_timer := 0.0
var invisibility_timer := 0.0
var shield_pulse_timer := 0.0
var time_freeze_timer := 0.0
var camera_anim_time := 0.0
var power_pickup_flash := 0.0
var power_pickup_cooldown := 0.0

var input_dir := Vector2.ZERO
var last_input_dir := Vector2.ZERO
var player := {"x": W * 0.5, "y": 40.0, "r": PLAYER_RADIUS, "speed": 185.0, "vx": 0.0, "vy": 0.0}
var npcs: Array[Dictionary] = []
var cops: Array[Dictionary] = []
var cameras: Array[Dictionary] = []
var obstacles: Array[Dictionary] = []
var decor: Array[Dictionary] = []
var power_ups: Array[Dictionary] = []
var inventory: Array[String] = []
var power_bag: Array[String] = []
var chunks_since_power_up := 0
var last_power_type := ""
var last_power_spawn_y := -INF

var run_stats := {}
var run_dirs_in_escape: Array[String] = []
var run_alert_items_used := 0
var run_max_busted_in_alert := 0.0
var run_soap_in_alert := false

func _init(seed_value: int = 0) -> void:
	if seed_value == 0:
		rng.randomize()
	else:
		rng.seed = seed_value
	run_stats = _empty_run_stats()
	reset()

func _empty_run_stats() -> Dictionary:
	return {
		"crowd_cover_time": 0.0,
		"crowd_cover_streak": 0.0,
		"crowd_cover_streak_max": 0.0,
		"suspicion_low50_time": 0.0,
		"suspicion_low20_time": 0.0,
		"no_camera_time": 0.0,
		"direction_changes": 0,
		"obstacle_hit": false,
		"clean_distance_meters": 0.0,
		"skates_meters": 0.0,
		"cameras_clean": 0,
		"max_busted": 0.0,
		"touched_police": false,
		"escapes": 0,
		"items_used": 0,
		"items_used_in_alert": 0,
		"used_escape_item": false,
		"used_soap_in_alert": false,
		"used_cloak_in_alert": false,
		"used_teleport_in_busted": false,
		"used_shield_near_cop": false,
		"used_staff": false,
		"used_time": false,
		"used_skates": false,
		"alert_ever": false,
		"anti_camp": false,
		"anti_camp_survived": false,
		"inventory_full": false,
		"suspicion_hit99": false,
		"suspicion_recovered": false,
		"dirs_in_escape": [],
		"near_capture_escape": false,
		"escape_no_items": false,
		"escape_one_item": false,
		"hard_escape": false,
		"picked_types": [],
		"used_types": [],
	}

func start(mode: String = DifficultyRules.MEDIUM) -> void:
	if not DifficultyRules.is_valid(mode):
		mode = DifficultyRules.MEDIUM
	difficulty = mode
	reset()
	started = true
	paused = false
	suspended = false
	if DifficultyRules.config(difficulty).constant_pursuit:
		alert = true
		suspicion = 100.0
		impossible_pursuit_started = true
		main_pursuer_id = _nearest_on_screen_cop_id()
		for cop in cops:
			cop.chase = true
		run_stats.alert_ever = true
	events.append({"type": "run_started", "difficulty": difficulty})

func reset() -> void:
	elapsed = 0.0
	camera_y = 0.0
	generated_until = -100.0
	distance_units = 0.0
	screen_distance_units = 0.0
	last_measured_camera_y = 0.0
	suspicion = 0.0
	alert = false
	game_over = false
	reason = ""
	spawn_indicator = 2.6
	pursuit_escape_timer = 0.0
	pursuit_grace_timer = 0.0
	main_pursuer_id = -1
	busted_timer = 0.0
	player_idle_timer = 0.0
	idle_hunter_id = -1
	impossible_pursuit_started = false
	escape_immunity_timer = 0.0
	soap_timer = 0.0
	skates_timer = 0.0
	staff_timer = 0.0
	invisibility_timer = 0.0
	shield_pulse_timer = 0.0
	time_freeze_timer = 0.0
	camera_anim_time = 0.0
	power_pickup_flash = 0.0
	power_pickup_cooldown = 0.0
	inventory.clear()
	power_ups.clear()
	power_bag.clear()
	chunks_since_power_up = 0
	last_power_type = ""
	last_power_spawn_y = -INF
	npcs.clear()
	cops.clear()
	cameras.clear()
	decor.clear()
	obstacles.clear()
	next_entity_id = 1
	input_dir = Vector2.ZERO
	last_input_dir = Vector2.ZERO
	player = {"x": W * 0.5, "y": 40.0, "r": PLAYER_RADIUS, "speed": 185.0, "vx": 0.0, "vy": 0.0}
	run_stats = _empty_run_stats()
	run_dirs_in_escape.clear()
	run_alert_items_used = 0
	run_max_busted_in_alert = 0.0
	run_soap_in_alert = false
	ensure_world()
	_sanitize_initial_spawn()

func set_best(value: float) -> void:
	best = maxf(best, value)

func set_input(x: float, y: float) -> void:
	if not is_playing():
		input_dir = Vector2.ZERO
		return
	var raw := Vector2(clampf(x, -1.0, 1.0), clampf(y, -1.0, 1.0))
	if raw.length() < 0.2:
		input_dir = Vector2.ZERO
	elif absf(raw.x) > absf(raw.y):
		input_dir = Vector2(signf(raw.x), 0.0)
	else:
		input_dir = Vector2(0.0, signf(raw.y))

func set_paused(value: bool) -> void:
	if not started or game_over:
		return
	if value and not DifficultyRules.allows_pause(difficulty):
		return
	paused = value
	input_dir = Vector2.ZERO

func toggle_pause() -> void:
	set_paused(not paused)

func suspend_app() -> void:
	if not started or game_over:
		return
	suspended = true
	input_dir = Vector2.ZERO

func resume_suspended() -> void:
	if not started or game_over:
		return
	suspended = false
	input_dir = Vector2.ZERO

func is_playing() -> bool:
	return started and not game_over and not paused and not suspended

func allows_pause() -> bool:
	return DifficultyRules.allows_pause(difficulty)

func get_difficulty_config() -> Dictionary:
	return DifficultyRules.config(difficulty)

func get_escape_target() -> float:
	return DifficultyRules.pursuit_escape_target(difficulty)

func consume_events() -> Array[Dictionary]:
	var result := events.duplicate(true)
	events.clear()
	return result

func step(dt: float) -> void:
	if not is_playing():
		return
	dt = clampf(dt, 0.0, 1.0 / 30.0)
	if dt <= 0.0:
		return

	elapsed += dt
	spawn_indicator = maxf(0.0, spawn_indicator - dt)
	escape_immunity_timer = maxf(0.0, escape_immunity_timer - dt)
	soap_timer = maxf(0.0, soap_timer - dt)
	skates_timer = maxf(0.0, skates_timer - dt)
	staff_timer = maxf(0.0, staff_timer - dt)
	invisibility_timer = maxf(0.0, invisibility_timer - dt)
	shield_pulse_timer = maxf(0.0, shield_pulse_timer - dt)
	time_freeze_timer = maxf(0.0, time_freeze_timer - dt)
	power_pickup_flash = maxf(0.0, power_pickup_flash - dt)
	power_pickup_cooldown = maxf(0.0, power_pickup_cooldown - dt)
	if time_freeze_timer <= 0.0:
		camera_anim_time += dt

	var before := Vector2(float(player.x), float(player.y))
	_update_player(dt)
	var after := Vector2(float(player.x), float(player.y))
	var moved_units := before.distance_to(after)
	distance_units += moved_units
	run_stats.clean_distance_meters = float(run_stats.clean_distance_meters) + moved_units / DISTANCE_UNITS_PER_METER
	if skates_timer > 0.0:
		run_stats.skates_meters = float(run_stats.skates_meters) + moved_units / DISTANCE_UNITS_PER_METER

	_update_camera(dt)
	ensure_world()
	_update_npcs(dt)
	_update_cops(dt)
	_update_cameras(dt)
	_update_suspicion_and_pursuit(dt)
	_update_power_pickups()
	_update_busted(dt)
	_update_run_stats(dt)
	_cleanup_world()

	var camera_delta := maxf(0.0, camera_y - last_measured_camera_y)
	screen_distance_units += camera_delta
	last_measured_camera_y = camera_y

	if DifficultyRules.config(difficulty).constant_pursuit and escape_immunity_timer <= 0.0 and not alert:
		_start_alert(_nearest_on_screen_cop_id())
		impossible_pursuit_started = true

func _update_player(dt: float) -> void:
	var speed := float(player.speed) * (1.5 if skates_timer > 0.0 else 1.0)
	var world_velocity := Vector2(input_dir.x, -input_dir.y) * speed
	player.vx = world_velocity.x
	player.vy = world_velocity.y

	if input_dir != Vector2.ZERO:
		if last_input_dir != Vector2.ZERO and input_dir != last_input_dir:
			run_stats.direction_changes = int(run_stats.direction_changes) + 1
		last_input_dir = input_dir
		if alert:
			var dir_name := _direction_name(input_dir)
			if not dir_name in run_dirs_in_escape:
				run_dirs_in_escape.append(dir_name)
		if idle_hunter_id != -1 and bool(run_stats.anti_camp):
			run_stats.anti_camp_survived = true
		player_idle_timer = 0.0
		idle_hunter_id = -1
	else:
		if not alert:
			player_idle_timer += dt

	if player_idle_timer >= 3.0 and not alert:
		run_stats.anti_camp = true
		if idle_hunter_id == -1:
			idle_hunter_id = _nearest_on_screen_cop_id()

	if world_velocity == Vector2.ZERO:
		return

	var old_x := float(player.x)
	var old_y := float(player.y)
	player.x = clampf(old_x + world_velocity.x * dt, PLAYER_RADIUS, W - PLAYER_RADIUS)
	player.y = old_y + world_velocity.y * dt

	var blocked := false
	for obstacle in obstacles:
		if absf((float(obstacle.y) + float(obstacle.h) * 0.5) - float(player.y)) > 80.0:
			continue
		if _circle_intersects_rect(float(player.x), float(player.y), PLAYER_RADIUS, obstacle):
			blocked = true
			break
	if not blocked:
		for cop in cops:
			if _dist(float(player.x), float(player.y), float(cop.x), float(cop.y)) < PLAYER_RADIUS + float(cop.r):
				blocked = true
				break
	if not blocked and soap_timer <= 0.0:
		for npc in npcs:
			if _dist(float(player.x), float(player.y), float(npc.x), float(npc.y)) < PLAYER_RADIUS + float(npc.r):
				blocked = true
				break

	if blocked:
		player.x = old_x
		player.y = old_y
		run_stats.obstacle_hit = true
		run_stats.clean_distance_meters = 0.0

func _update_camera(dt: float) -> void:
	var cfg := DifficultyRules.config(difficulty)
	camera_y += float(cfg.auto_scroll) * dt
	var follow_target := float(player.y) - H * 0.25
	if follow_target > camera_y:
		camera_y = follow_target
	if not bool(cfg.allow_bottom_touch) and screen_y(float(player.y)) > H + 26.0:
		_end_run("left_behind")

func _update_npcs(dt: float) -> void:
	if time_freeze_timer > 0.0:
		return
	for npc in npcs:
		if float(npc.get("stun_timer", 0.0)) > 0.0:
			npc.stun_timer = maxf(0.0, float(npc.stun_timer) - dt)
			continue
		npc.turn_timer = float(npc.turn_timer) - dt
		if float(npc.turn_timer) <= 0.0:
			npc.axis = "v" if str(npc.axis) == "h" else "h"
			npc.dir = -1.0 if rng.randf() < 0.5 else 1.0
			npc.turn_timer = rng.randf_range(0.8, 2.2)

		var velocity := Vector2.ZERO
		if staff_timer > 0.0:
			velocity = Vector2(-1.0 if float(npc.x) < W * 0.5 else 1.0, 0.0) * 78.0
		elif str(npc.axis) == "h":
			velocity.x = float(npc.dir) * float(npc.speed)
		else:
			velocity.y = float(npc.dir) * float(npc.speed)

		var old_x := float(npc.x)
		var old_y := float(npc.y)
		npc.x = clampf(old_x + velocity.x * dt, float(npc.r), W - float(npc.r))
		npc.y = old_y + velocity.y * dt
		var collided := false
		for obstacle in obstacles:
			if absf((float(obstacle.y) + float(obstacle.h) * 0.5) - float(npc.y)) > 70.0:
				continue
			if _circle_intersects_rect(float(npc.x), float(npc.y), float(npc.r), obstacle):
				collided = true
				break
		if _dist(float(npc.x), float(npc.y), float(player.x), float(player.y)) < float(npc.r) + PLAYER_RADIUS and soap_timer <= 0.0:
			collided = true
		if collided:
			npc.x = old_x
			npc.y = old_y
			npc.axis = "v" if str(npc.axis) == "h" else "h"
			npc.dir = -float(npc.dir)
			npc.turn_timer = rng.randf_range(0.45, 1.1)

	_resolve_npc_separation()

func _resolve_npc_separation() -> void:
	if time_freeze_timer > 0.0:
		return
	var count := npcs.size()
	for i in range(count):
		for j in range(i + 1, count):
			var a: Dictionary = npcs[i]
			var b: Dictionary = npcs[j]
			if absf(float(a.y) - float(b.y)) > NPC_MIN_SEPARATION:
				continue
			var dx := float(b.x) - float(a.x)
			var dy := float(b.y) - float(a.y)
			var d := sqrt(dx * dx + dy * dy)
			if d <= 0.001 or d >= NPC_MIN_SEPARATION:
				continue
			var push := (NPC_MIN_SEPARATION - d) * 0.5
			var nx := dx / d
			var ny := dy / d
			a.x = clampf(float(a.x) - nx * push, float(a.r), W - float(a.r))
			a.y = float(a.y) - ny * push
			b.x = clampf(float(b.x) + nx * push, float(b.r), W - float(b.r))
			b.y = float(b.y) + ny * push

func _update_cops(dt: float) -> void:
	for cop in cops:
		var sy := screen_y(float(cop.y))
		if sy >= -20.0 and sy <= H + 20.0:
			cop.has_been_on_screen = true
		cop.seeing_player = false

		if time_freeze_timer > 0.0:
			cop.recognizing = false
			continue
		if float(cop.get("stun_timer", 0.0)) > 0.0:
			cop.stun_timer = maxf(0.0, float(cop.stun_timer) - dt)
			continue

		var target_speed := 40.0
		var target_velocity := Vector2.ZERO
		var hunter := int(cop.id) == idle_hunter_id and not alert and player_idle_timer >= 3.0

		if alert and bool(cop.chase):
			target_speed = 72.0
			if int(cop.id) == main_pursuer_id and not _cop_can_see_player(cop):
				target_speed *= 0.85
			target_velocity = _cardinal_toward(cop, player, target_speed)
		elif hunter:
			target_speed = 62.0
			target_velocity = _cardinal_toward(cop, player, target_speed)
		else:
			cop.turn = float(cop.turn) - dt
			if float(cop.turn) <= 0.0:
				cop.axis = "v" if str(cop.axis) == "h" else "h"
				cop.dir = -1.0 if rng.randf() < 0.5 else 1.0
				cop.turn = rng.randf_range(0.7, 1.7)
			if str(cop.axis) == "h":
				target_velocity.x = float(cop.dir) * target_speed
			else:
				target_velocity.y = float(cop.dir) * target_speed

		if float(cop.get("avoid_timer", 0.0)) > 0.0:
			cop.avoid_timer = maxf(0.0, float(cop.avoid_timer) - dt)
			target_velocity = Vector2(float(cop.avoid_vx), float(cop.avoid_vy))

		var old_x := float(cop.x)
		var old_y := float(cop.y)
		cop.vx = target_velocity.x
		cop.vy = target_velocity.y
		cop.x = clampf(old_x + target_velocity.x * dt, float(cop.r), W - float(cop.r))
		cop.y = old_y + target_velocity.y * dt

		var blocked := false
		for obstacle in obstacles:
			if absf((float(obstacle.y) + float(obstacle.h) * 0.5) - float(cop.y)) > 75.0:
				continue
			if _circle_intersects_rect(float(cop.x), float(cop.y), float(cop.r), obstacle):
				blocked = true
				break
		if _dist(float(cop.x), float(cop.y), float(player.x), float(player.y)) < float(cop.r) + PLAYER_RADIUS:
			blocked = true
		if blocked:
			cop.x = old_x
			cop.y = old_y
			_start_cop_detour(cop, player if alert or hunter else null, target_speed)

		if target_velocity.length_squared() > 1.0 and not bool(cop.recognizing):
			cop.face = atan2(target_velocity.y, target_velocity.x)

		var d := _dist(float(cop.x), float(cop.y), float(player.x), float(player.y))
		var recognition_allowed := escape_immunity_timer <= 0.0 and invisibility_timer <= 0.0 and d <= float(cop.vision)
		if not alert:
			if bool(cop.recognizing) and recognition_allowed:
				var target_angle := atan2(float(player.y) - float(cop.y), float(player.x) - float(cop.x))
				cop.face = _turn_toward_angle(float(cop.face), target_angle, 6.2 * dt)
				cop.seeing_player = true
			else:
				cop.recognizing = false
				if recognition_allowed and _point_in_cone(cop, float(player.x), float(player.y)):
					cop.recognizing = true
					cop.seeing_player = true
		else:
			cop.recognizing = false
			cop.seeing_player = _cop_can_see_player(cop)

func _update_cameras(_dt: float) -> void:
	for camera in cameras:
		camera.seeing_player = false
		if time_freeze_timer > 0.0 or escape_immunity_timer > 0.0 or invisibility_timer > 0.0:
			continue
		if _point_in_camera_vision(camera, float(player.x), float(player.y)):
			camera.seeing_player = true
			camera.ever_saw_player = true

func _update_suspicion_and_pursuit(dt: float) -> void:
	var cover := _crowd_cover_factor()
	var seen_by_any := false
	var nearest_seeing_id := -1
	var nearest_seeing_distance := INF

	if not alert:
		for cop in cops:
			if not bool(cop.seeing_player):
				continue
			seen_by_any = true
			var d := _dist(float(cop.x), float(cop.y), float(player.x), float(player.y))
			var factor := clampf(1.25 - d / maxf(1.0, float(cop.vision)), 0.35, 1.0)
			suspicion += 72.0 * factor * (1.0 - cover) * dt
			if d < nearest_seeing_distance:
				nearest_seeing_distance = d
				nearest_seeing_id = int(cop.id)

		for camera in cameras:
			if not bool(camera.seeing_player):
				continue
			seen_by_any = true
			var d := _dist(float(camera.x), float(camera.y), float(player.x), float(player.y))
			var factor := clampf(1.25 - d / maxf(1.0, float(camera.vision)), 0.35, 1.0)
			suspicion += 72.0 * factor * (1.0 - cover) * dt

		if not seen_by_any:
			suspicion = maxf(0.0, suspicion - 48.0 * dt)

		if suspicion >= 99.0:
			run_stats.suspicion_hit99 = true
		if bool(run_stats.suspicion_hit99) and suspicion < 50.0:
			run_stats.suspicion_recovered = true

		if suspicion >= 100.0 and escape_immunity_timer <= 0.0:
			_start_alert(nearest_seeing_id)
	else:
		var main := _cop_by_id(main_pursuer_id)
		if main.is_empty():
			main_pursuer_id = _nearest_on_screen_cop_id()
			main = _cop_by_id(main_pursuer_id)
		var main_sees := not main.is_empty() and bool(main.seeing_player)
		if main_sees:
			pursuit_grace_timer = 0.5
			pursuit_escape_timer = maxf(0.0, pursuit_escape_timer - 2.0 * dt)
		else:
			if pursuit_grace_timer > 0.0:
				pursuit_grace_timer = maxf(0.0, pursuit_grace_timer - dt)
			else:
				pursuit_escape_timer += dt
		var target := get_escape_target()
		if target != INF and pursuit_escape_timer >= target:
			_clear_pursuit(true, true)

func _start_alert(source_id: int) -> void:
	if alert or escape_immunity_timer > 0.0:
		return
	alert = true
	suspicion = 100.0
	pursuit_escape_timer = 0.0
	pursuit_grace_timer = 0.5
	main_pursuer_id = source_id if source_id != -1 else _nearest_on_screen_cop_id()
	run_stats.alert_ever = true
	run_alert_items_used = 0
	run_max_busted_in_alert = 0.0
	run_soap_in_alert = false
	run_dirs_in_escape.clear()
	for cop in cops:
		cop.recognizing = false
		cop.seeing_player = false
		cop.chase = is_world_y_on_screen(float(cop.y), 90.0)
	events.append({"type": "alert_started", "main_pursuer_id": main_pursuer_id})

func _clear_pursuit(count_escape: bool = false, natural: bool = false) -> void:
	var was_alert := alert
	alert = false
	suspicion = 0.0
	pursuit_escape_timer = 0.0
	pursuit_grace_timer = 0.0
	main_pursuer_id = -1
	for cop in cops:
		cop.chase = false
		cop.seeing_player = false
		cop.recognizing = false
		cop.turn = rng.randf_range(0.7, 1.7)
	for camera in cameras:
		camera.seeing_player = false
	if count_escape and was_alert:
		_note_escape(natural)

func _note_escape(natural: bool) -> void:
	run_stats.escapes = int(run_stats.escapes) + 1
	run_stats.items_used_in_alert = maxi(int(run_stats.items_used_in_alert), run_alert_items_used)
	if run_alert_items_used == 0:
		run_stats.escape_no_items = true
	if run_alert_items_used == 1:
		run_stats.escape_one_item = true
	if run_max_busted_in_alert >= 1.0:
		run_stats.near_capture_escape = true
	if run_soap_in_alert:
		run_stats.used_soap_in_alert = true
	if run_dirs_in_escape.size() >= 4:
		run_stats.dirs_in_escape = run_dirs_in_escape.duplicate()
	if natural and (difficulty == DifficultyRules.HARD or difficulty == DifficultyRules.PRO):
		run_stats.hard_escape = true
	events.append({"type": "escape", "natural": natural})
	run_alert_items_used = 0
	run_max_busted_in_alert = 0.0
	run_soap_in_alert = false
	run_dirs_in_escape.clear()

func _update_busted(dt: float) -> void:
	var touching := false
	for cop in cops:
		var danger_radius := float(cop.danger_radius) + (12.0 if bool(cop.chase) else 0.0)
		if _dist(float(cop.x), float(cop.y), float(player.x), float(player.y)) <= danger_radius:
			touching = true
			break
	if touching:
		busted_timer += dt
		run_stats.touched_police = true
		run_stats.max_busted = maxf(float(run_stats.max_busted), busted_timer)
		if alert:
			run_max_busted_in_alert = maxf(run_max_busted_in_alert, busted_timer)
		if busted_timer >= 1.5:
			_end_run("caught")
	else:
		busted_timer = 0.0

func _update_power_pickups() -> void:
	if power_pickup_cooldown > 0.0 or inventory.size() >= 3:
		return
	for i in range(power_ups.size() - 1, -1, -1):
		var power: Dictionary = power_ups[i]
		if _dist(float(power.x), float(power.y), float(player.x), float(player.y)) <= PLAYER_RADIUS + float(power.r) + 3.0:
			var type := str(power.type)
			inventory.append(type)
			power_ups.remove_at(i)
			power_pickup_cooldown = 0.45
			power_pickup_flash = 0.22
			_remember_type(run_stats.picked_types, type)
			if inventory.size() >= 3:
				run_stats.inventory_full = true
			events.append({"type": "power_pickup", "power": type})
			return

func use_power_up(slot_index: int) -> bool:
	if not is_playing() or slot_index < 0 or slot_index >= inventory.size():
		return false
	var type := inventory[slot_index]
	run_stats.items_used = int(run_stats.items_used) + 1
	_remember_type(run_stats.used_types, type)
	if alert:
		run_alert_items_used += 1
		run_stats.items_used_in_alert = maxi(int(run_stats.items_used_in_alert), run_alert_items_used)

	match type:
		"escape":
			run_stats.used_escape_item = true
			_clear_pursuit(true, false)
			escape_immunity_timer = 3.0
			impossible_pursuit_started = false
		"soap":
			soap_timer = 5.0
			if alert:
				run_soap_in_alert = true
		"skates":
			skates_timer = 10.0
			run_stats.used_skates = true
		"staff":
			staff_timer = 5.0
			run_stats.used_staff = true
		"invis":
			invisibility_timer = 10.0
			if alert:
				run_stats.used_cloak_in_alert = true
		"teleport":
			if busted_timer > 0.0:
				run_stats.used_teleport_in_busted = true
			var destination := _find_teleport_destination(320.0)
			player.x = destination.x
			player.y = destination.y
			camera_y = maxf(camera_y, float(player.y) - H * 0.47)
			spawn_indicator = maxf(spawn_indicator, 0.7)
			ensure_world()
		"shield":
			_activate_shield()
		"time":
			time_freeze_timer = 10.0
			run_stats.used_time = true

	inventory.remove_at(slot_index)
	events.append({"type": "power_use", "power": type})
	return true

func _activate_shield() -> void:
	var radius := 150.0
	shield_pulse_timer = 0.45
	var hit_cop := false
	for npc in npcs:
		_repel_entity(npc, radius, 0.0)
	for cop in cops:
		if _dist(float(cop.x), float(cop.y), float(player.x), float(player.y)) <= radius:
			hit_cop = true
		_repel_entity(cop, radius, 12.0)
	if hit_cop:
		run_stats.used_shield_near_cop = true

func _repel_entity(entity: Dictionary, radius: float, extra_push: float) -> void:
	var dx := float(entity.x) - float(player.x)
	var dy := float(entity.y) - float(player.y)
	var d := sqrt(dx * dx + dy * dy)
	if d > radius:
		return
	if d < 0.001:
		dx = 1.0
		dy = 0.0
		d = 1.0
	var push := 58.0 + (1.0 - d / radius) * 48.0 + extra_push
	entity.x = clampf(float(entity.x) + dx / d * push, 16.0, W - 16.0)
	entity.y = float(entity.y) + dy / d * push
	entity.stun_timer = 1.0

func _find_teleport_destination(distance: float) -> Vector2:
	var target_y := float(player.y) + distance
	var candidates: Array[Vector2] = [
		Vector2(float(player.x), target_y),
		Vector2(W * 0.5, target_y),
		Vector2(float(player.x) - 80.0, target_y),
		Vector2(float(player.x) + 80.0, target_y),
		Vector2(W * 0.28, target_y + 34.0),
		Vector2(W * 0.72, target_y + 34.0),
		Vector2(W * 0.5, target_y + 70.0),
	]
	for candidate in candidates:
		var x := clampf(candidate.x, 20.0, W - 20.0)
		var y := candidate.y
		var blocked := false
		for obstacle in obstacles:
			if absf((float(obstacle.y) + float(obstacle.h) * 0.5) - y) < 70.0 and _circle_intersects_rect(x, y, PLAYER_RADIUS + 3.0, obstacle):
				blocked = true
				break
		if blocked:
			continue
		for cop in cops:
			if _dist(float(cop.x), float(cop.y), x, y) < float(cop.r) + PLAYER_RADIUS + 12.0:
				blocked = true
				break
		if blocked:
			continue
		for npc in npcs:
			if _dist(float(npc.x), float(npc.y), x, y) < float(npc.r) + PLAYER_RADIUS + 6.0:
				blocked = true
				break
		if not blocked:
			return Vector2(x, y)
	return Vector2(W * 0.5, target_y + 90.0)

func _update_run_stats(dt: float) -> void:
	var cover := _crowd_cover_factor()
	if cover > 0.0:
		run_stats.crowd_cover_time = float(run_stats.crowd_cover_time) + dt
		run_stats.crowd_cover_streak = float(run_stats.crowd_cover_streak) + dt
		run_stats.crowd_cover_streak_max = maxf(float(run_stats.crowd_cover_streak_max), float(run_stats.crowd_cover_streak))
	else:
		run_stats.crowd_cover_streak = 0.0
	if suspicion <= 50.0:
		run_stats.suspicion_low50_time = float(run_stats.suspicion_low50_time) + dt
	if suspicion < 20.0:
		run_stats.suspicion_low20_time = float(run_stats.suspicion_low20_time) + dt
	var camera_seeing := false
	for camera in cameras:
		if bool(camera.seeing_player):
			camera_seeing = true
			break
	if not camera_seeing:
		run_stats.no_camera_time = float(run_stats.no_camera_time) + dt

func ensure_world() -> void:
	var target := camera_y + H + 420.0
	while generated_until < target:
		_spawn_chunk(generated_until, CHUNK_HEIGHT)
		generated_until += CHUNK_HEIGHT
	_enforce_limits()

func _spawn_chunk(start_y: float, chunk_h: float) -> void:
	var cfg := DifficultyRules.config(difficulty)
	var obstacle_count := rng.randi_range(2, 4)
	for _i in range(obstacle_count):
		_spawn_obstacle(start_y, chunk_h)

	var npc_count := int(round(rng.randi_range(5, 8) * float(cfg.npc_multiplier)))
	for _i in range(npc_count):
		if npcs.size() >= MAX_LIVE_NPCS:
			break
		_spawn_npc(start_y, chunk_h)

	var cop_count := int(round(rng.randi_range(1, 2) * float(cfg.cop_multiplier)))
	if difficulty == DifficultyRules.PRO or difficulty == DifficultyRules.IMPOSSIBLE:
		if rng.randf() < 0.25:
			cop_count += 1
	for _i in range(cop_count):
		_spawn_cop(start_y, chunk_h)

	if rng.randf() < 0.46:
		_spawn_camera(start_y, chunk_h)
		if rng.randf() < 0.07:
			_spawn_camera(start_y, chunk_h)

	chunks_since_power_up += 1
	var wants_power := rng.randf() < 0.58 or chunks_since_power_up >= 2
	if wants_power and _spawn_power_up(start_y, chunk_h):
		chunks_since_power_up = 0

	for _i in range(rng.randi_range(3, 7)):
		decor.append({
			"x": rng.randf_range(12.0, W - 12.0),
			"y": start_y + rng.randf_range(10.0, chunk_h - 10.0),
			"kind": rng.randi_range(0, 3),
		})

func _spawn_obstacle(start_y: float, chunk_h: float) -> void:
	for _attempt in range(12):
		var type := ["bench", "trash", "planter", "barrier", "crate"][rng.randi_range(0, 4)]
		var size := _obstacle_size(type)
		var x := rng.randf_range(18.0, W - size.x - 18.0)
		var y := start_y + rng.randf_range(24.0, chunk_h - size.y - 24.0)
		if _rect_touches_spawn_safe_zone(x, y, size.x, size.y, 10.0):
			continue
		var candidate := {"x": x, "y": y, "w": size.x, "h": size.y, "type": type}
		var overlaps := false
		for obstacle in obstacles:
			if _rects_overlap(candidate, obstacle, 12.0):
				overlaps = true
				break
		if not overlaps:
			obstacles.append(candidate)
			return

func _spawn_npc(start_y: float, chunk_h: float) -> void:
	for _attempt in range(16):
		var x := rng.randf_range(22.0, W - 22.0)
		var y := start_y + rng.randf_range(20.0, chunk_h - 20.0)
		if _inside_spawn_safe_zone(x, y, 12.0):
			continue
		if not _can_spawn_actor_at(y):
			continue
		var blocked := false
		for obstacle in obstacles:
			if _circle_intersects_rect(x, y, 10.0, obstacle):
				blocked = true
				break
		if blocked:
			continue
		for npc in npcs:
			if _dist(float(npc.x), float(npc.y), x, y) < NPC_MIN_SEPARATION:
				blocked = true
				break
		if blocked:
			continue
		npcs.append({
			"id": _take_id(),
			"x": x, "y": y, "r": 10.0,
			"speed": rng.randf_range(24.0, 36.0),
			"axis": "h" if rng.randf() < 0.5 else "v",
			"dir": -1.0 if rng.randf() < 0.5 else 1.0,
			"turn_timer": rng.randf_range(0.6, 2.0),
			"tone": rng.randi_range(0, 4),
			"stun_timer": 0.0,
		})
		return

func _spawn_cop(start_y: float, chunk_h: float) -> void:
	for _attempt in range(16):
		var x := rng.randf_range(24.0, W - 24.0)
		var y := start_y + rng.randf_range(28.0, chunk_h - 28.0)
		if elapsed <= 0.01:
			y = maxf(y, _initial_police_min_world_y() + rng.randf_range(0.0, 80.0))
		if _inside_spawn_safe_zone(x, y, 75.0) or not _can_spawn_actor_at(y):
			continue
		var blocked := false
		for obstacle in obstacles:
			if _circle_intersects_rect(x, y, 10.0, obstacle):
				blocked = true
				break
		if blocked:
			continue
		var axis := "h" if rng.randf() < 0.5 else "v"
		var dir := -1.0 if rng.randf() < 0.5 else 1.0
		var vx := dir * 40.0 if axis == "h" else 0.0
		var vy := dir * 40.0 if axis == "v" else 0.0
		cops.append({
			"id": _take_id(),
			"x": x, "y": y, "r": 10.0,
			"danger_radius": 22.0,
			"vision": rng.randf_range(125.0, 165.0),
			"fov": PI / 3.1,
			"axis": axis, "dir": dir,
			"vx": vx, "vy": vy,
			"face": atan2(vy, vx),
			"chase": false,
			"seeing_player": false,
			"recognizing": false,
			"avoid_timer": 0.0,
			"avoid_vx": 0.0,
			"avoid_vy": 0.0,
			"stun_timer": 0.0,
			"turn": rng.randf_range(0.7, 1.7),
			"has_been_on_screen": false,
		})
		return

func _spawn_camera(start_y: float, chunk_h: float) -> void:
	if not _can_spawn_camera_at(start_y + chunk_h * 0.5):
		return
	for _attempt in range(16):
		var x := rng.randf_range(24.0, W - 24.0)
		var y := start_y + rng.randf_range(35.0, chunk_h - 35.0)
		if _inside_spawn_safe_zone(x, y, 85.0):
			continue
		var mode := ["fixed1", "fixed2", "sweep", "rotate"][rng.randi_range(0, 3)]
		var face := float(rng.randi_range(0, 3)) * PI * 0.5
		cameras.append({
			"id": _take_id(),
			"x": x, "y": y, "r": 9.0,
			"mode": mode,
			"face": face,
			"base_face": face,
			"vision": rng.randf_range(135.0, 170.0),
			"fov": PI / 3.1,
			"phase": rng.randf_range(0.0, TAU),
			"sweep_speed": rng.randf_range(0.65, 1.05),
			"rotation_dir": -1.0 if rng.randf() < 0.5 else 1.0,
			"rotation_speed": rng.randf_range(0.55, 0.9),
			"seeing_player": false,
			"ever_saw_player": false,
		})
		return

func _spawn_power_up(start_y: float, chunk_h: float) -> bool:
	var type := _next_power_type()
	for _attempt in range(18):
		var x := rng.randf_range(30.0, W - 30.0)
		var y := start_y + rng.randf_range(42.0, chunk_h - 42.0)
		if absf(y - last_power_spawn_y) < 115.0 or _inside_spawn_safe_zone(x, y, 65.0):
			continue
		var blocked := false
		for obstacle in obstacles:
			if absf((float(obstacle.y) + float(obstacle.h) * 0.5) - y) < 60.0 and _circle_intersects_rect(x, y, 16.0, obstacle):
				blocked = true
				break
		if blocked:
			continue
		for cop in cops:
			if _dist(float(cop.x), float(cop.y), x, y) < 48.0:
				blocked = true
				break
		if blocked:
			continue
		for npc in npcs:
			if _dist(float(npc.x), float(npc.y), x, y) < 36.0:
				blocked = true
				break
		if blocked:
			continue
		for power in power_ups:
			if _dist(float(power.x), float(power.y), x, y) < 95.0:
				blocked = true
				break
		if blocked:
			continue
		power_ups.append({"id": _take_id(), "x": x, "y": y, "type": type, "r": 16.0, "phase": rng.randf_range(0.0, TAU)})
		last_power_spawn_y = y
		return true
	power_bag.push_front(type)
	last_power_type = ""
	return false

func _refill_power_bag() -> void:
	power_bag = POWER_KEYS.duplicate()
	for i in range(power_bag.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var temp := power_bag[i]
		power_bag[i] = power_bag[j]
		power_bag[j] = temp
	if power_bag.size() > 1 and power_bag[0] == last_power_type:
		var swap_index := rng.randi_range(1, power_bag.size() - 1)
		var first := power_bag[0]
		power_bag[0] = power_bag[swap_index]
		power_bag[swap_index] = first

func _next_power_type() -> String:
	if power_bag.is_empty():
		_refill_power_bag()
	var type := power_bag.pop_front()
	last_power_type = type
	return type

func _sanitize_initial_spawn() -> void:
	for i in range(obstacles.size() - 1, -1, -1):
		var obstacle: Dictionary = obstacles[i]
		if _rect_touches_spawn_safe_zone(float(obstacle.x), float(obstacle.y), float(obstacle.w), float(obstacle.h), 10.0):
			obstacles.remove_at(i)
	for i in range(npcs.size() - 1, -1, -1):
		var npc: Dictionary = npcs[i]
		if _inside_spawn_safe_zone(float(npc.x), float(npc.y), 12.0):
			npcs.remove_at(i)

func _cleanup_world() -> void:
	var min_y := camera_y - 260.0
	for i in range(npcs.size() - 1, -1, -1):
		if float(npcs[i].y) < min_y:
			npcs.remove_at(i)
	for i in range(obstacles.size() - 1, -1, -1):
		if float(obstacles[i].y) + float(obstacles[i].h) < min_y:
			obstacles.remove_at(i)
	for i in range(decor.size() - 1, -1, -1):
		if float(decor[i].y) < min_y:
			decor.remove_at(i)
	for i in range(power_ups.size() - 1, -1, -1):
		if float(power_ups[i].y) < min_y:
			power_ups.remove_at(i)
	for i in range(cameras.size() - 1, -1, -1):
		var camera: Dictionary = cameras[i]
		if float(camera.y) < min_y:
			if not bool(camera.ever_saw_player):
				run_stats.cameras_clean = int(run_stats.cameras_clean) + 1
			cameras.remove_at(i)

	for i in range(cops.size() - 1, -1, -1):
		var cop: Dictionary = cops[i]
		var sy := screen_y(float(cop.y))
		if bool(cop.has_been_on_screen) and (sy < -140.0 or sy > H + 140.0):
			if int(cop.id) == main_pursuer_id:
				main_pursuer_id = -1
			if int(cop.id) == idle_hunter_id:
				idle_hunter_id = -1
			cops.remove_at(i)

func _enforce_limits() -> void:
	if npcs.size() > MAX_LIVE_NPCS:
		npcs.resize(MAX_LIVE_NPCS)

	var visible_npcs: Array[Dictionary] = []
	var visible_cops := 0
	for cop in cops:
		if is_world_y_on_screen(float(cop.y), 50.0):
			visible_cops += 1
	for npc in npcs:
		if is_world_y_on_screen(float(npc.y), 40.0):
			visible_npcs.append(npc)
	var excess := visible_npcs.size() + visible_cops - MAX_ON_SCREEN_ACTORS
	if excess > 0:
		visible_npcs.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
			return _dist(float(a.x), float(a.y), float(player.x), float(player.y)) > _dist(float(b.x), float(b.y), float(player.x), float(player.y))
		)
		for i in range(mini(excess, visible_npcs.size())):
			npcs.erase(visible_npcs[i])

	var visible_cameras: Array[Dictionary] = []
	for camera in cameras:
		if is_world_y_on_screen(float(camera.y), 50.0):
			visible_cameras.append(camera)
	if visible_cameras.size() > MAX_ON_SCREEN_CAMERAS:
		visible_cameras.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
			return _dist(float(a.x), float(a.y), float(player.x), float(player.y)) > _dist(float(b.x), float(b.y), float(player.x), float(player.y))
		)
		for i in range(visible_cameras.size() - MAX_ON_SCREEN_CAMERAS):
			cameras.erase(visible_cameras[i])

func _crowd_cover_factor() -> float:
	var nearby := 0
	for npc in npcs:
		if _dist(float(npc.x), float(npc.y), float(player.x), float(player.y)) <= 54.0:
			nearby += 1
	return minf(0.60, float(nearby) * 0.12)

func _cop_can_see_player(cop: Dictionary) -> bool:
	if escape_immunity_timer > 0.0 or invisibility_timer > 0.0 or time_freeze_timer > 0.0:
		return false
	return _point_in_cone(cop, float(player.x), float(player.y))

func _point_in_cone(cop: Dictionary, px: float, py: float) -> bool:
	var dx := px - float(cop.x)
	var dy := py - float(cop.y)
	var d := sqrt(dx * dx + dy * dy)
	if d > float(cop.vision):
		return false
	var angle := atan2(dy, dx)
	var diff := wrapf(angle - float(cop.face), -PI, PI)
	return absf(diff) <= float(cop.fov) * 0.5

func camera_faces(camera: Dictionary) -> Array[float]:
	var result: Array[float] = []
	match str(camera.mode):
		"fixed2":
			result = [float(camera.base_face), float(camera.base_face) + PI]
		"sweep":
			result = [float(camera.base_face) + sin(camera_anim_time * float(camera.sweep_speed) + float(camera.phase)) * PI * 0.5]
		"rotate":
			result = [float(camera.base_face) + camera_anim_time * float(camera.rotation_speed) * float(camera.rotation_dir)]
		_:
			result = [float(camera.base_face)]
	return result

func _point_in_camera_vision(camera: Dictionary, px: float, py: float) -> bool:
	var dx := px - float(camera.x)
	var dy := py - float(camera.y)
	var d := sqrt(dx * dx + dy * dy)
	if d > float(camera.vision):
		return false
	var angle := atan2(dy, dx)
	for face in camera_faces(camera):
		var diff := wrapf(angle - face, -PI, PI)
		if absf(diff) <= float(camera.fov) * 0.5:
			return true
	return false

func _cardinal_toward(from: Dictionary, target: Dictionary, speed: float) -> Vector2:
	var dx := float(target.x) - float(from.x)
	var dy := float(target.y) - float(from.y)
	if absf(dx) > absf(dy):
		return Vector2(signf(dx) * speed, 0.0)
	return Vector2(0.0, signf(dy) * speed)

func _start_cop_detour(cop: Dictionary, target: Variant, speed: float) -> void:
	var primary := Vector2(float(cop.vx), float(cop.vy))
	if primary.length_squared() < 1.0 and target is Dictionary:
		primary = _cardinal_toward(cop, target, speed)
	var left := Vector2(-primary.y, primary.x).normalized() * speed
	var right := -left
	var choice := left if rng.randf() < 0.5 else right
	var other := right if choice == left else left
	if _cop_path_blocked(cop, choice, 0.42):
		choice = other
	if _cop_path_blocked(cop, choice, 0.42):
		choice = -primary.normalized() * speed
		cop.avoid_timer = 0.50
	else:
		cop.avoid_timer = 0.72
	cop.avoid_vx = choice.x
	cop.avoid_vy = choice.y

func _cop_path_blocked(cop: Dictionary, velocity: Vector2, look_ahead: float) -> bool:
	if velocity.length_squared() < 1.0:
		return false
	var x := clampf(float(cop.x) + velocity.x * look_ahead, float(cop.r), W - float(cop.r))
	var y := float(cop.y) + velocity.y * look_ahead
	for obstacle in obstacles:
		if _circle_intersects_rect(x, y, float(cop.r), obstacle):
			return true
	return false

func _nearest_on_screen_cop_id() -> int:
	var found := -1
	var best_distance := INF
	for cop in cops:
		var sy := screen_y(float(cop.y))
		if sy < 20.0 or sy > H - 20.0:
			continue
		var d := _dist(float(cop.x), float(cop.y), float(player.x), float(player.y))
		if d < best_distance:
			best_distance = d
			found = int(cop.id)
	return found

func _cop_by_id(id: int) -> Dictionary:
	for cop in cops:
		if int(cop.id) == id:
			return cop
	return {}

func _can_spawn_actor_at(world_y: float) -> bool:
	var count := 0
	var half := H * 0.5 + 80.0
	for npc in npcs:
		if absf(float(npc.y) - world_y) <= half:
			count += 1
	for cop in cops:
		if absf(float(cop.y) - world_y) <= half:
			count += 1
	return count < MAX_ON_SCREEN_ACTORS

func _can_spawn_camera_at(world_y: float) -> bool:
	var count := 0
	var half := H * 0.5 + 80.0
	for camera in cameras:
		if absf(float(camera.y) - world_y) <= half:
			count += 1
	return count < MAX_ON_SCREEN_CAMERAS

func _inside_spawn_safe_zone(x: float, y: float, padding: float = 0.0) -> bool:
	return _dist(x, y, W * 0.5, 40.0) < 78.0 + padding

func _rect_touches_spawn_safe_zone(x: float, y: float, w: float, h: float, padding: float = 0.0) -> bool:
	var safe_x := W * 0.5
	var safe_y := 40.0
	var nearest_x := clampf(safe_x, x, x + w)
	var nearest_y := clampf(safe_y, y, y + h)
	return _dist(safe_x, safe_y, nearest_x, nearest_y) < 72.0 + padding

func _initial_police_min_world_y() -> float:
	return camera_y + (H * 0.5 - 110.0) + 26.0

func _circle_intersects_rect(cx: float, cy: float, radius: float, rect: Dictionary) -> bool:
	var nearest_x := clampf(cx, float(rect.x), float(rect.x) + float(rect.w))
	var nearest_y := clampf(cy, float(rect.y), float(rect.y) + float(rect.h))
	var dx := cx - nearest_x
	var dy := cy - nearest_y
	return dx * dx + dy * dy < radius * radius

func _rects_overlap(a: Dictionary, b: Dictionary, padding: float = 0.0) -> bool:
	return not (
		float(a.x) + float(a.w) + padding < float(b.x)
		or float(a.x) > float(b.x) + float(b.w) + padding
		or float(a.y) + float(a.h) + padding < float(b.y)
		or float(a.y) > float(b.y) + float(b.h) + padding
	)

func _obstacle_size(type: String) -> Vector2:
	match type:
		"bench": return Vector2(62.0, 22.0)
		"trash": return Vector2(24.0, 30.0)
		"planter": return Vector2(48.0, 34.0)
		"barrier": return Vector2(68.0, 20.0)
		_: return Vector2(32.0, 32.0)

func _turn_toward_angle(current: float, target: float, max_step: float) -> float:
	var diff := wrapf(target - current, -PI, PI)
	return current + clampf(diff, -max_step, max_step)

func _direction_name(dir: Vector2) -> String:
	if dir.x < 0.0: return "left"
	if dir.x > 0.0: return "right"
	if dir.y < 0.0: return "up"
	if dir.y > 0.0: return "down"
	return ""

func _remember_type(list: Array, type: String) -> void:
	if not type in list:
		list.append(type)

func _take_id() -> int:
	var id := next_entity_id
	next_entity_id += 1
	return id

func _dist(ax: float, ay: float, bx: float, by: float) -> float:
	var dx := ax - bx
	var dy := ay - by
	return sqrt(dx * dx + dy * dy)

func screen_y(world_y: float) -> float:
	return H - 110.0 - (world_y - camera_y)

func is_world_y_on_screen(world_y: float, margin: float = 40.0) -> bool:
	var sy := screen_y(world_y)
	return sy >= -margin and sy <= H + margin

func distance_meters() -> float:
	return distance_units / DISTANCE_UNITS_PER_METER

func screen_distance_meters() -> float:
	return screen_distance_units / DISTANCE_UNITS_PER_METER

func _format_time(value: float) -> String:
	var minutes := int(floor(value / 60.0))
	var seconds := int(floor(fmod(value, 60.0)))
	var centiseconds := int(floor((value - floor(value)) * 100.0))
	return "%02d:%02d.%02d" % [minutes, seconds, centiseconds]

func _format_distance(meters: float) -> String:
	if meters >= 1000.0:
		return "%.2f km" % (meters / 1000.0)
	if meters < 100.0:
		return "%.1f m" % meters
	return "%d m" % int(round(meters))

func snapshot() -> Dictionary:
	var effects: Array[Dictionary] = []
	for entry in [
		["IMUNE", escape_immunity_timer, "#f6d64a"],
		["SABÃO", soap_timer, "#64d9ff"],
		["PATINS", skates_timer, "#ff8bd5"],
		["MOISÉS", staff_timer, "#e9c878"],
		["INVISÍVEL", invisibility_timer, "#b9a7ff"],
		["TEMPO PARADO", time_freeze_timer, "#ffd166"],
	]:
		if float(entry[1]) > 0.0:
			effects.append({"label": entry[0], "remaining": entry[1], "color": entry[2]})
	return {
		"started": started,
		"game_over": game_over,
		"paused": paused,
		"suspended": suspended,
		"reason": reason,
		"difficulty": difficulty,
		"allows_pause": allows_pause(),
		"elapsed": elapsed,
		"time": _format_time(elapsed),
		"best": best,
		"best_time": _format_time(best),
		"distance": distance_meters(),
		"screen_distance": screen_distance_meters(),
		"distance_label": _format_distance(distance_meters()),
		"screen_distance_label": _format_distance(screen_distance_meters()),
		"suspicion": suspicion,
		"alert": alert,
		"busted_timer": busted_timer,
		"pursuit_escape_timer": pursuit_escape_timer,
		"pursuit_grace_timer": pursuit_grace_timer,
		"escape_target": get_escape_target(),
		"inventory": inventory.duplicate(),
		"effects": effects,
		"player": player.duplicate(true),
		"camera_y": camera_y,
		"run_stats": run_stats.duplicate(true),
	}

func return_to_menu() -> void:
	reset()
	started = false
	game_over = false
	paused = false
	suspended = false
	reason = ""
	input_dir = Vector2.ZERO

func _end_run(cause: String) -> void:
	if game_over:
		return
	reason = cause
	game_over = true
	started = false
	paused = false
	suspended = false
	input_dir = Vector2.ZERO
	if elapsed > best:
		best = elapsed
		events.append({"type": "best", "best": best})
	events.append({"type": "run_end", "reason": cause, "snapshot": snapshot()})

func export_state() -> Dictionary:
	return {
		"version": 1,
		"rng_state": str(rng.state),
		"started": started,
		"game_over": game_over,
		"reason": reason,
		"difficulty": difficulty,
		"elapsed": elapsed,
		"best": best,
		"camera_y": camera_y,
		"generated_until": generated_until,
		"distance_units": distance_units,
		"screen_distance_units": screen_distance_units,
		"last_measured_camera_y": last_measured_camera_y,
		"suspicion": suspicion,
		"alert": alert,
		"busted_timer": busted_timer,
		"pursuit_escape_timer": pursuit_escape_timer,
		"pursuit_grace_timer": pursuit_grace_timer,
		"main_pursuer_id": main_pursuer_id,
		"player_idle_timer": player_idle_timer,
		"idle_hunter_id": idle_hunter_id,
		"next_entity_id": next_entity_id,
		"impossible_pursuit_started": impossible_pursuit_started,
		"spawn_indicator": spawn_indicator,
		"escape_immunity_timer": escape_immunity_timer,
		"soap_timer": soap_timer,
		"skates_timer": skates_timer,
		"staff_timer": staff_timer,
		"invisibility_timer": invisibility_timer,
		"shield_pulse_timer": shield_pulse_timer,
		"time_freeze_timer": time_freeze_timer,
		"camera_anim_time": camera_anim_time,
		"power_pickup_flash": power_pickup_flash,
		"power_pickup_cooldown": power_pickup_cooldown,
		"player": player.duplicate(true),
		"npcs": npcs.duplicate(true),
		"cops": cops.duplicate(true),
		"cameras": cameras.duplicate(true),
		"obstacles": obstacles.duplicate(true),
		"decor": decor.duplicate(true),
		"power_ups": power_ups.duplicate(true),
		"inventory": inventory.duplicate(),
		"power_bag": power_bag.duplicate(),
		"chunks_since_power_up": chunks_since_power_up,
		"last_power_type": last_power_type,
		"last_power_spawn_y": last_power_spawn_y if is_finite(last_power_spawn_y) else -999999999.0,
		"run_stats": run_stats.duplicate(true),
		"run_dirs_in_escape": run_dirs_in_escape.duplicate(),
		"run_alert_items_used": run_alert_items_used,
		"run_max_busted_in_alert": run_max_busted_in_alert,
		"run_soap_in_alert": run_soap_in_alert,
	}

func restore_state(state: Dictionary) -> bool:
	if int(state.get("version", 0)) != 1:
		return false
	var restored_difficulty := str(state.get("difficulty", DifficultyRules.MEDIUM))
	if not DifficultyRules.is_valid(restored_difficulty):
		return false
	difficulty = restored_difficulty
	started = bool(state.get("started", true))
	game_over = bool(state.get("game_over", false))
	reason = str(state.get("reason", ""))
	elapsed = float(state.get("elapsed", 0.0))
	best = float(state.get("best", best))
	camera_y = float(state.get("camera_y", 0.0))
	generated_until = float(state.get("generated_until", camera_y + H))
	distance_units = float(state.get("distance_units", 0.0))
	screen_distance_units = float(state.get("screen_distance_units", 0.0))
	last_measured_camera_y = float(state.get("last_measured_camera_y", camera_y))
	suspicion = float(state.get("suspicion", 0.0))
	alert = bool(state.get("alert", false))
	busted_timer = float(state.get("busted_timer", 0.0))
	pursuit_escape_timer = float(state.get("pursuit_escape_timer", 0.0))
	pursuit_grace_timer = float(state.get("pursuit_grace_timer", 0.0))
	main_pursuer_id = int(state.get("main_pursuer_id", -1))
	player_idle_timer = float(state.get("player_idle_timer", 0.0))
	idle_hunter_id = int(state.get("idle_hunter_id", -1))
	next_entity_id = int(state.get("next_entity_id", 1))
	impossible_pursuit_started = bool(state.get("impossible_pursuit_started", false))
	spawn_indicator = float(state.get("spawn_indicator", 0.0))
	escape_immunity_timer = float(state.get("escape_immunity_timer", 0.0))
	soap_timer = float(state.get("soap_timer", 0.0))
	skates_timer = float(state.get("skates_timer", 0.0))
	staff_timer = float(state.get("staff_timer", 0.0))
	invisibility_timer = float(state.get("invisibility_timer", 0.0))
	shield_pulse_timer = float(state.get("shield_pulse_timer", 0.0))
	time_freeze_timer = float(state.get("time_freeze_timer", 0.0))
	camera_anim_time = float(state.get("camera_anim_time", 0.0))
	power_pickup_flash = float(state.get("power_pickup_flash", 0.0))
	power_pickup_cooldown = float(state.get("power_pickup_cooldown", 0.0))
	player = Dictionary(state.get("player", player)).duplicate(true)
	npcs.assign(Array(state.get("npcs", [])))
	cops.assign(Array(state.get("cops", [])))
	cameras.assign(Array(state.get("cameras", [])))
	obstacles.assign(Array(state.get("obstacles", [])))
	decor.assign(Array(state.get("decor", [])))
	power_ups.assign(Array(state.get("power_ups", [])))
	inventory.assign(Array(state.get("inventory", [])))
	power_bag.assign(Array(state.get("power_bag", [])))
	chunks_since_power_up = int(state.get("chunks_since_power_up", 0))
	last_power_type = str(state.get("last_power_type", ""))
	last_power_spawn_y = float(state.get("last_power_spawn_y", -INF))
	run_stats = Dictionary(state.get("run_stats", _empty_run_stats())).duplicate(true)
	run_dirs_in_escape.assign(Array(state.get("run_dirs_in_escape", [])))
	run_alert_items_used = int(state.get("run_alert_items_used", 0))
	run_max_busted_in_alert = float(state.get("run_max_busted_in_alert", 0.0))
	run_soap_in_alert = bool(state.get("run_soap_in_alert", false))
	var restored_rng_state := int(str(state.get("rng_state", "0")))
	if restored_rng_state != 0:
		rng.state = restored_rng_state
	paused = false
	suspended = started and not game_over
	input_dir = Vector2.ZERO
	last_input_dir = Vector2.ZERO
	return true
