import uuid
import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from ..models.schemas import Category, CategoryRequest
from ..core.config import settings

class CategoryService:
    def __init__(self):
        self.categories_file = os.path.join(settings.DATA_DIR, "categories.json")
        self._ensure_data_dir()
        self._load_categories()
        self._initialize_default_categories()
    
    def _ensure_data_dir(self):
        """데이터 디렉토리 생성"""
        data_dir = settings.DATA_DIR
        os.makedirs(data_dir, exist_ok=True)
    
    def _load_categories(self):
        """카테고리 데이터 로드"""
        if os.path.exists(self.categories_file):
            try:
                with open(self.categories_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # categories.json의 구조에 맞게 데이터 변환
                    if isinstance(data, dict):
                        # 이미 올바른 형식인 경우
                        self.categories = data
                    else:
                        # 리스트 형태인 경우 딕셔너리로 변환
                        self.categories = {}
                        for item in data:
                            if isinstance(item, dict) and 'category_id' in item:
                                self.categories[item['category_id']] = item
            except Exception as e:
                # 간소화: 상세 디버그 제거
                print(f"카테고리 데이터 로드 오류: {str(e)}")
                self.categories = {}
        else:
            # 과한 디버그 제거
            self.categories = {}
    
    def _save_categories(self):
        """카테고리 데이터 저장"""
        try:
            with open(self.categories_file, 'w', encoding='utf-8') as f:
                json.dump(self.categories, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            print(f"카테고리 데이터 저장 중 오류: {str(e)}")
    
    def _initialize_default_categories(self):
        """기본 카테고리 초기화"""
        # categories.json 파일이 이미 존재하고 데이터가 있으면 초기화하지 않음
        if not self.categories and not os.path.exists(self.categories_file):
            default_categories = [
                {
                    "name": "품질",
                    "description": "품질관리, 검사, ISO 인증 등",
                    "icon": "Target",
                    "color": "bg-red-500"
                },
                {
                    "name": "인사",
                    "description": "인사정책, 채용, 교육 등",
                    "icon": "Users",
                    "color": "bg-blue-500"
                },
                {
                    "name": "제조",
                    "description": "생산공정, 설비관리, 작업지시 등",
                    "icon": "Factory",
                    "color": "bg-green-500"
                },
                {
                    "name": "기술",
                    "description": "R&D, 기술개발, 특허 등",
                    "icon": "Code",
                    "color": "bg-purple-500"
                },
                {
                    "name": "영업",
                    "description": "영업정책, 고객관리, 계약 등",
                    "icon": "TrendingUp",
                    "color": "bg-orange-500"
                },
                {
                    "name": "물류",
                    "description": "물류관리, 재고, 운송 등",
                    "icon": "Truck",
                    "color": "bg-yellow-500"
                },
                {
                    "name": "총무",
                    "description": "행정업무, 법무, 보안 등",
                    "icon": "Briefcase",
                    "color": "bg-gray-500"
                },
                {
                    "name": "MES",
                    "description": "제조실행시스템, 생산관리 등",
                    "icon": "Settings",
                    "color": "bg-indigo-500"
                }
            ]
            
            for category_data in default_categories:
                category_id = str(uuid.uuid4())
                now = datetime.now()
                
                self.categories[category_id] = {
                    "category_id": category_id,
                    "name": category_data["name"],
                    "description": category_data["description"],
                    "icon": category_data["icon"],
                    "color": category_data["color"],
                    "created_at": now,
                    "updated_at": now
                }
            
            self._save_categories()
    
    async def create_category(self, request: CategoryRequest) -> Category:
        """새 카테고리 생성"""
        try:
            category_id = str(uuid.uuid4())
            now = datetime.now()
            
            category_data = {
                "category_id": category_id,
                "name": request.name,
                "description": request.description,
                "icon": getattr(request, 'icon', 'FileText'),
                "color": getattr(request, 'color', 'bg-gray-500'),
                "created_at": now,
                "updated_at": now
            }
            
            self.categories[category_id] = category_data
            self._save_categories()
            
            return Category(**category_data)
            
        except Exception as e:
            raise Exception(f"카테고리 생성 중 오류가 발생했습니다: {str(e)}")
    
    async def get_category(self, category_id: str) -> Optional[Category]:
        """카테고리 조회"""
        try:
            category_data = self.categories.get(category_id)
            if category_data:
                return Category(**category_data)
            return None
        except Exception as e:
            print(f"카테고리 조회 오류: {str(e)}")
            return None
    
    async def list_categories(self) -> List[Category]:
        """모든 카테고리 목록 조회"""
        try:
            categories = []
            
            # 파일 메타데이터를 직접 읽어서 문서 수 계산 (ChromaDB 의존성 제거)
            try:
                files_metadata_file = os.path.join(settings.DATA_DIR, "files_metadata.json")
                category_document_counts = {}
                
                if os.path.exists(files_metadata_file):
                    with open(files_metadata_file, 'r', encoding='utf-8') as f:
                        files_metadata = json.load(f)
                    
                    # files_metadata가 딕셔너리인지 확인
                    if isinstance(files_metadata, dict):
                        for file_id, file_info in files_metadata.items():
                            category_id = file_info.get('category_id')
                            if category_id:
                                category_document_counts[category_id] = category_document_counts.get(category_id, 0) + 1
                    elif isinstance(files_metadata, list):
                        # 리스트인 경우 빈 딕셔너리로 처리
                        pass
                    else:
                        # 타입 경고만 억제
                        pass
                    
            except Exception as e:
                print(f"파일 메타데이터 로드 오류: {str(e)}")
                category_document_counts = {}
            
            # 디버그 출력 제거
            for category_data in self.categories.values():
                try:
                    # 문서 수 추가
                    category_data_with_count = category_data.copy()
                    category_id = category_data["category_id"]
                    document_count = category_document_counts.get(category_id, 0)
                    category_data_with_count["document_count"] = document_count
                    # 상세 디버그 제거
                    
                    # datetime 문자열을 datetime 객체로 변환
                    if isinstance(category_data_with_count.get("created_at"), str):
                        category_data_with_count["created_at"] = datetime.fromisoformat(category_data_with_count["created_at"])
                    if isinstance(category_data_with_count.get("updated_at"), str):
                        category_data_with_count["updated_at"] = datetime.fromisoformat(category_data_with_count["updated_at"])
                    
                    category = Category(**category_data_with_count)
                    categories.append(category)
                except Exception as e:
                    print(f"카테고리 데이터 변환 오류: {str(e)}")
                    continue
            
            # 이름 순으로 정렬
            categories.sort(key=lambda x: x.name)
            return categories
            
        except Exception as e:
            print(f"카테고리 목록 조회 오류: {str(e)}")
            return []
    
    async def update_category(self, category_id: str, request: CategoryRequest) -> Optional[Category]:
        """카테고리 업데이트"""
        try:
            if category_id not in self.categories:
                return None
            
            category_data = self.categories[category_id]
            category_data.update({
                "name": request.name,
                "description": request.description,
                "icon": getattr(request, 'icon', category_data.get('icon', 'FileText')),
                "color": getattr(request, 'color', category_data.get('color', 'bg-gray-500')),
                "updated_at": datetime.now()
            })
            
            self.categories[category_id] = category_data
            self._save_categories()
            
            return Category(**category_data)
            
        except Exception as e:
            print(f"카테고리 업데이트 중 오류: {str(e)}")
            return None
    
    async def delete_category(self, category_id: str) -> bool:
        """카테고리 삭제"""
        try:
            if category_id not in self.categories:
                return False
            
            # TODO: 해당 카테고리에 속한 파일들의 category_id를 null로 변경
            del self.categories[category_id]
            self._save_categories()
            
            return True
            
        except Exception as e:
            print(f"카테고리 삭제 중 오류: {str(e)}")
            return False
    
    async def get_category_by_name(self, name: str) -> Optional[Category]:
        """이름으로 카테고리 검색"""
        try:
            for category_data in self.categories.values():
                if category_data["name"] == name:
                    return Category(**category_data)
            return None
        except Exception as e:
            print(f"카테고리 이름 검색 중 오류: {str(e)}")
            return None
    
    async def get_categories_by_ids(self, category_ids: List[str]) -> List[Category]:
        """ID 목록으로 카테고리 목록 조회"""
        try:
            categories = []
            for category_id in category_ids:
                category_data = self.categories.get(category_id)
                if category_data:
                    categories.append(Category(**category_data))
            return categories
        except Exception as e:
            print(f"카테고리 ID 목록 조회 중 오류: {str(e)}")
            return []
    
    async def get_category_stats(self) -> Dict[str, Any]:
        """카테고리별 통계 정보"""
        try:
            # 파일 메타데이터를 직접 읽어서 문서 수 계산 (ChromaDB 오류 방지)
            try:
                files_metadata_file = os.path.join(settings.DATA_DIR, "files_metadata.json")
                category_document_counts = {}
                
                if os.path.exists(files_metadata_file):
                    with open(files_metadata_file, 'r', encoding='utf-8') as f:
                        files_metadata = json.load(f)
                    
                    for file_id, file_info in files_metadata.items():
                        category_id = file_info.get('category_id')
                        if category_id:
                            category_document_counts[category_id] = category_document_counts.get(category_id, 0) + 1
                else:
                    print("파일 메타데이터 파일이 존재하지 않습니다.")
                    
            except Exception as e:
                print(f"파일 메타데이터 로드 중 오류: {str(e)}")
                category_document_counts = {}
            
            stats = {}
            for category_id, category_data in self.categories.items():
                stats[category_id] = {
                    "name": category_data["name"],
                    "document_count": category_document_counts.get(category_id, 0),
                    "icon": category_data.get("icon", "FileText"),
                    "color": category_data.get("color", "bg-gray-500")
                }
            return stats
        except Exception as e:
            print(f"카테고리 통계 조회 중 오류: {str(e)}")
            return {}