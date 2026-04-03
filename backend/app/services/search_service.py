from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..models.activity_log import SearchLog
from ..models.user import User
from ..ai.vector_store import get_vector_store
from ..core.config import settings
from ..schemas.search import SearchResult, SearchResponse, SearchHistoryItem


def search_documents(db: Session, query: str, top_k: int, user: User) -> SearchResponse:
    vector_store = get_vector_store(settings.VECTOR_STORE_PATH)
    raw_results = vector_store.search(query, top_k=top_k)

    results = [
        SearchResult(
            document_id=doc_id,
            title=title,
            score=round(score, 4),
            excerpt=excerpt,
        )
        for doc_id, title, score, excerpt in raw_results
    ]

    search_log = SearchLog(
        user_id=user.id,
        query=query,
        result_count=len(results),
    )
    db.add(search_log)
    db.commit()

    return SearchResponse(query=query, results=results, total=len(results))


def get_search_history(db: Session, user: User) -> List[SearchHistoryItem]:
    logs = db.query(SearchLog).filter(SearchLog.user_id == user.id).order_by(
        SearchLog.searched_at.desc()
    ).limit(50).all()
    return [
        SearchHistoryItem(
            id=log.id,
            query=log.query,
            result_count=log.result_count,
            searched_at=log.searched_at,
        )
        for log in logs
    ]
