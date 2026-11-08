#!/usr/bin/env python3
"""Genera el sprite pixel art del coche (64x32, nariz a +x)."""
from PIL import Image, ImageDraw

OUTLINE = (8, 19, 31, 255)
BODY_DARK = (13, 59, 120, 255)
BODY = (21, 101, 192, 255)
BODY_LIGHT = (66, 165, 245, 255)
GLASS = (33, 83, 120, 255)
GLASS_LIGHT = (127, 212, 255, 255)
WHITE = (245, 245, 245, 255)
RED = (229, 57, 53, 255)
YELLOW = (255, 213, 79, 255)
TIRE = (17, 17, 17, 255)
HUB = (158, 158, 158, 255)


def px(draw: ImageDraw.ImageDraw, box, color):
    draw.rectangle(box, fill=color)


def main():
    image = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Neumáticos y llantas (sobresalen del cuerpo).
    for x in (10, 44):
        px(draw, (x, 1, x + 9, 5), TIRE)
        px(draw, (x, 26, x + 9, 30), TIRE)
        px(draw, (x + 3, 2, x + 6, 4), HUB)
        px(draw, (x + 3, 27, x + 6, 29), HUB)
        px(draw, (x + 4, 2, x + 5, 4), OUTLINE)
        px(draw, (x + 4, 27, x + 5, 29), OUTLINE)

    # Carrocería con contorno redondeado.
    draw.rounded_rectangle((5, 5, 58, 26), radius=5, fill=OUTLINE)
    draw.rounded_rectangle((6, 6, 57, 25), radius=4, fill=BODY)
    draw.rounded_rectangle((8, 7, 55, 24), radius=3, fill=BODY_DARK)

    # Capó delantero, techo y portón trasero.
    px(draw, (44, 8, 55, 23), BODY)
    px(draw, (43, 9, 45, 22), BODY_LIGHT)
    px(draw, (18, 7, 34, 24), BODY)
    px(draw, (17, 8, 18, 23), BODY_LIGHT)
    px(draw, (7, 8, 12, 23), BODY_DARK)

    # Parabrisas y luneta.
    px(draw, (36, 8, 42, 23), GLASS)
    px(draw, (37, 9, 41, 10), GLASS_LIGHT)
    px(draw, (37, 21, 41, 22), GLASS_LIGHT)
    px(draw, (13, 8, 16, 23), GLASS)
    px(draw, (14, 9, 15, 10), GLASS_LIGHT)
    px(draw, (14, 21, 15, 22), GLASS_LIGHT)

    # Franja de competición y número en el techo.
    px(draw, (19, 14, 34, 17), WHITE)
    draw.ellipse((23, 12, 31, 20), fill=WHITE)
    # "7" minimalista.
    px(draw, (25, 14, 29, 15), OUTLINE)
    px(draw, (28, 14, 29, 18), OUTLINE)
    px(draw, (26, 18, 28, 19), OUTLINE)

    # Faros y pilotos.
    px(draw, (56, 8, 58, 11), YELLOW)
    px(draw, (56, 20, 58, 23), YELLOW)
    px(draw, (5, 8, 7, 11), RED)
    px(draw, (5, 20, 7, 23), RED)

    # Detalles: retrovisores, branquias y línea inferior.
    px(draw, (40, 5, 42, 6), OUTLINE)
    px(draw, (40, 25, 42, 26), OUTLINE)
    px(draw, (46, 12, 54, 13), BODY_LIGHT)
    px(draw, (46, 18, 54, 19), BODY_LIGHT)
    px(draw, (9, 24, 12, 24), OUTLINE)

    image.save("public/cars/rally-hatch.png")


if __name__ == "__main__":
    main()
