from pydantic import BaseModel
from typing import Optional, Dict, Any

class ConsultaResponse(BaseModel):
    success: bool
    ean: str
    filial: str
    tipo: str
    dados: Dict[str, Any]
    html: Optional[str] = None
    error: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"