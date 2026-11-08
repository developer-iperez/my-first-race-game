#!/usr/bin/env python3
"""Genera el atlas de decoración (32x32): árbol, roca y arbusto."""
from PIL import Image, ImageDraw

TILE = 32


def tree() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((4, 22, 28, 30), fill=(20, 48, 28, 120))
    draw.rectangle((14, 18, 18, 28), fill=(92, 63, 40, 255))
    draw.ellipse((3, 2, 29, 27), fill=(32, 91, 45, 255))
    draw.ellipse((6, 5, 26, 25), fill=(46, 122, 58, 255))
    draw.ellipse((9, 7, 23, 21), fill=(63, 148, 70, 255))
    draw.ellipse((11, 8, 16, 13), fill=(92, 176, 91, 255))
    draw.ellipse((18, 6, 22, 10), fill=(92, 176, 91, 255))
    return image


def rock() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((4, 22, 28, 30), fill=(20, 30, 40, 110))
    draw.polygon(
        ((5, 24), (8, 13), (14, 8), (23, 10), (28, 18), (26, 25)),
        fill=(99, 108, 116, 255),
    )
    draw.polygon(((9, 14), (14, 10), (18, 11), (12, 18)), fill=(137, 146, 154, 255))
    draw.line((16, 12, 12, 22), fill=(72, 81, 89, 255))
    draw.line((17, 12, 22, 19), fill=(72, 81, 89, 255))
    return image


def bush() -> Image.Image:
    image = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((4, 22, 28, 30), fill=(20, 48, 28, 100))
    draw.ellipse((5, 12, 20, 26), fill=(47, 113, 51, 255))
    draw.ellipse((12, 10, 27, 25), fill=(58, 131, 59, 255))
    draw.ellipse((9, 6, 23, 20), fill=(70, 145, 68, 255))
    draw.ellipse((12, 8, 17, 13), fill=(101, 174, 91, 255))
    return image


def main():
    atlas = Image.new("RGBA", (TILE * 3, TILE), (0, 0, 0, 0))
    for index, tile in enumerate((tree(), rock(), bush())):
        atlas.paste(tile, (index * TILE, 0))
    atlas.save("public/tiles/decor.png")


if __name__ == "__main__":
    main()
