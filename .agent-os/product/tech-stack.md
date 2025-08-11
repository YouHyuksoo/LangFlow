# Tech Stack - LangFlow RAG System

## Project Context

LangFlow는 사내 지식관리를 위한 RAG(Retrieval-Augmented Generation) 시스템입니다.

## Frontend Stack
- App Framework: Next.js 14+
- Language: TypeScript 5+
- Build Tool: Next.js built-in build system
- Package Manager: npm
- Node Version: 22 LTS
- CSS Framework: TailwindCSS
- UI Components: shadcn/ui components
- Icons: Lucide React components

## Backend Stack
- App Framework: FastAPI
- Language: Python 3.11+
- Database: SQLite (development) / PostgreSQL (production)
- ORM: SQLAlchemy
- API Documentation: FastAPI automatic OpenAPI docs
- AI/ML: LangFlow, OpenAI API
- File Processing: Vector embeddings for RAG

## Development Environment
- Concurrent Development: concurrently package
- Development Server: uvicorn (backend), Next.js dev server (frontend)
- Port Configuration: Backend (8000), Frontend (3000)
- Hot Reload: Enabled for both frontend and backend

## Deployment & Infrastructure
- Application Hosting: TBD (Cloud platform)
- Database Hosting: Managed PostgreSQL service
- File Storage: Local storage (development) / Cloud storage (production)
- CI/CD Platform: GitHub Actions
- Environment Management: Environment variables for API keys and configuration

## Testing & Quality
- Testing Framework: TBD (Jest for frontend, pytest for backend)
- Code Quality: ESLint, Prettier (frontend), Black, isort (backend)
- Type Checking: TypeScript (frontend), mypy (backend)

## Security Considerations
- API Key Management: Environment variables
- Authentication: JWT-based authentication
- Data Privacy: Secure handling of uploaded documents
- Access Control: Role-based access control