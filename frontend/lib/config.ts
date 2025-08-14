// API 설정 관련 유틸리티 함수들

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * 아바타 이미지 URL을 완전한 URL로 변환
 */
export const getAvatarUrl = (avatarPath?: string): string => {
  if (!avatarPath) return "";
  return `${API_BASE_URL}${avatarPath}`;
};

/**
 * 문서 이미지 URL을 완전한 URL로 변환
 */
export const getImageUrl = (imagePath?: string): string => {
  if (!imagePath) return "";
  return `${API_BASE_URL}${imagePath}`;
};

/**
 * API 엔드포인트 URL 생성
 */
export const getApiUrl = (path: string): string => {
  return `${API_BASE_URL}${path}`;
};