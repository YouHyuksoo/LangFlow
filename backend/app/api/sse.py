"""
Server-Sent Events (SSE) API
벡터화 진행 상황을 실시간으로 전송
"""

import asyncio
import json
import uuid
from typing import Dict, Set
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from datetime import datetime

router = APIRouter(prefix="/api/v1/sse", tags=["Server-Sent Events"])

# 연결된 클라이언트들 관리
class SSEManager:
    def __init__(self):
        self.connections: Dict[str, asyncio.Queue] = {}
    
    async def connect(self, client_id: str) -> asyncio.Queue:
        """새 클라이언트 연결"""
        queue = asyncio.Queue()
        self.connections[client_id] = queue
        print(f"SSE 클라이언트 연결: {client_id}")
        return queue
    
    async def disconnect(self, client_id: str):
        """클라이언트 연결 해제"""
        if client_id in self.connections:
            del self.connections[client_id]
            print(f"SSE 클라이언트 해제: {client_id}")
    
    async def broadcast(self, event: str, data: dict):
        """모든 연결된 클라이언트에게 이벤트 전송"""
        if not self.connections:
            return
            
        message = {
            "event": event,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        # 연결이 끊어진 클라이언트 제거를 위한 리스트
        disconnected_clients = []
        
        for client_id, queue in self.connections.items():
            try:
                await queue.put(message)
            except Exception as e:
                print(f"SSE 전송 실패 (클라이언트: {client_id}): {e}")
                disconnected_clients.append(client_id)
        
        # 끊어진 연결 정리
        for client_id in disconnected_clients:
            await self.disconnect(client_id)
    
    async def send_to_client(self, client_id: str, event: str, data: dict):
        """특정 클라이언트에게만 이벤트 전송"""
        if client_id in self.connections:
            message = {
                "event": event,
                "data": data,
                "timestamp": datetime.now().isoformat()
            }
            try:
                await self.connections[client_id].put(message)
            except Exception as e:
                print(f"SSE 개별 전송 실패 (클라이언트: {client_id}): {e}")
                await self.disconnect(client_id)

# 전역 SSE 매니저 인스턴스
sse_manager = SSEManager()

@router.get("/vectorization/events")
async def vectorization_events(request: Request):
    """벡터화 관련 SSE 이벤트 스트림"""
    
    client_id = str(uuid.uuid4())
    queue = await sse_manager.connect(client_id)
    
    async def event_generator():
        try:
            # 연결 확인 메시지
            yield f"data: {json.dumps({'event': 'connected', 'client_id': client_id})}\n\n"
            
            while True:
                # 클라이언트가 연결을 끊었는지 확인
                if await request.is_disconnected():
                    break
                
                try:
                    # 큐에서 메시지 대기 (타임아웃 설정)
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    
                    # SSE 형식으로 메시지 전송
                    event_data = json.dumps(message)
                    yield f"data: {event_data}\n\n"
                    
                except asyncio.TimeoutError:
                    # keep-alive 비활성화 - 하트비트 제거
                    continue
                
        except Exception as e:
            print(f"SSE 스트림 오류 (클라이언트: {client_id}): {e}")
        finally:
            await sse_manager.disconnect(client_id)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

@router.get("/status")
async def sse_status():
    """SSE 연결 상태 확인"""
    return {
        "connected_clients": len(sse_manager.connections),
        "client_ids": list(sse_manager.connections.keys())
    }

# SSE 매니저를 다른 모듈에서 사용할 수 있도록 export
def get_sse_manager() -> SSEManager:
    return sse_manager