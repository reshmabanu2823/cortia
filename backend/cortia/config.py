from dataclasses import dataclass, field
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]


def _load_env_file():
    for env_path in (ROOT / '.env', Path(__file__).resolve().parents[1] / '.env'):
        if env_path.is_file():
            try:
                for line in env_path.read_text(encoding='utf-8').splitlines():
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k, v = k.strip(), v.strip()
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass


_load_env_file()


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.getenv('CORTIA_DATA_DIR', ROOT/'data')))
    model_dir: Path = field(default_factory=lambda: Path(os.getenv('CORTIA_MODEL_DIR', ROOT/'models/mri')))
    database_url: str | None = field(default_factory=lambda: os.getenv('CORTIA_DATABASE_URL'))
    secure_cookie: bool = field(default_factory=lambda: os.getenv('CORTIA_SECURE_COOKIE') == '1')
    allowed_origins: tuple = ('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8010', 'http://127.0.0.1:8010')
    testing: bool = False
    max_upload_bytes: int = 10 * 1024 * 1024
    ai_endpoint: str = field(default_factory=lambda: os.getenv('CORTIA_AI_ENDPOINT', 'http://127.0.0.1:5000/v1'))
    ai_key: str = field(default_factory=lambda: os.getenv('CORTIA_AI_KEY', 'sk-e3259490e3ecc50a-efd4d4-5f46e993'))
    ai_model: str = field(default_factory=lambda: os.getenv('CORTIA_AI_MODEL', 'antigravity/gemini-3.8-flash-high'))
