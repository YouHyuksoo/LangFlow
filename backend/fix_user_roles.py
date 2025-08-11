#!/usr/bin/env python3
"""
사용자 role 컬럼 추가 및 admin 사용자 role 설정 스크립트
"""
import sqlite3
import os

def fix_user_roles():
    """사용자 role 컬럼을 추가하고 admin 사용자에게 admin role을 설정하는 함수"""
    # 데이터베이스 파일 경로
    db_path = os.path.join(os.path.dirname(__file__), "data", "users.db")
    
    try:
        # 데이터베이스 연결
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("데이터베이스 연결 성공")
        
        # 테이블 구조 확인
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print(f"현재 테이블 컬럼 수: {len(columns)}")
        
        # role 컬럼이 있는지 확인
        role_exists = any(col[1] == 'role' for col in columns)
        
        if not role_exists:
            print("\nrole 컬럼이 존재하지 않습니다. 추가합니다...")
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
            print("role 컬럼 추가 완료")
        else:
            print("\nrole 컬럼이 이미 존재합니다.")
        
        # admin 사용자에게 admin role 설정
        print("\nadmin 사용자에게 admin role 설정 중...")
        cursor.execute("UPDATE users SET role = 'admin' WHERE username = 'admin'")
        
        if cursor.rowcount > 0:
            print("admin 사용자 role 설정 완료")
        else:
            print("admin 사용자를 찾을 수 없습니다.")
        
        # 변경사항 확인
        cursor.execute("SELECT user_id, username, email, role FROM users WHERE username = 'admin'")
        admin_user = cursor.fetchone()
        
        if admin_user:
            print(f"\nAdmin 사용자 정보:")
            print(f"  User ID: {admin_user[0]}")
            print(f"  Username: {admin_user[1]}")
            print(f"  Email: {admin_user[2]}")
            print(f"  Role: {admin_user[3]}")
        else:
            print("\nAdmin 사용자를 찾을 수 없습니다.")
        
        # 변경사항 저장
        conn.commit()
        print("\n변경사항이 저장되었습니다.")
        
        # 최종 테이블 구조 확인
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print(f"\n최종 테이블 컬럼 수: {len(columns)}")
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
        
        conn.close()
        print("\n데이터베이스 연결 종료")
        
    except Exception as e:
        print(f"오류 발생: {e}")
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    fix_user_roles()
