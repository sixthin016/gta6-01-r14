#!/usr/bin/env python3
"""Neon Bay 3D r14 — procedural asset generator (run during the recorded build).

Generates two JPEG textures the game loads at runtime:
  game/assets/sky.jpg     — golden-hour sky gradient, low sun, clouds over the bay
  game/assets/facades.jpg — art-deco shopfront strip with readable signs

No stock photos, no network: every pixel is drawn here with PIL.
Run from the repo root:  python3 tools/gen_assets.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "game", "assets")
W, H = 1024, 512

rng = random.Random(20261122)


def _font(size, bold=True):
    """Best available TTF; falls back to PIL's bitmap font."""
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_sky():
    """Golden-hour sky: deep violet top -> amber horizon, sun disc with halo,
    drifting cloud bands, dark bay water at the bottom with a sun glitter path."""
    img = Image.new("RGB", (W, H))
    px = img.load()
    top = (46, 24, 86)       # dusk violet
    mid = (214, 92, 64)      # burnt orange
    low = (255, 176, 92)     # golden amber
    horizon = int(H * 0.62)
    for y in range(H):
        if y < horizon:
            t = y / horizon
            # ease the blend so the orange band hugs the horizon
            c = _lerp(_lerp(top, mid, t ** 1.4), low, max(0.0, (t - 0.55) / 0.45) ** 2)
        else:
            t = (y - horizon) / (H - horizon)
            c = _lerp((24, 30, 58), (10, 14, 34), t)  # bay water darkening down
        for x in range(W):
            px[x, y] = c

    d = ImageDraw.Draw(img, "RGBA")
    sx, sy = int(W * 0.68), int(H * 0.52)
    # sun halo, layered translucent discs
    for r, alpha in ((150, 26), (110, 40), (76, 70), (52, 110)):
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 214, 140, alpha))
    d.ellipse([sx - 34, sy - 34, sx + 34, sy + 34], fill=(255, 236, 190, 255))
    d.ellipse([sx - 22, sy - 22, sx + 22, sy + 22], fill=(255, 248, 220, 255))
    # sun glitter path on the water
    for i in range(90):
        x = sx + rng.randint(-70, 70)
        y = horizon + rng.randint(4, H - horizon - 6)
        w = rng.randint(6, 42)
        a = rng.randint(40, 150)
        d.line([x, y, x + w, y], fill=(255, 196, 120, a), width=2)
    # cloud bands: soft horizontal streaks, darker above the sun, lit below
    for _ in range(46):
        cx = rng.randint(0, W)
        cy = rng.randint(int(H * 0.08), int(H * 0.55))
        cw = rng.randint(90, 320)
        ch = rng.randint(6, 18)
        warm = cy > sy
        col = (255, 170, 120, rng.randint(36, 90)) if warm else (120, 70, 140, rng.randint(36, 80))
        d.ellipse([cx, cy, cx + cw, cy + ch], fill=col)
    # distant skyline silhouette along the horizon
    for x in range(0, W, 4):
        bh = 8 + int(26 * abs(math.sin(x * 0.011 + 1.7)) * rng.uniform(0.4, 1.0))
        d.rectangle([x, horizon - bh, x + 4, horizon], fill=(30, 18, 52, 255))
    img.save(os.path.join(ASSETS, "sky.jpg"), quality=90)
    print("sky.jpg written")


def make_facades():
    """Four art-deco shopfronts side by side, each with a readable sign, awning,
    door, windows and neon trim — tiled onto building walls by the game."""
    img = Image.new("RGB", (W, H), (18, 12, 34))
    d = ImageDraw.Draw(img, "RGBA")
    shops = [
        ("Palms Bar", (255, 94, 168), (24, 160, 120), "COCKTAILS • LIVE MUSIC"),
        ("Tiki Lounge", (255, 176, 66), (16, 120, 90), "TIKI • RUM • DANCING"),
        ("Sunset Cocktails", (120, 220, 255), (200, 60, 140), "ROOFTOP • SUNSET VIEW"),
        ("Gelato", (255, 120, 120), (90, 60, 180), "GELATO • SORBET • SHAKES"),
    ]
    sw = W // 4
    for i, (name, neon, wall, sub) in enumerate(shops):
        x0 = i * sw
        # wall
        d.rectangle([x0, 0, x0 + sw - 1, H - 1], fill=wall + (255,))
        # deco vertical stripes
        for k in range(6):
            sx = x0 + 14 + k * ((sw - 28) // 6)
            d.rectangle([sx, 0, sx + 5, 150], fill=(255, 255, 255, 26))
        # sign board
        d.rectangle([x0 + 10, 26, x0 + sw - 11, 118], fill=(12, 8, 26, 255))
        d.rectangle([x0 + 10, 26, x0 + sw - 11, 118], outline=neon + (255,), width=4)
        # neon glow around the sign
        for pad, alpha in ((10, 40), (6, 80)):
            d.rectangle([x0 + 10 - pad, 26 - pad, x0 + sw - 11 + pad, 118 + pad],
                        outline=neon + (alpha,), width=3)
        f = _font(44 if len(name) < 12 else 34)
        tw = d.textlength(name, font=f)
        d.text((x0 + (sw - tw) / 2, 44), name, font=f, fill=(255, 255, 255, 255))
        f2 = _font(17)
        tw2 = d.textlength(sub, font=f2)
        d.text((x0 + (sw - tw2) / 2, 92), sub, font=f2, fill=neon + (255,))
        # awning: alternating stripes
        ay0, ay1 = 150, 196
        for k in range(8):
            col = neon if k % 2 == 0 else (245, 240, 230)
            d.polygon([(x0 + k * sw // 8, ay0), (x0 + (k + 1) * sw // 8, ay0),
                       (x0 + (k + 1) * sw // 8 + 6, ay1), (x0 + k * sw // 8 - 6, ay1)],
                      fill=col + (255,))
        # windows + door
        d.rectangle([x0 + 18, 230, x0 + sw // 2 - 8, 400], fill=(255, 214, 140, 255))
        d.rectangle([x0 + 18, 230, x0 + sw // 2 - 8, 400], outline=(10, 8, 20, 255), width=5)
        d.rectangle([x0 + sw // 2 + 8, 230, x0 + sw - 19, 400], fill=(255, 214, 140, 255))
        d.rectangle([x0 + sw // 2 + 8, 230, x0 + sw - 19, 400], outline=(10, 8, 20, 255), width=5)
        # window mullions
        for wx in (x0 + sw // 4, x0 + 3 * sw // 4):
            d.line([wx, 230, wx, 400], fill=(10, 8, 20, 255), width=4)
        # door in the middle bottom
        d.rectangle([x0 + sw // 2 - 26, 400, x0 + sw // 2 + 26, H - 8], fill=(14, 10, 28, 255))
        d.rectangle([x0 + sw // 2 - 26, 400, x0 + sw // 2 + 26, H - 8],
                    outline=neon + (255,), width=3)
        # neon tube along the base
        d.rectangle([x0 + 4, H - 16, x0 + sw - 5, H - 8], fill=neon + (255,))
        # divider between shops
        d.rectangle([x0 + sw - 3, 0, x0 + sw - 1, H - 1], fill=(8, 6, 16, 255))
    img.save(os.path.join(ASSETS, "facades.jpg"), quality=90)
    print("facades.jpg written")


if __name__ == "__main__":
    os.makedirs(ASSETS, exist_ok=True)
    make_sky()
    make_facades()
    # Self-check: both textures must be real JPEGs of usable size.
    for name in ("sky.jpg", "facades.jpg"):
        path = os.path.join(ASSETS, name)
        with Image.open(path) as im:
            assert im.format == "JPEG" and im.size == (W, H), f"{name} bad: {im.format} {im.size}"
        size = os.path.getsize(path)
        assert size > 20000, f"{name} too small: {size} bytes"
        print(f"{name}: {size} bytes, {W}x{H} JPEG OK")
