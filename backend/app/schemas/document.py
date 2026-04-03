from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    filename: str
    file_size: int
    content_preview: Optional[str] = None
    uploaded_by: int
    uploaded_by_username: str
    is_indexed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
