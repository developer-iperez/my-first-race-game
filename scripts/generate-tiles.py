#!/usr/bin/env python3
"""Genera el atlas de tiles 32x32 (asfalto, hierba, arena, muro) y sus PNG sueltos."""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

TILE = 32
random.seed(7)


def asphalt() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (126, 147, 159, 255))
    draw = ImageDraw.Draw(image)
    for _ in range(80):
        x = random.randrange(TILE)
        y = random.randrange(TILE)
        shade = random.choice([(118, 138, 150, 255), (134, 155, 167, 255), (112, 133, 145, 255)])
        draw.point((x, y), fill=shade)
    for _ in range(4):
        x = random.randrange(2, TILE - 6)
        y = random.randrange(2, TILE - 6)
        draw.line((x, y, x + random.randrange(2, 5), y + random.randrange(-1, 2)), fill=(114, 135, 147, 255))
    return image


def grass() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (62, 121, 58, 255))
    draw = ImageDraw.Draw(image)
    for _ in range(90):
        x = random.randrange(TILE)
        y = random.randrange(TILE)
        draw.point((x, y), fill=random.choice([(49, 101, 47, 255), (78, 141, 70, 255)]))
    for _ in range(18):
        x = random.randrange(1, TILE - 1)
        y = random.randrange(2, TILE - 1)
        draw.line((x, y, x, y - random.randrange(1, 3)), fill=(40, 89, 40, 255))
    for _ in range(4):
        x = random.randrange(2, TILE - 2)
        y = random.randrange(2, TILE - 2)
        draw.point((x, y), fill=(219, 209, 92, 255))
    return image


def sand() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (216, 192, 142, 255))
    draw = ImageDraw.Draw(image)
    for _ in range(120):
        x = random.randrange(TILE)
        y = random.randrange(TILE)
        draw.point((x, y), fill=random.choice([(201, 176, 126, 255), (229, 208, 161, 255)]))
    for row in (7, 17, 26):
        points = []
        for x in range(0, TILE + 1, 2):
            points.append((x, row + round(math.sin(x / 5) * 1.4)))
        draw.line(points, fill=(190, 162, 112, 255), width=1)
    return image


def wall() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (91, 65, 44, 255))
    draw = ImageDraw.Draw(image)
    brick_w, brick_h = 16, 8
    for row in range(0, TILE, brick_h):
        offset = 0 if (row // brick_h) % 2 == 0 else brick_w // 2
        for col in range(-brick_w, TILE + brick_w, brick_w):
            x = col + offset
            draw.rectangle((x + 1, row + 1, x + brick_w - 2, row + brick_h - 2), fill=(107, 78, 53, 255))
            draw.line((x + 1, row + 1, x + brick_w - 2, row + 1), fill=(132, 99, 69, 255))
            draw.line((x + 1, row + brick_h - 2, x + brick_w - 2, row + brick_h - 2), fill=(72, 51, 35, 255))
    return image


def main():
    tiles = [asphalt(), grass(), sand(), wall()]
    atlas = Image.new("RGBA", (TILE * len(tiles), TILE), (0, 0, 0, 0))
    for index, tile in enumerate(tiles):
        atlas.paste(tile, (index * TILE, 0))

    out = Path("public/tiles")
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "tileset.png")
    for name, tile in zip(("asphalt", "grass", "sand", "wall"), tiles):
        tile.save(out / f"{name}.png")


if __name__ == "__main__":
    main()
