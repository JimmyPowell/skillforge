"""Application configuration via environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """SkillForge configuration — all values can be overridden via env vars."""

    # Application
    app_name: str = "SkillForge"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/skillforge.db"

    # Data directories
    data_dir: Path = Path("./data")
    skills_dir: Path = Path("./data/skills")
    tasks_dir: Path = Path("./data/tasks")
    runs_dir: Path = Path("./data/runs")

    # Docker
    docker_use_sg: bool = False  # Use `sg docker -c` wrapper

    # Execution
    max_concurrent_runs: int = 2
    default_timeout_sec: int = 600

    # Rate limiting
    rate_limit_runs_per_minute: int = 10

    # Agent credentials (passed to containers)
    anthropic_base_url: str = ""
    anthropic_auth_token: str = ""
    anthropic_custom_headers: str = ""

    # Frontend
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_prefix": "SKILLFORGE_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
