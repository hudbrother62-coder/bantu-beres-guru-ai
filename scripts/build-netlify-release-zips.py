#!/usr/bin/env python3
"""Build reproducible, Netlify-ready ZIPs from the current GroqCloud source.

Each archive contains public/, netlify/functions/, and netlify.toml.
The deployed Netlify site also needs these functions, not just static HTML.
"""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "releases"
SITES = (
    ("guru-ai-utama", "guru-ai-utama-groqcloud.zip"),
    ("guru-ai-v2", "guru-ai-v2-groqcloud.zip"),
)

def package(source: Path, destination: Path) -> None:
    required = (
        source / "netlify.toml",
        source / "public" / "index.html",
        source / "public" / "groq-client.js",
        source / "netlify" / "functions" / "groq-api.mjs",
    )
    missing = [str(p.relative_to(ROOT)) for p in required if not p.is_file()]
    if missing:
        raise SystemExit("Missing deployment files: " + ", ".join(missing))

    paths = sorted(
        [source / "netlify.toml"]
        + [p for folder in ("public", "netlify") for p in (source / folder).rglob("*") if p.is_file()],
        key=lambda p: p.relative_to(source).as_posix(),
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for file in paths:
            info = ZipInfo(file.relative_to(source).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, file.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    print(f"{destination.relative_to(ROOT)} ({len(paths)} files, {destination.stat().st_size} bytes)")

if __name__ == "__main__":
    for folder, filename in SITES:
        package(ROOT / "sites" / folder, OUTPUT / filename)
