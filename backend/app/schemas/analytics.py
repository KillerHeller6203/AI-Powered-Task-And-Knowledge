from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TopQuery(BaseModel):
    query: str
    count: int


class TaskAnalytics(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    completion_rate: float


class DocumentAnalytics(BaseModel):
    total_documents: int
    total_chunks: int


class SearchAnalytics(BaseModel):
    total_searches: int
    top_queries: List[TopQuery]


class UserAnalytics(BaseModel):
    total_users: int
    active_users: int
    admins: int


class ActivityItem(BaseModel):
    id: int
    username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime


class Analytics(BaseModel):
    tasks: TaskAnalytics
    searches: SearchAnalytics
    users: UserAnalytics
    documents: DocumentAnalytics
    recent_activity: List[ActivityItem]
