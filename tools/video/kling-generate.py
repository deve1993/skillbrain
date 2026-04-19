#!/usr/bin/env python3
"""
Kling 3.0 Video Generator — Image-to-Video con Kling AI API.
Uso: python3 kling-generate.py --image <path> --prompt "<prompt>" [opzioni]
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import jwt
import requests
from dotenv import load_dotenv

# Carica API keys dal .env
load_dotenv(Path(__file__).parent / ".env")

ACCESS_KEY = os.getenv("KLING_ACCESS_KEY")
SECRET_KEY = os.getenv("KLING_SECRET_KEY")

if not ACCESS_KEY or not SECRET_KEY:
    print("Errore: KLING_ACCESS_KEY o KLING_SECRET_KEY non trovate nel file .env")
    sys.exit(1)

API_BASE = "https://api.klingai.com"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def generate_jwt_token() -> str:
    """Genera un JWT token per autenticazione Kling API."""
    now = int(time.time())
    payload = {
        "iss": ACCESS_KEY,
        "iat": now,
        "nbf": now - 5,
        "exp": now + 1800,  # 30 minuti
    }
    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256", headers=headers)
    return token


def image_to_base64(path: str) -> str:
    """Converte un'immagine locale in base64."""
    img_path = Path(path)
    if not img_path.exists():
        print(f"Errore: immagine non trovata: {path}")
        sys.exit(1)
    data = img_path.read_bytes()
    return base64.b64encode(data).decode("utf-8")


def get_headers() -> dict:
    """Headers con JWT token."""
    token = generate_jwt_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def build_camera_control(args) -> Optional[dict]:
    """Costruisce il dict camera_control se almeno un parametro e' specificato."""
    camera_params = {
        "horizontal": args.camera_horizontal,
        "vertical": args.camera_vertical,
        "pan": args.camera_pan,
        "tilt": args.camera_tilt,
        "roll": args.camera_roll,
        "zoom": args.camera_zoom,
    }

    # Filtra solo i parametri specificati dall'utente (non None)
    specified = {k: v for k, v in camera_params.items() if v is not None}

    if not specified and args.camera_type is None:
        return None

    # Costruisci il config con tutti i valori (default 0 per quelli non specificati)
    config = {k: (v if v is not None else 0.0) for k, v in camera_params.items()}

    result: dict = {"config": config}
    if args.camera_type:
        result["type"] = args.camera_type
    else:
        result["type"] = "simple"

    return result


def create_video_task(
    image_path: str,
    prompt: str,
    model: str = "kling-v2-6",
    mode: str = "pro",
    duration: int = 10,
    aspect_ratio: str = "16:9",
    negative_prompt: Optional[str] = None,
    camera_control: Optional[dict] = None,
    cfg_scale: float = 0.5,
    image_tail_path: Optional[str] = None,
    enable_audio: bool = False,
) -> str:
    """Crea un task di generazione video da immagine."""

    # Converti immagine in base64
    img_b64 = image_to_base64(image_path)

    body = {
        "model_name": model,
        "mode": mode,
        "duration": str(duration),
        "aspect_ratio": aspect_ratio,
        "prompt": prompt,
        "image": img_b64,
        "cfg_scale": cfg_scale,
    }

    if negative_prompt:
        body["negative_prompt"] = negative_prompt

    if camera_control:
        body["camera_control"] = camera_control

    if image_tail_path:
        body["image_tail"] = image_to_base64(image_tail_path)
        print(f"Last frame: {image_tail_path}")

    if enable_audio:
        body["enable_audio"] = True

    print(f"Modello: {model} | Modo: {mode} | Durata: {duration}s | Aspect: {aspect_ratio} | CFG: {cfg_scale}")
    print(f"Prompt: {prompt}\n")

    resp = requests.post(
        f"{API_BASE}/v1/videos/image2video",
        headers=get_headers(),
        json=body,
        timeout=60,
    )

    if resp.status_code != 200:
        print(f"Errore API ({resp.status_code}): {resp.text}")
        sys.exit(1)

    result = resp.json()
    if result.get("code") != 0:
        print(f"Errore Kling: {result.get('message', 'Errore sconosciuto')}")
        sys.exit(1)

    task_id = result["data"]["task_id"]
    print(f"Task creato: {task_id}")
    return task_id


def poll_task(task_id: str, max_wait: int = 600) -> dict:
    """Polling fino al completamento del task."""
    elapsed = 0
    interval = 15

    while elapsed < max_wait:
        resp = requests.get(
            f"{API_BASE}/v1/videos/image2video/{task_id}",
            headers=get_headers(),
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"Errore polling ({resp.status_code}): {resp.text}")
            time.sleep(interval)
            elapsed += interval
            continue

        result = resp.json()
        data = result.get("data", {})
        status = data.get("task_status", "unknown")

        if status == "succeed":
            print(f"\nGenerazione completata! ({elapsed}s)")
            return data
        elif status == "failed":
            msg = data.get("task_status_msg", "Errore sconosciuto")
            print(f"\nGenerazione fallita: {msg}")
            sys.exit(1)
        else:
            print(f"  In corso... ({elapsed}s) - stato: {status}")
            time.sleep(interval)
            elapsed += interval

    print(f"\nTimeout dopo {max_wait}s")
    sys.exit(1)


def download_video(video_url: str, output_path: Path):
    """Scarica il video dall'URL."""
    print(f"Download video...")
    resp = requests.get(video_url, stream=True, timeout=120)
    resp.raise_for_status()

    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Video salvato: {output_path} ({size_mb:.1f} MB)")


def save_metadata(out_path: Path, model: str, prompt: str, settings: dict, duration_seconds: int):
    """Salva un file .json accanto al video con i metadati della generazione."""
    meta = {
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "prompt": prompt,
        "settings": settings,
        "output_file": out_path.name,
        "duration_seconds": duration_seconds,
    }
    json_path = out_path.with_suffix(".json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"Metadati salvati: {json_path}")


def generate_video(
    image_path: str,
    prompt: str,
    model: str = "kling-v2-6",
    mode: str = "pro",
    duration: int = 10,
    aspect_ratio: str = "16:9",
    output_name: Optional[str] = None,
    negative_prompt: Optional[str] = None,
    cfg_scale: float = 0.5,
    image_tail_path: Optional[str] = None,
    enable_audio: bool = False,
    camera_control: Optional[dict] = None,
):
    print(f"Immagine: {image_path}")

    # Crea task
    task_id = create_video_task(
        image_path=image_path,
        prompt=prompt,
        model=model,
        mode=mode,
        duration=duration,
        aspect_ratio=aspect_ratio,
        negative_prompt=negative_prompt,
        cfg_scale=cfg_scale,
        image_tail_path=image_tail_path,
        enable_audio=enable_audio,
        camera_control=camera_control,
    )

    # Polling
    task_data = poll_task(task_id)

    # Scarica video
    videos = task_data.get("task_result", {}).get("videos", [])
    if not videos:
        print("Errore: nessun video nel risultato")
        sys.exit(1)

    video_url = videos[0].get("url")
    if not video_url:
        print("Errore: URL video mancante")
        sys.exit(1)

    if output_name:
        out_path = OUTPUT_DIR / output_name
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = Path(image_path).stem
        out_path = OUTPUT_DIR / f"kling_{stem}_{ts}.mp4"

    if out_path.suffix != ".mp4":
        out_path = out_path.with_suffix(".mp4")

    # Calcola tempo trascorso dal task (approssimativo)
    elapsed = task_data.get("task_result", {}).get("duration", 0) or 0

    download_video(video_url, out_path)

    save_metadata(
        out_path=out_path,
        model=model,
        prompt=prompt,
        settings={
            "mode": mode,
            "duration": duration,
            "aspect_ratio": aspect_ratio,
            "cfg_scale": cfg_scale,
            "image_path": image_path,
            "image_tail_path": image_tail_path,
            "negative_prompt": negative_prompt,
            "enable_audio": enable_audio,
            "camera_control": camera_control,
        },
        duration_seconds=elapsed,
    )

    return str(out_path)


def main():
    parser = argparse.ArgumentParser(description="Genera video con Kling AI")
    parser.add_argument("--image", required=True, help="Immagine di partenza (primo frame)")
    parser.add_argument("--prompt", required=True, help="Prompt descrittivo per il video")
    parser.add_argument(
        "--model",
        default="kling-v2-6",
        choices=["kling-v1", "kling-v1-5", "kling-v2", "kling-v2-6", "kling-v3"],
        help="Modello (default: kling-v2-6)",
    )
    parser.add_argument("--mode", default="pro", choices=["std", "pro"], help="Modalità (default: pro)")
    parser.add_argument("--duration", type=int, default=10, choices=[5, 10], help="Durata in secondi (default: 10)")
    parser.add_argument("--aspect-ratio", default="16:9", help="Aspect ratio (default: 16:9)")
    parser.add_argument("--output", default=None, help="Nome file output")
    parser.add_argument("--negative-prompt", default=None, help="Elementi da evitare")
    parser.add_argument("--cfg-scale", type=float, default=0.5, help="Aderenza all'immagine 0-1 (default: 0.5, max fedeltà: 0.9)")
    parser.add_argument("--last-frame", default=None, help="Immagine ultimo frame")
    parser.add_argument("--audio", action="store_true", help="Abilita audio nativo")

    # Camera control
    parser.add_argument(
        "--camera-type",
        default=None,
        choices=["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
        help="Tipo di movimento camera predefinito",
    )
    parser.add_argument("--camera-horizontal", type=float, default=None, metavar="[-10,10]", help="Movimento orizzontale camera")
    parser.add_argument("--camera-vertical", type=float, default=None, metavar="[-10,10]", help="Movimento verticale camera")
    parser.add_argument("--camera-pan", type=float, default=None, metavar="[-10,10]", help="Pan camera")
    parser.add_argument("--camera-tilt", type=float, default=None, metavar="[-10,10]", help="Tilt camera")
    parser.add_argument("--camera-roll", type=float, default=None, metavar="[-10,10]", help="Roll camera")
    parser.add_argument("--camera-zoom", type=float, default=None, metavar="[-10,10]", help="Zoom camera")

    args = parser.parse_args()

    # Costruisci camera_control se necessario
    camera_control = build_camera_control(args)
    if camera_control:
        print(f"Camera control: {camera_control}")

    generate_video(
        image_path=args.image,
        prompt=args.prompt,
        model=args.model,
        mode=args.mode,
        duration=args.duration,
        aspect_ratio=args.aspect_ratio,
        output_name=args.output,
        negative_prompt=args.negative_prompt,
        cfg_scale=args.cfg_scale,
        image_tail_path=args.last_frame,
        enable_audio=args.audio,
        camera_control=camera_control,
    )


if __name__ == "__main__":
    main()
