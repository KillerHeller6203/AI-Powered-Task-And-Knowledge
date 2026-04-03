from pydantic import BaseModel
from datetime import datetime
from typing import List


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SearchResult(BaseModel):
    document_id: int
    title: str
    score: float
    excerpt: str


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int


class SearchHistoryItem(BaseModel):
    id: int
    query: str
    result_count: int
    searched_at: datetime

    model_config = {"from_attributes": True}
