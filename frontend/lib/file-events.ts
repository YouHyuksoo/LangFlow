/**
 * 파일 관련 이벤트 처리를 위한 이벤트 시스템
 * 브라우저 탭 간 통신을 위해 localStorage 이벤트 활용
 */

export class FileEventEmitter {
  private static instance: FileEventEmitter | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private storageListener: ((e: StorageEvent) => void) | null = null;

  static getInstance(): FileEventEmitter {
    if (!FileEventEmitter.instance) {
      FileEventEmitter.instance = new FileEventEmitter();
    }
    return FileEventEmitter.instance;
  }

  constructor() {
    this.initStorageListener();
  }

  // localStorage를 통한 탭 간 통신 초기화
  private initStorageListener(): void {
    if (typeof window === 'undefined') return;

    this.storageListener = (e: StorageEvent) => {
      if (e.key?.startsWith('file_event_')) {
        const eventName = e.key.replace('file_event_', '');
        const eventData = e.newValue ? JSON.parse(e.newValue) : null;
        
        // localStorage 이벤트로 받은 데이터를 내부 이벤트로 전파
        this.emitLocal(eventName, eventData);
      }
    };

    window.addEventListener('storage', this.storageListener);
  }

  // 이벤트 리스너 등록
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // 이벤트 리스너 해제
  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // 로컬 이벤트만 발생 (localStorage 사용 안 함)
  private emitLocal(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }

  // 브라우저 탭 간 이벤트 발생 (localStorage 활용)
  emit(event: string, data?: any): void {
    // 현재 탭에서 즉시 실행
    this.emitLocal(event, data);

    // 다른 탭들에게도 알림 (localStorage 이벤트)
    if (typeof window !== 'undefined') {
      try {
        const eventKey = `file_event_${event}`;
        const eventData = JSON.stringify({
          timestamp: Date.now(),
          data
        });
        
        // localStorage에 설정하여 다른 탭들이 감지할 수 있도록 함
        localStorage.setItem(eventKey, eventData);
        
        // 즉시 제거하여 동일한 이벤트가 다시 발생할 수 있도록 함
        setTimeout(() => {
          localStorage.removeItem(eventKey);
        }, 100);
      } catch (error) {
        console.error('Error emitting cross-tab event:', error);
      }
    }
  }

  // 정리
  destroy(): void {
    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener);
    }
    this.removeAllListeners();
  }

  // 모든 리스너 정리
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// 파일 관련 이벤트 타입 정의
export enum FileEvents {
  FILE_UPLOADED = 'file_uploaded',
  FILE_DELETED = 'file_deleted',
  VECTORIZATION_STARTED = 'vectorization_started',
  VECTORIZATION_COMPLETED = 'vectorization_completed',
  VECTORIZATION_FAILED = 'vectorization_failed',
  FILES_UPDATED = 'files_updated'
}

// 편의 함수들
export const fileEvents = FileEventEmitter.getInstance();

// 이벤트 발생 헬퍼 함수들
export const emitFileUploaded = (fileData: any) => {
  fileEvents.emit(FileEvents.FILE_UPLOADED, fileData);
  fileEvents.emit(FileEvents.FILES_UPDATED, { type: 'upload', data: fileData });
};

export const emitFileDeleted = (fileId: string) => {
  fileEvents.emit(FileEvents.FILE_DELETED, fileId);
  fileEvents.emit(FileEvents.FILES_UPDATED, { type: 'delete', data: { fileId } });
};

export const emitVectorizationStarted = (fileData: any) => {
  fileEvents.emit(FileEvents.VECTORIZATION_STARTED, fileData);
  fileEvents.emit(FileEvents.FILES_UPDATED, { type: 'vectorization_started', data: fileData });
};

export const emitVectorizationCompleted = (fileData: any) => {
  fileEvents.emit(FileEvents.VECTORIZATION_COMPLETED, fileData);
  fileEvents.emit(FileEvents.FILES_UPDATED, { type: 'vectorization_completed', data: fileData });
};

export const emitVectorizationFailed = (fileData: any) => {
  fileEvents.emit(FileEvents.VECTORIZATION_FAILED, fileData);
  fileEvents.emit(FileEvents.FILES_UPDATED, { type: 'vectorization_failed', data: fileData });
};