extends Node

var chase_player: AudioStreamPlayer
var pickup_player: AudioStreamPlayer
var use_player: AudioStreamPlayer
var chase_active := false

func _ready() -> void:
	chase_player = AudioStreamPlayer.new()
	pickup_player = AudioStreamPlayer.new()
	use_player = AudioStreamPlayer.new()
	add_child(chase_player)
	add_child(pickup_player)
	add_child(use_player)
	chase_player.stream = preload("res://assets/sounds/chase-alert.mp3")
	pickup_player.stream = preload("res://assets/sounds/power-pickup.mp3")
	use_player.stream = preload("res://assets/sounds/power-use.mp3")
	chase_player.volume_db = -13.0
	pickup_player.volume_db = -9.0
	use_player.volume_db = -9.0
	chase_player.finished.connect(_on_chase_finished)

func set_chase(active: bool) -> void:
	chase_active = active
	if active:
		if not chase_player.playing:
			chase_player.play()
	elif chase_player.playing:
		chase_player.stop()

func play_pickup() -> void:
	pickup_player.stop()
	pickup_player.play()

func play_power_use() -> void:
	use_player.stop()
	use_player.play()

func stop_all() -> void:
	chase_active = false
	chase_player.stop()
	pickup_player.stop()
	use_player.stop()

func _on_chase_finished() -> void:
	if chase_active:
		chase_player.play()
