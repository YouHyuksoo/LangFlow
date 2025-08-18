"""
JSON 파일 메타데이터를 SQLite로 마이그레이션하는 스크립트
"""
import os
import json
import sys
from datetime import datetime
from typing import Dict, Any

# 프로젝트 루트를 sys.path에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.models.vector_models import FileMetadata, FileMetadataService, FileStatus
from app.core.config import settings

class DataMigrator:
    def __init__(self):
        self.file_metadata_service = FileMetadataService()
        self.json_file_path = os.path.join(settings.DATA_DIR, 'files_metadata.json')
        
    def load_json_metadata(self) -> Dict[str, Any]:
        """기존 JSON 파일에서 메타데이터 로드"""
        if not os.path.exists(self.json_file_path):
            print(f"JSON 파일을 찾을 수 없습니다: {self.json_file_path}")
            return {}
        
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"JSON 파일 로드 실패: {e}")
            return {}
    
    def convert_status(self, old_status: str) -> FileStatus:
        """기존 상태를 새 FileStatus로 변환"""
        status_mapping = {
            "uploaded": FileStatus.UPLOADED,
            "preprocessing": FileStatus.PREPROCESSING,
            "preprocessed": FileStatus.PREPROCESSED,
            "vectorizing": FileStatus.VECTORIZING,
            "completed": FileStatus.COMPLETED,
            "failed": FileStatus.FAILED,
            "deleted": FileStatus.DELETED
        }
        return status_mapping.get(old_status, FileStatus.UPLOADED)
    
    def parse_datetime(self, date_str: str) -> datetime:
        """문자열을 datetime으로 변환"""
        if not date_str:
            return datetime.now()
        
        # 여러 가능한 형식 시도
        formats = [
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S"
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # 모든 형식이 실패하면 현재 시간 반환
        print(f"날짜 파싱 실패, 기본값 사용: {date_str}")
        return datetime.now()
    
    def migrate_file_data(self, file_id: str, file_data: Dict[str, Any]) -> bool:
        """개별 파일 데이터를 SQLite로 마이그레이션"""
        try:
            # 기본 필드 매핑
            file_metadata = FileMetadata(
                file_id=file_id,
                filename=file_data.get('filename', ''),
                saved_filename=file_data.get('saved_filename', f"{file_id}.pdf"),
                file_path=file_data.get('file_path', ''),
                file_size=file_data.get('file_size', 0),
                file_hash=file_data.get('file_hash', ''),
                category_id=file_data.get('category_id'),
                category_name=file_data.get('category_name'),
                status=self.convert_status(file_data.get('status', 'uploaded')),
                vectorized=file_data.get('vectorized', False),
                
                # 시간 필드들
                upload_time=self.parse_datetime(file_data.get('upload_time', '')),
                preprocessing_started_at=self.parse_datetime(file_data.get('preprocessing_started_at', '')) if file_data.get('preprocessing_started_at') else None,
                preprocessing_completed_at=self.parse_datetime(file_data.get('preprocessing_completed_at', '')) if file_data.get('preprocessing_completed_at') else None,
                vectorization_started_at=self.parse_datetime(file_data.get('vectorization_started_at', '')) if file_data.get('vectorization_started_at') else None,
                vectorization_completed_at=self.parse_datetime(file_data.get('vectorization_completed_at', '')) if file_data.get('vectorization_completed_at') else None,
                deleted_at=self.parse_datetime(file_data.get('deleted_at', '')) if file_data.get('deleted_at') else None,
                
                # 처리 정보
                preprocessing_method=file_data.get('preprocessing_method', 'basic'),
                chunk_count=file_data.get('chunk_count', 0),
                flow_id=file_data.get('used_flow_id') or file_data.get('flow_id'),
                
                # 에러 정보
                error_message=file_data.get('error_message') or file_data.get('error'),
                error_type=file_data.get('error_type'),
                
                # 문서 분석 정보 (있다면)
                page_count=file_data.get('page_count'),
                table_count=file_data.get('table_count'),
                image_count=file_data.get('image_count'),
            )
            
            # 처리 옵션 설정 (있다면)
            if 'processing_options' in file_data:
                file_metadata.set_processing_options(file_data['processing_options'])
            
            # SQLite에 저장
            success = self.file_metadata_service.create_file(file_metadata)
            if success:
                print(f"✅ 마이그레이션 성공: {file_id} ({file_data.get('filename')})")
                return True
            else:
                print(f"❌ 마이그레이션 실패: {file_id}")
                return False
                
        except Exception as e:
            print(f"❌ 마이그레이션 오류 {file_id}: {e}")
            return False
    
    def migrate_all(self) -> Dict[str, Any]:
        """모든 데이터 마이그레이션 실행"""
        print("🔄 JSON에서 SQLite로 데이터 마이그레이션 시작...")
        
        # 기존 JSON 데이터 로드
        json_data = self.load_json_metadata()
        if not json_data:
            return {
                "success": False,
                "message": "마이그레이션할 JSON 데이터가 없습니다."
            }
        
        total_files = len(json_data)
        migrated_count = 0
        failed_count = 0
        
        print(f"📋 총 {total_files}개 파일 발견")
        
        # 각 파일별로 마이그레이션
        for file_id, file_data in json_data.items():
            if self.migrate_file_data(file_id, file_data):
                migrated_count += 1
            else:
                failed_count += 1
        
        # 결과 요약
        result = {
            "success": True,
            "total_files": total_files,
            "migrated_count": migrated_count,
            "failed_count": failed_count,
            "message": f"마이그레이션 완료: {migrated_count}/{total_files} 성공, {failed_count}개 실패"
        }
        
        print(f"\n📊 마이그레이션 결과:")
        print(f"   - 총 파일: {total_files}개")
        print(f"   - 성공: {migrated_count}개")
        print(f"   - 실패: {failed_count}개")
        
        if failed_count == 0:
            print("✅ 모든 데이터가 성공적으로 마이그레이션되었습니다!")
        else:
            print(f"⚠️  {failed_count}개 파일 마이그레이션에 실패했습니다.")
        
        return result
    
    def create_backup(self) -> bool:
        """JSON 파일 백업 생성"""
        if not os.path.exists(self.json_file_path):
            return True
        
        try:
            backup_path = f"{self.json_file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            import shutil
            shutil.copy2(self.json_file_path, backup_path)
            print(f"📦 백업 생성 완료: {backup_path}")
            return True
        except Exception as e:
            print(f"❌ 백업 생성 실패: {e}")
            return False
    
    def verify_migration(self) -> Dict[str, Any]:
        """마이그레이션 검증"""
        print("🔍 마이그레이션 검증 중...")
        
        # JSON 데이터와 SQLite 데이터 비교
        json_data = self.load_json_metadata()
        sqlite_files = self.file_metadata_service.list_files(include_deleted=True)
        
        json_count = len(json_data)
        sqlite_count = len(sqlite_files)
        
        print(f"📊 데이터 수 비교:")
        print(f"   - JSON: {json_count}개")
        print(f"   - SQLite: {sqlite_count}개")
        
        # 누락된 파일 확인
        json_file_ids = set(json_data.keys())
        sqlite_file_ids = {f.file_id for f in sqlite_files}
        
        missing_in_sqlite = json_file_ids - sqlite_file_ids
        extra_in_sqlite = sqlite_file_ids - json_file_ids
        
        result = {
            "json_count": json_count,
            "sqlite_count": sqlite_count,
            "missing_in_sqlite": list(missing_in_sqlite),
            "extra_in_sqlite": list(extra_in_sqlite),
            "verified": len(missing_in_sqlite) == 0
        }
        
        if missing_in_sqlite:
            print(f"⚠️  SQLite에 누락된 파일: {len(missing_in_sqlite)}개")
            for file_id in missing_in_sqlite:
                print(f"   - {file_id}")
        
        if extra_in_sqlite:
            print(f"ℹ️  SQLite에만 있는 파일: {len(extra_in_sqlite)}개")
        
        if result["verified"]:
            print("✅ 마이그레이션 검증 성공!")
        else:
            print("❌ 마이그레이션 검증 실패!")
        
        return result


def main():
    """메인 마이그레이션 함수"""
    # 윈도우 콘솔 인코딩 설정
    import sys
    if sys.platform.startswith('win'):
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
    
    migrator = DataMigrator()
    
    print("=" * 60)
    print("🚀 LangFlow 파일 메타데이터 마이그레이션")
    print("   JSON → SQLite")
    print("=" * 60)
    
    # 1. 백업 생성
    print("\n1️⃣ 백업 생성...")
    if not migrator.create_backup():
        print("❌ 백업 생성에 실패했습니다. 마이그레이션을 중단합니다.")
        return
    
    # 2. 마이그레이션 실행
    print("\n2️⃣ 데이터 마이그레이션...")
    result = migrator.migrate_all()
    
    if not result["success"]:
        print(f"❌ 마이그레이션 실패: {result['message']}")
        return
    
    # 3. 검증
    print("\n3️⃣ 마이그레이션 검증...")
    verification = migrator.verify_migration()
    
    # 4. 결과 요약
    print("\n" + "=" * 60)
    print("📋 마이그레이션 완료 요약")
    print("=" * 60)
    print(f"총 파일: {result['total_files']}개")
    print(f"마이그레이션 성공: {result['migrated_count']}개")
    print(f"마이그레이션 실패: {result['failed_count']}개")
    print(f"검증 결과: {'✅ 성공' if verification['verified'] else '❌ 실패'}")
    
    if verification['verified'] and result['failed_count'] == 0:
        print("\n🎉 모든 데이터가 성공적으로 SQLite로 마이그레이션되었습니다!")
        print("이제 JSON 파일 기반 코드를 제거할 수 있습니다.")
    else:
        print("\n⚠️  마이그레이션이 완전하지 않습니다. 문제를 해결한 후 다시 시도하세요.")


if __name__ == "__main__":
    main()