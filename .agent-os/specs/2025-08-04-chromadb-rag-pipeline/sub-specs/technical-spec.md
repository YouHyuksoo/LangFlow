# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-04-chromadb-rag-pipeline/spec.md

> Created: 2025-08-04
> Version: 1.0.0

## Technical Requirements

### ChromaDB Architecture

**Collection Design**:
- Single persistent collection named "langflow_documents" with metadata filtering by category
- OpenAI embedding function integration (text-embedding-3-small model)
- Persistent client with local file storage at ./chroma_db/
- Metadata schema: category_id, category_name, file_id, filename, chunk_index, upload_date, file_size

**Storage Configuration**:
- Persistent ChromaDB client with local file-based storage
- Collection dimension: 1536 (text-embedding-3-small output size)
- Index type: HNSW for efficient similarity search
- Distance metric: Cosine similarity for semantic relevance

### Document Processing Pipeline

**PDF Text Extraction**:
- Enhanced PDF text extraction with error handling and encoding support
- Multi-format support: PDF, TXT, DOC, DOCX
- Character encoding detection and normalization (UTF-8)
- Content sanitization and whitespace normalization

**Text Chunking Strategy**:
- Intelligent text chunking: 1000 characters with 200 character overlap at sentence boundaries
- Sentence-aware splitting to preserve semantic coherence
- Paragraph boundary preservation where possible
- Minimum chunk size: 200 characters (avoid too small chunks)

**Embedding Generation**:
- Batch embedding generation with OpenAI API integration and retry logic
- Model: text-embedding-3-small (1536 dimensions)
- Batch size: 100 chunks per API call for efficiency
- Rate limiting and exponential backoff for API reliability

**Metadata Management**:
- Document metadata preservation and unique ID generation for chunks
- Unique chunk IDs: `{file_id}_{chunk_index}` format
- Timestamp tracking for upload_date and last_modified
- File size and type metadata for search filtering

### Semantic Search Implementation

**Query Processing**:
- Category-aware filtering using ChromaDB where clause
- Query text preprocessing and normalization
- Query embedding generation using same model as documents

**Search Strategy**:
- Similarity search with configurable top-k results (default: 10)
- Score normalization and relevance ranking
- Hybrid search: semantic similarity + metadata filtering
- Minimum similarity threshold: 0.7 for relevance filtering

**UI Integration**:
- Integration with existing category selector UI component
- Real-time search suggestions and autocomplete
- Search result highlighting and snippet generation

### RAG Pipeline Integration

**Context Management**:
- Document retrieval with context window management (max 4000 tokens)
- Token counting using tiktoken for accurate limits
- Context prioritization by relevance score
- Smart truncation at sentence boundaries

**Response Generation**:
- OpenAI chat completion integration with system prompts
- Korean language optimization for responses
- Temperature: 0.3 for consistent, factual responses
- Max tokens: 1000 for comprehensive answers

**Source Attribution**:
- Source attribution with document references
- Citation format: [filename, page/section]
- Clickable source links in UI responses
- Confidence scores for each source

### Performance Requirements

**Response Time Targets**:
- Query response time: <5 seconds end-to-end
- Embedding generation: <2 seconds for single query
- ChromaDB search: <1 second for similarity queries
- Context assembly: <500ms for retrieved documents

**Processing Efficiency**:
- Document processing: <30 seconds for 10MB PDF
- Batch processing: 50 documents per minute
- Memory usage: <500MB per processing job
- Concurrent processing: 5 documents simultaneously

**Scalability Targets**:
- Concurrent user support: 50 simultaneous queries
- Document capacity: 10,000 documents in collection
- Memory efficiency: <2GB for 1000 documents
- Search latency: <100ms for cached queries

## Approach

### Service Layer Architecture

**ChatService Updates**:
```python
class ChatService:
    async def search_documents(self, query: str, category_id: int = None, limit: int = 10) -> List[SearchResult]:
        """Replace existing search with ChromaDB semantic search"""
        pass
    
    async def generate_rag_response(self, query: str, context: List[str]) -> ChatResponse:
        """Generate contextual response using retrieved documents"""
        pass
```

**FileService Enhancements**:
```python
class FileService:
    async def vectorize_file(self, file_id: int) -> bool:
        """Enhanced vectorization with ChromaDB storage"""
        pass
    
    async def process_and_embed(self, file_path: str, metadata: dict) -> List[str]:
        """Process document and generate embeddings"""
        pass
```

**New VectorService**:
```python
class VectorService:
    def __init__(self, collection_name: str = "langflow_documents"):
        """Initialize ChromaDB client and collection"""
        pass
    
    async def add_documents(self, texts: List[str], metadatas: List[dict], ids: List[str]) -> bool:
        """Add document chunks to vector store"""
        pass
    
    async def similarity_search(self, query: str, filter_dict: dict = None, k: int = 10) -> List[dict]:
        """Perform semantic similarity search"""
        pass
```

### Error Handling Strategy

**API Resilience**:
- Exponential backoff for OpenAI API calls
- Circuit breaker pattern for external service failures
- Graceful degradation when embedding service unavailable
- Comprehensive logging for debugging and monitoring

**Data Integrity**:
- Transaction-like processing for document ingestion
- Rollback capability for failed vectorization
- Duplicate detection and handling
- Consistency checks between database and vector store

### Configuration Management

**Environment Variables**:
```env
# ChromaDB Configuration
CHROMA_DB_PATH=./chroma_db
CHROMA_COLLECTION_NAME=langflow_documents

# OpenAI Configuration
OPENAI_API_KEY=your_api_key_here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-3.5-turbo

# Processing Configuration
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_CONTEXT_TOKENS=4000
SIMILARITY_THRESHOLD=0.7
```

**Settings Management**:
- Centralized configuration in core/config.py
- Runtime parameter adjustment without restart
- Environment-specific configurations (dev/prod)
- Configuration validation and defaults

## External Dependencies

### Required Package Updates

**chromadb==0.4.20**
- Purpose: Vector database for document embeddings storage and semantic search
- Justification: Modern, Python-native vector database with excellent metadata support and OpenAI integration
- Integration: Persistent client with local storage, metadata filtering, similarity search

**openai==1.6.1**
- Purpose: Updated OpenAI client for embeddings and chat completion
- Justification: Replace outdated OpenAI integration, modern async support, better error handling
- Integration: Async API calls, batch processing, rate limiting

**tiktoken==0.5.2**
- Purpose: Token counting for OpenAI API cost management
- Justification: Accurate token counting for context window management and cost optimization
- Integration: Context window management, cost tracking, prompt optimization

### Optional Dependencies

**sentence-transformers==2.2.2**
- Purpose: Alternative embedding model for reduced API costs
- Justification: Local embedding generation, privacy benefits, cost reduction
- Integration: Fallback option when OpenAI API unavailable

**langchain==0.1.0**
- Purpose: Advanced text splitting and preprocessing utilities
- Justification: Sophisticated text chunking strategies, document loaders
- Integration: Enhanced document processing pipeline

### Database Schema Changes

**New Tables**:
```sql
-- Vector metadata tracking
CREATE TABLE vector_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER REFERENCES files(id),
    chunk_id VARCHAR(255) UNIQUE,
    chunk_index INTEGER,
    chunk_text TEXT,
    embedding_model VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search analytics
CREATE TABLE search_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT,
    category_id INTEGER,
    results_count INTEGER,
    response_time_ms INTEGER,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Index Optimization**:
```sql
CREATE INDEX idx_vector_documents_file_id ON vector_documents(file_id);
CREATE INDEX idx_vector_documents_chunk_id ON vector_documents(chunk_id);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
```

### Migration Strategy

**Phase 1: Infrastructure Setup**
1. Install ChromaDB and initialize collection
2. Set up OpenAI API integration
3. Create vector service layer
4. Database schema updates

**Phase 2: Document Processing**
1. Implement enhanced text extraction
2. Deploy chunking and embedding pipeline
3. Migrate existing documents to vector store
4. Validate data integrity

**Phase 3: Search Integration**
1. Replace existing search with semantic search
2. Update API endpoints
3. Integrate with frontend components
4. Performance testing and optimization

**Phase 4: RAG Implementation**
1. Implement context retrieval
2. Deploy response generation
3. Add source attribution
4. User acceptance testing

### Testing Strategy

**Unit Tests**:
- VectorService methods (add, search, delete)
- Text processing utilities (chunking, embedding)
- OpenAI API integration with mocking
- Configuration loading and validation

**Integration Tests**:
- End-to-end document processing pipeline
- Search accuracy with known document sets
- RAG response quality evaluation
- Performance benchmarking

**Load Tests**:
- Concurrent user simulation (50 users)
- Large document processing (100MB files)
- Search performance under load
- Memory usage monitoring

### Monitoring and Observability

**Metrics Collection**:
- API response times and error rates
- Vector search accuracy and latencies
- Document processing throughput
- Memory and storage usage

**Logging Strategy**:
- Structured logging for all vector operations
- Query performance logging
- Error tracking with context
- User interaction analytics

**Health Checks**:
- ChromaDB connection status
- OpenAI API availability
- Storage space monitoring
- Service dependency checks