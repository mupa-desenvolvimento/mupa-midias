from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional

class Settings(BaseSettings):
    jwt_secret_key: str = Field(default="default_secret_key_123456", alias="JWT_SECRET_KEY")
    jwt_access_token_expires: int = Field(default=3600, alias="JWT_ACCESS_TOKEN_EXPIRES")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings() 