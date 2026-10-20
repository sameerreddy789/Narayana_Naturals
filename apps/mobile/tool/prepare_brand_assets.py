"""Bundle the owner's assets and licensed web fonts for native Flutter.

Run from the repository with Python, Pillow and fontTools (woff2 requires
Brotli). No imagery is downloaded or generated. Launcher mark pixels come
from the high-resolution transparent version of the owner-supplied logo.
"""
from pathlib import Path
import shutil
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

root = Path(__file__).resolve().parents[3]
mobile = root / "apps/mobile"
brand = root / "design/brand"
assets = mobile / "assets"
(assets / "brand").mkdir(parents=True, exist_ok=True)
(assets / "fonts").mkdir(parents=True, exist_ok=True)
for source, target in [
    ("narayana-naturals-horizontal.svg", "horizontal.svg"),
    ("narayana-naturals-logo.svg", "logo.svg"),
    ("narayana-naturals-mark.svg", "mark.svg"),
    ("narayana-naturals-logo-transparent.png", "logo.png"),
]:
    shutil.copyfile(brand / source, assets / "brand" / target)

specs = [
    ("@fontsource/source-sans-3", "source-sans-3-latin-400-normal.woff", "SourceSans3-Regular.ttf", None),
    ("@fontsource/source-sans-3", "source-sans-3-latin-600-normal.woff", "SourceSans3-Semibold.ttf", None),
    ("@fontsource/noto-sans-telugu", "noto-sans-telugu-telugu-400-normal.woff", "NotoTelugu-Regular.ttf", None),
    ("@fontsource/noto-sans-telugu", "noto-sans-telugu-telugu-600-normal.woff", "NotoTelugu-Semibold.ttf", None),
    ("@fontsource-variable/anek-telugu", "anek-telugu-latin-wght-normal.woff2", "Anek-Semibold.ttf", 600),
    ("@fontsource-variable/anek-telugu", "anek-telugu-telugu-wght-normal.woff2", "AnekTelugu-Semibold.ttf", 600),
]
for package, filename, destination, weight in specs:
    font = TTFont(root / "node_modules" / package / "files" / filename)
    if weight is not None:
        font = instantiateVariableFont(font, {"wght": weight}, inplace=False)
    font.flavor = None
    font.save(assets / "fonts" / destination)
    shutil.copyfile(root / "node_modules" / package / "LICENSE", assets / "fonts" / f"{destination.split('-')[0]}-LICENSE.txt")

# The transparent stacked logo is already cropped around the supplied mark
# and wordmark. Retain all upper leaf/stem/grain artwork on the launcher icon.
logo = Image.open(brand / "narayana-naturals-logo-transparent.png").convert("RGBA")
logo = logo.crop(logo.getbbox())
mark = logo.crop((0, 0, logo.width, round(logo.height * 0.68)))
mark = mark.crop(mark.getbbox())
res = mobile / "android/app/src/main/res"
for density, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    tile = Image.new("RGBA", (size, size), "#f3f6ec")
    fitted = mark.copy()
    fitted.thumbnail((round(size * 0.70), round(size * 0.70)), Image.Resampling.LANCZOS)
    tile.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    directory = res / f"mipmap-{density}"
    directory.mkdir(parents=True, exist_ok=True)
    tile.convert("RGB").save(directory / "ic_launcher.png")

# Adaptive launchers supply their own mask; keep the mark inside the safe zone.
foreground = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
fitted = mark.copy()
fitted.thumbnail((230, 230), Image.Resampling.LANCZOS)
foreground.alpha_composite(fitted, ((432 - fitted.width) // 2, (432 - fitted.height) // 2))
(res / "drawable").mkdir(parents=True, exist_ok=True)
foreground.save(res / "drawable/ic_launcher_foreground.png")
print("Bundled brand assets, six native fonts and owner-mark launcher icons.")
