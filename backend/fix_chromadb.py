vh#!/usr/bin/env python3
"""
ChromaDB 문제 해결 스크립트
ChromaDB 버전 호환성 문제와 데이터베이스 손상 문제를 해결합니다.
"""

import os
import sys
import shutil
import time
from datetime import datetime

def fix_chromadb():
    """ChromaDB 문제를 해결합니다."""
    print("ChromaDB 문제 해결을 시작합니다...")
    
    # settings를 사용하여 경로 설정
    from app.core.config import settings
    data_dir = settings.DATA_DIR
    vectors_dir = os.path.join(data_dir, "vectors")
    
    print(f"데이터 디렉토리: {data_dir}")
    print(f"벡터 디렉토리: {vectors_dir}")
    
    # 1. ChromaDB 버전 확인
    try:
        import chromadb
        chroma_version = chromadb.__version__
        print(f"현재 ChromaDB 버전: {chroma_version}")
        
        # 버전 호환성 체크
        version_parts = chroma_version.split('.')
        major_version = int(version_parts[0])
        minor_version = int(version_parts[1]) if len(version_parts) > 1 else 0
        
        if major_version < 0 or (major_version == 0 and minor_version < 4):
            print("⚠️  경고: ChromaDB 버전이 낮습니다. 업데이트를 권장합니다.")
            print("다음 명령어로 업데이트하세요:")
            print("pip install --upgrade chromadb")
        else:
            print("✅ ChromaDB 버전이 적절합니다.")
            
    except ImportError:
        print("❌ ChromaDB가 설치되지 않았습니다.")
        print("다음 명령어로 설치하세요:")
        print("pip install chromadb")
        return False
    except Exception as e:
        print(f"❌ ChromaDB 버전 확인 실패: {str(e)}")
        return False
    
    # 2. 손상된 데이터베이스 백업 및 리셋
    if os.path.exists(vectors_dir):
        print(f"기존 벡터 디렉토리 발견: {vectors_dir}")
        
        # 백업 생성 (파일이 사용 중일 경우 대기)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = f"{vectors_dir}_backup_{timestamp}"
        
        max_retries = 5
        for attempt in range(max_retries):
            try:
                if os.path.exists(vectors_dir):
                    # 파일이 사용 중인지 확인
                    chroma_db_path = os.path.join(vectors_dir, "chroma.sqlite3")
                    if os.path.exists(chroma_db_path):
                        try:
                            # 파일이 잠겨있는지 테스트
                            with open(chroma_db_path, 'r+b') as f:
                                pass
                        except PermissionError:
                            print(f"파일이 사용 중입니다. {attempt + 1}/{max_retries}번째 시도...")
                            if attempt < max_retries - 1:
                                time.sleep(2)
                                continue
                            else:
                                print("❌ 파일이 계속 사용 중입니다. 서버를 중지하고 다시 시도하세요.")
                                return False
                    
                    shutil.move(vectors_dir, backup_path)
                    print(f"✅ 기존 데이터베이스를 백업했습니다: {backup_path}")
                    break
                else:
                    print("벡터 디렉토리가 이미 삭제되었습니다.")
                    break
            except Exception as e:
                print(f"❌ 백업 생성 실패 (시도 {attempt + 1}/{max_retries}): {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                else:
                    print("❌ 백업 생성에 실패했습니다. 수동으로 처리하세요.")
                    return False
    
    # 3. 새 디렉토리 생성
    try:
        os.makedirs(vectors_dir, exist_ok=True)
        print(f"✅ 새 벡터 디렉토리 생성: {vectors_dir}")
    except Exception as e:
        print(f"❌ 디렉토리 생성 실패: {str(e)}")
        return False
    
    # 4. ChromaDB 클라이언트 테스트
    try:
        from chromadb.config import Settings
        
        test_client = chromadb.PersistentClient(
            path=vectors_dir,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # 간단한 테스트 컬렉션 생성
        test_collection = test_client.create_collection(
            name="test_collection",
            metadata={"description": "테스트용 컬렉션"}
        )
        
        # 테스트 컬렉션 삭제
        test_client.delete_collection(name="test_collection")
        
        print("✅ ChromaDB 클라이언트 테스트 성공")
        
    except Exception as e:
        print(f"❌ ChromaDB 클라이언트 테스트 실패: {str(e)}")
        return False
    
    print("\n🎉 ChromaDB 문제 해결이 완료되었습니다!")
    print("이제 서버를 다시 시작하세요:")
    print("python main.py")
    
    return True

if __name__ == "__main__":
    success = fix_chromadb()
    sys.exit(0 if success else 1) 