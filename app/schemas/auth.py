from pydantic import BaseModel

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    access_token: str
    role: str
    expires_in: int
