"""Erzeugt die Add-in-Symbole (assets/icon-*.png): rotes Rechteck mit weißem Brief-Umriss.
Aufruf: python3 scripts/make-icons.py
"""
import os
from PIL import Image, ImageDraw

ROT = (227, 6, 19, 255)
WEISS = (255, 255, 255, 255)
SIZES = [16, 32, 64, 80, 128]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')


def zeichne(px):
    s = 8  # Supersampling für glatte Kanten
    n = px * s
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.18, fill=ROT)
    # Brief: Rechteck + Klappe
    x0, y0, x1, y1 = n * 0.2, n * 0.28, n * 0.8, n * 0.72
    w = max(2, round(n * 0.06))
    d.rounded_rectangle([x0, y0, x1, y1], radius=n * 0.04, outline=WEISS, width=w)
    d.line([(x0 + w / 2, y0 + w / 2), (n / 2, n * 0.54), (x1 - w / 2, y0 + w / 2)], fill=WEISS, width=w, joint='curve')
    return img.resize((px, px), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
for px in SIZES:
    zeichne(px).save(os.path.join(OUT, f'icon-{px}.png'))
    print(f'icon-{px}.png')
