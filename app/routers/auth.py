from fastapi import APIRouter, HTTPException, status
from app.auth import create_access_token, get_password_hash, verify_password
from app.config import settings
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter()

_user_hash: str | None = None
_admin_hash: str | None = None

def _get_user_hash() -> str:
    global _user_hash
    if _user_hash is None:
        _user_hash = get_password_hash(settings.user_password)
    return _user_hash

def _get_admin_hash() -> str:
    global _admin_hash
    if _admin_hash is None:
        _admin_hash = get_password_hash(settings.admin_password)
    return _admin_hash

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    admin_match = verify_password(body.password, _get_admin_hash())
    user_match = verify_password(body.password, _get_user_hash())
    if admin_match:
        token = create_access_token(2, "admin")
        return LoginResponse(access_token=token, role="admin", expires_in=settings.jwt_expire_hours * 3600)
    if user_match:
        token = create_access_token(1, "user")
        return LoginResponse(access_token=token, role="user", expires_in=settings.jwt_expire_hours * 3600)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
