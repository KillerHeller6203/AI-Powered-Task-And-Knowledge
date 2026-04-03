from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..schemas.search import SearchRequest, SearchResponse, SearchHistoryItem
from ..services import search_service
from ..services.activity_service import log_activity

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
def search(
    request: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = search_service.search_documents(db, request.query, request.top_k, current_user)
    log_activity(
        db,
        action="search",
        user=current_user,
        resource_type="document",
        details=f"Searched: '{request.query}' → {result.total} results",
    )
    return result


@router.get("/history", response_model=List[SearchHistoryItem])
def get_search_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return search_service.get_search_history(db, current_user)
