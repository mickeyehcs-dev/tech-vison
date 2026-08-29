from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
FEATURE_SCHEMA = BASE_DIR / "feature_schema.json"
MANIFEST = BASE_DIR / "manifest.json"
MAX_HISTORY = 1000
