import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// API 연결 상태 확인
console.log("API Base URL:", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 60초 타임아웃 (RAG 검색 시간 고려)
  withCredentials: true, // Enable sending cookies
});

// 요청 인터셉터 - 토큰 및 쿠키 추가
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => {
    // 성공 응답 로깅
    console.log(
      `API 응답 성공: ${response.config.method?.toUpperCase()} ${
        response.config.url
      }`,
      {
        status: response.status,
        data: response.data,
      }
    );
    return response;
  },
  (error) => {
    // 에러 상세 정보 로깅
    console.error("API 호출 오류:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
    });

    // 401 오류 처리 - 일부 API는 로그인이 선택적이므로 리다이렉트하지 않음
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      // 로그인이 선택적인 API들은 리다이렉트하지 않음
      const skipRedirectUrls = [
        "/chat/",
        "/api/v1/chat",
        "/api/v1/users/me/", // 사용자 정보 조회는 로그인 체크용이므로 리다이렉트하지 않음
      ];

      const shouldSkipRedirect = skipRedirectUrls.some((skipUrl) =>
        url.includes(skipUrl)
      );

      if (!shouldSkipRedirect) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }

    // 네트워크 오류 처리
    if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
      console.error("네트워크 연결 오류:", error.message);
      // 네트워크 오류 시 사용자 친화적인 메시지로 변환
      error.userMessage = "네트워크 연결을 확인해주세요.";
    }

    // 타임아웃 오류 처리
    if (error.code === "ECONNABORTED") {
      console.error("요청 타임아웃:", error.message);
      // 타임아웃 오류 시 사용자 친화적인 메시지로 변환
      error.userMessage =
        "AI 처리 시간이 예상보다 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요.";
    }

    // 서버 오류 처리
    if (error.response?.status >= 500) {
      console.error("서버 오류:", error.response.status, error.response.data);
      error.userMessage = "서버에 일시적인 문제가 발생했습니다.";
    }

    return Promise.reject(error);
  }
);

// 설정 API
export const settingsAPI = {
  getSettings: async () => {
    try {
      const response = await api.get("/api/v1/settings/");
      return response.data;
    } catch (error) {
      console.error("설정 로드 실패, 기본값 사용:", error);
      // 에러 시 기본값 반환
      return {
        maxFileSize: 10, // MB
        allowedFileTypes: ["pdf"],
        uploadDirectory: "uploads/",
        vectorDimension: 1536,
        chunkSize: 1000,
        chunkOverlap: 200,
        enableAutoVectorization: true,
        enableNotifications: true,
        debugMode: false,
      };
    }
  },

  updateSettings: async (settings: any) => {
    const response = await api.post("/api/v1/settings/", settings);
    return response.data;
  },

  resetSettings: async () => {
    const response = await api.post("/api/v1/settings/reset");
    return response.data;
  },
};

// 파일 업로드 API
export const fileAPI = {
  uploadFile: async (file: File, category?: string, forceReplace?: boolean) => {
    const formData = new FormData();
    formData.append("file", file);
    if (category) {
      formData.append("category", category);
    }
    if (forceReplace) {
      formData.append("force_replace", "true");
    }

    const response = await api.post("/api/v1/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // 카테고리별 파일 업로드 (여러 카테고리에 동일한 파일 업로드)
  uploadFileToCategories: async (file: File, categories: string[]) => {
    const uploadPromises = categories.map((category) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      return api.post("/api/v1/files/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    });

    const responses = await Promise.all(uploadPromises);
    return responses.map((response) => response.data);
  },

  getFiles: async (category?: string) => {
    const response = await api.get("/api/v1/files/", {
      params: { category },
    });
    return response.data;
  },

  deleteFile: async (fileId: string) => {
    const response = await api.delete(`/api/v1/files/${fileId}`);
    return response.data;
  },

  generateHashes: async () => {
    const response = await api.post("/api/v1/files/generate-hashes");
    return response.data;
  },

  // 카테고리별 파일 통계
  getFileStats: async () => {
    const response = await api.get("/api/v1/files/stats/");
    return response.data;
  },

  // 카테고리별 벡터 DB 재인덱싱
  reindexCategory: async (category: string) => {
    const response = await api.post("/api/v1/files/reindex", { category });
    return response.data;
  },

  // 파일 보기
  viewFile: async (fileId: string) => {
    const response = await api.get(`/api/v1/files/${fileId}/view`);
    return response.data;
  },

  // 벡터화 상태 조회
  getVectorizationStatus: async (fileId?: string) => {
    if (fileId) {
      const response = await api.get(
        `/api/v1/files/${fileId}/vectorization-status`
      );
      return response.data;
    } else {
      const response = await api.get("/api/v1/files/vectorization/status/");
      return response.data;
    }
  },

  // 벡터화 실행
  executeVectorization: async (fileIds?: string[]) => {
    const response = await api.post("/api/v1/files/vectorization/execute", {
      file_ids: fileIds || [],
    });
    return response.data;
  },

  // 벡터화 재시도
  retryVectorization: async (fileId: string) => {
    const response = await api.post(
      `/api/v1/files/${fileId}/vectorization/retry`
    );
    return response.data;
  },

  // 개별 파일 벡터화
  vectorizeFile: async (fileId: string) => {
    const response = await api.post(`/api/v1/files/${fileId}/vectorize`);
    return response.data;
  },

  // ChromaDB 상태 조회
  getChromaDBStatus: async () => {
    const response = await api.get("/api/v1/files/chromadb/status/");
    return response.data;
  },

  // ChromaDB 초기화
  initializeChromaDB: async () => {
    const response = await api.post("/api/v1/files/chromadb/initialize");
    return response.data;
  },

  // LangFlow 등록 현황 조회
  getLangflowStatus: async () => {
    const response = await api.get("/api/v1/files/langflow/status/");
    return response.data;
  },

  // LangFlow Flow 상세 정보 조회
  getLangflowFlowDetails: async (flowId: string) => {
    const response = await api.get(`/api/v1/files/langflow/flows/${flowId}`);
    return response.data;
  },

  // Flow 활성/비활성 토글
  toggleFlowStatus: async (flowId: string) => {
    const response = await api.put(
      `/api/v1/files/langflow/flows/${flowId}/toggle`
    );
    return response.data;
  },

  // 기본 벡터화 Flow 설정
  setDefaultVectorizationFlow: async (flowId: string) => {
    const response = await api.put(
      `/api/v1/files/langflow/flows/${flowId}/set-default`
    );
    return response.data;
  },

  // 검색 Flow 설정
  setSearchFlow: async (flowId: string) => {
    const response = await api.put(
      `/api/v1/files/langflow/flows/${flowId}/set-search`
    );
    return response.data;
  },

  // Flow 삭제
  deleteFlow: async (flowId: string) => {
    const response = await api.delete(`/api/v1/files/langflow/flows/${flowId}`);
    return response.data;
  },

  // 문서 검색
  searchDocuments: async (
    query: string,
    topK: number = 5,
    categoryIds?: string[]
  ) => {
    const params = new URLSearchParams({
      query,
      top_k: topK.toString(),
    });

    if (categoryIds && categoryIds.length > 0) {
      params.append("category_ids", categoryIds.join(","));
    }

    const response = await api.get(`/api/v1/files/search?${params}`);
    return response.data;
  },

  // 진단 및 정상화
  diagnoseAndFixDatabase: async () => {
    const response = await api.post(
      "/api/v1/files/maintenance/diagnose-and-fix"
    );
    return response.data;
  },
};

// 통계 API
export const statsAPI = {
  getStats: async () => {
    const response = await api.get("/stats");
    return response.data;
  },

  getUsageStats: async (period: string = "7d") => {
    const response = await api.get("/stats/usage", {
      params: { period },
    });
    return response.data;
  },

  // 카테고리별 통계
  getCategoryStats: async () => {
    const response = await api.get("/stats/categories");
    return response.data;
  },

  // 카테고리별 질문 통계
  getCategoryQuestionStats: async (period: string = "7d") => {
    const response = await api.get("/stats/categories/questions", {
      params: { period },
    });
    return response.data;
  },

  // 대시보드 통계
  getDashboardStats: async () => {
    const response = await api.get("/api/v1/stats/dashboard/");
    return response.data;
  },
};

// 사용자 API
export const userAPI = {
  // 로그인
  login: async (username: string, password: string) => {
    const response = await api.post("/api/v1/users/login", {
      username,
      password,
    });
    return response.data;
  },

  // 회원가입
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    persona?: string;
    interest_areas?: string[];
  }) => {
    const response = await api.post("/api/v1/users/register", userData);
    return response.data;
  },

  // 로그아웃
  logout: async () => {
    const response = await api.post("/api/v1/users/logout");
    return response.data;
  },

  // 현재 사용자 정보 조회
  getCurrentUser: async () => {
    const response = await api.get("/api/v1/users/me/");
    return response.data;
  },

  // 모든 사용자 조회 (관리자)
  getAllUsers: async () => {
    const response = await api.get("/api/v1/users/");
    return response.data;
  },

  // 사용자 생성 (관리자)
  createUser: async (userData: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    persona?: string;
    interest_areas?: string[];
  }) => {
    const response = await api.post("/api/v1/users/", userData);
    return response.data;
  },

  // 사용자 정보 조회
  getUserById: async (userId: string) => {
    const response = await api.get(`/api/v1/users/${userId}`);
    return response.data;
  },

  // 사용자 정보 업데이트
  updateUser: async (userId: string, userData: any) => {
    const response = await api.put(`/api/v1/users/${userId}`, userData);
    return response.data;
  },

  // 사용자 삭제
  deleteUser: async (userId: string) => {
    const response = await api.delete(`/api/v1/users/${userId}`);
    return response.data;
  },

  // 페르소나 목록 조회
  getPersonas: async () => {
    const response = await api.get("/api/v1/users/personas/");
    return response.data;
  },

  // 페르소나 생성
  createPersona: async (personaData: {
    name: string;
    description?: string;
    system_message?: string;
  }) => {
    const response = await api.post("/api/v1/users/personas/", personaData);
    return response.data;
  },

  // 관심 영역 목록 조회
  getInterestAreas: async () => {
    const response = await api.get("/api/v1/users/interest-areas/");
    return response.data;
  },

  // 관심 영역 생성
  createInterestArea: async (areaData: {
    name: string;
    description?: string;
    category_ids?: string[];
  }) => {
    const response = await api.post("/api/v1/users/interest-areas/", areaData);
    return response.data;
  },

  // 페르소나 삭제
  deletePersona: async (personaId: string) => {
    const response = await api.delete(`/api/v1/users/personas/${personaId}`);
    return response.data;
  },

  // 관심 영역 삭제
  deleteInterestArea: async (areaId: string) => {
    const response = await api.delete(`/api/v1/users/interest-areas/${areaId}`);
    return response.data;
  },

  // 승인 대기 중인 사용자 조회 (관리자)
  getPendingUsers: async () => {
    const response = await api.get("/api/v1/users/pending");
    return response.data;
  },

  // 사용자 승인 (관리자)
  approveUser: async (userId: string) => {
    const response = await api.post(`/api/v1/users/${userId}/approve`);
    return response.data;
  },

  // 사용자 거부 (관리자)
  rejectUser: async (userId: string) => {
    const response = await api.post(`/api/v1/users/${userId}/reject`);
    return response.data;
  },

  // 프로필 업데이트
  updateProfile: async (profileData: {
    full_name?: string;
    email?: string;
  }) => {
    const response = await api.put("/api/v1/users/me/profile", profileData);
    return response.data;
  },

  // 비밀번호 변경
  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }) => {
    const response = await api.post("/api/v1/users/me/change-password", passwordData);
    return response.data;
  },

  // 아바타 업로드
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/api/v1/users/me/upload-avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

// 관리자 API
export const adminAPI = {
  getUsers: async () => {
    const response = await api.get("/admin/users");
    return response.data;
  },

  updateUser: async (userId: string, data: any) => {
    const response = await api.put(`/admin/users/${userId}`, data);
    return response.data;
  },

  deleteUser: async (userId: string) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  getSystemStatus: async () => {
    const response = await api.get("/admin/status");
    return response.data;
  },

  // 카테고리별 문서 관리
  getDocumentsByCategory: async (category: string) => {
    const response = await api.get("/admin/documents/category", {
      params: { category },
    });
    return response.data;
  },

  // 카테고리별 벡터 DB 상태
  getVectorDBStatus: async () => {
    const response = await api.get("/admin/vectordb/status");
    return response.data;
  },

  // 카테고리별 벡터 DB 재인덱싱
  reindexVectorDB: async (category?: string) => {
    const response = await api.post("/admin/vectordb/reindex", { category });
    return response.data;
  },
};

// 카테고리 API
export const categoryAPI = {
  // 모든 카테고리 목록
  getCategories: async () => {
    try {
      console.log("카테고리 API 호출 시작");
      const response = await api.get("/api/v1/categories/");
      console.log("카테고리 API 응답 상태:", response.status);
      console.log("카테고리 API 응답 데이터:", response.data);
      console.log("응답 데이터 타입:", typeof response.data);
      console.log("응답 데이터가 배열인가?", Array.isArray(response.data));
      return response.data;
    } catch (error: any) {
      console.error("카테고리 API 호출 실패:", error);
      console.error(
        "오류 상세:",
        error instanceof Error ? error.message : error
      );
      if (error.response) {
        console.error("응답 상태:", error.response.status);
        console.error("응답 데이터:", error.response.data);
      }
      throw error;
    }
  },

  // 카테고리별 문서 수
  getCategoryDocumentCounts: async () => {
    const response = await api.get("/api/v1/categories/stats/");
    return response.data;
  },

  // 카테고리별 사용 통계
  getCategoryUsageStats: async (period: string = "7d") => {
    const response = await api.get("/api/v1/categories/usage-stats/", {
      params: { period },
    });
    return response.data;
  },

  // 새 카테고리 생성
  createCategory: async (categoryData: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
  }) => {
    const response = await api.post("/api/v1/categories/", categoryData);
    return response.data;
  },

  // 카테고리 업데이트
  updateCategory: async (
    categoryId: string,
    categoryData: {
      name: string;
      description?: string;
      icon?: string;
      color?: string;
    }
  ) => {
    const response = await api.put(
      `/api/v1/categories/${categoryId}`,
      categoryData
    );
    return response.data;
  },

  // 카테고리 삭제
  deleteCategory: async (categoryId: string) => {
    const response = await api.delete(`/api/v1/categories/${categoryId}`);
    return response.data;
  },

  // 카테고리별 파일 목록
  getFilesByCategory: async (categoryId: string) => {
    const response = await api.get(`/api/v1/files/category/${categoryId}`);
    return response.data;
  },
};

// 페르소나 API
export const personaAPI = {
  // 모든 페르소나 목록
  getPersonas: async () => {
    const response = await api.get("/api/v1/users/personas/");
    return response.data;
  },

  // 새 페르소나 생성
  createPersona: async (personaData: {
    name: string;
    description?: string;
    system_message?: string;
  }) => {
    const response = await api.post("/api/v1/users/personas/", personaData);
    return response.data;
  },

  // 페르소나 업데이트
  updatePersona: async (
    personaId: string,
    personaData: {
      name: string;
      description?: string;
      system_message?: string;
    }
  ) => {
    const response = await api.put(
      `/api/v1/users/personas/${personaId}`,
      personaData
    );
    return response.data;
  },

  // 페르소나 삭제
  deletePersona: async (personaId: string) => {
    const response = await api.delete(`/api/v1/users/personas/${personaId}`);
    return response.data;
  },
};

// 채팅 API
export const chatAPI = {
  // 새로운 채팅 API (RAG 기반) - 통합된 메시지 전송
  sendMessage: async (
    message: string,
    categoryIds: string[] = [],
    flowId?: string,
    userId?: string,
    topK: number = 10,
    systemMessage?: string,
    personaId?: string
  ) => {
    const response = await api.post("/api/v1/chat/", {
      message,
      category_ids: categoryIds,
      categories: [], // 카테고리 이름은 빈 배열로 (ID 사용)
      flow_id: flowId,
      user_id: userId || null,
      top_k: topK,
      system_message: systemMessage || null,
      persona_id: personaId || null,
    });
    return response.data;
  },

  // 간단한 채팅 API
  sendSimpleMessage: async (
    message: string,
    categoryIds?: string[],
    flowId?: string
  ) => {
    const response = await api.post("/api/v1/chat/simple", {
      message,
      category_ids: categoryIds || [],
      flow_id: flowId,
    });
    return response.data;
  },

  // 특정 Flow를 사용한 채팅
  sendMessageWithFlow: async (
    flowId: string,
    message: string,
    categoryIds: string[] = []
  ) => {
    const response = await api.post(`/api/v1/chat/flow/${flowId}`, {
      message,
      category_ids: categoryIds,
      categories: [],
    });
    return response.data;
  },

  // 사용 가능한 검색 Flow 목록 조회
  getAvailableFlows: async () => {
    const response = await api.get("/api/v1/chat/flows/");
    return response.data;
  },

  // 채팅 시스템 상태 확인
  getChatStatus: async () => {
    const response = await api.get("/api/v1/chat/status/");
    return response.data;
  },

  // 채팅 시스템 테스트
  testChat: async () => {
    const response = await api.post("/api/v1/chat/test");
    return response.data;
  },

  // 사용자 채팅 히스토리
  getChatHistory: async (userId?: string, limit: number = 50) => {
    const response = await api.get("/api/v1/chat/history/", {
      params: {
        user_id: userId || "default_user",
        limit,
      },
    });
    return response.data;
  },

  // 채팅 히스토리 저장
  saveChatHistory: async (
    userId: string,
    userMessage: any,
    assistantMessage: any
  ) => {
    const response = await api.post("/api/v1/chat/history", {
      user_id: userId,
      user_message: userMessage,
      assistant_message: assistantMessage,
    });
    return response.data;
  },

  // 카테고리별 채팅 히스토리
  getChatHistoryByCategory: async (category: string, userId?: string) => {
    const response = await api.get("/api/v1/chat/history/category/", {
      params: {
        category,
        user_id: userId || "default_user",
      },
    });
    return response.data;
  },

  // 관리자용 채팅 기록 조회
  getAdminChatHistory: async (params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => {
    const response = await api.get("/api/v1/chat/admin/history", { params });
    return response.data;
  },

  // 관리자용 채팅 통계
  getChatHistoryStats: async () => {
    const response = await api.get("/api/v1/chat/admin/history/stats");
    return response.data;
  },

  // 관리자용 채팅 기록 삭제
  deleteChatHistory: async (historyId: number) => {
    const response = await api.delete(`/api/v1/chat/admin/history/${historyId}`);
    return response.data;
  },
};

export default api;
