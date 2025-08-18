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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Cpu, 
  Save, 
  Zap, 
  Activity, 
  Database,
  Clock,
  BarChart3,
  TrendingUp,
  Server
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { settingsAPI } from "@/lib/api";

interface PerformanceSettings {
  // 병렬 처리 설정
  maxConcurrentEmbeddings: number;
  maxConcurrentChunks: number;
  embeddingPoolSize: number;
  chunkStreamBufferSize: number;
  
  // 연결 및 캐시 설정
  connectionPoolSize: number;
  cacheTtlSeconds: number;
  
  // 성능 최적화 플래그
  enableParallelProcessing: boolean;
  enableStreamingChunks: boolean;
  enableSmartCaching: boolean;
  enableBatchProcessing: boolean;
  
  // 리소스 제한
  maxMemoryUsageMB: number;
  maxCpuUsagePercent: number;
  requestTimeoutSeconds: number;
  
  // 모니터링 설정
  enablePerformanceMonitoring: boolean;
  logPerformanceMetrics: boolean;
}

export default function PerformancePage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PerformanceSettings>({
    maxConcurrentEmbeddings: 5,
    maxConcurrentChunks: 20,
    embeddingPoolSize: 3,
    chunkStreamBufferSize: 100,
    connectionPoolSize: 10,
    cacheTtlSeconds: 3600,
    enableParallelProcessing: true,
    enableStreamingChunks: true,
    enableSmartCaching: true,
    enableBatchProcessing: false,
    maxMemoryUsageMB: 2048,
    maxCpuUsagePercent: 80,
    requestTimeoutSeconds: 300,
    enablePerformanceMonitoring: true,
    logPerformanceMetrics: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    memory: 0,
    activeConnections: 0,
    cacheHitRate: 0,
  });

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.getPerformanceSettings();
      setSettings({
        maxConcurrentEmbeddings: data.maxConcurrentEmbeddings || 5,
        maxConcurrentChunks: data.maxConcurrentChunks || 20,
        embeddingPoolSize: data.embeddingPoolSize || 3,
        chunkStreamBufferSize: data.chunkStreamBufferSize || 100,
        connectionPoolSize: data.connectionPoolSize || 10,
        cacheTtlSeconds: data.cacheTtlSeconds || 3600,
        enableParallelProcessing: data.enableParallelProcessing ?? true,
        enableStreamingChunks: data.enableStreamingChunks ?? true,
        enableSmartCaching: data.enableSmartCaching ?? true,
        enableBatchProcessing: data.enableBatchProcessing ?? false,
        maxMemoryUsageMB: data.maxMemoryUsageMB || 2048,
        maxCpuUsagePercent: data.maxCpuUsagePercent || 80,
        requestTimeoutSeconds: data.requestTimeoutSeconds || 300,
        enablePerformanceMonitoring: data.enablePerformanceMonitoring ?? true,
        logPerformanceMetrics: data.logPerformanceMetrics ?? false,
      });
    } catch (error) {
      console.error("성능 설정 로드 오류:", error);
      toast({
        title: "오류",
        description: "성능 설정을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const fetchSystemStats = async () => {
    try {
      const data = await settingsAPI.getSystemStats();
      setSystemStats({
        cpu: data.cpu || 0,
        memory: data.memory || 0,
        activeConnections: data.activeConnections || 0,
        cacheHitRate: data.cacheHitRate || 0,
      });
    } catch (error) {
      console.error("시스템 통계 로드 오류:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchSystemStats()]);
      setLoading(false);
    };
    loadData();

    // 시스템 통계를 주기적으로 업데이트
    const statsInterval = setInterval(fetchSystemStats, 10000);
    return () => clearInterval(statsInterval);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updatePerformanceSettings(settings);
      toast({
        title: "성공",
        description: "성능 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("성능 설정 저장 오류:", error);
      toast({
        title: "오류",
        description: "성능 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      maxConcurrentEmbeddings: 5,
      maxConcurrentChunks: 20,
      embeddingPoolSize: 3,
      chunkStreamBufferSize: 100,
      connectionPoolSize: 10,
      cacheTtlSeconds: 3600,
      enableParallelProcessing: true,
      enableStreamingChunks: true,
      enableSmartCaching: true,
      enableBatchProcessing: false,
      maxMemoryUsageMB: 2048,
      maxCpuUsagePercent: 80,
      requestTimeoutSeconds: 300,
      enablePerformanceMonitoring: true,
      logPerformanceMetrics: false,
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">성능 설정을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Cpu className="h-8 w-8 text-orange-500" />
            성능 관리
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            시스템 성능과 리소스 사용량을 최적화합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            기본값 복원
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* 시스템 현재 상태 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4 text-orange-500" />
              CPU 사용률
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.cpu.toFixed(1)}%</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              제한: {settings.maxCpuUsagePercent}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              메모리 사용량
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.memory.toFixed(0)}MB</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              제한: {settings.maxMemoryUsageMB}MB
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4 text-green-500" />
              활성 연결
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.activeConnections}</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              풀 크기: {settings.connectionPoolSize}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              캐시 적중률
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.cacheHitRate.toFixed(1)}%</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              TTL: {Math.floor(settings.cacheTtlSeconds / 60)}분
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 병렬 처리 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            병렬 처리 설정
          </CardTitle>
          <CardDescription>
            동시 처리 작업 수와 리소스 풀 크기를 조정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium">동시 임베딩 수</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={settings.maxConcurrentEmbeddings}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxConcurrentEmbeddings: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 3-10
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">동시 청크 처리 수</label>
              <Input
                type="number"
                min="5"
                max="100"
                value={settings.maxConcurrentChunks}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxConcurrentChunks: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 10-50
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">임베딩 풀 크기</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.embeddingPoolSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    embeddingPoolSize: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 2-5
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">청크 스트림 버퍼</label>
              <Input
                type="number"
                min="10"
                max="500"
                value={settings.chunkStreamBufferSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunkStreamBufferSize: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 50-200
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="parallel-processing"
                checked={settings.enableParallelProcessing}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    enableParallelProcessing: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="parallel-processing" className="text-sm font-medium">
                병렬 처리 활성화
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="batch-processing"
                checked={settings.enableBatchProcessing}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    enableBatchProcessing: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="batch-processing" className="text-sm font-medium">
                배치 처리 활성화
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 연결 및 캐시 설정 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-500" />
              연결 설정
            </CardTitle>
            <CardDescription>
              데이터베이스 연결 풀과 타임아웃을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">연결 풀 크기</label>
              <Input
                type="number"
                min="5"
                max="50"
                value={settings.connectionPoolSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    connectionPoolSize: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 5-20
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">요청 타임아웃 (초)</label>
              <Input
                type="number"
                min="30"
                max="600"
                value={settings.requestTimeoutSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    requestTimeoutSeconds: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 120-300
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              캐시 설정
            </CardTitle>
            <CardDescription>
              메모리 캐시와 생존 시간을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">캐시 TTL (초)</label>
              <Input
                type="number"
                min="300"
                max="86400"
                value={settings.cacheTtlSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cacheTtlSeconds: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 1800-7200 ({Math.floor(settings.cacheTtlSeconds / 60)}분)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="smart-caching"
                  checked={settings.enableSmartCaching}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableSmartCaching: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <label htmlFor="smart-caching" className="text-sm font-medium">
                  스마트 캐싱 활성화
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="streaming-chunks"
                  checked={settings.enableStreamingChunks}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableStreamingChunks: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <label htmlFor="streaming-chunks" className="text-sm font-medium">
                  스트리밍 청크 활성화
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 리소스 제한 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            리소스 제한
          </CardTitle>
          <CardDescription>
            시스템 리소스 사용량의 최대 허용치를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">최대 메모리 사용량 (MB)</label>
              <Input
                type="number"
                min="512"
                max="16384"
                value={settings.maxMemoryUsageMB}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxMemoryUsageMB: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 1024-4096MB
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">최대 CPU 사용률 (%)</label>
              <Input
                type="number"
                min="10"
                max="100"
                value={settings.maxCpuUsagePercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxCpuUsagePercent: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                권장: 60-90%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 모니터링 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            성능 모니터링
          </CardTitle>
          <CardDescription>
            성능 지표 수집과 로깅을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="performance-monitoring"
                checked={settings.enablePerformanceMonitoring}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    enablePerformanceMonitoring: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="performance-monitoring" className="text-sm font-medium">
                성능 모니터링 활성화
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="log-metrics"
                checked={settings.logPerformanceMetrics}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    logPerformanceMetrics: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="log-metrics" className="text-sm font-medium">
                성능 지표 로깅
              </label>
            </div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 성능 최적화 팁:</strong><br/>
              • 동시 처리 수는 시스템 사양에 맞게 조정하세요<br/>
              • 캐시 TTL은 데이터 변경 빈도를 고려하여 설정하세요<br/>
              • 리소스 제한은 시스템 안정성을 위해 여유를 두고 설정하세요
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}