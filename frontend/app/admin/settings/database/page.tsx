"use client";

import { useState, useEffect, useCallback } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Database, 
  Save, 
  RefreshCw, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Server,
  FileText,
  Layers,
  DatabaseZap,
  Sparkles,
  HardDrive,
  Download,
  Users,
  Archive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { databaseAPI } from "@/lib/api";

// --- 인터페이스 정의 ---
interface DatabaseInfo {
  name: string;
  description: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  size_formatted: string;
  type: string;
  last_modified?: string;
  // 각 DB별 추가 정보
  connected?: boolean;
  collections?: string[];
  total_vectors?: number;
  record_count?: number;
  tables?: string[];
  user_count?: number;
  error?: string;
}

interface DatabaseStatus {
  timestamp: string;
  databases: {
    chromadb: DatabaseInfo;
    metadata: DatabaseInfo;
    users: DatabaseInfo;
  };
}

// --- 데이터베이스 카드 컴포넌트 ---
interface DatabaseCardProps {
  database: DatabaseInfo;
  onBackup: () => void;
  onReset: () => void;
  isLoading: boolean;
}

const DatabaseCard = ({ database, onBackup, onReset, isLoading }: DatabaseCardProps) => {
  const getStatusIcon = () => {
    if (database.error) return <XCircle className="h-5 w-5 text-red-500" />;
    if (!database.exists) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (database.connected === false) return <XCircle className="h-5 w-5 text-red-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = () => {
    if (database.error) return "오류";
    if (!database.exists) return "미존재";
    if (database.connected === false) return "연결 끊김";
    return "정상";
  };

  const getStatusColor = () => {
    if (database.error) return "text-red-500";
    if (!database.exists) return "text-yellow-500";
    if (database.connected === false) return "text-red-500";
    return "text-green-500";
  };

  const getIcon = () => {
    switch (database.name) {
      case "CHROMADB": return <Database className="h-6 w-6" />;
      case "METADATA": return <FileText className="h-6 w-6" />;
      case "USERS": return <Users className="h-6 w-6" />;
      default: return <Server className="h-6 w-6" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getIcon()}
            {database.name}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </CardTitle>
        <CardDescription>{database.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 기본 정보 */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">경로:</span>
            <span className="font-mono text-xs break-all">{database.path}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">크기:</span>
            <span>{database.size_formatted}</span>
          </div>
          {database.last_modified && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">수정:</span>
              <span>{new Date(database.last_modified).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* 각 DB별 상세 정보 */}
        {database.name === "CHROMADB" && database.exists && (
          <div className="space-y-2 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">벡터 수:</span>
              <span>{database.total_vectors?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">컬렉션:</span>
              <span>{database.collections?.length || 0}개</span>
            </div>
          </div>
        )}

        {database.name === "METADATA" && database.exists && (
          <div className="space-y-2 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">레코드:</span>
              <span>{database.record_count?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">테이블:</span>
              <span>{database.tables?.length || 0}개</span>
            </div>
          </div>
        )}

        {database.name === "USERS" && database.exists && (
          <div className="space-y-2 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">사용자:</span>
              <span>{database.user_count?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">테이블:</span>
              <span>{database.tables?.length || 0}개</span>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {database.error && (
          <div className="p-2 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
            {database.error}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2 border-t">
          <Button 
            onClick={onBackup} 
            disabled={isLoading || !database.exists}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1" />
            백업
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                disabled={isLoading}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                초기화
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  {database.name} 초기화 확인
                </DialogTitle>
                <DialogDescription>
                  정말로 {database.name} 데이터베이스를 초기화하시겠습니까? 
                  {database.name === "USERS" && (
                    <span className="text-red-600 font-medium"> 모든 사용자 데이터가 삭제됩니다!</span>
                  )}
                  <br />
                  <span className="text-green-600 font-medium">
                    안전을 위해 초기화 전에 자동으로 백업이 생성됩니다.
                  </span>
                  <br />
                  이 작업은 되돌릴 수 없습니다.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">취소</Button>
                <Button variant="destructive" onClick={onReset} disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  예, 초기화합니다
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

// --- 메인 컴포넌트 ---
export default function DatabaseManagementPage() {
  const { toast } = useToast();
  
  // --- 상태 관리 ---
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  // --- 데이터 로딩 ---
  const fetchData = useCallback(async () => {
    try {
      const status = await databaseAPI.getAllDatabaseStatus();
      setDatabaseStatus(status);
    } catch (error) {
      console.error("데이터베이스 상태 로드 오류:", error);
      toast({
        title: "오류",
        description: "데이터베이스 상태를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30초마다 상태 자동 갱신
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- 액션 핸들러 ---
  const handleBackup = async (dbType: string) => {
    setActionLoading(prev => ({ ...prev, [`backup_${dbType}`]: true }));
    try {
      let result;
      switch (dbType) {
        case "chromadb":
          result = await databaseAPI.backupChromaDB();
          break;
        case "metadata":
          result = await databaseAPI.backupMetadataDB();
          break;
        case "users":
          result = await databaseAPI.backupUsersDB();
          break;
        default:
          throw new Error("알 수 없는 데이터베이스 유형");
      }
      
      toast({
        title: "백업 완료",
        description: `${dbType.toUpperCase()} 백업이 완료되었습니다. (${result.backup_size})`
      });
      await fetchData();
    } catch (error) {
      console.error(`${dbType} 백업 오류:`, error);
      toast({
        title: "백업 실패",
        description: `${dbType.toUpperCase()} 백업 중 오류가 발생했습니다.`,
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`backup_${dbType}`]: false }));
    }
  };

  const handleReset = async (dbType: string) => {
    setActionLoading(prev => ({ ...prev, [`reset_${dbType}`]: true }));
    try {
      let result;
      switch (dbType) {
        case "chromadb":
          result = await databaseAPI.resetChromaDB();
          break;
        case "metadata":
          result = await databaseAPI.resetMetadataDB();
          break;
        case "users":
          result = await databaseAPI.resetUsersDB();
          break;
        default:
          throw new Error("알 수 없는 데이터베이스 유형");
      }
      
      // 백업 정보 포함된 메시지 생성
      let description = `${dbType.toUpperCase()} 데이터베이스가 초기화되었습니다.`;
      
      if (result.backup_info) {
        if (result.backup_info.backup_created) {
          description += ` 백업 파일: ${result.backup_info.backup_size}`;
        } else if (result.backup_info.backup_error) {
          description += ` (백업 실패: ${result.backup_info.backup_error})`;
        }
      }
      
      toast({
        title: "초기화 완료",
        description: description
      });
      await fetchData();
    } catch (error) {
      console.error(`${dbType} 초기화 오류:`, error);
      toast({
        title: "초기화 실패",
        description: `${dbType.toUpperCase()} 초기화 중 오류가 발생했습니다.`,
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`reset_${dbType}`]: false }));
    }
  };

  const handleBackupAll = async () => {
    setActionLoading(prev => ({ ...prev, backup_all: true }));
    try {
      const result = await databaseAPI.backupAllDatabases();
      
      toast({
        title: "전체 백업 완료",
        description: `${result.message}. 성공: ${result.results.filter((r: any) => r.result).length}개`
      });
      await fetchData();
    } catch (error) {
      console.error("전체 백업 오류:", error);
      toast({
        title: "전체 백업 실패",
        description: "전체 백업 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, backup_all: false }));
    }
  };

  // --- 렌더링 ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-4 text-lg">데이터베이스 상태를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DatabaseZap className="h-8 w-8" />
            데이터베이스 관리
          </h1>
          <p className="text-muted-foreground">
            ChromaDB, 메타데이터, 사용자 데이터베이스를 통합 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button 
            onClick={handleBackupAll} 
            disabled={actionLoading.backup_all}
            variant="default"
            size="sm"
          >
            {actionLoading.backup_all ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            전체 백업
          </Button>
        </div>
      </div>

      {/* 마지막 업데이트 시간 */}
      {databaseStatus && (
        <div className="text-sm text-muted-foreground">
          마지막 업데이트: {new Date(databaseStatus.timestamp).toLocaleString()}
        </div>
      )}

      {/* 데이터베이스 카드들 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {databaseStatus && Object.entries(databaseStatus.databases).map(([key, db]) => (
          <DatabaseCard
            key={key}
            database={db}
            onBackup={() => handleBackup(key)}
            onReset={() => handleReset(key)}
            isLoading={actionLoading[`backup_${key}`] || actionLoading[`reset_${key}`]}
          />
        ))}
      </div>

      {/* 경고 메시지 */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-300">
                주의사항
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                <li>• 데이터베이스 초기화는 되돌릴 수 없는 작업입니다.</li>
                <li>• 사용자 DB 초기화 시 모든 사용자 계정이 삭제됩니다.</li>
                <li>• <span className="text-green-600 font-medium">초기화 시 자동으로 백업이 생성되어 안전합니다.</span></li>
                <li>• 백업 파일은 data/backups 디렉토리에 저장됩니다.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}