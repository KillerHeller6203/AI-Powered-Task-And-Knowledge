from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.task import Task
from ..models.document import Document
from ..models.user import User
from ..models.activity_log import ActivityLog, SearchLog
from ..schemas.analytics import (
    Analytics, TaskAnalytics, DocumentAnalytics,
    SearchAnalytics, UserAnalytics, TopQuery, ActivityItem,
)
from ..ai.vector_store import get_vector_store
from ..core.config import settings


def get_analytics(db: Session) -> Analytics:
    total_tasks = db.query(func.count(Task.id)).scalar() or 0
    pending_tasks = db.query(func.count(Task.id)).filter(Task.status == "pending").scalar() or 0
    completed_tasks = db.query(func.count(Task.id)).filter(Task.status == "completed").scalar() or 0
    in_progress_tasks = max(0, total_tasks - pending_tasks - completed_tasks)
    completion_rate = round(completed_tasks / max(1, total_tasks) * 100, 1)

    total_docs = db.query(func.count(Document.id)).scalar() or 0
    try:
        vs = get_vector_store(settings.VECTOR_STORE_PATH)
        total_chunks = vs.chunk_count
    except Exception:
        total_chunks = 0

    total_searches = db.query(func.count(SearchLog.id)).scalar() or 0
    top_queries_raw = (
        db.query(SearchLog.query, func.count(SearchLog.id).label("cnt"))
        .group_by(SearchLog.query)
        .order_by(func.count(SearchLog.id).desc())
        .limit(10)
        .all()
    )
    top_queries = [TopQuery(query=q, count=c) for q, c in top_queries_raw]

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    admin_users = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0

    recent_logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        ActivityItem(
            id=log.id,
            username=log.username,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log in recent_logs
    ]

    return Analytics(
        tasks=TaskAnalytics(
            total=total_tasks,
            pending=pending_tasks,
            in_progress=in_progress_tasks,
            completed=completed_tasks,
            completion_rate=completion_rate,
        ),
        searches=SearchAnalytics(
            total_searches=total_searches,
            top_queries=top_queries,
        ),
        users=UserAnalytics(
            total_users=total_users,
            active_users=active_users,
            admins=admin_users,
        ),
        documents=DocumentAnalytics(
            total_documents=total_docs,
            total_chunks=total_chunks,
        ),
        recent_activity=recent_activity,
    )
