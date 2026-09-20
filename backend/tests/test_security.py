import jwt

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password


def test_password_hash_roundtrip():
    hashed = get_password_hash("secreta123")
    assert hashed != "secreta123"
    assert verify_password("secreta123", hashed)
    assert not verify_password("otra", hashed)


def test_token_contains_sub_exp_and_unique_jti():
    t1 = create_access_token({"sub": "ana"})
    t2 = create_access_token({"sub": "ana"})
    p1 = jwt.decode(t1, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    p2 = jwt.decode(t2, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert p1["sub"] == "ana"
    assert "exp" in p1
    assert p1["jti"] != p2["jti"]
