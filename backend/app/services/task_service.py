from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional, List
from ..models.task import Task
from ..models.user import User
from ..schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskOut, TaskPage


def _enrich_task(task: Task, db: Session) -> dict:
    assignee = db.query(User).filter(User.id == task.assigned_to).first() if task.assigned_to else None
    creator = db.query(User).filter(User.id == task.created_by).first()
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": task.assigned_to,
        "assigned_to_username": assignee.username if assignee else None,
        "created_by": task.created_by,
        "created_by_username": creator.username if creator else "unknown",
        "due_date": task.due_date,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def list_tasks(
    db: Session,
    current_user: User,
    status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    created_by: Optional[int] = None,
    priority: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> TaskPage:
    query = db.query(Task)
    if current_user.role != "admin":
        query = query.filter(Task.assigned_to == current_user.id)
    if status:
        query = query.filter(Task.status == status)
    if assigned_to is not None:
        query = query.filter(Task.assigned_to == assigned_to)
    if created_by is not None:
        query = query.filter(Task.created_by == created_by)
    if priority:
        query = query.filter(Task.priority == priority)

    total = query.count()
    tasks = (
        query.order_by(Task.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [TaskOut.model_validate(_enrich_task(t, db)) for t in tasks]
    return TaskPage(items=items, total=total, page=page, page_size=page_size)


def create_task(db: Session, request: CreateTaskRequest, creator: User) -> dict:
    if request.assigned_to:
        assignee = db.query(User).filter(User.id == request.assigned_to).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")
    task = Task(
        title=request.title,
        description=request.description,
        priority=request.priority,
        assigned_to=request.assigned_to,
        created_by=creator.id,
        due_date=request.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _enrich_task(task, db)


def get_task(db: Session, task_id: int, current_user: User) -> dict:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role != "admin" and task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _enrich_task(task, db)


def update_task(db: Session, task_id: int, request: UpdateTaskRequest, current_user: User) -> dict:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role != "admin" and task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role != "admin":
        updates = {k: v for k, v in request.model_dump(exclude_none=True).items() if k == "status"}
    else:
        updates = request.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return _enrich_task(task, db)


def delete_task(db: Session, task_id: int) -> None:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
