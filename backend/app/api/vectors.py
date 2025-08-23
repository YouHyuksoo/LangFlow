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
        db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        
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
        db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        
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
    category_id: Optional[str] = Query(None, description="카테고리 ID 필터"),
    category_name: Optional[str] = Query(None, description="카테고리명 필터"),
    filename: Optional[str] = Query(None, description="파일명 필터"),
    has_images: Optional[bool] = Query(None, description="이미지 존재 여부 필터"),
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
        
        # UUID 매핑용 데이터 준비
        file_id_to_name = {}
        category_id_to_name = {}
        
        # 통합 파일 메타데이터 DB에서 파일명과 카테고리명 매핑 조회
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'file_metadata.db')
        if os.path.exists(metadata_db_path):
            with sqlite3.connect(metadata_db_path) as conn:
                cursor = conn.cursor()
                # 파일 매핑
                cursor.execute("SELECT file_id, filename FROM file_metadata WHERE status != 'deleted'")
                for row in cursor.fetchall():
                    file_id_to_name[row[0]] = row[1]
                
                # 카테고리 매핑 (중복 제거)
                cursor.execute("SELECT DISTINCT category_id, category_name FROM file_metadata WHERE category_id IS NOT NULL AND category_name IS NOT NULL AND status != 'deleted'")
                for row in cursor.fetchall():
                    category_id_to_name[row[0]] = row[1]

        def enhance_metadata(metadata):
            """메타데이터에 실제 이름 추가하고 순서 정렬"""
            # 메타데이터 표시 순서 정의
            ordered_fields = [
                'filename', 'file_id', 'category_name', 'category_id', 
                'flow_id', 'chunk_index', 'vectorization_method', 
                'created_at', 'updated_at', 'processing_method'
            ]
            
            enhanced = {}
            
            # 파일명과 카테고리명 추가
            if 'file_id' in metadata and metadata['file_id'] in file_id_to_name:
                enhanced['filename'] = file_id_to_name[metadata['file_id']]
            if 'category_id' in metadata and metadata['category_id'] in category_id_to_name:
                enhanced['category_name'] = category_id_to_name[metadata['category_id']]
            
            # 정의된 순서대로 메타데이터 추가
            for field in ordered_fields:
                if field in metadata:
                    enhanced[field] = metadata[field]
                elif field in enhanced:
                    # filename, category_name은 이미 추가됨
                    continue
            
            # 정의되지 않은 나머지 필드들 추가 (알파벳 순)
            remaining_fields = sorted([k for k in metadata.keys() if k not in ordered_fields and k not in enhanced])
            for field in remaining_fields:
                enhanced[field] = metadata[field]
            
            return enhanced

        # 데이터 조회
        if search:
            # VectorService를 통한 검색 (1536차원 임베딩 사용)
            search_results = await vector_service.search_similar_chunks(
                query=search,
                top_k=min(limit, total_count),
                category_ids=None
            )
            
            documents = []
            for result in search_results:
                original_metadata = result.get('metadata', {})
                enhanced_metadata = enhance_metadata(original_metadata)
                
                documents.append({
                    "document": result['content'],
                    "metadata": enhanced_metadata,
                    "distance": 1 - result['similarity'] if result.get('similarity') else None
                })
        else:
            # 메타데이터 필터 조건 구성 (ChromaDB $and 연산자 사용)
            where_conditions = []
            
            # 카테고리 ID 필터
            if category_id:
                where_conditions.append({"category_id": {"$eq": category_id}})
            
            # 카테고리명 필터 (category_name을 category_id로 변환)
            if category_name:
                try:
                    from ..services.category_service import CategoryService
                    category_service = CategoryService()
                    all_categories = await category_service.list_categories()
                    category_id_for_name = None
                    for cat in all_categories:
                        if cat.name == category_name:
                            category_id_for_name = cat.category_id
                            break
                    
                    if category_id_for_name:
                        where_conditions.append({"category_id": {"$eq": category_id_for_name}})
                        _clog.info(f"카테고리 필터 적용: {category_name} -> category_id: {category_id_for_name}")
                    else:
                        _clog.warning(f"카테고리 '{category_name}'에 해당하는 ID를 찾을 수 없습니다.")
                except Exception as e:
                    _clog.error(f"카테고리 ID 조회 실패: {e}")
                    # 폴백으로 category_name 직접 사용 (작동하지 않을 가능성 높음)
                    where_conditions.append({"category_name": {"$eq": category_name}})
            
            # 파일명 필터 (부분 매칭을 위해 먼저 전체 조회 후 필터링)
            filename_filter = filename
            
            # 이미지 존재 여부 필터
            if has_images is not None:
                if has_images:
                    # 이미지가 존재하는 문서만
                    where_conditions.append({"has_images": {"$eq": True}})
                else:
                    # 이미지가 없는 문서만 (has_images가 False이거나 존재하지 않음)
                    pass  # ChromaDB에서 NOT 조건은 복잡하므로 후처리에서 필터링
            
            # 일반 조회 (필터 조건 적용)
            query_params = {
                "include": ['metadatas', 'documents']
            }
            
            # where 조건 설정 (조건이 있는 경우)
            if where_conditions:
                if len(where_conditions) == 1:
                    # 단일 조건인 경우 직접 사용
                    query_params["where"] = where_conditions[0]
                else:
                    # 여러 조건인 경우 $and 연산자 사용
                    query_params["where"] = {"$and": where_conditions}
                _clog.info(f"ChromaDB where 조건: {query_params['where']}")
            
            # 디버깅: 카테고리 필터 사용 시 샘플 데이터 확인
            if category_name:
                sample_data = collection.get(limit=5, include=['metadatas'])
                if sample_data.get('metadatas'):
                    sample_categories = [meta.get('category_name') for meta in sample_data['metadatas'][:3]]
                    _clog.info(f"ChromaDB 샘플 카테고리들: {sample_categories}")
                    _clog.info(f"요청된 카테고리: '{category_name}'")
            
            # 필터링된 전체 데이터 조회 (페이징을 위해 먼저 전체 개수 파악)
            if where_conditions or filename_filter or (has_images is False):
                # 필터링이 있는 경우 전체 조회 후 처리
                all_results = collection.get(**query_params)
                
                # 파일명 필터링 (부분 매칭)
                if filename_filter or (has_images is False):
                    filtered_docs = []
                    filtered_metadatas = []
                    
                    for i, metadata in enumerate(all_results.get('metadatas', [])):
                        # 파일명 매핑
                        file_id = metadata.get('file_id')
                        actual_filename = file_id_to_name.get(file_id, metadata.get('filename', ''))
                        
                        # 파일명 필터 체크
                        filename_match = True
                        if filename_filter:
                            filename_match = filename_filter.lower() in actual_filename.lower()
                        
                        # 이미지 존재 여부 필터 체크 (has_images=False인 경우)
                        images_match = True
                        if has_images is False:
                            has_img = metadata.get('has_images', False)
                            images_match = not has_img
                        
                        if filename_match and images_match:
                            filtered_docs.append(all_results['documents'][i])
                            filtered_metadatas.append(metadata)
                    
                    # 필터링된 결과로 교체
                    filtered_total = len(filtered_docs)
                    
                    # 페이징 적용
                    start_idx = offset
                    end_idx = offset + limit
                    
                    results = {
                        'documents': filtered_docs[start_idx:end_idx],
                        'metadatas': filtered_metadatas[start_idx:end_idx]
                    }
                    
                    # 전체 개수 업데이트
                    total_count = filtered_total
                else:
                    # 필터링 후 페이징
                    filtered_total = len(all_results.get('documents', []))
                    
                    # 페이징 적용
                    start_idx = offset
                    end_idx = offset + limit
                    
                    results = {
                        'documents': all_results['documents'][start_idx:end_idx],
                        'metadatas': all_results['metadatas'][start_idx:end_idx]
                    }
                    
                    total_count = filtered_total
            else:
                # 필터링이 없는 경우 기존 방식
                query_params.update({
                    "limit": limit,
                    "offset": offset
                })
                results = collection.get(**query_params)
            
            documents = []
            if results.get('documents'):
                # 문서 데이터를 정렬 가능한 형태로 먼저 수집
                temp_documents = []
                for i, doc in enumerate(results['documents']):
                    original_metadata = results['metadatas'][i] if i < len(results['metadatas']) else {}
                    enhanced_metadata = enhance_metadata(original_metadata)
                    
                    temp_documents.append({
                        "id": f"doc_{i}",  # ChromaDB에서 직접 ID를 가져올 수 없으므로 인덱스 기반으로 생성
                        "document": doc[:500] + "..." if len(doc) > 500 else doc,
                        "metadata": enhanced_metadata,
                        "full_document_length": len(doc)
                    })
                
                # 메타데이터 기준으로 정렬 (파일명 → 청크 인덱스 순)
                documents = sorted(temp_documents, key=lambda x: (
                    x['metadata'].get('filename', ''),
                    x['metadata'].get('chunk_index', 0),
                    x['metadata'].get('file_id', '')
                ))
        
        return {
            "collection_name": collection_name,
            "documents": documents,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_pages": (total_count + limit - 1) // limit
            },
            "filters": {
                "search": search,
                "category_id": category_id,
                "category_name": category_name,
                "filename": filename,
                "has_images": has_images
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"ChromaDB 컬렉션 데이터 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chromadb/categories")
async def get_chromadb_categories(admin_user = Depends(get_admin_user)):
    """ChromaDB에서 실제 사용되는 카테고리 목록 조회"""
    try:
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        # 모든 컬렉션에서 카테고리 정보 수집
        categories = set()
        
        # 먼저 모든 카테고리를 조회해서 ID -> 이름 매핑 생성
        try:
            from ..services.category_service import CategoryService
            category_service = CategoryService()
            all_categories = await category_service.list_categories()
            category_map = {cat.category_id: cat.name for cat in all_categories}
            _clog.info(f"카테고리 매핑: {category_map}")
        except Exception as e:
            _clog.warning(f"카테고리 매핑 생성 실패: {e}")
            category_map = {}
        
        try:
            collections = chroma_client.list_collections()
            _clog.info(f"ChromaDB 컬렉션 개수: {len(collections)}")
            
            for collection_info in collections:
                try:
                    collection = chroma_client.get_collection(collection_info.name)
                    # 샘플 메타데이터 조회 (카테고리 정보 추출용)
                    sample_data = collection.get(limit=100, include=['metadatas'])
                    _clog.info(f"컬렉션 {collection_info.name}: {len(sample_data.get('metadatas', []))}개 메타데이터")
                    
                    if sample_data.get('metadatas'):
                        for i, metadata in enumerate(sample_data['metadatas'][:3]):  # 처음 3개만 로그
                            _clog.info(f"메타데이터 샘플 {i+1}: {metadata}")
                            
                            # category_name이 있으면 사용, 없으면 category_id로 매핑에서 조회
                            category_name = metadata.get('category_name')
                            if not category_name:
                                category_id = metadata.get('category_id')
                                if category_id and category_id in category_map:
                                    category_name = category_map[category_id]
                                    _clog.info(f"category_id {category_id}에서 카테고리명 매핑: {category_name}")
                            
                            if category_name:
                                categories.add(category_name)
                                _clog.info(f"카테고리 추가: {category_name}")
                except Exception as e:
                    _clog.warning(f"컬렉션 {collection_info.name} 카테고리 조회 실패: {e}")
                    continue
        except Exception as e:
            _clog.error(f"ChromaDB 카테고리 조회 오류: {e}")
            
        _clog.info(f"수집된 카테고리: {sorted(list(categories))}")
        return {
            "categories": sorted(list(categories))
        }
    
    except Exception as e:
        _clog.error(f"ChromaDB 카테고리 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_vectors(
    query: str = Query(..., description="검색 쿼리"),
    top_k: int = Query(10, ge=1, le=100, description="반환할 결과 수"),
    admin_user = Depends(get_admin_user)
):
    """벡터 유사도 검색"""
    try:
        # VectorService 초기화 확인
        await vector_service._ensure_client()
        if not vector_service._client:
            raise HTTPException(status_code=503, detail="벡터 서비스에 연결할 수 없습니다")
        
        # UUID 매핑용 데이터 준비 (검색용)
        file_id_to_name = {}
        category_id_to_name = {}
        
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        if os.path.exists(metadata_db_path):
            with sqlite3.connect(metadata_db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT file_id, filename FROM vector_metadata")
                for row in cursor.fetchall():
                    file_id_to_name[row[0]] = row[1]
                
                cursor.execute("SELECT DISTINCT category_id, category_name FROM vector_metadata WHERE category_id IS NOT NULL AND category_name IS NOT NULL")
                for row in cursor.fetchall():
                    category_id_to_name[row[0]] = row[1]

        def enhance_search_metadata(metadata):
            """검색 결과 메타데이터에 실제 이름 추가"""
            enhanced = metadata.copy()
            if 'file_id' in metadata and metadata['file_id'] in file_id_to_name:
                enhanced['filename'] = file_id_to_name[metadata['file_id']]
            if 'category_id' in metadata and metadata['category_id'] in category_id_to_name:
                enhanced['category_name'] = category_id_to_name[metadata['category_id']]
            return enhanced

        # VectorService를 통한 검색 수행 (384차원 임베딩 사용)
        all_results = []
        
        # VectorService의 search_similar_chunks 메서드 사용
        search_results = await vector_service.search_similar_chunks(
            query=query,
            top_k=top_k,
            category_ids=None
        )
        
        for result in search_results:
            original_metadata = result.get('metadata', {})
            enhanced_metadata = enhance_search_metadata(original_metadata)
            
            all_results.append({
                "collection": "default",  # VectorService는 기본 컬렉션 사용
                "document": result['content'][:300] + "..." if len(result['content']) > 300 else result['content'],
                "metadata": enhanced_metadata,
                "distance": 1 - result['similarity'] if result.get('similarity') else None,
                "similarity": result.get('similarity', 0),
                "has_images": result.get('has_images', False),
                "related_images": result.get('related_images', []),
                "image_count": result.get('image_count', 0)
            })
        
        # 거리순 정렬 (가장 가까운 것부터)
        all_results.sort(key=lambda x: x['distance'] if x['distance'] is not None else float('inf'))
        
        return {
            "query": query,
            "results": all_results[:top_k],
            "total_results": len(all_results),
            "search_method": "VectorService"
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
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
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
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
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
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        
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
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        
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

@router.delete("/collections/all")
async def delete_all_collections(admin_user = Depends(get_admin_user)):
    """ChromaDB 모든 컬렉션 삭제"""
    try:
        # ChromaDB에서 모든 컬렉션 삭제
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        deleted_collections = []
        try:
            collections = chroma_client.list_collections()
            for collection in collections:
                try:
                    chroma_client.delete_collection(collection.name)
                    deleted_collections.append(collection.name)
                    _clog.info(f"컬렉션 '{collection.name}' 삭제 완료")
                except Exception as e:
                    _clog.warning(f"컬렉션 {collection.name} 삭제 실패: {e}")
        except Exception as e:
            _clog.error(f"ChromaDB 컬렉션 목록 조회 오류: {e}")
            raise HTTPException(status_code=500, detail=f"컬렉션 목록 조회 실패: {str(e)}")
        
        return {
            "status": "success",
            "message": f"{len(deleted_collections)}개의 컬렉션이 삭제되었습니다",
            "deleted_collections": deleted_collections,
            "deleted_count": len(deleted_collections),
            "deleted_at": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"컬렉션 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=f"컬렉션 삭제 중 오류가 발생했습니다: {str(e)}")

@router.delete("/collections/selected")
async def delete_selected_collections(
    request_data: Dict[str, List[str]], 
    admin_user = Depends(get_admin_user)
):
    """ChromaDB 선택된 컬렉션들 삭제"""
    try:
        collection_names = request_data.get("collection_names", [])
        
        if not collection_names:
            raise HTTPException(status_code=400, detail="삭제할 컬렉션을 선택해주세요")
        
        # ChromaDB에서 선택된 컬렉션들 삭제
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        deleted_collections = []
        failed_collections = []
        
        for collection_name in collection_names:
            try:
                chroma_client.delete_collection(collection_name)
                deleted_collections.append(collection_name)
                _clog.info(f"컬렉션 '{collection_name}' 삭제 완료")
            except Exception as e:
                failed_collections.append({"name": collection_name, "error": str(e)})
                _clog.warning(f"컬렉션 {collection_name} 삭제 실패: {e}")
        
        result = {
            "status": "success" if len(deleted_collections) > 0 else "failed",
            "message": f"{len(deleted_collections)}개의 컬렉션이 삭제되었습니다",
            "deleted_collections": deleted_collections,
            "deleted_count": len(deleted_collections),
            "deleted_at": datetime.now().isoformat()
        }
        
        if failed_collections:
            result["failed_collections"] = failed_collections
            result["failed_count"] = len(failed_collections)
            result["message"] += f" ({len(failed_collections)}개 실패)"
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"선택된 컬렉션 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=f"컬렉션 삭제 중 오류가 발생했습니다: {str(e)}")

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

@router.post("/metadata/reset")
async def reset_vector_metadata_db(admin_user = Depends(get_admin_user)):
    """벡터 메타데이터 SQLite 데이터베이스 완전 초기화"""
    try:
        # 가능한 연결 잠금을 줄이기 위해 GC 유도 및 지연
        import gc, time
        try:
            # VectorService가 보유한 메타데이터 서비스도 해제 시도
            if hasattr(vector_service, 'metadata_service') and vector_service.metadata_service:
                try:
                    vector_service.metadata_service.engine.dispose()
                except Exception:
                    pass
        except Exception:
            pass
        gc.collect()
        time.sleep(0.1)

        success = metadata_service.reset_database()
        if success:
            return {"message": "메타데이터 데이터베이스가 초기화되었습니다.", "status": "success"}
        else:
            raise HTTPException(status_code=500, detail="메타데이터 데이터베이스 초기화에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"메타데이터 DB 초기화 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === 데이터베이스 관리 API 엔드포인트 ===

@router.get("/database/settings")
async def get_database_settings(admin_user = Depends(get_admin_user)):
    """데이터베이스 설정 및 상태 조회"""
    try:
        from ..services.settings_service import settings_service
        
        # --- 실제 DB 상태 조회 ---
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        available_collections = []
        if chroma_client:
            try:
                collections = chroma_client.list_collections()
                available_collections = [c.name for c in collections]
            except Exception as e:
                _clog.warning(f"ChromaDB 컬렉션 목록 조회 실패: {e}")

        # --- 설정 파일 기반 정보 조회 ---
        system_settings = settings_service.get_section_settings("system")
        
        # 활성 컬렉션 결정 (설정값 -> 사용 가능한 첫번째 컬렉션 -> 기본값)
        active_collection = system_settings.get("chromadbCollectionName")
        if not active_collection and available_collections:
            active_collection = available_collections[0]
        elif not active_collection:
            active_collection = "langflow_vectors" # 최후의 보루

        db_settings = {
            "db_type": "local",
            "db_path": vector_service.vector_dir,
            "active_collection": active_collection,
            "available_collections": available_collections,
            
            # 기존 설정들은 유지 (UI 재구성에 따라 일부는 사용되지 않을 수 있음)
            "chromadb_collection_name": active_collection, # 호환성을 위해 유지
            "vectorDimension": system_settings.get("vectorDimension", 1536),
            "similarity_threshold": system_settings.get("similarityThreshold", 0.7),
            "max_results": system_settings.get("maxResults", 10),
        }
        
        return db_settings
    
    except Exception as e:
        _clog.error(f"데이터베이스 설정 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 설정을 불러오는 중 오류가 발생했습니다: {str(e)}")

@router.post("/database/settings")
async def update_database_settings(settings_data: Dict[str, Any], admin_user = Depends(get_admin_user)):
    """데이터베이스 설정 업데이트 (활성 컬렉션 변경)"""
    try:
        from ..services.settings_service import settings_service
        
        collection_name = settings_data.get("active_collection")
        
        if not collection_name:
            raise HTTPException(status_code=400, detail="활성화할 컬렉션 이름이 필요합니다.")

        # 시스템 설정에서 컬렉션 이름만 업데이트
        settings_service.update_section_settings(
            "system", 
            {"chromadbCollectionName": collection_name}
        )
        
        # 현재 실행중인 VectorService가 즉시 새 컬렉션을 사용하도록 강제 재연결
        if vector_service._client:
            try:
                await vector_service._connect_to_chromadb()
                _clog.info(f"VectorService가 새 컬렉션 '{collection_name}'(으)로 재연결되었습니다.")
            except Exception as e:
                _clog.error(f"VectorService 컬렉션 재연결 실패: {e}")

        return {"message": f"활성 컬렉션이 '{collection_name}'(으)로 변경되었습니다.", "status": "success"}
    
    except Exception as e:
        _clog.error(f"데이터베이스 설정 업데이트 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 설정 업데이트 중 오류가 발생했습니다: {str(e)}")

@router.get("/database/stats")
async def get_database_stats(admin_user = Depends(get_admin_user)):
    """데이터베이스 통계 조회"""
    try:
        # ChromaDB 연결 및 통계 수집
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        stats = {
            "total_documents": 0,
            "total_chunks": 0,
            "database_size_mb": 0.0,
            "index_size_mb": 0.0,
            "last_backup": "",
            "collection_status": "unknown",
            "health_status": "unknown"
        }
        
        if chroma_client:
            try:
                # 컬렉션 정보 수집
                collections = chroma_client.list_collections()
                total_vectors = 0
                
                for collection in collections:
                    try:
                        coll = chroma_client.get_collection(collection.name)
                        total_vectors += coll.count()
                    except Exception:
                        continue
                
                stats["total_chunks"] = total_vectors
                stats["collection_status"] = "active" if len(collections) > 0 else "inactive"
                stats["health_status"] = "healthy"
                
            except Exception as e:
                _clog.warning(f"ChromaDB 통계 수집 실패: {e}")
                stats["health_status"] = "error"
        
        # 메타데이터 DB에서 문서 수 조회
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        if os.path.exists(metadata_db_path):
            try:
                with sqlite3.connect(metadata_db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*) FROM vector_metadata")
                    stats["total_documents"] = cursor.fetchone()[0]
                    
                    # 데이터베이스 파일 크기 계산
                    import os
                    file_size = os.path.getsize(metadata_db_path)
                    stats["database_size_mb"] = file_size / (1024 * 1024)
                    
            except Exception as e:
                _clog.warning(f"메타데이터 DB 통계 수집 실패: {e}")
        
        return stats
    
    except Exception as e:
        _clog.error(f"데이터베이스 통계 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 통계 조회 중 오류가 발생했습니다: {str(e)}")

@router.post("/database/test")
async def test_database_connection(admin_user = Depends(get_admin_user)):
    """데이터베이스 연결 테스트"""
    try:
        # ChromaDB 연결 테스트
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        if not chroma_client:
            raise HTTPException(status_code=503, detail="ChromaDB에 연결할 수 없습니다")
        
        # 간단한 작업으로 연결 확인
        collections = chroma_client.list_collections()
        
        return {
            "status": "success",
            "message": "데이터베이스 연결 테스트가 성공했습니다",
            "collections_count": len(collections),
            "collections": [c.name for c in collections]
        }
    
    except Exception as e:
        _clog.error(f"데이터베이스 연결 테스트 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 연결 테스트 실패: {str(e)}")

@router.post("/database/backup")
async def create_database_backup(admin_user = Depends(get_admin_user)):
    """데이터베이스 백업 생성"""
    try:
        # 백업 디렉토리 생성
        backup_dir = os.path.join(settings.DATA_DIR, "backups", "vector_db")
        os.makedirs(backup_dir, exist_ok=True)
        
        # 백업 파일명 (타임스탬프 포함)
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"vector_backup_{timestamp}.db"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # 메타데이터 DB 백업 (SQLite 파일 복사)
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        if os.path.exists(metadata_db_path):
            import shutil
            shutil.copy2(metadata_db_path, backup_path)
        
        return {
            "status": "success", 
            "message": "데이터베이스 백업이 완료되었습니다",
            "backup_file": backup_filename,
            "backup_path": backup_path,
            "created_at": datetime.now().isoformat()
        }
    
    except Exception as e:
        _clog.error(f"데이터베이스 백업 생성 오류: {e}")
        raise HTTPException(status_code=500, detail=f"백업 생성 중 오류가 발생했습니다: {str(e)}")

@router.post("/database/optimize")
async def optimize_database(admin_user = Depends(get_admin_user)):
    """데이터베이스 최적화"""
    try:
        # 메타데이터 SQLite DB 최적화
        metadata_db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
        if os.path.exists(metadata_db_path):
            with sqlite3.connect(metadata_db_path) as conn:
                conn.execute("VACUUM")
                conn.execute("REINDEX")
        
        return {
            "status": "success",
            "message": "데이터베이스 최적화가 완료되었습니다",
            "optimized_at": datetime.now().isoformat()
        }
    
    except Exception as e:
        _clog.error(f"데이터베이스 최적화 오류: {e}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 최적화 중 오류가 발생했습니다: {str(e)}")

@router.delete("/database/all-vectors")
async def delete_all_vectors(admin_user = Depends(get_admin_user)):
    """모든 벡터 데이터 삭제"""
    try:
        # ChromaDB에서 모든 컬렉션 삭제
        await vector_service._ensure_client()
        chroma_client = vector_service._client
        
        deleted_collections = []
        if chroma_client:
            try:
                collections = chroma_client.list_collections()
                for collection in collections:
                    try:
                        chroma_client.delete_collection(collection.name)
                        deleted_collections.append(collection.name)
                    except Exception as e:
                        _clog.warning(f"컬렉션 {collection.name} 삭제 실패: {e}")
            except Exception as e:
                _clog.error(f"ChromaDB 컬렉션 삭제 오류: {e}")
        
        # 메타데이터 DB 초기화
        success = metadata_service.reset_database()
        
        return {
            "status": "success",
            "message": "모든 벡터 데이터가 삭제되었습니다",
            "deleted_collections": deleted_collections,
            "metadata_reset": success,
            "deleted_at": datetime.now().isoformat()
        }
    
    except Exception as e:
        _clog.error(f"벡터 데이터 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=f"벡터 데이터 삭제 중 오류가 발생했습니다: {str(e)}")

@router.delete("/documents/{file_id}")
async def delete_document(
    file_id: str,
    admin_user = Depends(get_admin_user)
):
    """개별 문서(파일) 삭제 - 파일 데이터와 벡터 데이터 모두 삭제"""
    try:
        from ..services.file_service import FileService
        
        file_service = FileService()
        
        # 파일 정보 조회
        file_info = await file_service.get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
        
        # 파일 삭제 (물리 파일 + 메타데이터 + 벡터 데이터)
        success = await file_service.delete_file(file_id)
        
        if success:
            _clog.info(f"문서 삭제 완료: {file_id} ({file_info.filename})")
            return {
                "status": "success",
                "message": f"문서 '{file_info.filename}'이 성공적으로 삭제되었습니다",
                "file_id": file_id,
                "filename": file_info.filename,
                "deleted_at": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="문서 삭제에 실패했습니다")
        
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"문서 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=f"문서 삭제 중 오류가 발생했습니다: {str(e)}")

@router.get("/documents")
async def get_documents_list(
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    search: Optional[str] = Query(None, description="파일명 검색"),
    category_id: Optional[str] = Query(None, description="카테고리 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    admin_user = Depends(get_admin_user)
):
    """문서 목록 조회 (관리자용)"""
    try:
        from ..services.file_service import FileService
        from ..models.vector_models import file_metadata_service
        
        # 필터 조건에 따라 파일 조회
        if status == "deleted":
            files = file_metadata_service.list_files(include_deleted=True, limit=None)
            files = [f for f in files if f.status.value == "deleted"]
        else:
            files = file_metadata_service.list_files(
                category_id=category_id,
                include_deleted=False,
                limit=None
            )
            
        # 검색 필터 적용
        if search:
            files = [f for f in files if search.lower() in f.filename.lower()]
        
        # 상태 필터 적용
        if status and status != "deleted":
            files = [f for f in files if f.status.value == status]
        
        # 페이징 처리
        total_count = len(files)
        offset = (page - 1) * limit
        paginated_files = files[offset:offset + limit]
        
        # 응답 형식으로 변환
        documents = []
        for file_metadata in paginated_files:
            documents.append({
                "file_id": file_metadata.file_id,
                "filename": file_metadata.filename,
                "category_id": file_metadata.category_id,
                "category_name": file_metadata.category_name,
                "status": file_metadata.status.value,
                "vectorized": file_metadata.vectorized,
                "file_size": file_metadata.file_size,
                "chunk_count": file_metadata.chunk_count,
                "upload_time": file_metadata.upload_time.isoformat() if file_metadata.upload_time else None,
                "preprocessing_method": file_metadata.preprocessing_method,
                "error_message": file_metadata.error_message
            })
        
        return {
            "documents": documents,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_pages": (total_count + limit - 1) // limit
            },
            "filters": {
                "search": search,
                "category_id": category_id,
                "status": status
            }
        }
        
    except Exception as e:
        _clog.error(f"문서 목록 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"문서 목록 조회 중 오류가 발생했습니다: {str(e)}")

@router.delete("/documents/selected")
async def delete_selected_documents(
    request_data: Dict[str, Any],
    admin_user = Depends(get_admin_user)
):
    """선택된 문서들 일괄 삭제"""
    try:
        file_ids = request_data.get("file_ids", [])
        if not file_ids:
            raise HTTPException(status_code=400, detail="삭제할 문서를 선택해주세요")
        
        from ..services.file_service import FileService
        file_service = FileService()
        
        deleted_files = []
        failed_files = []
        
        for file_id in file_ids:
            try:
                # 파일 정보 조회
                file_info = await file_service.get_file_info(file_id)
                if not file_info:
                    failed_files.append({"file_id": file_id, "reason": "파일을 찾을 수 없음"})
                    continue
                
                # 파일 삭제
                success = await file_service.delete_file(file_id)
                if success:
                    deleted_files.append({
                        "file_id": file_id,
                        "filename": file_info.filename
                    })
                    _clog.info(f"문서 삭제 완료: {file_id} ({file_info.filename})")
                else:
                    failed_files.append({"file_id": file_id, "filename": file_info.filename, "reason": "삭제 실패"})
            except Exception as e:
                failed_files.append({"file_id": file_id, "reason": str(e)})
        
        return {
            "status": "success" if len(deleted_files) > 0 else "failed",
            "message": f"{len(deleted_files)}개 문서가 삭제되었습니다",
            "deleted_files": deleted_files,
            "failed_files": failed_files,
            "deleted_count": len(deleted_files),
            "failed_count": len(failed_files),
            "deleted_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"선택된 문서 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail=f"문서 삭제 중 오류가 발생했습니다: {str(e)}")

@router.get("/status")
async def get_vector_status():
    """벡터 서비스 상태 조회 (통합 엔드포인트)"""
    try:
        status = await vector_service.get_status()
        return status
    except Exception as e:
        _clog.error(f"벡터 상태 조회 실패: {e}")
        return {
            "connected": False,
            "total_vectors": 0,
            "collection_count": 0,
            "collections": [],
            "error": str(e)
        }