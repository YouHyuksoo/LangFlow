#!/usr/bin/env python3
import sqlite3
import os

print("스크립트 시작")

# 데이터베이스 파일 경로
db_path = os.path.join(os.path.dirname(__file__), "data", "users.db")
print(f"데이터베이스 경로: {db_path}")

# 파일 존재 확인
if os.path.exists(db_path):
    print("데이터베이스 파일이 존재합니다.")
else:
    print("데이터베이스 파일이 존재하지 않습니다.")
    exit(1)

try:
    print("데이터베이스 연결 시도...")
    conn = sqlite3.connect(db_path)
    print("데이터베이스 연결 성공")
    
    cursor = conn.cursor()
    print("커서 생성 성공")
    
    # 테이블 구조 확인
    print("테이블 구조 확인 중...")
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    print(f"테이블 컬럼 수: {len(columns)}")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    
    # admin 사용자 조회
    print("\nadmin 사용자 조회 중...")
    cursor.execute("SELECT user_id, username, email, role FROM users WHERE username = 'admin'")
    admin_user = cursor.fetchone()
    
    if admin_user:
        print(f"Admin 사용자: {admin_user}")
    else:
        print("Admin 사용자를 찾을 수 없습니다.")
    
    # 모든 사용자 조회
    print("\n모든 사용자 조회 중...")
    cursor.execute("SELECT username, role FROM users")
    users = cursor.fetchall()
    print(f"총 사용자 수: {len(users)}")
    for user in users:
        print(f"  {user[0]}: {user[1]}")
    
    conn.close()
    print("데이터베이스 연결 종료")
    
except Exception as e:
    print(f"오류 발생: {e}")
    import traceback
    traceback.print_exc()
    if 'conn' in locals():
        conn.close()

print("스크립트 완료")
