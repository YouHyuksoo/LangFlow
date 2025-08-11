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
  Database,
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";
import { fileAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
}

interface VectorizationStats {
  totalFiles: number;
  vectorizedFiles: number;
  pendingFiles: number;
  failedFiles: number;
  totalVectors: number;
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
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadVectorizationData = async () => {
    try {
      setLoading(true);

      // 동시에 데이터 로드
      const [filesResponse, chromaStatus] = await Promise.all([
        fileAPI.getFiles(),
        fileAPI.getChromaDBStatus().catch(() => ({ collection_count: 0 })) // ChromaDB 상태 조회 실패 시 기본값 사용
      ]);
      
      setFiles(filesResponse);

      // 디버그: 받은 파일 데이터 확인
      console.log('🔍 API에서 받은 파일 데이터:', filesResponse);
      filesResponse.forEach((f: VectorizationFile) => {
        console.log(`📄 ${f.filename}: vectorized=${f.vectorized} (타입: ${typeof f.vectorized}), status=${f.status}, vectorization_status=${f.vectorization_status}`);
      });

      // 통계 계산 (벡터화 상태를 더 정확히 분류)
      const vectorizedFiles = filesResponse.filter((f: VectorizationFile) => f.vectorized === true);
      const vectorizedCount = vectorizedFiles.length;
      console.log('✅ 벡터화 완료된 파일들:', vectorizedFiles.map((f: VectorizationFile) => f.filename));
      
      const failedFiles = filesResponse.filter(
        (f: VectorizationFile) =>
          f.vectorization_status === "failed" || 
          f.error_message || 
          (f.vectorization_status === "error")
      );
      const failedCount = failedFiles.length;
      console.log('❌ 벡터화 실패한 파일들:', failedFiles.map((f: VectorizationFile) => f.filename));
      
      const processingFiles = filesResponse.filter(
        (f: VectorizationFile) => 
          f.vectorization_status === "processing" ||
          f.vectorization_status === "in_progress" ||
          processing.has(f.file_id)
      );
      const processingCount = processingFiles.length;
      console.log('🔄 벡터화 진행중인 파일들:', processingFiles.map((f: VectorizationFile) => f.filename));
      
      const pendingCount = filesResponse.length - vectorizedCount - failedCount - processingCount;
      console.log(`📊 통계 계산: 총 ${filesResponse.length}개 파일 중 완료=${vectorizedCount}, 실패=${failedCount}, 진행중=${processingCount}, 대기=${pendingCount}`);

      setStats({
        totalFiles: filesResponse.length,
        vectorizedFiles: vectorizedCount,
        pendingFiles: Math.max(0, pendingCount), // 음수 방지
        failedFiles: failedCount,
        totalVectors: chromaStatus?.collection_count || 0,
      });
      
      console.log('벡터화 데이터 업데이트:', {
        total: filesResponse.length,
        vectorized: vectorizedCount,
        pending: Math.max(0, pendingCount),
        failed: failedCount,
        processing: processingCount
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
  
  // 페이지 포커스 시 데이터 새로고침
  useEffect(() => {
    const handleFocus = () => {
      console.log('벡터화 페이지 포커스됨 - 데이터 새로고침');
      loadVectorizationData();
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('벡터화 페이지 가시성 변경 - 데이터 새로고침');
        loadVectorizationData();
      }
    });
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadVectorizationData]);
  
  // 자동 새로고침 기능
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh || processing.size > 0) {
      // 진행중인 작업이 있거나 자동 새로고침이 활성된 경우
      interval = setInterval(() => {
        loadVectorizationData();
      }, 3000); // 3초마다 새로고침
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, processing.size]);

  const handleVectorizeFile = async (fileId: string, filename: string) => {
    try {
      setProcessing((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.add(fileId);
        return newSet;
      });
      
      const response = await fileAPI.vectorizeFile(fileId);
      
      // 백엔드 응답에 따른 정확한 메시지 표시
      toast({
        title: "벡터화 완료",
        description: response?.message || `"${filename}" 파일의 벡터화가 완료되었습니다.`,
      });

      // 즉시 데이터 새로고침 및 주기적 체크
      await loadVectorizationData();
      
      // 벡터화 상태가 업데이트될 때까지 폴링
      let attempts = 0;
      const maxAttempts = 8; // 폴링 횟수 증가
      const pollInterval = 1500; // 폴링 간격을 1.5초로 단축
      
      const pollForUpdate = async () => {
        if (attempts >= maxAttempts) {
          console.log(`폴링 완료: ${attempts}회 시도 후 종료`);
          // 마지막으로 한 번 더 데이터 새로고침
          await loadVectorizationData();
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        await loadVectorizationData();
        
        // 현재 파일의 상태 확인
        const updatedFiles = await fileAPI.getFiles();
        const updatedFile = updatedFiles.find((f: any) => f.file_id === fileId);
        
        console.log(`폴링 ${attempts}회: ${updatedFile?.filename} 상태 확인 - vectorized: ${updatedFile?.vectorized}`);
        
        // 벡터화가 완료되었거나 실패한 경우 폴링 종료
        if (updatedFile?.vectorized || updatedFile?.error_message || updatedFile?.vectorization_status === "failed") {
          console.log(`벡터화 상태 업데이트 완료: ${updatedFile?.filename}`);
          return;
        }
        
        if (attempts < maxAttempts) {
          pollForUpdate();
        }
      };
      
      pollForUpdate();
      
    } catch (error: any) {
      console.error('벡터화 오류:', error);
      toast({
        title: "벡터화 실패",
        description: error?.response?.data?.detail || `"${filename}" 파일의 벡터화에 실패했습니다.`,
        variant: "destructive",
      });
    } finally {
      setProcessing((prev) => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(fileId);
        return newSet;
      });
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
      const processingSet = new Set(pendingFiles.map(f => f.file_id));
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
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (succeeded > 0) {
        toast({
          title: "일괄 벡터화 완료",
          description: `${succeeded}개 파일의 벡터화가 완료되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ''}`,
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
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        await loadVectorizationData();
        
        // 아직 processing 중인 파일이 있는지 확인
        const updatedFiles = await fileAPI.getFiles();
        const stillPending = updatedFiles.filter((f: any) => 
          processingSet.has(f.file_id) && !f.vectorized && !f.error_message && f.vectorization_status !== "failed"
        );
        
        const completedCount = pendingFiles.length - stillPending.length;
        console.log(`일괄 벡터화 폴링 ${attempts}회: ${completedCount}/${pendingFiles.length} 완료 (남은 파일: ${stillPending.length}개)`);
        
        if (stillPending.length > 0 && attempts < maxAttempts) {
          pollForUpdates();
        } else {
          console.log(`일괄 벡터화 완료: 총 ${completedCount}/${pendingFiles.length} 파일 처리됨`);
          setProcessing(new Set()); // 폴링 완료 후 processing 상태 해제
        }
      };
      
      pollForUpdates();
      
    } catch (error: any) {
      console.error('일괄 벡터화 오류:', error);
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
    return <Clock className="h-4 w-4 text-gray-400" />;
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
    
    // 서버에서도 진행중인 상태
    if (file.vectorization_status === "processing" || 
        file.vectorization_status === "in_progress") {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          벡터화 진행중
        </Badge>
      );
    }
    
    // 오류 상태
    if (file.error_message || 
        file.vectorization_status === "failed" ||
        file.vectorization_status === "error") {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          벡터화 실패
        </Badge>
      );
    }
    
    // 기본 대기 상태
    return (
      <Badge className="bg-gray-100 text-gray-800 border-gray-200">
        <Clock className="h-3 w-3 mr-1" />
        대기중
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">벡터화 관리</h1>
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
        <h1 className="text-3xl font-bold tracking-tight">벡터화 관리</h1>
        <div className="flex gap-2">
          <Button 
            onClick={loadVectorizationData} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            자동 새로고침
          </Button>
          <Button
            onClick={handleVectorizeAll}
            size="sm"
            disabled={stats.pendingFiles === 0 || processing.size > 0}
          >
            <Play className="h-4 w-4 mr-2" />
            전체 벡터화
          </Button>
        </div>
      </div>

      {/* 통계 카드들 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <div className="w-full bg-gray-200 rounded-full h-3">
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
                          onClick={() =>
                            handleVectorizeFile(file.file_id, file.filename)
                          }
                        >
                          <Play className="h-4 w-4 mr-2" />
                          벡터화
                        </Button>
                      )}
                    
                    {/* 재시도 버튼 (실패한 경우) */}
                    {(file.error_message || file.vectorization_status === "failed") &&
                      !processing.has(file.file_id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleVectorizeFile(file.file_id, file.filename)
                          }
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          재시도
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
