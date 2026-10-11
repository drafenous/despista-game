extends RefCounted
class_name DifficultyRules

const EASY := "easy"
const MEDIUM := "medium"
const HARD := "hard"
const PRO := "pro"
const IMPOSSIBLE := "impossible"

const ALL: Array[String] = [EASY, MEDIUM, HARD, PRO, IMPOSSIBLE]

static func is_valid(value: String) -> bool:
	return value in ALL

static func config(value: String) -> Dictionary:
	match value:
		EASY:
			return {
				"npc_multiplier": 0.80,
				"cop_multiplier": 1.0,
				"auto_scroll": 0.0,
				"allow_bottom_touch": true,
				"constant_pursuit": false,
			}
		HARD:
			return {
				"npc_multiplier": 1.0,
				"cop_multiplier": 1.0,
				"auto_scroll": 40.0,
				"allow_bottom_touch": false,
				"constant_pursuit": false,
			}
		PRO:
			return {
				"npc_multiplier": 1.0,
				"cop_multiplier": 1.10,
				"auto_scroll": 40.0,
				"allow_bottom_touch": false,
				"constant_pursuit": false,
			}
		IMPOSSIBLE:
			return {
				"npc_multiplier": 1.0,
				"cop_multiplier": 1.10,
				"auto_scroll": 40.0,
				"allow_bottom_touch": false,
				"constant_pursuit": true,
			}
		_:
			return {
				"npc_multiplier": 1.0,
				"cop_multiplier": 1.0,
				"auto_scroll": 0.0,
				"allow_bottom_touch": true,
				"constant_pursuit": false,
			}

static func label(value: String) -> String:
	match value:
		EASY: return "Fácil"
		MEDIUM: return "Médio"
		HARD: return "Difícil"
		PRO: return "Pro"
		IMPOSSIBLE: return "Impossível"
		_: return value

static func description(value: String) -> String:
	match value:
		EASY:
			return "20% menos NPCs em tela."
		MEDIUM:
			return "Experiência base. Pode encostar no canto inferior sem a câmera recuar."
		HARD:
			return "A tela sobe automaticamente. Sem pausa manual."
		PRO:
			return "Como o Difícil, com 10% mais policiais. Sem pausa manual."
		IMPOSSIBLE:
			return "Como o Pro, mas a perseguição é permanente. Sem pausa manual."
		_:
			return ""

static func allows_pause(value: String) -> bool:
	return value == EASY or value == MEDIUM

static func pursuit_escape_target(value: String) -> float:
	if value == IMPOSSIBLE:
		return INF
	if value == HARD or value == PRO:
		return 4.0
	return 3.0
