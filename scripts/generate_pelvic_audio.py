"""Generate the pelvic-floor cues with the open-source Piper voice zh_CN-huayan-medium.

The ONNX weights stay in scripts/.cache and are not committed. Only the short mp3 cues
under src/packages/tools/pelvic-floor/assets are checked in.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / ".cache" / "piper"
OUT = ROOT / "src" / "packages" / "tools" / "pelvic-floor" / "assets"
MODEL_NAME = "zh_CN-huayan-medium"
MODEL = CACHE / f"{MODEL_NAME}.onnx"
CONFIG = CACHE / f"{MODEL_NAME}.onnx.json"
MIRRORS = (
    "https://hf-mirror.com/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium",
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium",
)
PHRASES = {
    "cue-contract": "收紧",
    "cue-relax": "放松",
    "cue-done": "本次训练完成",
}


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    temporary = dest.with_suffix(dest.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "tool-kits-pelvic-audio"})
    with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as handle:
        shutil.copyfileobj(response, handle)
    temporary.replace(dest)


def ensure_model() -> None:
    if MODEL.exists() and CONFIG.exists() and MODEL.stat().st_size > 0 and CONFIG.stat().st_size > 0:
        return
    errors: list[str] = []
    for mirror in MIRRORS:
        try:
            if not MODEL.exists() or MODEL.stat().st_size == 0:
                download(f"{mirror}/{MODEL_NAME}.onnx", MODEL)
            if not CONFIG.exists() or CONFIG.stat().st_size == 0:
                download(f"{mirror}/{MODEL_NAME}.onnx.json", CONFIG)
            return
        except Exception as error:  # noqa: BLE001 - try the next mirror
            errors.append(f"{mirror}: {error}")
    raise RuntimeError("无法下载 Piper 中文音色\n" + "\n".join(errors))


def synthesize_wav(text: str, wav_path: Path) -> None:
    from piper import PiperVoice

    voice = PiperVoice.load(str(MODEL), config_path=str(CONFIG))
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as wav_file:
        if "syn_config" in voice.synthesize_wav.__code__.co_varnames:
            try:
                from piper.config import SynthesisConfig

                voice.synthesize_wav(text, wav_file, syn_config=SynthesisConfig())
                return
            except TypeError:
                wav_file.seek(0)
                wav_file.truncate(0)
        voice.synthesize_wav(text, wav_file)


def to_mp3(wav_path: Path, mp3_path: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(wav_path),
        "-ac",
        "1",
        "-ar",
        "22050",
        "-b:a",
        "32k",
        str(mp3_path),
    ]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> None:
    ensure_model()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, text in PHRASES.items():
        wav_path = CACHE / f"{name}.wav"
        mp3_path = OUT / f"{name}.mp3"
        synthesize_wav(text, wav_path)
        to_mp3(wav_path, mp3_path)
        print(f"{mp3_path.name}: {mp3_path.stat().st_size} bytes")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(error, file=sys.stderr)
        raise
