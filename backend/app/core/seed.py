import os
import uuid
import logging
from .database import SessionLocal
from .security import get_password_hash
from .config import settings
from ..models.user import User
from ..models.task import Task
from ..models.document import Document
from ..ai.vector_store import get_vector_store

logger = logging.getLogger(__name__)

SEED_TASKS = [
    dict(title="Review Q3 Reports", description="Analyze and summarize Q3 financial data", priority="high", status="pending"),
    dict(title="Update Knowledge Base", description="Add new product documentation to the system", priority="medium", status="pending"),
    dict(title="Customer Onboarding", description="Set up accounts for new enterprise customers", priority="high", status="completed"),
    dict(title="Security Audit", description="Review API endpoints and access controls", priority="high", status="pending"),
    dict(title="Documentation Review", description="Proofread and update developer guides", priority="low", status="pending"),
]

SEED_DOCUMENTS = [
    (
        "TaskIQ System Guide",
        "System overview and getting started guide",
        """TaskIQ System Overview and Getting Started Guide

TaskIQ is an AI-powered task and knowledge management system designed to help teams organize work and find information efficiently.

Key Features:
1. Task Management - Create, assign, and track tasks with priority levels and deadlines
2. Document Search - Upload documents and search them using AI-powered semantic search
3. Role-Based Access - Admin and User roles with appropriate permissions
4. Activity Logging - All key actions are tracked for auditing

Getting Started:
- Admin users can create tasks and upload documents
- Regular users can view their assigned tasks and search documents
- Use the search feature to find relevant information quickly
- Tasks can have three priority levels: low, medium, and high

The semantic search feature uses sentence-transformers (all-MiniLM-L6-v2) to convert your query into a 384-dimensional vector and FAISS (IndexFlatIP) to find the most semantically similar document chunks using cosine similarity.""",
    ),
    (
        "Search & Upload Guide",
        "Guide for document upload and semantic search",
        """Document Upload and Search Guide

Uploading Documents:
Both .txt and .pdf files are supported. Files must be under 10 MB.
When you upload a document, it is automatically chunked and indexed for semantic search.

How Semantic Search Works:
1. Documents are split into 512-word chunks with 64-word overlap (sliding window)
2. Each chunk is encoded into a 384-dimensional vector using all-MiniLM-L6-v2
3. Vectors are stored in a FAISS IndexFlatIP index on disk
4. When you search, your query is encoded into the same vector space
5. Inner product (cosine similarity on normalized vectors) ranks results
6. The top-K most similar chunks are returned, deduplicated by document

Search Tips:
- Use natural language queries for best results
- Search works even without exact keyword matches
- The similarity score is a percentage (higher is more relevant)
- Excerpts show the most relevant chunk from each document""",
    ),
]


async def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            logger.info("Users already exist — skipping seed")
            return

        logger.info("Seeding initial data...")

        admin, user1, user2 = _create_seed_users(db)
        _create_seed_tasks(db, admin, user1, user2)
        _create_seed_documents(db, admin)

        logger.info("Initial data seeded successfully")
        logger.info("Default accounts: admin/Admin@1234  alice/User@1234  bob/User@1234")
    except Exception as exc:
        logger.error("Seeding failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def _create_seed_users(db) -> tuple[User, User, User]:
    admin = User(username="admin", email="admin@taskiq.com", hashed_password=get_password_hash("Admin@1234"), role="admin")
    user1 = User(username="alice", email="alice@taskiq.com", hashed_password=get_password_hash("User@1234"), role="user")
    user2 = User(username="bob", email="bob@taskiq.com", hashed_password=get_password_hash("User@1234"), role="user")
    db.add_all([admin, user1, user2])
    db.commit()
    db.refresh(admin)
    db.refresh(user1)
    db.refresh(user2)
    return admin, user1, user2


def _create_seed_tasks(db, admin: User, user1: User, user2: User) -> None:
    assignees = [user1, user2, user1, user2, user1]
    tasks = [
        Task(
            title=t["title"],
            description=t["description"],
            priority=t["priority"],
            status=t["status"],
            assigned_to=assignees[i].id,
            created_by=admin.id,
        )
        for i, t in enumerate(SEED_TASKS)
    ]
    db.add_all(tasks)
    db.commit()


def _create_seed_documents(db, admin: User) -> None:
    vector_store = get_vector_store(settings.VECTOR_STORE_PATH)
    docs_to_index = []

    for title, desc, content in SEED_DOCUMENTS:
        filename = f"{uuid.uuid4().hex}.txt"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        doc = Document(
            title=title,
            description=desc,
            filename=f"sample_{title.lower().replace(' ', '_')}.txt",
            file_path=file_path,
            file_size=len(content.encode()),
            content=content,
            content_preview=content[:500],
            uploaded_by=admin.id,
            is_indexed=True,
        )
        db.add(doc)
        docs_to_index.append((doc, content))

    db.commit()

    for doc, content in docs_to_index:
        db.refresh(doc)
        vector_store.add_document(doc.id, doc.title, content)