# Code Style - LangFlow RAG System

## General Principles

- **Clean Code**: Write self-documenting code with meaningful names
- **Consistency**: Follow established patterns within the codebase
- **Simplicity**: Prefer simple, maintainable solutions
- **Security First**: Never expose sensitive information

## TypeScript/JavaScript (Frontend)

### Naming Conventions
- Variables and functions: `camelCase`
- Components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components

### Code Structure
- Use TypeScript strict mode
- Define proper interfaces and types
- Prefer composition over inheritance
- Keep components under 200 lines
- Use custom hooks for reusable logic

### Import Organization
```typescript
// External libraries
import React from 'react'
import { NextRouter } from 'next/router'

// Internal utilities
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// Components
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/file-upload'

// Types
import type { UploadedFile } from '@/types'
```

## Python (Backend)

### Naming Conventions
- Variables and functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `snake_case.py`

### Code Structure
- Use type hints for all function parameters and return values
- Keep functions under 50 lines
- Use dataclasses or Pydantic models for data structures
- Follow FastAPI best practices for route organization

### Import Organization
```python
# Standard library
import os
from typing import Optional, List
from pathlib import Path

# Third-party packages
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Local imports
from app.core.config import settings
from app.models.schemas import FileUpload
from app.services.file_service import FileService
```

## File Organization

### Frontend Structure
```
frontend/
├── app/                    # Next.js app directory
├── components/
│   ├── ui/                # shadcn/ui components
│   └── [feature]/         # Feature-specific components
├── lib/                   # Utility functions
├── types/                 # TypeScript type definitions
└── public/               # Static assets
```

### Backend Structure
```
backend/
├── app/
│   ├── api/              # API routes
│   ├── core/             # Core configuration
│   ├── models/           # Database models and schemas
│   └── services/         # Business logic
├── data/                 # Data storage
└── requirements.txt      # Python dependencies
```

## Error Handling

### Frontend
- Use try-catch blocks for async operations
- Provide user-friendly error messages
- Log errors for debugging
- Implement proper loading states

### Backend
- Use FastAPI HTTPException for API errors
- Log errors with appropriate detail level
- Return consistent error response format
- Handle database errors gracefully

## Documentation

### Code Comments
- Use JSDoc for TypeScript functions
- Use docstrings for Python functions
- Comment complex business logic
- Avoid obvious comments

### API Documentation
- Use FastAPI automatic documentation
- Provide clear endpoint descriptions
- Include example request/response bodies
- Document authentication requirements

## Security Practices

### Environment Variables
- Store sensitive data in environment variables
- Use `.env.local` for local development
- Never commit secrets to version control
- Validate environment variables at startup

### Input Validation
- Validate all user inputs
- Use Pydantic models for request validation
- Sanitize file uploads
- Implement proper error handling for invalid inputs

## Testing Standards

### Frontend Testing
- Write unit tests for utility functions
- Test component behavior, not implementation
- Use meaningful test descriptions
- Mock external dependencies

### Backend Testing
- Write unit tests for service functions
- Test API endpoints with various scenarios
- Use fixtures for test data
- Test error conditions

## Performance Guidelines

### Frontend
- Optimize bundle size
- Use dynamic imports for large components
- Implement proper image optimization
- Use React.memo for expensive components

### Backend
- Optimize database queries
- Use async/await for I/O operations
- Implement proper caching strategies
- Monitor response times