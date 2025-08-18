"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Database,
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { fileAPI, doclingAPI, settingsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useVectorizationSSE } from "@/hooks/use-sse";
import { DoclingSettingsInfo } from "@/components/docling-settings-info";

interface VectorizationFile {
  file_id: string;
  filename: string;
  category_name: string;
  vectorized: boolean;
  vectorization_status?: string;
  file_size: number;
  upload_time: string;
  error_message?: string;
  status: string;
  chunk_count?: number;
}

interface VectorizationStats {
  totalFiles: number;
  vectorizedFiles: number;
  pendingFiles: number;
  failedFiles: number;
  totalVectors: number;
  totalChunks: number;
}

export default function VectorizationPage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<VectorizationFile[]>([]);
  const [stats, setStats] = useState<VectorizationStats>({
    totalFiles: 0,
    vectorizedFiles: 0,
    pendingFiles: 0,
    failedFiles: 0,
    totalVectors: 0,
    totalChunks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [vectorizationSettings, setVectorizationSettings] = useState<any>(null);
  const [vectorDbInfo, setVectorDbInfo] = useState<any>(null);
  const [confirmRevectorize, setConfirmRevectorize] = useState<{
    isOpen: boolean;
    fileId: string;
    filename: string;
    isAllFiles: boolean;
  }>({
    isOpen: false,
    fileId: "",
    filename: "",
    isAllFiles: false,
  });

  const loadVectorizationData = async () => {
    try {
      setLoading(true);

      // 동시에 데이터 로드
      const [filesResponse, chromaStatus] = await Promise.all([
        fileAPI.getFiles(),
        fileAPI.getChromaDBStatus().catch(() => ({ collection_count: 0 })), // ChromaDB 상태 조회 실패 시 기본값 사용
      ]);

      // Vector DB 정보 설정
      setVectorDbInfo(chromaStatus);

      setFiles(filesResponse);

      // 디버그: 받은 파일 데이터 확인
      console.log("🔍 API에서 받은 파일 데이터:", filesResponse);
      filesResponse.forEach((f: VectorizationFile) => {
        console.log(
          `📄 ${f.filename}: vectorized=${
            f.vectorized
          } (타입: ${typeof f.vectorized}), status=${
            f.status
          }, vectorization_status=${f.vectorization_status}`
        );
      });

      // 통계 계산 (벡터화 상태를 더 정확히 분류)
      const vectorizedFiles = filesResponse.filter(
        (f: VectorizationFile) => f.vectorized === true || f.status === "completed"
      );
      const vectorizedCount = vectorizedFiles.length;
      console.log(
        "✅ 벡터화 완료된 파일들:",
        vectorizedFiles.map((f: VectorizationFile) => f.filename)
      );

      const failedFiles = filesResponse.filter(
        (f: VectorizationFile) =>
          f.vectorization_status === "failed" ||
          f.error_message ||
          f.vectorization_status === "error"
      );
      const failedCount = failedFiles.length;
      console.log(
        "❌ 벡터화 실패한 파일들:",
        failedFiles.map((f: VectorizationFile) => f.filename)
      );

      const processingFiles = filesResponse.filter(
        (f: VectorizationFile) =>
          f.vectorization_status === "processing" ||
          f.vectorization_status === "in_progress" ||
          processing.has(f.file_id)
      );
      const processingCount = processingFiles.length;
      console.log(
        "🔄 벡터화 진행중인 파일들:",
        processingFiles.map((f: VectorizationFile) => f.filename)
      );

      const pendingCount =
        filesResponse.length - vectorizedCount - failedCount - processingCount;

      // 총 청크 수 계산
      const totalChunks = filesResponse.reduce(
        (total: number, file: VectorizationFile) => {
          return total + (file.chunk_count || 0);
        },
        0
      );

      console.log(
        `📊 통계 계산: 총 ${filesResponse.length}개 파일 중 완료=${vectorizedCount}, 실패=${failedCount}, 진행중=${processingCount}, 대기=${pendingCount}, 총 청크=${totalChunks}개`
      );

      setStats({
        totalFiles: filesResponse.length,
        vectorizedFiles: vectorizedCount,
        pendingFiles: Math.max(0, pendingCount), // 음수 방지
        failedFiles: failedCount,
        totalVectors: chromaStatus?.collection_count || 0,
        totalChunks: totalChunks,
      });

      console.log("벡터화 데이터 업데이트:", {
        total: filesResponse.length,
        vectorized: vectorizedCount,
        pending: Math.max(0, pendingCount),
        failed: failedCount,
        processing: processingCount,
      });
    } catch (error) {
      console.error("벡터화 데이터 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "벡터화 상태를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVectorizationData();
  }, []);

  // SSE 실시간 벡터화 상태 업데이트
  const handleVectorizationUpdate = (data: any) => {
    console.log("🔔 실시간 벡터화 상태 업데이트:", data);

    setFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.file_id === data.file_id
          ? {
              ...file,
              vectorized: data.vectorized || data.status === "completed",
              vectorization_status:
                data.status === "started" ? "processing" : data.status,
            }
          : file
      )
    );

    // 벡터화 시작 시에는 processing 상태 유지, 완료/실패 시에만 제거
    if (data.status === "completed" || data.status === "failed") {
      setProcessing((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(data.file_id);
        return newSet;
      });
    }

    // 토스트 알림
    if (data.status === "started") {
      console.log(`🚀 벡터화 시작 확인: ${data.filename}`);
      // 시작 시에는 별도 토스트 없음 (이미 표시했음)
    } else if (data.status === "completed") {
      toast({
        title: "벡터화 완료",
        description: `"${data.filename}" 파일의 벡터화가 완료되었습니다.`,
      });
    } else if (data.status === "failed") {
      toast({
        title: "벡터화 실패",
        description: `"${data.filename}" 파일의 벡터화에 실패했습니다.`,
        variant: "destructive",
      });
    }
  };

  // SSE 연결
  const { isConnected, connectionStatus } = useVectorizationSSE(
    handleVectorizationUpdate
  );

  // 페이지 포커스 시 데이터 새로고침
  useEffect(() => {
    const handleFocus = () => {
      console.log("벡터화 페이지 포커스됨 - 데이터 새로고침");
      loadVectorizationData();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        console.log("벡터화 페이지 가시성 변경 - 데이터 새로고침");
        loadVectorizationData();
      }
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadVectorizationData]);

  // 설정 로드 (Docling, 기본 설정, 벡터화 설정)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Docling 설정, 기본 설정, 벡터화 설정을 동시에 로드
        const [doclingSettings, basicSettings, vecSettings] = await Promise.all([
          doclingAPI.getDoclingSettings(),
          settingsAPI.getSettings(),
          settingsAPI.getVectorizationSettings()
        ]);
        
        setCurrentSettings(doclingSettings);
        setSystemSettings(basicSettings);
        setVectorizationSettings(vecSettings);
      } catch (error) {
        console.error("설정 로드 실패:", error);
      }
    };
    loadSettings();
  }, []);

  // 자동 새로고침 기능 (SSE 연결 실패 시 백업용)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if ((autoRefresh || processing.size > 0) && !isConnected) {
      // SSE가 연결되지 않았을 때만 폴링 사용
      console.log("📡 SSE 미연결 - 백업 폴링 시작");
      interval = setInterval(() => {
        loadVectorizationData();
      }, 10000); // 10초마다 새로고침 (SSE 백업용)
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, processing.size, isConnected]);

  const handleVectorizeFile = async (fileId: string, filename: string) => {
    // 이미 처리 중인 파일인지 확인 (중복 클릭 방지)
    if (processing.has(fileId)) {
      console.log(`⚠️ 벡터화 중복 클릭 방지: ${filename}`);
      return;
    }

    try {
      setProcessing((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.add(fileId);
        return newSet;
      });

      // 비동기 백그라운드 벡터화 사용 (Docling 설정은 백엔드에서 자동 처리)
      const response = await fileAPI.vectorizeFile(fileId);

      // 백엔드 응답 메시지를 사용한 알림
      toast({
        title: "벡터화 시작",
        description:
          response?.message || `"${filename}" 파일의 벡터화가 시작되었습니다.`,
      });

      // 즉시 데이터 새로고침 및 주기적 체크
      await loadVectorizationData();

      // SSE가 연결된 경우 폴링하지 않음 (실시간 업데이트 대기)
      if (isConnected) {
        console.log("✅ SSE 연결됨 - 실시간 상태 업데이트 대기");
      } else {
        console.log("⚠️ SSE 미연결 - 백업 폴링 로직으로 상태 확인");
        // SSE가 연결되지 않은 경우에만 간단한 백업 확인
        setTimeout(async () => {
          await loadVectorizationData();
          const updatedFiles = await fileAPI.getFiles();
          const updatedFile = updatedFiles.find(
            (f: any) => f.file_id === fileId
          );

          if (updatedFile?.vectorized || updatedFile?.error_message) {
            setProcessing((prev) => {
              const newSet = new Set(Array.from(prev));
              newSet.delete(fileId);
              return newSet;
            });
          }
        }, 5000);
      }
    } catch (error: any) {
      console.error("벡터화 요청 오류:", error);

      // HTTP 타임아웃이나 네트워크 오류 vs 실제 벡터화 실패 구분
      const isNetworkError =
        error?.code === "NETWORK_ERROR" || error?.code === "TIMEOUT_ERROR";

      toast({
        title: isNetworkError ? "네트워크 오류" : "벡터화 요청 실패",
        description:
          error?.response?.data?.detail ||
          (isNetworkError
            ? `"${filename}" 파일 벡터화 요청 중 네트워크 오류가 발생했습니다.`
            : `"${filename}" 파일의 벡터화 요청에 실패했습니다.`),
        variant: "destructive",
      });

      // 네트워크 오류가 아닌 경우에만 processing 제거
      if (!isNetworkError) {
        setProcessing((prev) => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(fileId);
          return newSet;
        });
      }
    }
  };

  const handleRevectorizeFile = (fileId: string, filename: string) => {
    setConfirmRevectorize({
      isOpen: true,
      fileId,
      filename,
      isAllFiles: false,
    });
  };

  const executeRevectorizeFile = async () => {
    const { fileId, filename } = confirmRevectorize;

    // 모달 닫기
    setConfirmRevectorize({
      isOpen: false,
      fileId: "",
      filename: "",
      isAllFiles: false,
    });

    // 이미 처리 중인 파일인지 확인 (중복 클릭 방지)
    if (processing.has(fileId)) {
      console.log(`⚠️ 재벡터화 중복 클릭 방지: ${filename}`);
      return;
    }

    try {
      setProcessing((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.add(fileId);
        return newSet;
      });

      const response = await fileAPI.revectorizeFile(fileId);

      // 백엔드 응답 메시지를 사용한 알림
      toast({
        title: "재벡터화 시작",
        description:
          response?.message ||
          `"${filename}" 파일의 재벡터화가 시작되었습니다.`,
      });

      // 즉시 데이터 새로고침
      await loadVectorizationData();

      // SSE가 연결된 경우 폴링하지 않음 (실시간 업데이트 대기)
      if (isConnected) {
        console.log("✅ SSE 연결됨 - 실시간 상태 업데이트 대기");
      } else {
        console.log("⚠️ SSE 미연결 - 백업 폴링 로직으로 상태 확인");
        // SSE가 연결되지 않은 경우에만 간단한 백업 확인
        setTimeout(async () => {
          await loadVectorizationData();
          const updatedFiles = await fileAPI.getFiles();
          const updatedFile = updatedFiles.find(
            (f: any) => f.file_id === fileId
          );

          if (updatedFile?.vectorized || updatedFile?.error_message) {
            setProcessing((prev) => {
              const newSet = new Set(Array.from(prev));
              newSet.delete(fileId);
              return newSet;
            });
          }
        }, 5000);
      }
    } catch (error: any) {
      console.error("재벡터화 요청 오류:", error);

      // HTTP 타임아웃이나 네트워크 오류 vs 실제 벡터화 실패 구분
      const isNetworkError =
        error?.code === "NETWORK_ERROR" || error?.code === "TIMEOUT_ERROR";

      toast({
        title: isNetworkError ? "네트워크 오류" : "재벡터화 요청 실패",
        description:
          error?.response?.data?.detail ||
          (isNetworkError
            ? `"${filename}" 파일 재벡터화 요청 중 네트워크 오류가 발생했습니다.`
            : `"${filename}" 파일의 재벡터화 요청에 실패했습니다.`),
        variant: "destructive",
      });

      // 네트워크 오류가 아닌 경우에만 processing 제거
      if (!isNetworkError) {
        setProcessing((prev) => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(fileId);
          return newSet;
        });
      }
    }
  };

  const handleForceReprocess = async (fileId: string, filename: string) => {
    console.log(`🔄 강제 재처리 시작: ${filename} (${fileId})`);

    // 이미 처리 중인 파일인지 확인 (중복 클릭 방지)
    if (processing.has(fileId)) {
      console.log(`⚠️ 강제 재처리 중복 클릭 방지: ${filename}`);
      return;
    }

    try {
      setProcessing((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.add(fileId);
        return newSet;
      });

      const response = await fileAPI.forceReprocessFile(fileId);

      // 백엔드 응답 메시지를 사용한 알림
      toast({
        title: "강제 재처리 시작",
        description:
          response?.message ||
          `"${filename}" 파일의 강제 재처리가 시작되었습니다.`,
      });

      // 즉시 데이터 새로고침
      await loadVectorizationData();

      // SSE가 연결된 경우 폴링하지 않음 (실시간 업데이트 대기)
      if (isConnected) {
        console.log("✅ SSE 연결됨 - 실시간 상태 업데이트 대기");
      } else {
        console.log("⚠️ SSE 미연결 - 백업 폴링 로직으로 상태 확인");
        // SSE가 연결되지 않은 경우에만 간단한 백업 확인
        setTimeout(async () => {
          await loadVectorizationData();
          const updatedFiles = await fileAPI.getFiles();
          const updatedFile = updatedFiles.find(
            (f: any) => f.file_id === fileId
          );

          if (updatedFile?.vectorized || updatedFile?.error_message) {
            setProcessing((prev) => {
              const newSet = new Set(Array.from(prev));
              newSet.delete(fileId);
              return newSet;
            });
          }
        }, 5000);
      }
    } catch (error: any) {
      console.error("강제 재처리 요청 오류:", error);

      // HTTP 타임아웃이나 네트워크 오류 vs 실제 처리 실패 구분
      const isNetworkError =
        error?.code === "NETWORK_ERROR" || error?.code === "TIMEOUT_ERROR";

      toast({
        title: isNetworkError ? "네트워크 오류" : "강제 재처리 요청 실패",
        description:
          error?.response?.data?.detail ||
          (isNetworkError
            ? `"${filename}" 파일 강제 재처리 요청 중 네트워크 오류가 발생했습니다.`
            : `"${filename}" 파일의 강제 재처리 요청에 실패했습니다.`),
        variant: "destructive",
      });

      // 네트워크 오류가 아닌 경우에만 processing 제거
      if (!isNetworkError) {
        setProcessing((prev) => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(fileId);
          return newSet;
        });
      }
    }
  };

  const handleRevectorizeAll = () => {
    const vectorizedFiles = files.filter((f) => f.vectorized || f.status === "completed");

    if (vectorizedFiles.length === 0) {
      toast({
        title: "재벡터화할 파일이 없습니다",
        description: "벡터화가 완료된 파일이 없습니다.",
      });
      return;
    }

    setConfirmRevectorize({
      isOpen: true,
      fileId: "",
      filename: `${vectorizedFiles.length}개 파일`,
      isAllFiles: true,
    });
  };

  const executeRevectorizeAll = async () => {
    const vectorizedFiles = files.filter((f) => f.vectorized || f.status === "completed");

    // 모달 닫기
    setConfirmRevectorize({
      isOpen: false,
      fileId: "",
      filename: "",
      isAllFiles: false,
    });

    try {
      // 모든 파일을 processing 상태로 설정
      const processingSet = new Set(vectorizedFiles.map((f) => f.file_id));
      setProcessing(processingSet);

      // 모든 파일 재벡터화 실행
      const results = await Promise.allSettled(
        vectorizedFiles.map(async (file) => {
          try {
            return await fileAPI.revectorizeFile(file.file_id);
          } catch (error) {
            console.error(`파일 ${file.filename} 재벡터화 실패:`, error);
            throw error;
          }
        })
      );

      // 성공/실패 분류
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (succeeded > 0) {
        toast({
          title: "일괄 재벡터화 시작",
          description: `${succeeded}개 파일의 재벡터화가 시작되었습니다.${
            failed > 0 ? ` (${failed}개 실패)` : ""
          }`,
        });
      }

      if (failed > 0 && succeeded === 0) {
        toast({
          title: "일괄 재벡터화 실패",
          description: `모든 파일의 재벡터화 시작에 실패했습니다.`,
          variant: "destructive",
        });
      }

      // 즉시 데이터 새로고침
      await loadVectorizationData();

      // 주기적으로 상태 체크 (최대 16초간)
      let attempts = 0;
      const maxAttempts = 8; // 폴링 횟수
      const pollInterval = 2000; // 2초 간격

      const pollForUpdates = async () => {
        if (attempts >= maxAttempts) {
          console.log(`일괄 재벡터화 폴링 완료: ${attempts}회 시도 후 종료`);
          setProcessing(new Set()); // 강제로 processing 상태 해제
          // 마지막으로 한 번 더 데이터 새로고침
          await loadVectorizationData();
          return;
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        await loadVectorizationData();

        // 아직 processing 중인 파일이 있는지 확인
        const updatedFiles = await fileAPI.getFiles();
        const stillPending = updatedFiles.filter(
          (f: any) =>
            processingSet.has(f.file_id) &&
            f.vectorization_status === "processing"
        );

        const completedCount = vectorizedFiles.length - stillPending.length;
        console.log(
          `일괄 재벡터화 폴링 ${attempts}회: ${completedCount}/${vectorizedFiles.length} 완료 (남은 파일: ${stillPending.length}개)`
        );

        if (stillPending.length > 0 && attempts < maxAttempts) {
          pollForUpdates();
        } else {
          console.log(
            `일괄 재벡터화 완료: 총 ${completedCount}/${vectorizedFiles.length} 파일 처리됨`
          );
          setProcessing(new Set()); // 폴링 완료 후 processing 상태 해제
        }
      };

      pollForUpdates();
    } catch (error: any) {
      console.error("일괄 재벡터화 오류:", error);
      toast({
        title: "일괄 재벡터화 실패",
        description: "일부 파일의 재벡터화에 실패했습니다.",
        variant: "destructive",
      });
      setProcessing(new Set()); // 오류 발생시 processing 상태 해제
    }
  };

  const handleVectorizeAll = async () => {
    const pendingFiles = files.filter((f) => !f.vectorized && !f.error_message);

    if (pendingFiles.length === 0) {
      toast({
        title: "벡터화할 파일이 없습니다",
        description: "모든 파일이 이미 벡터화되었거나 오류 상태입니다.",
      });
      return;
    }

    try {
      // 모든 파일을 processing 상태로 설정
      const processingSet = new Set(pendingFiles.map((f) => f.file_id));
      setProcessing(processingSet);

      // 모든 파일 벡터화 실행
      const results = await Promise.allSettled(
        pendingFiles.map(async (file) => {
          try {
            return await fileAPI.vectorizeFile(file.file_id);
          } catch (error) {
            console.error(`파일 ${file.filename} 벡터화 실패:`, error);
            throw error;
          }
        })
      );

      // 성공/실패 분류
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (succeeded > 0) {
        toast({
          title: "일괄 벡터화 완료",
          description: `${succeeded}개 파일의 벡터화가 완료되었습니다.${
            failed > 0 ? ` (${failed}개 실패)` : ""
          }`,
        });
      }

      if (failed > 0 && succeeded === 0) {
        toast({
          title: "일괄 벡터화 실패",
          description: `모든 파일의 벡터화에 실패했습니다.`,
          variant: "destructive",
        });
      }

      // 즉시 데이터 새로고침
      await loadVectorizationData();

      // 주기적으로 상태 체크 (최대 16초간)
      let attempts = 0;
      const maxAttempts = 8; // 폴링 횟수 증가
      const pollInterval = 2000; // 2초 간격 유지

      const pollForUpdates = async () => {
        if (attempts >= maxAttempts) {
          console.log(`일괄 벡터화 폴링 완료: ${attempts}회 시도 후 종료`);
          setProcessing(new Set()); // 강제로 processing 상태 해제
          // 마지막으로 한 번 더 데이터 새로고침
          await loadVectorizationData();
          return;
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        await loadVectorizationData();

        // 아직 processing 중인 파일이 있는지 확인
        const updatedFiles = await fileAPI.getFiles();
        const stillPending = updatedFiles.filter(
          (f: any) =>
            processingSet.has(f.file_id) &&
            !f.vectorized &&
            !f.error_message &&
            f.vectorization_status !== "failed"
        );

        const completedCount = pendingFiles.length - stillPending.length;
        console.log(
          `일괄 벡터화 폴링 ${attempts}회: ${completedCount}/${pendingFiles.length} 완료 (남은 파일: ${stillPending.length}개)`
        );

        if (stillPending.length > 0 && attempts < maxAttempts) {
          pollForUpdates();
        } else {
          console.log(
            `일괄 벡터화 완료: 총 ${completedCount}/${pendingFiles.length} 파일 처리됨`
          );
          setProcessing(new Set()); // 폴링 완료 후 processing 상태 해제
        }
      };

      pollForUpdates();
    } catch (error: any) {
      console.error("일괄 벡터화 오류:", error);
      toast({
        title: "일괄 벡터화 실패",
        description: "일부 파일의 벡터화에 실패했습니다.",
        variant: "destructive",
      });
      setProcessing(new Set()); // 오류 발생시 processing 상태 해제
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = (file: VectorizationFile) => {
    if (processing.has(file.file_id)) {
      return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
    if (file.vectorized) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (file.error_message || file.vectorization_status === "failed") {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (file: VectorizationFile) => {
    // 프론트엔드 processing 상태가 최우선
    if (processing.has(file.file_id)) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          벡터화 진행중
        </Badge>
      );
    }

    // 벡터화 완료
    if (file.vectorized === true) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          벡터화 성공
        </Badge>
      );
    }

    // 서버에서도 진행중인 상태 (vectorizing 상태 추가)
    if (
      file.vectorization_status === "processing" ||
      file.vectorization_status === "in_progress" ||
      file.status === "vectorizing"
    ) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          벡터화 진행중
        </Badge>
      );
    }

    // 오류 상태
    if (
      file.error_message ||
      file.vectorization_status === "failed" ||
      file.vectorization_status === "error"
    ) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          벡터화 실패
        </Badge>
      );
    }

    // 기본 대기 상태
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        대기중
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">벡터화 관리</h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="text-muted-foreground">
              벡터화 상태를 불러오는 중...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">벡터화 관리</h1>
        <div className="flex gap-2">
          <Button
            onClick={loadVectorizationData}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
          {/* SSE 연결 상태 */}
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className="px-3"
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            {isConnected ? "실시간 연결됨" : "연결 끊어짐"}
          </Badge>

          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {isConnected ? "백업 폴링" : "자동 새로고침"}
          </Button>
          <Button
            onClick={handleVectorizeAll}
            size="sm"
            disabled={stats.pendingFiles === 0 || processing.size > 0}
          >
            <Play className="h-4 w-4 mr-2" />
            전체 벡터화
          </Button>
          <Button
            onClick={handleRevectorizeAll}
            size="sm"
            disabled={stats.vectorizedFiles === 0 || processing.size > 0}
            variant="outline"
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            전체 재벡터화
          </Button>
        </div>
      </div>

      {/* 문서 처리 설정 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">문서 처리 설정</CardTitle>
          <CardDescription>
            현재 적용 중인 전처리 방식과 문서 처리 설정을 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 전처리 방식, 임베딩 모델, 벡터 DB 정보 표시 */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="font-medium text-blue-800 dark:text-blue-300">
                  전처리 방식
                </h3>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                {systemSettings?.preprocessing_method === "basic" && (
                  <div>
                    <span className="font-medium">기본 처리</span>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                      빠른 텍스트 추출, 간단한 문서에 적합
                    </p>
                  </div>
                )}
                {systemSettings?.preprocessing_method === "docling" && (
                  <div>
                    <span className="font-medium">Docling</span>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                      고급 문서 구조 분석, 표와 이미지 추출
                    </p>
                  </div>
                )}
                {systemSettings?.preprocessing_method === "unstructured" && (
                  <div>
                    <span className="font-medium">Unstructured</span>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                      포괄적 문서 분석, 다양한 형식 지원
                    </p>
                  </div>
                )}
                {!systemSettings?.preprocessing_method && (
                  <div>
                    <span className="font-medium">설정 로드 중...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <h3 className="font-medium text-purple-800 dark:text-purple-300">
                  임베딩 모델
                </h3>
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                {vectorizationSettings?.embedding_model ? (
                  <div>
                    <div className="font-medium truncate" title={vectorizationSettings.embedding_model.name}>
                      {vectorizationSettings.embedding_model.name}
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-500">
                      {vectorizationSettings.embedding_model.type}
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                      {vectorizationSettings.embedding_model.description}
                    </div>
                    <div className="text-xs font-mono bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-2 py-1 rounded mt-1 inline-block">
                      📏 {vectorizationSettings.embedding_model.dimension || '1536'}차원
                    </div>
                    {vectorizationSettings.embedding_model.is_local && (
                      <div className="text-xs bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200 px-2 py-1 rounded mt-1 inline-block">
                        🏠 로컬 실행
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="font-medium">설정 로드 중...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h3 className="font-medium text-orange-800 dark:text-orange-300">
                  벡터 DB 정보
                </h3>
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                {vectorDbInfo ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${vectorDbInfo.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="font-medium">
                        {vectorDbInfo.connected ? '연결됨' : '연결 안됨'}
                      </span>
                    </div>
                    {vectorDbInfo.connected && (
                      <>
                        <div className="text-xs text-orange-600 dark:text-orange-500">
                          컬렉션: {vectorDbInfo.collections?.join(', ') || 'N/A'}
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-500">
                          총 벡터: {vectorDbInfo.total_vectors?.toLocaleString() || 0}개
                        </div>
                        {vectorDbInfo.dimension && (
                          <div className="text-xs font-mono bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded mt-1 inline-block">
                            📏 {vectorDbInfo.dimension}차원
                          </div>
                        )}
                      </>
                    )}
                    {vectorDbInfo.error && (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        오류: {vectorDbInfo.error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="font-medium">상태 로드 중...</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="font-medium text-green-800 dark:text-green-300">
                  파일 업로드 설정
                </h3>
              </div>
              <div className="text-sm text-green-700 dark:text-green-400 space-y-1">
                <div>
                  <span className="font-medium">최대 크기:</span> {systemSettings?.maxFileSize || 10}MB
                </div>
                <div>
                  <span className="font-medium">지원 형식:</span> {systemSettings?.allowedFileTypes?.length || 0}개
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">
                  {systemSettings?.allowedFileTypes?.join(', ') || '로딩 중...'}
                </div>
              </div>
            </div>
          </div>

          {/* 벡터화 성능 설정 */}
          {vectorizationSettings?.performance_settings && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3 text-purple-800 dark:text-purple-300">
                벡터화 성능 설정
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400">청크 크기</div>
                  <div className="font-medium">{vectorizationSettings.chunk_settings?.chunk_size || 1000}자</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400">청크 오버랩</div>
                  <div className="font-medium">{vectorizationSettings.chunk_settings?.chunk_overlap || 200}자</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400">병렬 처리</div>
                  <div className="font-medium">{vectorizationSettings.performance_settings.enable_parallel ? '활성화' : '비활성화'}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-600 dark:text-gray-400">배치 크기</div>
                  <div className="font-medium">{vectorizationSettings.performance_settings?.batch_size || 10}</div>
                </div>
              </div>
            </div>
          )}

          {/* Docling 세부 설정 */}
          {systemSettings?.preprocessing_method === "docling" && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3 text-purple-800 dark:text-purple-300">
                Docling 세부 설정
              </h3>
              <DoclingSettingsInfo settings={currentSettings} />
            </div>
          )}

          {/* 설정 변경 안내 */}
          <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <span className="font-medium">💡 전처리 방식 변경:</span> 
              <span className="ml-1">기본 설정 페이지에서 변경할 수 있습니다.</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('/admin/settings', '_blank')}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 dark:text-yellow-400 dark:border-yellow-600 dark:hover:bg-yellow-900/50"
            >
              설정 변경
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드들 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 파일</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <p className="text-xs text-muted-foreground">업로드된 파일 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">벡터화 완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.vectorizedFiles}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalVectors.toLocaleString()} 벡터 생성
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">처리 대기</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pendingFiles}
            </div>
            <p className="text-xs text-muted-foreground">벡터화 대기중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">실패</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.failedFiles}
            </div>
            <p className="text-xs text-muted-foreground">벡터화 실패</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 청크</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalChunks.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">생성된 텍스트 청크</p>
          </CardContent>
        </Card>
      </div>

      {/* 진행률 */}
      {stats.totalFiles > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>전체 진행률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>벡터화 진행률</span>
                <span>
                  {Math.round((stats.vectorizedFiles / stats.totalFiles) * 100)}
                  %
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (stats.vectorizedFiles / stats.totalFiles) * 100
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats.vectorizedFiles}개 완료</span>
                <span>{stats.pendingFiles}개 대기</span>
                <span>{stats.failedFiles}개 실패</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 파일 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>파일별 벡터화 상태</CardTitle>
          <CardDescription>
            각 파일의 벡터화 상태를 확인하고 개별적으로 처리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">업로드된 파일이 없습니다.</p>
              <p className="text-sm text-muted-foreground mt-2">
                파일을 업로드하면 벡터화를 진행할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.file_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(file)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{file.filename}</p>
                        {getStatusBadge(file)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>카테고리: {file.category_name}</span>
                        {file.chunk_count && (
                          <span>
                            청크: {file.chunk_count.toLocaleString()}개
                          </span>
                        )}
                        <span>
                          {new Date(file.upload_time).toLocaleString()}
                        </span>
                      </div>
                      {file.error_message && (
                        <p className="text-sm text-red-600 mt-1">
                          오류: {file.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* 벡터화 가능한 조건: 벡터화되지 않았고, 진행중이 아니고, 오류가 아닌 상태 */}
                    {!file.vectorized &&
                      !processing.has(file.file_id) &&
                      file.vectorization_status !== "processing" &&
                      file.vectorization_status !== "in_progress" &&
                      !file.error_message && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing.has(file.file_id)}
                          onClick={() =>
                            handleVectorizeFile(file.file_id, file.filename)
                          }
                        >
                          <Play className="h-4 w-4 mr-2" />
                          벡터화
                        </Button>
                      )}

                    {/* 재시도 버튼 (실패한 경우 또는 vectorizing 상태에서 멈춘 경우) */}
                    {(file.error_message ||
                      file.vectorization_status === "failed" ||
                      file.status === "vectorizing") &&
                      !processing.has(file.file_id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing.has(file.file_id)}
                          onClick={() =>
                            handleVectorizeFile(file.file_id, file.filename)
                          }
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          재시도
                        </Button>
                      )}

                    {/* 강제 재처리 버튼 (PREPROCESSING 또는 FAILED 상태인 경우) */}
                    {(file.status === "preprocessing" || 
                      file.status === "failed" ||
                      file.vectorization_status === "preprocessing" ||
                      (file.error_message && file.status !== "completed")) &&
                      !processing.has(file.file_id) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={processing.has(file.file_id)}
                          onClick={() =>
                            handleForceReprocess(file.file_id, file.filename)
                          }
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          강제 재처리
                        </Button>
                      )}

                    {/* 재벡터화 버튼 (성공한 경우 또는 실패한 경우) */}
                    {(file.vectorized || file.status === "completed" || file.status === "failed") &&
                      !processing.has(file.file_id) &&
                      file.vectorization_status !== "processing" &&
                      file.vectorization_status !== "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing.has(file.file_id)}
                          onClick={() =>
                            handleRevectorizeFile(file.file_id, file.filename)
                          }
                          className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          재벡터화
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 재벡터화 확인 모달 */}
      <Dialog
        open={confirmRevectorize.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmRevectorize({
              isOpen: false,
              fileId: "",
              filename: "",
              isAllFiles: false,
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              재벡터화 확인
            </DialogTitle>
            <DialogDescription>
              {confirmRevectorize.isAllFiles
                ? `총 ${confirmRevectorize.filename}을 재벡터화하시겠습니까?`
                : `"${confirmRevectorize.filename}" 파일을 재벡터화하시겠습니까?`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-800 mb-1">주의사항</h4>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• 기존 벡터 데이터가 완전히 삭제됩니다</li>
                    <li>• 새로운 벡터 데이터로 교체됩니다</li>
                    <li>• 처리 중에는 검색 결과에 영향을 줄 수 있습니다</li>
                    {confirmRevectorize.isAllFiles && (
                      <li>• 모든 파일이 순차적으로 처리됩니다</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmRevectorize({
                  isOpen: false,
                  fileId: "",
                  filename: "",
                  isAllFiles: false,
                })
              }
            >
              취소
            </Button>
            <Button
              onClick={
                confirmRevectorize.isAllFiles
                  ? executeRevectorizeAll
                  : executeRevectorizeFile
              }
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              재벡터화 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
