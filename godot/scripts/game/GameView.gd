extends Node2D
class_name GameView

var game: GameEngine

func setup(engine: GameEngine) -> void:
	game = engine
	queue_redraw()

func _draw() -> void:
	if game == null:
		return
	_draw_background()
	_draw_decor()
	_draw_cop_cones()
	_draw_camera_cones()
	_draw_obstacles()
	_draw_cameras()
	_draw_powerups()
	_draw_npcs()
	_draw_cops()
	_draw_player()
	_draw_spawn_indicator()
	_draw_danger_line()
	_draw_effect_overlays()

func _draw_background() -> void:
	draw_rect(Rect2(0, 0, GameEngine.W, GameEngine.H), Color("#111923"))
	draw_rect(Rect2(18, 0, GameEngine.W - 36, GameEngine.H), Color("#25303a"))
	draw_rect(Rect2(26, 0, GameEngine.W - 52, GameEngine.H), Color("#303b45"))
	var offset := fmod(game.camera_y, 64.0)
	for y in range(-64, 720, 64):
		var py := float(y) + offset
		draw_line(Vector2(28, py), Vector2(GameEngine.W - 28, py), Color(1, 1, 1, .035), 1.0)
	draw_line(Vector2(18, 0), Vector2(18, GameEngine.H), Color("#4b5660"), 3)
	draw_line(Vector2(GameEngine.W - 18, 0), Vector2(GameEngine.W - 18, GameEngine.H), Color("#4b5660"), 3)

func _draw_decor() -> void:
	for item in game.decor:
		var sy := game.screen_y(float(item.y))
		if sy < -20 or sy > GameEngine.H + 20:
			continue
		var color := [Color("#3e5c45"), Color("#635444"), Color("#374e63"), Color("#4e455e")][int(item.kind) % 4]
		draw_rect(Rect2(float(item.x) - 2, sy - 2, 4, 4), color)

func _draw_cop_cones() -> void:
	for cop in game.cops:
		var sy := game.screen_y(float(cop.y))
		if sy < -220 or sy > GameEngine.H + 220:
			continue
		var fill := Color(1, 1, 1, .12) if game.alert else Color(1.0, .85, .25, .14)
		_draw_cone(Vector2(float(cop.x), sy), -float(cop.face), float(cop.vision), float(cop.fov), fill)
		if bool(cop.seeing_player) and not game.alert:
			var charged := clampf(game.suspicion / 100.0, 0.0, 1.0)
			_draw_cone(Vector2(float(cop.x), sy), -float(cop.face), float(cop.vision) * charged, float(cop.fov), Color(1.0, .35, .18, .12 + charged * .18))

func _draw_camera_cones() -> void:
	for camera in game.cameras:
		var sy := game.screen_y(float(camera.y))
		if sy < -220 or sy > GameEngine.H + 220:
			continue
		for face in game.camera_faces(camera):
			_draw_cone(Vector2(float(camera.x), sy), -face, float(camera.vision), float(camera.fov), Color(.37, .75, 1.0, .15))
			if bool(camera.seeing_player):
				var p := clampf(game.suspicion / 100.0, 0.0, 1.0)
				_draw_cone(Vector2(float(camera.x), sy), -face, float(camera.vision) * p, float(camera.fov), Color(1.0, .34, .18, .16 + p * .18))

func _draw_cone(origin: Vector2, screen_face: float, radius: float, fov: float, color: Color) -> void:
	var points := PackedVector2Array([origin])
	var steps := 18
	for i in range(steps + 1):
		var angle := screen_face - fov * .5 + fov * float(i) / float(steps)
		points.append(origin + Vector2(cos(angle), sin(angle)) * radius)
	draw_colored_polygon(points, color)

func _draw_obstacles() -> void:
	for obstacle in game.obstacles:
		var top := game.screen_y(float(obstacle.y) + float(obstacle.h))
		if top < -80 or top > GameEngine.H + 80:
			continue
		var rect := Rect2(float(obstacle.x), top, float(obstacle.w), float(obstacle.h))
		draw_rect(Rect2(rect.position + Vector2(3, rect.size.y - 2), Vector2(rect.size.x, 6)), Color(0,0,0,.28))
		match str(obstacle.type):
			"bench":
				draw_rect(rect, Color("#7b5639"))
				draw_rect(Rect2(rect.position, Vector2(rect.size.x, 6)), Color("#9b6d47"))
			"trash":
				draw_rect(rect, Color("#4e5b66"))
				draw_rect(Rect2(rect.position, Vector2(rect.size.x, 6)), Color("#6d7b87"))
			"planter":
				draw_rect(rect, Color("#8a5e43"))
				draw_rect(Rect2(rect.position + Vector2(5,-4), Vector2(rect.size.x - 10, 11)), Color("#4f9c55"))
			"barrier":
				draw_rect(rect, Color("#d7dce1"))
				for x in range(3, int(rect.size.x), 18):
					draw_rect(Rect2(rect.position + Vector2(x,0), Vector2(9, rect.size.y)), Color("#e95045"))
			_:
				draw_rect(rect, Color("#8c663e"))
				draw_rect(rect.grow(-2), Color("#b88854"), false, 2)

func _draw_cameras() -> void:
	for camera in game.cameras:
		var sy := game.screen_y(float(camera.y))
		if sy < -40 or sy > GameEngine.H + 40:
			continue
		var origin := Vector2(float(camera.x), sy)
		draw_rect(Rect2(origin + Vector2(-3,5), Vector2(6,12)), Color("#202936"))
		draw_rect(Rect2(origin + Vector2(-8,-8), Vector2(16,12)), Color("#ff7b59") if bool(camera.seeing_player) else Color("#d6e2ef"))
		draw_circle(origin + Vector2(0,-3), 2, Color("#ff394b") if bool(camera.seeing_player) else Color("#55d9ff"))
		for face in game.camera_faces(camera):
			var dir := Vector2(cos(face), -sin(face))
			draw_line(origin, origin + dir * 14, Color("#7fa7c6"), 4)

func _draw_powerups() -> void:
	var full := game.inventory.size() >= 3
	for power in game.power_ups:
		var sy := game.screen_y(float(power.y))
		if sy < -45 or sy > GameEngine.H + 45:
			continue
		var bob := sin(game.elapsed * 4.0 + float(power.phase)) * 3.0
		var center := Vector2(float(power.x), sy + bob)
		var def: Dictionary = GameEngine.POWER_DEFS[str(power.type)]
		var color := Color("#777777") if full else Color(str(def.color))
		draw_circle(center, 24, Color(color, .18))
		draw_rect(Rect2(center - Vector2(16,16), Vector2(32,32)), Color("#0b1020"))
		draw_rect(Rect2(center - Vector2(16,16), Vector2(32,32)), color, false, 2)
		PowerIcon.draw_icon(self, str(power.type), center, 24, color)

func _draw_npcs() -> void:
	for npc in game.npcs:
		var sy := game.screen_y(float(npc.y))
		if sy < -40 or sy > GameEngine.H + 40:
			continue
		_draw_person(Vector2(float(npc.x), sy), int(npc.tone), false, false, .42 if game.soap_timer > 0 else 1.0)

func _draw_cops() -> void:
	for cop in game.cops:
		var sy := game.screen_y(float(cop.y))
		if sy < -50 or sy > GameEngine.H + 50:
			continue
		var center := Vector2(float(cop.x), sy - 3)
		var danger := float(cop.danger_radius) + (12.0 if bool(cop.chase) else 0.0)
		draw_circle(center, danger, Color(1, .2, .2, .07) if bool(cop.chase) else Color(1,1,1,.03))
		draw_arc(center, danger, 0, TAU, 28, Color(1,.3,.3,.42) if bool(cop.chase) else Color(1,1,1,.16), 1)
		if bool(cop.chase):
			var blue := int(floor(game.elapsed * 7.0)) % 2 == 0
			draw_arc(center, 24, 0, TAU, 24, Color("#3f7cff") if blue else Color("#ff3f4f"), 3)
		if int(cop.id) == game.idle_hunter_id and not game.alert and game.player_idle_timer >= 3.0:
			draw_string(ThemeDB.fallback_font, Vector2(float(cop.x) - 3, sy - 42), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("#ffd45a"))
		_draw_person(Vector2(float(cop.x), sy), 2, true, false)
		var face := Vector2(cos(float(cop.face)), -sin(float(cop.face)))
		draw_circle(Vector2(float(cop.x), sy) + face * 16, 2, Color("#ff4444") if game.alert else Color("#f3cf55"))

func _draw_player() -> void:
	var sy := game.screen_y(float(game.player.y))
	var alpha := .28 + sin(game.elapsed * 8.0) * .07 if game.invisibility_timer > 0 else 1.0
	_draw_person(Vector2(float(game.player.x), sy), 1, false, true, alpha)
	if game.shield_pulse_timer > 0.0:
		var progress := 1.0 - game.shield_pulse_timer / .45
		draw_arc(Vector2(float(game.player.x), sy - 3), 24 + progress * 128, 0, TAU, 36, Color(0.47,0.67,1.0,1.0-progress), 4)
	if game.power_pickup_flash > 0.0:
		draw_arc(Vector2(float(game.player.x), sy - 3), 24 + (1.0 - game.power_pickup_flash / .22) * 16, 0, TAU, 28, Color(1,.96,.66,game.power_pickup_flash/.22), 3)
	var marker := PackedVector2Array([
		Vector2(float(game.player.x), sy - 40),
		Vector2(float(game.player.x) - 8, sy - 48),
		Vector2(float(game.player.x) + 8, sy - 48),
	])
	draw_colored_polygon(marker, Color("#ff4c4c") if game.alert else Color.WHITE)

func _draw_person(pos: Vector2, tone: int, police: bool, player_char: bool, alpha: float = 1.0) -> void:
	var skin := [Color("#f1c7a2"),Color("#c98f66"),Color("#8e5e42"),Color("#e1aa7d"),Color("#6b4937")][tone % 5]
	skin.a *= alpha
	var dark := Color("#18283a") if police else Color("#26313d")
	dark.a *= alpha
	draw_rect(Rect2(pos + Vector2(-12,16), Vector2(24,8)), Color(0,0,0,.30 * alpha))
	draw_rect(Rect2(pos + Vector2(-10,4), Vector2(8,16)), dark)
	draw_rect(Rect2(pos + Vector2(2,4), Vector2(8,16)), dark)
	if player_char:
		var white := Color(1,1,1,alpha)
		var black := Color(0.05,0.05,0.06,alpha)
		draw_rect(Rect2(pos + Vector2(-12,-12), Vector2(24,20)), white)
		for y in [-12,-6,0,6]:
			draw_rect(Rect2(pos + Vector2(-12,y), Vector2(24,3 if y != 6 else 2)), black)
		draw_rect(Rect2(pos + Vector2(-6,-12), Vector2(3,20)), black)
		draw_rect(Rect2(pos + Vector2(2,-12), Vector2(3,20)), black)
	else:
		var body := Color("#3e79a8") if police else [Color("#6f8f5a"),Color("#9e5f79"),Color("#8a774e"),Color("#5b7c9e"),Color("#795b9b")][tone % 5]
		body.a *= alpha
		draw_rect(Rect2(pos + Vector2(-12,-12), Vector2(24,20)), body)
	draw_rect(Rect2(pos + Vector2(-8,-24), Vector2(16,12)), skin)
	var hat := Color("#111111") if player_char else (Color("#1e3045") if police else Color("#3a3029"))
	hat.a *= alpha
	draw_rect(Rect2(pos + Vector2(-10 if player_char else -8,-32 if player_char else -28), Vector2(20 if player_char else 16,8 if player_char else 4)), hat)
	if police:
		draw_rect(Rect2(pos + Vector2(-12,-32), Vector2(24,4)), Color("#6ca1cc"))

func _draw_spawn_indicator() -> void:
	if not game.started or game.spawn_indicator <= 0.0:
		return
	var sy := game.screen_y(float(game.player.y))
	var age := 2.6 - game.spawn_indicator
	var fade := clampf(game.spawn_indicator / .65, 0.0, 1.0)
	var pulse := (sin(age * 8.0) + 1.0) * .5
	var center := Vector2(float(game.player.x), sy - 3)
	draw_arc(center, 24 + pulse * 8, 0, TAU, 32, Color(1,.91,.36,.95 * fade), 3)
	draw_arc(center, 36 - pulse * 8, 0, TAU, 32, Color(1,1,1,.65 * fade), 2)
	draw_string(ThemeDB.fallback_font, Vector2(center.x - 17, sy - 68), "VOCÊ", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1,.97,.69,fade))

func _draw_danger_line() -> void:
	draw_rect(Rect2(0, GameEngine.H - 6, GameEngine.W, 6), Color("#6b1010") if game.alert else Color("#402218"))

func _draw_effect_overlays() -> void:
	if game.time_freeze_timer > 0.0 and game.started:
		draw_rect(Rect2(0,0,GameEngine.W,GameEngine.H), Color(.75,.86,1,.055))
		draw_rect(Rect2(8,8,GameEngine.W-16,GameEngine.H-16), Color(1,.82,.4,.38), false, 3)
	if game.alert and game.started:
		var blue := int(floor(game.elapsed * 7.0)) % 2 == 0
		var primary := Color(0.22,0.41,1,.62) if blue else Color(1,.22,.27,.62)
		var secondary := Color(1,.22,.27,.28) if blue else Color(.22,.41,1,.28)
		draw_rect(Rect2(4,4,GameEngine.W-8,GameEngine.H-8), primary, false, 7)
		draw_rect(Rect2(11,11,GameEngine.W-22,GameEngine.H-22), secondary, false, 3)
