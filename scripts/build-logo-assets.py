from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ICON_SIZES = {
    "icon.png": 512,
    "icon128.png": 128,
    "icon48.png": 48,
    "icon32.png": 32,
    "icon16.png": 16,
}


def find_content_bbox(image: Image.Image, background: tuple[int, int, int]) -> tuple[int, int, int, int]:
    background_layer = Image.new("RGB", image.size, background)
    difference = ImageChops.difference(image.convert("RGB"), background_layer)
    red, green, blue = difference.split()
    strongest_channel = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    mask = strongest_channel.point(lambda value: 255 if value > 24 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("The source image does not contain a visible logo.")
    return bbox


def square_crop(image: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = bbox
    content_width = right - left
    content_height = bottom - top
    side = math.ceil(max(content_width, content_height) * 1.14)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    crop_left = round(center_x - side / 2)
    crop_top = round(center_y - side / 2)
    crop_right = crop_left + side
    crop_bottom = crop_top + side

    background = image.getpixel((0, 0))
    canvas = Image.new("RGB", (side, side), background)
    source_box = (
        max(0, crop_left),
        max(0, crop_top),
        min(image.width, crop_right),
        min(image.height, crop_bottom),
    )
    region = image.crop(source_box)
    canvas.paste(region, (source_box[0] - crop_left, source_box[1] - crop_top))
    return canvas


def save_resized(source: Image.Image, output: Path, size: int) -> None:
    resized = source.resize((size, size), Image.Resampling.LANCZOS)
    if size <= 48:
        resized = resized.filter(ImageFilter.UnsharpMask(radius=0.45, percent=130, threshold=2))
    output.parent.mkdir(parents=True, exist_ok=True)
    resized.save(output, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build ResumeBridge logo and extension icon assets.")
    parser.add_argument("source", type=Path, help="Path to the generated square logo image.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    image = Image.open(args.source).convert("RGB")
    background = image.getpixel((0, 0))
    cropped = square_crop(image, find_content_bbox(image, background))

    asset_path = args.root / "assets" / "resumebridge-logo.png"
    save_resized(cropped, asset_path, 1024)
    for filename, size in ICON_SIZES.items():
        save_resized(cropped, args.root / "icons" / filename, size)

    print(f"Logo asset: {asset_path}")
    print("Icons: " + ", ".join(str(args.root / "icons" / name) for name in ICON_SIZES))


if __name__ == "__main__":
    main()
