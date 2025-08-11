# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-04-chromadb-rag-pipeline/spec.md

> Created: 2025-08-04
> Version: 1.0.0

## Enhanced Endpoints

### POST /api/v1/chat/
**Purpose:** Process user queries with ChromaDB semantic search and generate AI responses

**Enhanced Parameters:**
- query: str (user question)
- categories: List[str] (selected category IDs for filtering)
- max_results: int = 10 (number of documents to retrieve)
- include_sources: bool = true (include source attribution)

**Enhanced Response:**
```json
{
  "response": "AI generated answer text",
  "sources": [
    {
      "file_id": "uuid",
      "filename": "document.pdf", 
      "category_name": "품질",
      "relevance_score": 0.95,
      "chunk_content": "relevant text snippet"
    }
  ],
  "query_time": 2.3,
  "retrieved_docs_count": 5
}
```

**Errors:** 400 (invalid query), 422 (embedding generation failed), 500 (ChromaDB connection error)

### POST /api/v1/files/upload
**Purpose:** Upload and process PDF documents with ChromaDB indexing

**Enhanced Response:**
```json
{
  "file_id": "uuid",
  "filename": "document.pdf",
  "status": "processing",
  "vectorization_status": "pending",
  "estimated_processing_time": 45
}
```

### GET /api/v1/files/{file_id}/vectorization
**Purpose:** Check document vectorization status in ChromaDB

**Response:**
```json
{
  "file_id": "uuid",
  "vectorization_status": "completed|processing|failed",
  "chunks_processed": 25,
  "total_chunks": 25,
  "error_message": null
}
```

### GET /api/v1/vector/search
**Purpose:** Direct semantic search endpoint for testing

**Parameters:**
- query: str (search query)
- categories: List[str] (optional category filter)
- limit: int = 10 (results limit)

**Response:**
```json
{
  "results": [
    {
      "document": "text content",
      "metadata": {...},
      "distance": 0.1234
    }
  ],
  "query_time": 0.8
}
```

### GET /api/v1/vector/stats
**Purpose:** ChromaDB collection statistics for admin dashboard

**Response:**
```json
{
  "total_documents": 1250,
  "documents_by_category": {
    "품질": 180,
    "인사": 95
  },
  "collection_size_mb": 45.2,
  "last_updated": "2025-08-04T10:30:00Z"
}
```

## Controllers

### Enhanced ChatController
- Handle RAG pipeline integration with ChromaDB semantic search
- Implement source attribution and response formatting
- Add error handling for embedding generation failures
- Support category-based filtering for search results

### Enhanced FileController  
- Add vectorization status endpoints for real-time progress tracking
- Implement ChromaDB document indexing workflow
- Handle vectorization error states and retry mechanisms
- Support batch file processing status queries

### New VectorController
- Direct semantic search interface for testing and debugging
- Collection statistics and health monitoring endpoints
- Administrative functions for ChromaDB management
- Performance metrics and query analytics

## New Service Methods

### ChatService Updates
- `async def search_documents_semantic(query, categories, limit)` - ChromaDB semantic search
- `async def generate_response_with_context(query, documents)` - RAG response generation
- `async def format_sources(documents)` - Source attribution formatting

### FileService Updates  
- `async def vectorize_file_chromadb(file_id)` - ChromaDB document indexing
- `async def get_vectorization_status(file_id)` - Processing status check
- `async def delete_from_vector_db(file_id)` - ChromaDB document removal

### New VectorService
- `async def initialize_chromadb()` - Collection setup and configuration
- `async def add_documents(documents, metadatas, ids)` - Batch document addition
- `async def search(query, filters, limit)` - Semantic search interface
- `async def get_collection_stats()` - Collection statistics and health