from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import timedelta
from ..models.user import User
from ..core.security import verify_password, get_password_hash, create_access_token
from ..core.config import settings
from ..schemas.user import CreateUserRequest


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(
        User.username == username,
        User.is_active == True
    ).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    return user


def create_token(user: User) -> str:
    return create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_user(db: Session, request: CreateUserRequest) -> User:
    existing = db.query(User).filter(
        (User.username == request.username) | (User.email == request.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists",
        )
    if request.role not in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'admin' or 'user'",
        )
    user = User(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role=request.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
