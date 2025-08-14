"use client";

import { useEffect, useRef, useState } from "react";

interface SSEMessage {
  event: string;
  data: any;
  timestamp: string;
}

interface UseSSEOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: SSEMessage) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const connect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    console.log('SSE 연결 시도:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE 연결 성공');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectCountRef.current = 0;
      onConnect?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        console.log('📨 SSE 메시지 수신:', message);
        onMessage?.(message);
      } catch (error) {
        console.error('SSE 메시지 파싱 오류:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE 연결 오류:', error);
      setIsConnected(false);
      setConnectionStatus('error');
      onError?.(error);

      // 자동 재연결 시도
      if (reconnectCountRef.current < maxReconnectAttempts) {
        reconnectCountRef.current++;
        console.log(`🔄 SSE 재연결 시도 ${reconnectCountRef.current}/${maxReconnectAttempts}`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      } else {
        console.error('❌ SSE 재연결 최대 시도 횟수 초과');
        setConnectionStatus('disconnected');
      }
    };
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    reconnectCountRef.current = 0;
    onDisconnect?.();
    console.log('🔌 SSE 연결 해제');
  };

  const reconnect = () => {
    disconnect();
    setTimeout(connect, 100);
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    connectionStatus,
    reconnect,
    disconnect
  };
}

// 벡터화 전용 SSE 훅
export function useVectorizationSSE(onVectorizationUpdate: (data: any) => void) {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  return useSSE(`${API_BASE_URL}/api/v1/sse/vectorization/events`, {
    onMessage: (message) => {
      if (message.event === 'vectorization_started' || 
          message.event === 'vectorization_completed' || 
          message.event === 'vectorization_failed') {
        onVectorizationUpdate(message.data);
      }
    },
    onConnect: () => {
      console.log('🔗 벡터화 SSE 연결됨');
    },
    onDisconnect: () => {
      console.log('🔌 벡터화 SSE 연결 해제됨');
    },
    onError: (error) => {
      console.error('⚠️ 벡터화 SSE 오류:', error);
    }
  });
}