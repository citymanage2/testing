"""Run via Render Shell: python scripts/reset_users.py"""
import asyncio, uuid, os
from passlib.context import CryptContext

async def main():
    from app.database import SessionLocal
    from app.models.user import User
    from sqlalchemy import select

    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user_password = os.environ.get("USER_PASSWORD", "user123")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    async with SessionLocal() as db:
        for username, password, role in [
            ("user", user_password, "user"),
            ("admin", admin_password, "admin"),
        ]:
            existing = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
            if existing:
                existing.hashed_password = pwd_ctx.hash(password)
                print(f"Updated {username}")
            else:
                db.add(User(id=str(uuid.uuid4()), username=username, hashed_password=pwd_ctx.hash(password), role=role))
                print(f"Created {username}")
        await db.commit()
    print("Done")

asyncio.run(main())
