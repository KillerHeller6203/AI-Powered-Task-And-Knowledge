from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..schemas.auth import LoginRequest, LoginResponse
from ..schemas.user import UserOut, CreateUserRequest
from ..services.auth_service import authenticate_user, create_token, create_user
from ..services.activity_service import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    token = create_token(user)
    log_activity(
        db,
        action="login",
        user=user,
        resource_type="auth",
        details=f"User {user.username} logged in",
        ip_address=req.client.host if req.client else None,
    )
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=LoginResponse, status_code=201)
def register(request: CreateUserRequest, req: Request, db: Session = Depends(get_db)):
    request.role = "user"
    user = create_user(db, request)
    token = create_token(user)
    log_activity(
        db,
        action="register",
        user=user,
        resource_type="auth",
        details=f"New user {user.username} registered",
        ip_address=req.client.host if req.client else None,
    )
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
