from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str
    jwt_secret: str
    jwt_expire_hours: int = 24
    user_password: str
    admin_password: str
    max_files_per_request: int = 5
    max_file_size_mb: int = 50
    search_city: str = "Екатеринбург"
    vat_rate: float = 20.0
    cors_origins: str = "https://testing-frontend-52jt.onrender.com"

    class Config:
        env_file = ".env"

settings = Settings()
