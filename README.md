# TaskIQ — AI-Powered Task & Knowledge Management System

> An MVP system where **admins** upload documents and assign tasks, and **users** search the knowledge base using AI-powered semantic search to complete their work.

---

## Screenshots

### Dashboard
![Dashboard](docs/dashboard.png)

### Analytics
![Analytics](docs/analytics.png)

### Knowledge Search (FAISS semantic search — 62.8% match)
![Search](docs/search.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI |
| Database | MySQL 8 · SQLAlchemy ORM · FK-constrained relational schema |
| Authentication | JWT (python-jose) · bcrypt · RBAC |
| AI / Search | sentence-transformers `all-MiniLM-L6-v2` · 384-dim embeddings |
| Vector Store | FAISS `IndexFlatIP` · disk-persisted (`.faiss` + JSON sidecar) |
| Frontend | React 18 · TypeScript · Vite |
| UI | Tailwind CSS · shadcn/ui · Recharts |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── ai/             # Embeddings (sentence-transformers) & FAISS vector store
│   │   ├── core/           # Config, DB session, JWT security, dependencies
│   │   ├── models/         # SQLAlchemy models (users, tasks, documents, logs)
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic layer
│   │   └── main.py         # App entry point + startup DB seeding
│   ├── uploads/            # Uploaded document files (auto-created)
│   └── run.py              # Uvicorn server startup
├── frontend/
│   ├── src/
│   │   ├── api/            # Typed API client & React Query hooks
│   │   ├── components/     # Reusable UI components (Layout, TaskCard, etc.)
│   │   ├── lib/            # Auth context, token management, utilities
│   │   └── pages/          # Login, Dashboard, Admin, Search, Analytics
│   └── vite.config.ts      # Vite config with /api proxy → :8080
├── docs/screenshots/       # README screenshots
├── requirements.txt
└── README.md
```

---

## Database Schema

```
users         (id, username, email, hashed_password, role, is_active, created_at)
tasks         (id, title, description, status, priority, assigned_to→users.id, created_by→users.id, due_date)
documents     (id, title, filename, file_path, file_size, content, is_indexed, uploaded_by→users.id)
activity_logs (id, user_id→users.id, username, action, resource_type, resource_id, details, ip_address, created_at)
search_logs   (id, user_id→users.id, query, result_count, searched_at)
```

---

## Setup & Installation

### Prerequisites

- Python 3.12+
- Node.js 18+
- MySQL 8.0+

### 1. Clone the repo

```bash
git clone <repo-url>
cd taskiq
```

### 2. Database Setup

```sql
CREATE DATABASE taskiq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'taskiq_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON taskiq.* TO 'taskiq_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r ../requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set your DB credentials and a secret key
```

`.env`:
```env
DATABASE_URL=mysql+pymysql://taskiq_user:your_password@localhost/taskiq
SECRET_KEY=your-long-random-secret-key
```

```bash
# Start the backend (tables created + seed data inserted automatically on first run)
# Note: sentence-transformers model (~90MB) downloads on very first startup
python run.py
```

Backend runs at **http://localhost:8080**  
Swagger docs at **http://localhost:8080/api/docs**

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**  
All `/api/*` requests are proxied to `:8080` via Vite config.

### 5. Default Credentials

Seeded automatically on first run:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@1234` |
| User | `alice` | `User@1234` |
| User | `bob` | `User@1234` |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Authenticate, returns JWT |
| POST | `/api/auth/register` | Public | Register new user |
| GET | `/api/auth/me` | Any | Current user info |
| GET | `/api/tasks` | Any | List tasks (supports filters) |
| POST | `/api/tasks` | Admin | Create task |
| PATCH | `/api/tasks/{id}` | Any | Update task |
| DELETE | `/api/tasks/{id}` | Admin | Delete task |
| GET | `/api/documents` | Any | List documents |
| POST | `/api/documents/upload` | Admin | Upload & auto-index `.txt` / `.pdf` |
| DELETE | `/api/documents/{id}` | Admin | Delete + remove from FAISS index |
| POST | `/api/search` | Any | Semantic search |
| GET | `/api/search/history` | Any | User's search history |
| GET | `/api/analytics` | Any | System-wide analytics |
| GET | `/api/activity` | Admin | Full activity logs |
| GET | `/api/users` | Admin | List all users |
| POST | `/api/users` | Admin | Create user |

### Dynamic Task Filtering

```
GET /api/tasks?status=pending
GET /api/tasks?status=completed&priority=high
GET /api/tasks?assigned_to=2
GET /api/tasks?page=2&page_size=10
```

---

## Key Features

### JWT Authentication & RBAC
Two roles enforced via FastAPI dependency injection on every protected route:
- **Admin** — full CRUD on tasks, documents, and users; access to activity logs
- **User** — view assigned tasks, update task status, search documents

### AI Semantic Search
Documents are split into 512-word overlapping chunks (64-word overlap) and encoded into 384-dimensional vectors using the pretrained **`all-MiniLM-L6-v2`** model from sentence-transformers — runs entirely locally, no external API required.

Vectors are stored in a **FAISS `IndexFlatIP`** index persisted to disk. At query time, the query is encoded into the same vector space and cosine similarity (inner product on L2-normalized vectors) retrieves the top-K most semantically relevant chunks.

### Document Upload
- Supports `.txt` and `.pdf` files up to 10MB
- PDF text extracted automatically via PyPDF2
- Chunked and indexed into FAISS on upload
- Deleting a document removes it from the vector index

### Activity Logging
Every key action is tracked in `activity_logs`:

| Action | Trigger |
|---|---|
| `login` | Successful login |
| `register` | New user registration |
| `task_created` | Admin creates a task |
| `task_updated` | Status or field change |
| `task_deleted` | Task removed |
| `document_uploaded` | File indexed into FAISS |
| `document_deleted` | File removed |
| `search` | Semantic search executed |

Search queries are also stored in `search_logs` to power the **Top Queries** analytics chart.

### Analytics
- Task status distribution — pie chart (pending / completed)
- Completion rate
- Top search queries — bar chart
- User breakdown (total, active, admins)
- Document count + total indexed chunks
- Live recent activity feed
