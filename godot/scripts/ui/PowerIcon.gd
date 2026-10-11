extends RefCounted
class_name PowerIcon

static func draw_icon(target: CanvasItem, type: String, center: Vector2, size: float, color: Color) -> void:
	var scale := size / 24.0
	var p := func(x: float, y: float) -> Vector2:
		return center + Vector2(x - 12.0, y - 12.0) * scale
	var stroke := Color(1.0, 1.0, 1.0, 0.82)
	var width := maxf(1.0, 1.15 * scale)

	match type:
		"escape":
			var pts := PackedVector2Array([
				p.call(12, 2.8), p.call(6.4, 12), p.call(10.1, 12),
				p.call(8.9, 21.2), p.call(17.6, 10.7), p.call(13.8, 10.7), p.call(17, 2.8)
			])
			target.draw_colored_polygon(pts, color)
			target.draw_polyline(_closed(pts), stroke, width, true)
		"soap":
			target.draw_rect(Rect2(p.call(4.2, 6.2), Vector2(15.6, 11.6) * scale), color, true)
			target.draw_rect(Rect2(p.call(4.2, 6.2), Vector2(15.6, 11.6) * scale), stroke, false, width)
			target.draw_circle(p.call(8.2, 8.1), 1.1 * scale, Color(1, 1, 1, .78))
			target.draw_circle(p.call(11.2, 6.6), .8 * scale, Color(1, 1, 1, .72))
			target.draw_circle(p.call(14.6, 8.3), .9 * scale, Color(1, 1, 1, .72))
		"skates":
			var shoe := PackedVector2Array([
				p.call(5,13.4), p.call(15.2,13.4), p.call(18.6,16),
				p.call(19.3,17.8), p.call(5.6,17.8), p.call(4,16)
			])
			target.draw_colored_polygon(shoe, color)
			target.draw_polyline(_closed(shoe), stroke, width, true)
			for x in [8.2, 12.2, 16.2]:
				target.draw_circle(p.call(x, 19.1), 1.45 * scale, Color("#0b1020"))
				target.draw_arc(p.call(x, 19.1), 1.45 * scale, 0, TAU, 16, stroke, width, true)
			target.draw_line(p.call(7.1,11.4), p.call(9.1,7.7), stroke, width, true)
			target.draw_line(p.call(9.1,7.7), p.call(14.2,7.7), stroke, width, true)
		"staff":
			target.draw_line(p.call(12,3.2), p.call(12,19.3), stroke, 1.7 * scale, true)
			var head := PackedVector2Array([p.call(8.6,6.1), p.call(12,3.7), p.call(15.4,6.1), p.call(12,8.5)])
			target.draw_colored_polygon(head, color)
			target.draw_polyline(_closed(head), stroke, width, true)
			target.draw_arc(p.call(12,18.4), 7.0 * scale, PI + .35, TAU - .35, 16, stroke, width, true)
		"invis":
			target.draw_arc(center, 7.4 * scale, 0, TAU, 24, stroke, 1.4 * scale, true)
			target.draw_circle(center, 2.9 * scale, color)
			target.draw_arc(center, 2.9 * scale, 0, TAU, 18, stroke, width, true)
			target.draw_line(p.call(5,19), p.call(19,5), stroke, 1.4 * scale, true)
		"teleport":
			target.draw_arc(center, 7.1 * scale, 0, TAU, 20, stroke, 1.1 * scale, true)
			var star := PackedVector2Array([
				p.call(11.8,4.7), p.call(13.4,8.7), p.call(17.5,10.2), p.call(13.4,11.7),
				p.call(11.8,15.7), p.call(10.2,11.7), p.call(6.1,10.2), p.call(10.2,8.7)
			])
			target.draw_colored_polygon(star, color)
			target.draw_polyline(_closed(star), stroke, width, true)
		"shield":
			var shield := PackedVector2Array([
				p.call(12,3.2), p.call(18.7,5.6), p.call(18.7,11.4),
				p.call(16.8,16.5), p.call(12,20.8), p.call(7.2,16.5), p.call(5.3,11.4), p.call(5.3,5.6)
			])
			target.draw_colored_polygon(shield, color)
			target.draw_polyline(_closed(shield), stroke, width, true)
			target.draw_line(p.call(12,7.2), p.call(12,14.3), stroke, 1.2 * scale, true)
			target.draw_line(p.call(8.8,10.3), p.call(15.2,10.3), stroke, 1.2 * scale, true)
		"time":
			target.draw_arc(center, 7.5 * scale, 0, TAU, 24, stroke, 1.35 * scale, true)
			target.draw_line(center, p.call(12,7.6), stroke, 1.5 * scale, true)
			target.draw_line(center, p.call(15.5,14.1), stroke, 1.5 * scale, true)
			target.draw_line(p.call(8.7,2.9), p.call(15.3,2.9), stroke, 1.3 * scale, true)
			target.draw_line(p.call(9.3,20.2), p.call(14.7,20.2), stroke, 1.1 * scale, true)
		_:
			target.draw_circle(center, 7.0 * scale, color)

static func _closed(points: PackedVector2Array) -> PackedVector2Array:
	var closed := points.duplicate()
	if not points.is_empty():
		closed.append(points[0])
	return closed
