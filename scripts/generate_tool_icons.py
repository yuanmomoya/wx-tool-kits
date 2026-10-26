"""Generate the local flat pictogram set used by tool cards.

The source artwork is deliberately geometric and deterministic so the complete
set keeps one visual language and can be regenerated without a web dependency.
"""

from pathlib import Path

from PIL import Image, ImageDraw


SIZE = 96
SCALE = 4
OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "assets" / "icons" / "tools"

PALETTES = {
    "coral": ("#e96b60", "#fde8e5"),
    "indigo": ("#5268c6", "#e9edff"),
    "mint": ("#238273", "#e0f3ee"),
    "amber": ("#c17a19", "#fff0d4"),
    "violet": ("#7659bd", "#eee8ff"),
    "red": ("#d75555", "#fde8e8"),
    "green": ("#4b8a57", "#e6f3e7"),
    "sky": ("#3479a8", "#e4f1fa"),
    "deep": ("#2d6d61", "#dfefeb"),
}


class Icon:
    def __init__(self, tone: str):
        self.fg, self.soft = PALETTES[tone]
        self.image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)

    @staticmethod
    def _box(values):
        return tuple(round(value * SCALE) for value in values)

    @staticmethod
    def _points(values):
        return [(round(x * SCALE), round(y * SCALE)) for x, y in values]

    def line(self, points, fill=None, width=5):
        self.draw.line(
            self._points(points),
            fill=fill or self.fg,
            width=round(width * SCALE),
            joint="curve",
        )

    def rect(self, box, fill=None, outline=None, width=4):
        self.draw.rectangle(
            self._box(box),
            fill=fill,
            outline=outline,
            width=round(width * SCALE),
        )

    def round_rect(self, box, radius=8, fill=None, outline=None, width=4):
        self.draw.rounded_rectangle(
            self._box(box),
            radius=round(radius * SCALE),
            fill=fill,
            outline=outline,
            width=round(width * SCALE),
        )

    def ellipse(self, box, fill=None, outline=None, width=4):
        self.draw.ellipse(
            self._box(box),
            fill=fill,
            outline=outline,
            width=round(width * SCALE),
        )

    def polygon(self, points, fill=None, outline=None, width=4):
        pts = self._points(points)
        self.draw.polygon(pts, fill=fill)
        if outline:
            self.draw.line(pts + [pts[0]], fill=outline, width=round(width * SCALE), joint="curve")

    def save(self, name: str):
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        result = self.image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        result.save(OUT_DIR / f"{name}.png", optimize=True)


def arrow(icon: Icon, start, end, color=None, width=5, head=8):
    color = color or icon.fg
    icon.line([start, end], fill=color, width=width)
    x1, y1 = start
    x2, y2 = end
    if abs(x2 - x1) >= abs(y2 - y1):
        direction = 1 if x2 > x1 else -1
        icon.line([(x2 - direction * head, y2 - head), (x2, y2), (x2 - direction * head, y2 + head)], fill=color, width=width)
    else:
        direction = 1 if y2 > y1 else -1
        icon.line([(x2 - head, y2 - direction * head), (x2, y2), (x2 + head, y2 - direction * head)], fill=color, width=width)


def picture_frame(icon: Icon, box=(17, 20, 79, 72)):
    x1, y1, x2, y2 = box
    icon.round_rect(box, radius=7, fill=icon.soft, outline=icon.fg, width=4)
    icon.ellipse((x1 + 10, y1 + 9, x1 + 20, y1 + 19), fill=icon.fg)
    icon.polygon(
        [(x1 + 8, y2 - 9), (x1 + 26, y1 + 29), (x1 + 38, y1 + 42), (x1 + 49, y1 + 29), (x2 - 7, y2 - 9)],
        fill=icon.fg,
    )


def pindou():
    i = Icon("coral")
    for box in ((14, 16, 45, 45), (51, 16, 82, 45), (14, 51, 45, 80), (51, 51, 82, 80)):
        i.round_rect(box, radius=5, fill=i.soft, outline=i.fg, width=3)
    i.ellipse((22, 23, 29, 30), fill=i.fg)
    i.polygon([(18, 40), (28, 31), (36, 39), (42, 33), (42, 42), (18, 42)], fill=i.fg)
    i.save("pindou")


def long_image():
    i = Icon("indigo")
    i.round_rect((18, 13, 66, 57), radius=6, fill=i.soft, outline=i.fg, width=4)
    i.round_rect((30, 26, 78, 70), radius=6, fill="#ffffff", outline=i.fg, width=4)
    i.ellipse((39, 34, 47, 42), fill=i.fg)
    i.polygon([(35, 64), (47, 50), (56, 58), (63, 48), (73, 64)], fill=i.fg)
    arrow(i, (54, 72), (54, 88), width=4, head=6)
    i.save("long-image")


def qrcode():
    i = Icon("mint")
    for x, y in ((14, 14), (58, 14), (14, 58)):
        i.round_rect((x, y, x + 25, y + 25), radius=3, fill=i.soft, outline=i.fg, width=4)
        i.rect((x + 8, y + 8, x + 17, y + 17), fill=i.fg)
    for box in ((50, 49, 60, 59), (67, 49, 82, 59), (48, 66, 58, 82), (65, 65, 74, 74), (78, 72, 85, 83)):
        i.round_rect(box, radius=2, fill=i.fg)
    i.save("qrcode")


def mortgage():
    i = Icon("amber")
    i.polygon([(12, 45), (48, 14), (84, 45), (77, 53), (48, 29), (19, 53)], fill=i.fg)
    i.round_rect((22, 45, 74, 82), radius=5, fill=i.soft, outline=i.fg, width=4)
    i.round_rect((43, 58, 56, 82), radius=3, fill=i.fg)
    i.rect((27, 57, 38, 68), fill="#ffffff", outline=i.fg, width=3)
    i.save("mortgage")


def salary():
    i = Icon("violet")
    i.round_rect((13, 26, 78, 76), radius=10, fill=i.soft, outline=i.fg, width=4)
    i.round_rect((52, 39, 86, 63), radius=7, fill="#ffffff", outline=i.fg, width=4)
    i.ellipse((61, 46, 70, 55), fill=i.fg)
    i.line([(23, 26), (27, 17), (66, 17), (70, 26)], width=4)
    i.save("salary")


def nine_grid():
    i = Icon("coral")
    for row in range(3):
        for col in range(3):
            x, y = 14 + col * 25, 14 + row * 25
            i.round_rect((x, y, x + 18, y + 18), radius=4, fill=i.soft if (row + col) % 2 else i.fg, outline=i.fg, width=3)
    i.save("nine-grid")


def restaurant():
    i = Icon("deep")
    i.round_rect((18, 36, 78, 82), radius=5, fill=i.soft, outline=i.fg, width=4)
    i.polygon([(14, 36), (23, 15), (73, 15), (82, 36)], fill=i.fg)
    for x in (26, 42, 58):
        i.rect((x, 16, x + 8, 35), fill=i.soft)
    i.round_rect((29, 53, 44, 68), radius=3, fill="#ffffff", outline=i.fg, width=3)
    i.round_rect((55, 51, 69, 82), radius=3, fill=i.fg)
    i.save("restaurant")


def image_compress():
    i = Icon("green")
    picture_frame(i, (21, 23, 75, 72))
    arrow(i, (8, 48), (24, 48), width=4, head=6)
    arrow(i, (88, 48), (72, 48), width=4, head=6)
    i.save("image-compress")


def image_resize():
    i = Icon("sky")
    picture_frame(i, (20, 20, 76, 76))
    arrow(i, (39, 57), (14, 82), width=4, head=6)
    arrow(i, (58, 39), (83, 14), width=4, head=6)
    i.save("image-resize")


def image_watermark():
    i = Icon("mint")
    picture_frame(i, (14, 18, 70, 70))
    i.polygon([(69, 39), (83, 60), (82, 69), (76, 77), (66, 77), (59, 69), (59, 61)], fill=i.soft, outline=i.fg, width=4)
    i.ellipse((66, 63, 74, 71), fill=i.fg)
    i.save("image-watermark")


def video_compress():
    i = Icon("indigo")
    i.round_rect((20, 24, 76, 72), radius=8, fill=i.soft, outline=i.fg, width=4)
    i.polygon([(42, 36), (42, 61), (62, 48)], fill=i.fg)
    arrow(i, (7, 48), (22, 48), width=4, head=6)
    arrow(i, (89, 48), (74, 48), width=4, head=6)
    i.save("video-compress")


def converter():
    i = Icon("coral")
    i.ellipse((10, 18, 34, 42), fill=i.soft, outline=i.fg, width=4)
    i.round_rect((62, 56, 86, 80), radius=4, fill=i.soft, outline=i.fg, width=4)
    arrow(i, (32, 30), (77, 30), width=5, head=7)
    arrow(i, (64, 68), (19, 68), width=5, head=7)
    i.save("converter")


def ruler():
    i = Icon("mint")
    i.polygon([(16, 62), (65, 13), (82, 30), (33, 79)], fill=i.soft, outline=i.fg, width=4)
    for start in (31, 42, 53, 64):
        length = 12 if start in (31, 53) else 8
        i.line([(start, 58 - (start - 31)), (start + length, 58 - (start - 31) + length)], width=3)
    i.save("ruler")


def price_compare():
    i = Icon("amber")
    i.line([(48, 15), (48, 76)], width=5)
    i.line([(22, 29), (74, 29)], width=5)
    i.line([(31, 29), (18, 55), (44, 55), (31, 29)], width=3)
    i.line([(65, 29), (52, 55), (78, 55), (65, 29)], width=3)
    i.round_rect((10, 54, 44, 64), radius=5, fill=i.soft, outline=i.fg, width=3)
    i.round_rect((52, 54, 86, 64), radius=5, fill=i.soft, outline=i.fg, width=3)
    i.round_rect((31, 75, 65, 82), radius=3, fill=i.fg)
    i.save("price-compare")


def retirement_pension():
    i = Icon("green")
    i.ellipse((16, 30, 76, 73), fill=i.soft, outline=i.fg, width=4)
    i.ellipse((67, 38, 85, 55), fill=i.soft, outline=i.fg, width=4)
    i.polygon([(20, 34), (17, 20), (34, 30)], fill=i.soft, outline=i.fg, width=4)
    i.line([(30, 70), (27, 82)], width=5)
    i.line([(64, 70), (67, 82)], width=5)
    i.ellipse((74, 44, 78, 48), fill=i.fg)
    i.line([(40, 39), (55, 39)], width=4)
    i.ellipse((24, 45, 31, 52), fill=i.fg)
    i.save("retirement-pension")


def calendar_base(i: Icon):
    i.round_rect((14, 20, 75, 79), radius=7, fill=i.soft, outline=i.fg, width=4)
    i.rect((14, 20, 75, 38), fill=i.fg)
    i.line([(29, 12), (29, 27)], fill=i.fg, width=5)
    i.line([(59, 12), (59, 27)], fill=i.fg, width=5)
    for y in (47, 61):
        for x in (27, 44, 61):
            i.ellipse((x - 3, y - 3, x + 3, y + 3), fill=i.fg)


def retirement_age():
    i = Icon("sky")
    calendar_base(i)
    i.ellipse((55, 54, 87, 86), fill="#ffffff", outline=i.fg, width=4)
    i.line([(71, 63), (71, 71), (79, 76)], width=4)
    i.save("retirement-age")


def date_diff():
    i = Icon("sky")
    calendar_base(i)
    i.round_rect((52, 48, 88, 82), radius=7, fill="#ffffff", outline=i.fg, width=4)
    arrow(i, (60, 65), (80, 65), width=4, head=5)
    i.save("date-diff")


def bmi():
    i = Icon("sky")
    i.round_rect((18, 16, 78, 82), radius=14, fill=i.soft, outline=i.fg, width=4)
    i.ellipse((33, 27, 63, 54), fill="#ffffff", outline=i.fg, width=4)
    i.line([(48, 40), (57, 33)], width=4)
    i.line([(31, 66), (65, 66)], width=5)
    i.save("bmi")


def pelvic_floor():
    i = Icon("mint")
    i.round_rect((14, 18, 82, 78), radius=12, fill=i.soft, outline=i.fg, width=4)
    i.line([(24, 58), (34, 58), (40, 28), (50, 28), (56, 58), (66, 58), (72, 36), (78, 58)], width=5)
    i.save("pelvic-floor")


def bmr():
    i = Icon("coral")
    i.polygon([(50, 8), (65, 34), (62, 46), (76, 37), (80, 57), (70, 78), (48, 88), (26, 79), (15, 61), (20, 38), (36, 51), (34, 32)], fill=i.soft, outline=i.fg, width=4)
    i.polygon([(49, 43), (61, 60), (58, 72), (48, 79), (37, 72), (34, 61)], fill=i.fg)
    i.save("bmr")


def relationship():
    i = Icon("coral")
    i.line([(48, 44), (25, 69), (71, 69), (48, 44)], fill=i.soft, width=5)
    for x, y, r in ((48, 24, 12), (22, 64, 11), (74, 64, 11)):
        i.ellipse((x - r, y - r, x + r, y + r), fill=i.soft, outline=i.fg, width=4)
        i.round_rect((x - r - 3, y + r - 1, x + r + 3, y + r + 17), radius=8, fill=i.fg)
    i.save("relationship")


def compound():
    i = Icon("green")
    for box in ((15, 61, 29, 81), (37, 48, 51, 81), (59, 32, 73, 81)):
        i.round_rect(box, radius=3, fill=i.soft, outline=i.fg, width=3)
    arrow(i, (17, 52), (76, 16), width=5, head=7)
    i.ellipse((67, 55, 89, 77), fill="#ffffff", outline=i.fg, width=4)
    i.ellipse((73, 61, 83, 71), fill=i.fg)
    i.save("compound")


def zodiac():
    i = Icon("indigo")
    stars = [(18, 62), (32, 35), (51, 48), (66, 21), (79, 57), (52, 76)]
    i.line(stars + [stars[0]], fill=i.soft, width=4)
    for index, (x, y) in enumerate(stars):
        radius = 7 if index in (1, 3) else 5
        i.ellipse((x - radius, y - radius, x + radius, y + radius), fill=i.fg)
    i.polygon([(66, 6), (70, 15), (80, 16), (72, 23), (74, 33), (66, 28), (58, 33), (60, 23), (52, 16), (62, 15)], fill=i.soft, outline=i.fg, width=2)
    i.save("zodiac")


def choice_helper():
    i = Icon("coral")
    i.line([(48, 80), (48, 53)], width=5)
    i.line([(48, 53), (25, 31), (25, 15)], width=5)
    i.line([(48, 53), (71, 31), (71, 15)], width=5)
    i.line([(25, 15), (17, 24)], width=5)
    i.line([(25, 15), (33, 24)], width=5)
    i.line([(71, 15), (63, 24)], width=5)
    i.line([(71, 15), (79, 24)], width=5)
    i.ellipse((38, 71, 58, 91), fill=i.soft, outline=i.fg, width=4)
    i.save("choice-helper")


def shelf_life():
    i = Icon("amber")
    i.polygon([(14, 29), (48, 13), (82, 29), (48, 46)], fill=i.soft, outline=i.fg, width=4)
    i.polygon([(14, 29), (48, 46), (48, 83), (14, 65)], fill="#ffffff", outline=i.fg, width=4)
    i.polygon([(82, 29), (48, 46), (48, 83), (82, 65)], fill=i.soft, outline=i.fg, width=4)
    i.ellipse((58, 55, 89, 86), fill="#ffffff", outline=i.fg, width=4)
    i.line([(73, 63), (73, 71), (80, 76)], width=4)
    i.save("shelf-life")


def poker_ledger():
    i = Icon("violet")
    i.round_rect((15, 21, 55, 76), radius=6, fill=i.soft, outline=i.fg, width=4)
    i.round_rect((39, 15, 81, 73), radius=6, fill="#ffffff", outline=i.fg, width=4)
    i.polygon([(60, 34), (54, 27), (47, 34), (47, 42), (60, 55), (73, 42), (73, 34), (66, 27)], fill=i.fg)
    i.ellipse((60, 65, 88, 91), fill=i.soft, outline=i.fg, width=4)
    i.ellipse((68, 72, 80, 84), fill=i.fg)
    i.save("poker-ledger")


def guide():
    i = Icon("deep")
    i.polygon([(12, 23), (31, 18), (48, 27), (48, 79), (31, 70), (12, 74)], fill=i.soft, outline=i.fg, width=4)
    i.polygon([(84, 23), (65, 18), (48, 27), (48, 79), (65, 70), (84, 74)], fill="#ffffff", outline=i.fg, width=4)
    for y in (37, 48, 59):
        i.line([(20, y), (37, y - 2)], width=3)
        i.line([(59, y - 2), (76, y)], width=3)
    i.save("guide")


def privacy_cleaner():
    i = Icon("mint")
    i.round_rect((15, 20, 75, 72), radius=8, fill="#ffffff", outline=i.fg, width=4)
    i.ellipse((24, 30, 35, 41), fill=i.fg)
    i.polygon([(20, 62), (36, 47), (47, 57), (58, 44), (71, 62)], fill=i.soft, outline=i.fg, width=3)
    i.polygon([(58, 48), (78, 41), (87, 48), (84, 70), (73, 82), (62, 70)], fill="#ffffff", outline=i.fg, width=4)
    i.line([(68, 61), (73, 66), (81, 56)], width=4)
    i.save("privacy-cleaner")


def document_copy():
    i = Icon("sky")
    i.round_rect((18, 12, 78, 84), radius=6, fill=i.soft, outline=i.fg, width=4)
    i.round_rect((28, 24, 68, 42), radius=4, fill="#ffffff", outline=i.fg, width=3)
    i.round_rect((28, 50, 68, 68), radius=4, fill="#ffffff", outline=i.fg, width=3)
    i.line([(34, 31), (50, 31)], width=3)
    i.ellipse((54, 28, 62, 36), fill=i.fg)
    i.line([(34, 57), (50, 57)], width=3)
    i.ellipse((54, 54, 62, 62), fill=i.fg)
    i.save("document-copy")


GENERATORS = [
    pindou,
    long_image,
    qrcode,
    mortgage,
    salary,
    nine_grid,
    restaurant,
    image_compress,
    image_resize,
    image_watermark,
    privacy_cleaner,
    document_copy,
    video_compress,
    converter,
    ruler,
    price_compare,
    retirement_pension,
    retirement_age,
    date_diff,
    bmi,
    pelvic_floor,
    bmr,
    relationship,
    compound,
    zodiac,
    choice_helper,
    shelf_life,
    poker_ledger,
    guide,
]


if __name__ == "__main__":
    for generate in GENERATORS:
        generate()
    print(f"Generated {len(GENERATORS)} icons in {OUT_DIR}")
