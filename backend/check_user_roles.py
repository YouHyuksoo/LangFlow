#!/usr/bin/env python3
"""
사용자 role 확인 및 수정 스크립트
"""
import sqlite3
import os

def check_user_roles():
    """사용자 role을 확인하는 함수"""
    # 데이터베이스 파일 경로
    db_path = os.path.join(os.path.dirname(__file__), "data", "users.db")
    
    try:
        # 데이터베이스 연결
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # admin 사용자 정보 확인
        cursor.execute("SELECT user_id, username, email, role FROM users WHERE username = 'admin'")
        admin_user = cursor.fetchone()
        
        if admin_user:
            print(f"Admin 사용자 정보:")
            print(f"  User ID: {admin_user[0]}")
            print(f"  Username: {admin_user[1]}")
            print(f"  Email: {admin_user[2]}")
            print(f"  Role: {admin_user[3]}")
        else:
            print("Admin 사용자를 찾을 수 없습니다.")
        
        # 모든 사용자의 role 확인
        cursor.execute("SELECT username, role FROM users")
        users = cursor.fetchall()
        
        print(f"\n전체 사용자 role 목록:")
        for user in users:
            print(f"  {user[0]}: {user[1]}")
        
        conn.close()
        
    except Exception as e:
        print(f"오류 발생: {e}")
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    check_user_roles()