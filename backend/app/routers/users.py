from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.dependencies import require_admin
from ..models.user import User
from ..schemas.user import UserOut, CreateUserRequest
from ..services.auth_service import create_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserOut.model_validate(u) for u in users]


@router.post("", response_model=UserOut, status_code=201)
def create_new_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = create_user(db, request)
    return UserOut.model_validate(user)
