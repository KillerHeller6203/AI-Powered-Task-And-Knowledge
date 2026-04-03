from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..core.database import get_db
from ..core.dependencies import get_current_user, require_admin
from ..models.user import User
from ..schemas.task import TaskOut, TaskPage, CreateTaskRequest, UpdateTaskRequest
from ..services import task_service
from ..services.activity_service import log_activity

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskPage)
def list_tasks(
    status: Optional[str] = Query(None),
    assigned_to: Optional[int] = Query(None),
    created_by: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return task_service.list_tasks(
        db, current_user, status, assigned_to, created_by, priority, page, page_size
    )


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    request: CreateTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    task = task_service.create_task(db, request, current_user)
    log_activity(
        db,
        action="task_created",
        user=current_user,
        resource_type="task",
        resource_id=task["id"],
        details=f"Created task: {task['title']}",
    )
    return TaskOut.model_validate(task)


@router.get("/{id}", response_model=TaskOut)
def get_task(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = task_service.get_task(db, id, current_user)
    return TaskOut.model_validate(task)


@router.patch("/{id}", response_model=TaskOut)
def update_task(
    id: int,
    request: UpdateTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = task_service.update_task(db, id, request, current_user)
    log_activity(
        db,
        action="task_updated",
        user=current_user,
        resource_type="task",
        resource_id=id,
        details=f"Updated task {id}: status={task.get('status')}",
    )
    return TaskOut.model_validate(task)


@router.delete("/{id}", status_code=204)
def delete_task(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    log_activity(
        db,
        action="task_deleted",
        user=current_user,
        resource_type="task",
        resource_id=id,
    )
    task_service.delete_task(db, id)
    return Response(status_code=204)
