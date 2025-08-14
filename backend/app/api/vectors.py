from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict, Any
import sqlite3
import os
from ..core.config import settings
from ..core.logger import get_console_logger
from ..services.vector_service import VectorService
from ..models.vector_models import VectorMetadataService
from ..api.chat import get_admin_user
import json
from datetime import datetime

router = APIRouter(prefix="/admin/vectors", tags=["vectors"])

# 서비스 인스턴스
vector_service = VectorService()
metadata_service = VectorMetadataService()
_clog = get_console_logger()

@router.get("/metadata")
async def get_vector_metadata(
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    search: Optional[str] = Query(None, description="파일명 검색"),
    category_id: Optional[str] = Query(None, description="카테고리 필터"),
    processing_method: Optional[str] = Query(None, description="처리 방법 필터"),
    admin_user = Depends(get_admin_user)
):
    """벡터 메타데이터 조회 (관리자용)"""
    try:
        # SQLite에서 메타데이터 조회
        db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        
        if not os.path.exists(db_path):
            return {
                "metadata": [],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": 0,
                    "total_pages": 0
                }
            }
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 기본 쿼리
            base_query = """
                SELECT 
                    id, file_id, filename, category_id, category_name,
                    flow_id, processing_method, processing_time,
                    chunk_count, file_size, page_count, table_count,
                    image_count, docling_options, created_at, updated_at
                FROM vector_metadata
                WHERE 1=1
            """
            
            # 필터 조건 추가
            conditions = []
            params = []
            
            if search:
                conditions.append("filename LIKE ?")
                params.append(f"%{search}%")
            
            if category_id:
                conditions.append("category_id = ?")
                params.append(category_id)
            
            if processing_method:
                conditions.append("processing_method = ?")
                params.append(processing_method)
            
            if conditions:
                base_query += " AND " + " AND ".join(conditions)
            
            # 전체 개수 조회
            count_query = f"SELECT COUNT(*) FROM ({base_query}) as filtered"
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()[0]
            
            # 페이징 처리
            offset = (page - 1) * limit
            final_query = f"{base_query} ORDER BY updated_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor.execute(final_query, params)
            rows = cursor.fetchall()
            
            # 결과 포맷팅
            metadata = []
            for row in rows:
                item = dict(row)
                # Docling 옵션 파싱
                if item['docling_options']:
                    try:
                        item['docling_options'] = json.loads(item['docling_options'])
                    except json.JSONDecodeError:
                        item['docling_options'] = None
                metadata.append(item)
            
            return {
                "metadata": metadata,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "total_pages": (total_count + limit - 1) // limit
                },
                "filters": {
                    "search": search,
                    "category_id": category_id,
                    "processing_method": processing_method
                }
            }
    
    except Exception as e:
        _clog.error(f"벡터 메타데이터 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metadata/stats")
async def get_vector_metadata_stats(admin_user = Depends(get_admin_user)):
    """벡터 메타데이터 통계 조회"""
    try:
        db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        
        if not os.path.exists(db_path):
            return {
                "total_files": 0,
                "total_chunks": 0,
                "total_size": 0,
                "processing_methods": {},
                "categories": {},
                "avg_processing_time": 0,
                "recent_files": 0
            }
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 전체 통계
            cursor.execute("SELECT COUNT(*) as total_files FROM vector_metadata")
            total_files = cursor.fetchone()['total_files']
            
            cursor.execute("SELECT SUM(chunk_count) as total_chunks FROM vector_metadata")
            total_chunks = cursor.fetchone()['total_chunks'] or 0
            
            cursor.execute("SELECT SUM(file_size) as total_size FROM vector_metadata")
            total_size = cursor.fetchone()['total_size'] or 0
            
            cursor.execute("SELECT AVG(processing_time) as avg_time FROM vector_metadata")
            avg_processing_time = cursor.fetchone()['avg_time'] or 0
            
            # 처리 방법별 통계
            cursor.execute("""
                SELECT processing_method, COUNT(*) as count, AVG(processing_time) as avg_time
                FROM vector_metadata 
                GROUP BY processing_method
            """)
            processing_methods = {
                row['processing_method']: {
                    'count': row['count'],
                    'avg_processing_time': row['avg_time']
                }
                for row in cursor.fetchall()
            }
            
            # 카테고리별 통계
            cursor.execute("""
                SELECT category_name, COUNT(*) as count, SUM(chunk_count) as chunks
                FROM vector_metadata 
                WHERE category_name IS NOT NULL
                GROUP BY category_name
            """)
            categories = {
                row['category_name']: {
                    'count': row['count'],
                    'chunks': row['chunks']
                }
                for row in cursor.fetchall()
            }
            
            # 최근 24시간 파일
            cursor.execute("""
                SELECT COUNT(*) as recent_count 
                FROM vector_metadata 
                WHERE created_at >= datetime('now', '-1 day')
            """)
            recent_files = cursor.fetchone()['recent_count']
            
            return {
                "total_files": total_files,
                "total_chunks": total_chunks,
                "total_size": total_size,
                "processing_methods": processing_methods,
                "categories": categories,
                "avg_processing_time": round(avg_processing_time, 2),
                "recent_files": recent_files
            }
    
    except Exception as e:
        _clog.error(f"벡터 메타데이터 통계 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chromadb/collections")
async def get_chromadb_collections(admin_user = Depends(get_admin_user)):
    """ChromaDB 컬렉션 정보 조회"""
    try:
        # ChromaDB 클라이언트 초기화 확인
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        # 모든 컬렉션 조회
        collections = chroma_client.list_collections()
        
        collection_info = []
        for collection in collections:
            try:
                # 컬렉션 상세 정보
                coll = chroma_client.get_collection(collection.name)
                count = coll.count()
                
                # 메타데이터 샘플 조회 (최대 5개)
                sample_data = coll.get(limit=5, include=['metadatas', 'documents'])
                
                collection_info.append({
                    "name": collection.name,
                    "id": collection.id if hasattr(collection, 'id') else None,
                    "count": count,
                    "metadata": collection.metadata if hasattr(collection, 'metadata') else {},
                    "sample_metadatas": sample_data.get('metadatas', [])[:5] if sample_data else [],
                    "sample_documents": [doc[:200] + "..." if len(doc) > 200 else doc 
                                       for doc in sample_data.get('documents', [])[:3]] if sample_data else []
                })
            except Exception as e:
                collection_info.append({
                    "name": collection.name,
                    "id": getattr(collection, 'id', None),
                    "count": 0,
                    "error": str(e),
                    "metadata": {},
                    "sample_metadatas": [],
                    "sample_documents": []
                })
        
        return {
            "collections": collection_info,
            "total_collections": len(collections)
        }
    
    except Exception as e:
        _clog.error(f"ChromaDB 컬렉션 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chromadb/collection/{collection_name}")
async def get_chromadb_collection_data(
    collection_name: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    search: Optional[str] = Query(None, description="문서 내용 검색"),
    admin_user = Depends(get_admin_user)
):
    """특정 ChromaDB 컬렉션의 데이터 조회"""
    try:
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        try:
            collection = chroma_client.get_collection(collection_name)
        except Exception:
            raise HTTPException(status_code=404, detail=f"컬렉션 '{collection_name}'을 찾을 수 없습니다")
        
        # 전체 개수
        total_count = collection.count()
        
        # 페이징 처리
        offset = (page - 1) * limit
        
        # 데이터 조회
        if search:
            # 검색 쿼리
            results = collection.query(
                query_texts=[search],
                n_results=min(limit, total_count),
                include=['metadatas', 'documents', 'distances']
            )
            
            documents = []
            if results['documents'] and len(results['documents']) > 0:
                for i, doc in enumerate(results['documents'][0]):
                    documents.append({
                        "document": doc,
                        "metadata": results['metadatas'][0][i] if i < len(results['metadatas'][0]) else {},
                        "distance": results['distances'][0][i] if results['distances'] and i < len(results['distances'][0]) else None
                    })
        else:
            # 일반 조회
            results = collection.get(
                limit=limit,
                offset=offset,
                include=['metadatas', 'documents']
            )
            
            documents = []
            if results['documents']:
                for i, doc in enumerate(results['documents']):
                    documents.append({
                        "id": results['ids'][i] if i < len(results['ids']) else None,
                        "document": doc[:500] + "..." if len(doc) > 500 else doc,
                        "metadata": results['metadatas'][i] if i < len(results['metadatas']) else {},
                        "full_document_length": len(doc)
                    })
        
        return {
            "collection_name": collection_name,
            "documents": documents,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_pages": (total_count + limit - 1) // limit
            },
            "search": search
        }
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"ChromaDB 컬렉션 데이터 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_vectors(
    query: str = Query(..., description="검색 쿼리"),
    collection_name: Optional[str] = Query(None, description="대상 컬렉션"),
    top_k: int = Query(10, ge=1, le=100, description="반환할 결과 수"),
    admin_user = Depends(get_admin_user)
):
    """벡터 유사도 검색"""
    try:
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        # 컬렉션 선택
        if collection_name:
            try:
                collection = chroma_client.get_collection(collection_name)
                collections = [collection]
            except Exception:
                raise HTTPException(status_code=404, detail=f"컬렉션 '{collection_name}'을 찾을 수 없습니다")
        else:
            # 모든 컬렉션에서 검색
            all_collections = chroma_client.list_collections()
            collections = [chroma_client.get_collection(c.name) for c in all_collections]
        
        # 각 컬렉션에서 검색 수행
        all_results = []
        for collection in collections:
            try:
                results = collection.query(
                    query_texts=[query],
                    n_results=min(top_k, collection.count()),
                    include=['metadatas', 'documents', 'distances']
                )
                
                if results['documents'] and len(results['documents']) > 0:
                    for i, doc in enumerate(results['documents'][0]):
                        all_results.append({
                            "collection": collection.name,
                            "document": doc[:300] + "..." if len(doc) > 300 else doc,
                            "metadata": results['metadatas'][0][i] if i < len(results['metadatas'][0]) else {},
                            "distance": results['distances'][0][i] if results['distances'] and i < len(results['distances'][0]) else None,
                            "similarity": 1 - results['distances'][0][i] if results['distances'] and i < len(results['distances'][0]) else None
                        })
            except Exception as e:
                _clog.warning(f"컬렉션 {collection.name} 검색 실패: {e}")
                continue
        
        # 거리순 정렬 (가장 가까운 것부터)
        all_results.sort(key=lambda x: x['distance'] if x['distance'] is not None else float('inf'))
        
        return {
            "query": query,
            "results": all_results[:top_k],
            "total_results": len(all_results),
            "searched_collections": [c.name for c in collections]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"벡터 검색 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def sync_metadata_with_chromadb(admin_user = Depends(get_admin_user)):
    """메타데이터 DB와 ChromaDB 동기화"""
    try:
        # ChromaDB 클라이언트 초기화
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        # 동기화 결과 저장
        sync_results = {
            "updated_files": [],
            "orphaned_metadata": [],
            "orphaned_vectors": [],
            "errors": [],
            "summary": {}
        }
        
        # 1. 메타데이터 DB에서 모든 파일 조회
        metadata_db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        if not os.path.exists(metadata_db_path):
            raise HTTPException(status_code=404, detail="메타데이터 데이터베이스를 찾을 수 없습니다")
        
        with sqlite3.connect(metadata_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 모든 메타데이터 조회
            cursor.execute("SELECT * FROM vector_metadata")
            metadata_records = cursor.fetchall()
            
            # 2. ChromaDB에서 모든 벡터 조회
            collections = chroma_client.list_collections()
            actual_vectors = {}
            
            for collection in collections:
                try:
                    coll = chroma_client.get_collection(collection.name)
                    # 모든 벡터의 메타데이터 조회
                    all_data = coll.get(include=['metadatas'])
                    
                    # 파일별로 벡터 수 계산
                    if all_data and all_data.get('metadatas'):
                        for metadata in all_data['metadatas']:
                            file_id = metadata.get('file_id')
                            if file_id:
                                actual_vectors[file_id] = actual_vectors.get(file_id, 0) + 1
                
                except Exception as e:
                    sync_results["errors"].append(f"컬렉션 {collection.name} 조회 실패: {str(e)}")
            
            # 3. 메타데이터 동기화
            for record in metadata_records:
                file_id = record['file_id']
                recorded_chunks = record['chunk_count']
                actual_chunks = actual_vectors.get(file_id, 0)
                
                if actual_chunks != recorded_chunks:
                    # 메타데이터 업데이트
                    try:
                        cursor.execute(
                            "UPDATE vector_metadata SET chunk_count = ?, updated_at = ? WHERE file_id = ?",
                            (actual_chunks, datetime.now().isoformat(), file_id)
                        )
                        
                        sync_results["updated_files"].append({
                            "file_id": file_id,
                            "filename": record['filename'],
                            "recorded_chunks": recorded_chunks,
                            "actual_chunks": actual_chunks,
                            "difference": actual_chunks - recorded_chunks
                        })
                    except Exception as e:
                        sync_results["errors"].append(f"파일 {file_id} 업데이트 실패: {str(e)}")
                
                # 4. 고아 메타데이터 찾기 (ChromaDB에 벡터가 없는 메타데이터)
                if actual_chunks == 0:
                    sync_results["orphaned_metadata"].append({
                        "file_id": file_id,
                        "filename": record['filename'],
                        "recorded_chunks": recorded_chunks
                    })
            
            # 5. 고아 벡터 찾기 (메타데이터가 없는 ChromaDB 벡터)
            metadata_file_ids = {record['file_id'] for record in metadata_records}
            for file_id in actual_vectors:
                if file_id not in metadata_file_ids:
                    sync_results["orphaned_vectors"].append({
                        "file_id": file_id,
                        "chunk_count": actual_vectors[file_id]
                    })
            
            # 변경사항 저장
            conn.commit()
        
        # 6. 요약 정보 생성
        sync_results["summary"] = {
            "total_metadata_files": len(metadata_records),
            "total_chromadb_files": len(actual_vectors),
            "updated_files_count": len(sync_results["updated_files"]),
            "orphaned_metadata_count": len(sync_results["orphaned_metadata"]),
            "orphaned_vectors_count": len(sync_results["orphaned_vectors"]),
            "errors_count": len(sync_results["errors"]),
            "total_actual_vectors": sum(actual_vectors.values()),
            "sync_timestamp": datetime.now().isoformat()
        }
        
        return sync_results
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"동기화 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/status")
async def get_sync_status(admin_user = Depends(get_admin_user)):
    """동기화 상태 확인"""
    try:
        # ChromaDB 클라이언트 초기화
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            return {
                "chromadb_available": False,
                "metadata_db_available": False,
                "sync_needed": True,
                "message": "ChromaDB에 연결할 수 없습니다"
            }
        
        # 메타데이터 DB 확인
        metadata_db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        if not os.path.exists(metadata_db_path):
            return {
                "chromadb_available": True,
                "metadata_db_available": False,
                "sync_needed": True,
                "message": "메타데이터 데이터베이스를 찾을 수 없습니다"
            }
        
        # 빠른 상태 체크
        with sqlite3.connect(metadata_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*), SUM(chunk_count) FROM vector_metadata")
            metadata_files, metadata_chunks = cursor.fetchone()
        
        # ChromaDB 벡터 수 확인
        collections = chroma_client.list_collections()
        total_vectors = 0
        
        for collection in collections:
            try:
                coll = chroma_client.get_collection(collection.name)
                total_vectors += coll.count()
            except Exception:
                continue
        
        return {
            "chromadb_available": True,
            "metadata_db_available": True,
            "metadata_files": metadata_files or 0,
            "metadata_chunks": metadata_chunks or 0,
            "chromadb_vectors": total_vectors,
            "sync_needed": (metadata_chunks or 0) != total_vectors,
            "difference": (metadata_chunks or 0) - total_vectors,
            "message": f"메타데이터: {metadata_chunks or 0}개, ChromaDB: {total_vectors}개"
        }
    
    except Exception as e:
        _clog.error(f"동기화 상태 확인 오류: {e}")
        return {
            "chromadb_available": False,
            "metadata_db_available": False,
            "sync_needed": True,
            "error": str(e)
        }

@router.get("/cleanup/orphaned")
async def get_orphaned_metadata(admin_user = Depends(get_admin_user)):
    """청크가 0개인 고아 메타데이터 조회"""
    try:
        # 메타데이터 DB에서 청크가 0개인 파일들 조회
        metadata_db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        
        if not os.path.exists(metadata_db_path):
            raise HTTPException(status_code=404, detail="메타데이터 데이터베이스를 찾을 수 없습니다")
        
        orphaned_files = []
        with sqlite3.connect(metadata_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 청크가 0개인 메타데이터 조회
            cursor.execute("""
                SELECT id, file_id, filename, category_name, processing_method, 
                       chunk_count, file_size, created_at, updated_at
                FROM vector_metadata 
                WHERE chunk_count = 0 OR chunk_count IS NULL
                ORDER BY updated_at DESC
            """)
            
            rows = cursor.fetchall()
            for row in rows:
                orphaned_files.append({
                    "id": row['id'],
                    "file_id": row['file_id'],
                    "filename": row['filename'],
                    "category_name": row['category_name'],
                    "processing_method": row['processing_method'],
                    "chunk_count": row['chunk_count'] or 0,
                    "file_size": row['file_size'],
                    "created_at": row['created_at'],
                    "updated_at": row['updated_at']
                })
        
        return {
            "orphaned_files": orphaned_files,
            "total_count": len(orphaned_files)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"고아 메타데이터 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cleanup/orphaned")
async def cleanup_orphaned_metadata(admin_user = Depends(get_admin_user)):
    """청크가 0개인 고아 메타데이터 일괄 삭제"""
    try:
        metadata_db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        
        if not os.path.exists(metadata_db_path):
            raise HTTPException(status_code=404, detail="메타데이터 데이터베이스를 찾을 수 없습니다")
        
        deleted_files = []
        with sqlite3.connect(metadata_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 삭제할 파일 정보 먼저 조회
            cursor.execute("""
                SELECT file_id, filename FROM vector_metadata 
                WHERE chunk_count = 0 OR chunk_count IS NULL
            """)
            
            files_to_delete = cursor.fetchall()
            for file_info in files_to_delete:
                deleted_files.append({
                    "file_id": file_info['file_id'],
                    "filename": file_info['filename']
                })
            
            # 청크가 0개인 메타데이터 일괄 삭제
            cursor.execute("""
                DELETE FROM vector_metadata 
                WHERE chunk_count = 0 OR chunk_count IS NULL
            """)
            
            deleted_count = cursor.rowcount
            conn.commit()
        
        return {
            "message": f"{deleted_count}개의 고아 메타데이터가 삭제되었습니다",
            "deleted_count": deleted_count,
            "deleted_files": deleted_files
        }
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"고아 메타데이터 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/metadata/{file_id}")
async def delete_vector_metadata(
    file_id: str,
    admin_user = Depends(get_admin_user)
):
    """벡터 메타데이터 삭제"""
    try:
        success = metadata_service.delete_metadata(file_id)
        
        if success:
            return {"message": f"파일 {file_id}의 메타데이터가 삭제되었습니다"}
        else:
            raise HTTPException(status_code=404, detail="메타데이터를 찾을 수 없습니다")
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"벡터 메타데이터 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))