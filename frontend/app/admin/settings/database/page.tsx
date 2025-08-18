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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Archive,
  Search,
  Zap,
  CheckCircle2,
  File,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { databaseAPI, vectorAPI } from "@/lib/api";

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
  file_count?: number;
  error?: string;
}

interface DatabaseStatus {
  timestamp: string;
  databases: {
    [key: string]: DatabaseInfo;
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
    const dbName = database.name.toUpperCase();
    switch (dbName) {
      case "FILE_METADATA": return <File className="h-6 w-6" />;
      case "METADATA": return <FileText className="h-6 w-6" />;
      case "USERS": return <Users className="h-6 w-6" />;
      case "CHROMADB_MAIN": return <Database className="h-6 w-6" />;
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
        {database.name.toUpperCase() === "CHROMADB_MAIN" && database.exists && (
          <div className="space-y-2 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">타입:</span>
              <span>ChromaDB SQLite</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">용도:</span>
              <span>벡터 데이터베이스</span>
            </div>
          </div>
        )}

        {database.name.toUpperCase() === "METADATA" && database.exists && (
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

        {database.name.toUpperCase() === "USERS" && database.exists && (
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

        {database.name.toUpperCase() === "FILE_METADATA" && database.exists && (
          <div className="space-y-2 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">파일 수:</span>
              <span>{database.file_count?.toLocaleString() || 0}</span>
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
                  정말로 {database.name.toUpperCase()} 데이터베이스를 초기화하시겠습니까? 
                  {database.name.toUpperCase() === "USERS" && (
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
  
  // --- 동기화 관련 상태 ---
  const [syncStatus, setSyncStatus] = useState<any>({});
  const [syncResults, setSyncResults] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // --- 고아 데이터 정리 상태 ---
  const [orphanedData, setOrphanedData] = useState<any>({});
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [orphanedLoading, setOrphanedLoading] = useState(false);
  
  // --- 컬렉션 삭제 상태 ---
  const [showCollectionDeleteModal, setShowCollectionDeleteModal] = useState(false);
  const [collectionDeleteLoading, setCollectionDeleteLoading] = useState(false);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // --- 문서 삭제 상태 ---
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentDeleteLoading, setDocumentDeleteLoading] = useState(false);
  const [showDocumentDeleteModal, setShowDocumentDeleteModal] = useState(false);
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const [documentFilter, setDocumentFilter] = useState<'all' | 'vectorized' | 'failed'>('all');

  // --- 데이터 로딩 ---
  const fetchData = useCallback(async () => {
    try {
      const [status, syncStatusData, orphanedDataStatus, collectionsData] = await Promise.all([
        databaseAPI.getAllDatabaseStatus(),
        vectorAPI.getSyncStatus().catch(e => {
          console.error("동기화 상태 로드 오류:", e);
          return {};
        }),
        vectorAPI.getOrphanedMetadata().catch(e => {
          console.error("고아 데이터 로드 오류:", e);
          return {};
        }),
        vectorAPI.getChromaCollections().catch(e => {
          console.error("컬렉션 목록 로드 오류:", e);
          return { collections: [] };
        })
      ]);
      
      setDatabaseStatus(status);
      setSyncStatus(syncStatusData);
      setOrphanedData(orphanedDataStatus);
      setAvailableCollections(collectionsData.collections || []);
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

  // --- 문서 목록 로딩 ---
  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      const response = await vectorAPI.getDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error("문서 목록 로드 오류:", error);
      toast({
        title: "오류",
        description: "문서 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDocumentsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    fetchDocuments(); // 문서 목록도 로드
    const interval = setInterval(fetchData, 30000); // 30초마다 상태 자동 갱신
    return () => clearInterval(interval);
  }, [fetchData, fetchDocuments]);

  // --- 액션 핸들러 ---
  const handleBackup = async (dbType: string) => {
    setActionLoading(prev => ({ ...prev, [`backup_${dbType}`]: true }));
    try {
      let result;
      switch (dbType) {
        case "chromadb_main":
          result = await databaseAPI.backupChromaDB();
          break;
        case "metadata":
          result = await databaseAPI.backupMetadataDB();
          break;
        case "users":
          result = await databaseAPI.backupUsersDB();
          break;
        case "file_metadata":
          result = await databaseAPI.backupFileMetadataDB();
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
        case "chromadb_main":
          result = await databaseAPI.resetChromaDB();
          break;
        case "metadata":
          result = await databaseAPI.resetMetadataDB();
          break;
        case "users":
          result = await databaseAPI.resetUsersDB();
          break;
        case "file_metadata":
          result = await databaseAPI.resetFileMetadataDB();
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

  // --- 동기화 관련 핸들러 ---
  const handleSync = async () => {
    try {
      setSyncLoading(true);
      const results = await vectorAPI.syncMetadata();
      setSyncResults(results);
      
      toast({
        title: "동기화 완료",
        description: `${results.summary.updated_files_count}개 파일이 업데이트되었습니다.`,
      });

      await fetchData();
      setShowSyncModal(false);
    } catch (error: any) {
      console.error("동기화 오류:", error);
      toast({
        title: "동기화 실패",
        description: error.response?.data?.detail || "동기화 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const loadOrphanedData = async () => {
    try {
      setOrphanedLoading(true);
      const data = await vectorAPI.getOrphanedMetadata();
      setOrphanedData(data);
    } catch (error) {
      console.error("고아 메타데이터 로드 오류:", error);
    } finally {
      setOrphanedLoading(false);
    }
  };

  const handleCleanupOrphaned = async () => {
    try {
      setCleanupLoading(true);
      const result = await vectorAPI.cleanupOrphanedMetadata();
      
      toast({
        title: "정리 완료",
        description: `${result.deleted_count}개의 고아 메타데이터가 삭제되었습니다.`,
      });

      await fetchData();
      setShowCleanupModal(false);
    } catch (error: any) {
      console.error("고아 메타데이터 정리 오류:", error);
      toast({
        title: "정리 실패",
        description: error.response?.data?.detail || "고아 메타데이터 정리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleDeleteCollections = async () => {
    if (selectedCollections.length === 0) {
      toast({
        title: "선택된 컬렉션 없음",
        description: "삭제할 컬렉션을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCollectionDeleteLoading(true);
      const result = await vectorAPI.deleteSelectedCollections(selectedCollections);
      
      toast({
        title: "컬렉션 삭제 완료",
        description: `${result.deleted_count}개의 컬렉션이 삭제되었습니다.`,
      });

      setSelectedCollections([]);
      await fetchData();
      setShowCollectionDeleteModal(false);
    } catch (error: any) {
      console.error("컬렉션 삭제 오류:", error);
      toast({
        title: "삭제 실패",
        description: error.response?.data?.detail || "컬렉션 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setCollectionDeleteLoading(false);
    }
  };

  // --- 컬렉션 선택 핸들러 ---
  const handleCollectionSelect = (collectionName: string, checked: boolean) => {
    setSelectedCollections(prev => 
      checked 
        ? [...prev, collectionName]
        : prev.filter(name => name !== collectionName)
    );
  };

  const handleSelectAllCollections = (checked: boolean) => {
    setSelectedCollections(checked ? availableCollections.map(col => col.name) : []);
  };

  // --- 문서 삭제 관련 핸들러 ---
  const handleDocumentSelect = (fileId: string, checked: boolean) => {
    setSelectedDocuments(prev => 
      checked 
        ? [...prev, fileId]
        : prev.filter(id => id !== fileId)
    );
  };

  const handleSelectAllDocuments = (checked: boolean) => {
    const filteredDocs = getFilteredDocuments();
    setSelectedDocuments(checked ? filteredDocs.map(doc => doc.file_id) : []);
  };

  const handleDeleteDocuments = async () => {
    if (selectedDocuments.length === 0) {
      toast({
        title: "선택된 문서 없음",
        description: "삭제할 문서를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setDocumentDeleteLoading(true);
      
      // 개별 삭제 또는 일괄 삭제
      if (selectedDocuments.length === 1) {
        await vectorAPI.deleteDocument(selectedDocuments[0]);
      } else {
        await vectorAPI.deleteSelectedDocuments(selectedDocuments);
      }
      
      toast({
        title: "문서 삭제 완료",
        description: `${selectedDocuments.length}개의 문서가 삭제되었습니다.`,
      });

      setSelectedDocuments([]);
      await fetchDocuments();
      await fetchData();
      setShowDocumentDeleteModal(false);
    } catch (error: any) {
      console.error("문서 삭제 오류:", error);
      toast({
        title: "삭제 실패",
        description: error.response?.data?.detail || "문서 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDocumentDeleteLoading(false);
    }
  };

  const getFilteredDocuments = () => {
    let filtered = documents;
    
    // 필터 적용
    if (documentFilter === 'vectorized') {
      filtered = filtered.filter(doc => doc.vectorized);
    } else if (documentFilter === 'failed') {
      filtered = filtered.filter(doc => doc.status === 'failed');
    }
    
    // 검색어 적용
    if (documentSearchQuery) {
      const query = documentSearchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.filename.toLowerCase().includes(query) ||
        doc.category_name?.toLowerCase().includes(query) ||
        doc.file_id.toLowerCase().includes(query)
      );
    }
    
    return filtered;
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
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {databaseStatus && (() => {
          // 표시할 데이터베이스 순서 정의 (실제 DB 파일만)
          const displayOrder = ['file_metadata', 'metadata', 'users', 'chromadb_main'];
          const filteredDatabases = displayOrder.filter(key => 
            databaseStatus.databases[key] !== undefined
          );
          
          return filteredDatabases.map((key) => (
            <DatabaseCard
              key={key}
              database={databaseStatus.databases[key]}
              onBackup={() => handleBackup(key)}
              onReset={() => handleReset(key)}
              isLoading={actionLoading[`backup_${key}`] || actionLoading[`reset_${key}`]}
            />
          ));
        })()}
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

      {/* 데이터베이스 동기화 섹션 */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" />
            데이터베이스 동기화
          </h2>
          <p className="text-muted-foreground">
            메타데이터 DB와 ChromaDB 간의 동기화를 관리하고 데이터 일관성을 유지합니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* 동기화 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                동기화 상태
              </CardTitle>
              <CardDescription>
                메타데이터 DB와 ChromaDB의 동기화 상태를 확인합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium">메타데이터 DB</p>
                    <p className="text-sm text-muted-foreground">
                      {syncStatus.metadata_files || 0}개 파일, {syncStatus.metadata_chunks || 0}개 청크
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${syncStatus.metadata_db_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium">ChromaDB</p>
                    <p className="text-sm text-muted-foreground">
                      {syncStatus.chromadb_vectors || 0}개 벡터
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${syncStatus.chromadb_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">동기화 상태</p>
                    <p className="text-sm text-muted-foreground">
                      {syncStatus.sync_needed ? "동기화 필요" : "동기화됨"}
                      {syncStatus.difference && ` (차이: ${syncStatus.difference}개)`}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${syncStatus.sync_needed ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                </div>
              </div>

              <Button 
                onClick={() => setShowSyncModal(true)} 
                disabled={syncLoading}
                className="w-full mt-4"
                variant={syncStatus.sync_needed ? "default" : "outline"}
              >
                {syncLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    동기화 진행 중...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    데이터베이스 동기화
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 고아 데이터 정리 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                고아 데이터 정리
              </CardTitle>
              <CardDescription>
                청크가 0개인 고아 메타데이터를 정리합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium">고아 메타데이터</p>
                    <p className="text-sm text-muted-foreground">
                      {orphanedLoading ? "로딩 중..." : `${orphanedData.total_count || 0}개 파일`}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    orphanedLoading ? 'bg-gray-400' : 
                    (orphanedData.total_count > 0 ? 'bg-orange-500' : 'bg-green-500')
                  }`}></div>
                </div>

                {orphanedData.total_count > 0 && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="text-sm text-orange-800 dark:text-orange-200">
                      <p className="font-medium mb-2">정리 대상 파일 ({orphanedData.total_count}개)</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {orphanedData.orphaned_files?.slice(0, 5).map((file: any, index: number) => (
                          <div key={index} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border">
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-muted-foreground">
                              카테고리: {file.category_name || '없음'}
                            </p>
                          </div>
                        ))}
                        {orphanedData.total_count > 5 && (
                          <div className="text-xs text-center text-muted-foreground">
                            외 {orphanedData.total_count - 5}개 파일...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={loadOrphanedData}
                    variant="outline"
                    size="sm"
                    disabled={orphanedLoading}
                  >
                    {orphanedLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    다시 확인
                  </Button>
                  
                  {orphanedData.total_count > 0 && (
                    <Button 
                      onClick={() => setShowCleanupModal(true)}
                      variant="destructive"
                      size="sm"
                      disabled={cleanupLoading}
                    >
                      {cleanupLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      정리하기
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 컬렉션 삭제 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-red-600" />
                컬렉션 삭제
              </CardTitle>
              <CardDescription>
                ChromaDB의 벡터 컬렉션을 선택하여 삭제합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-medium mb-2">주의사항</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>선택된 컬렉션의 모든 벡터 데이터가 영구적으로 삭제됩니다</li>
                      <li>삭제 후 해당 파일들을 다시 벡터화해야 합니다</li>
                      <li>이 작업은 되돌릴 수 없습니다</li>
                    </ul>
                  </div>
                </div>

                {/* 컬렉션 목록 표시 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">사용 가능한 컬렉션</Label>
                    <Badge variant={syncStatus.chromadb_available ? "default" : "destructive"}>
                      {availableCollections.length}개
                    </Badge>
                  </div>
                  
                  {availableCollections.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
                      {/* 전체 선택 */}
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox 
                          id="select-all"
                          checked={selectedCollections.length === availableCollections.length && availableCollections.length > 0}
                          onCheckedChange={handleSelectAllCollections}
                        />
                        <Label htmlFor="select-all" className="text-sm font-medium">
                          전체 선택 ({availableCollections.length}개)
                        </Label>
                      </div>
                      
                      {/* 개별 컬렉션 */}
                      {availableCollections.map((collection) => (
                        <div key={collection.name} className="flex items-center justify-between space-x-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id={`collection-${collection.name}`}
                              checked={selectedCollections.includes(collection.name)}
                              onCheckedChange={(checked) => handleCollectionSelect(collection.name, !!checked)}
                            />
                            <Label htmlFor={`collection-${collection.name}`} className="text-sm">
                              {collection.name}
                            </Label>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {collection.count || 0}개 벡터
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-muted-foreground text-sm bg-gray-50 dark:bg-gray-800 rounded-lg">
                      사용 가능한 컬렉션이 없습니다
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    선택된 컬렉션: {selectedCollections.length}개
                  </span>
                  {selectedCollections.length > 0 && (
                    <Button 
                      onClick={() => setSelectedCollections([])}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs"
                    >
                      선택 해제
                    </Button>
                  )}
                </div>

                <Button 
                  onClick={() => setShowCollectionDeleteModal(true)}
                  variant="destructive"
                  size="sm"
                  disabled={collectionDeleteLoading || selectedCollections.length === 0 || !syncStatus.chromadb_available}
                  className="w-full"
                >
                  {collectionDeleteLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  선택된 컬렉션 삭제 ({selectedCollections.length}개)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 문서 삭제 */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                문서 관리
              </CardTitle>
              <CardDescription>
                업로드된 문서를 관리하고 선택하여 삭제합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 검색 및 필터 */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="파일명, 카테고리, ID로 검색..."
                      value={documentSearchQuery}
                      onChange={(e) => setDocumentSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Select
                    value={documentFilter}
                    onValueChange={(value: 'all' | 'vectorized' | 'failed') => setDocumentFilter(value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 문서</SelectItem>
                      <SelectItem value="vectorized">벡터화된 문서</SelectItem>
                      <SelectItem value="failed">실패한 문서</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={fetchDocuments}
                    variant="outline"
                    size="icon"
                    disabled={documentsLoading}
                  >
                    {documentsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* 문서 목록 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">문서 목록</Label>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        전체: {documents.length}개
                      </Badge>
                      <Badge variant="outline">
                        표시: {getFilteredDocuments().length}개
                      </Badge>
                      <Badge variant="destructive">
                        선택: {selectedDocuments.length}개
                      </Badge>
                    </div>
                  </div>
                  
                  {documentsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">문서 목록을 불러오는 중...</span>
                    </div>
                  ) : documents.length > 0 ? (
                    <div className="border rounded-lg p-3 space-y-2 max-h-96 overflow-y-auto">
                      {/* 전체 선택 */}
                      <div className="flex items-center space-x-2 pb-2 border-b sticky top-0 bg-background">
                        <Checkbox 
                          id="select-all-docs"
                          checked={getFilteredDocuments().length > 0 && selectedDocuments.length === getFilteredDocuments().length}
                          onCheckedChange={handleSelectAllDocuments}
                        />
                        <Label htmlFor="select-all-docs" className="text-sm font-medium">
                          전체 선택 ({getFilteredDocuments().length}개)
                        </Label>
                      </div>
                      
                      {/* 개별 문서 */}
                      {getFilteredDocuments().map((doc: any) => (
                        <div key={doc.file_id} className="flex items-start space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                          <Checkbox 
                            id={`doc-${doc.file_id}`}
                            checked={selectedDocuments.includes(doc.file_id)}
                            onCheckedChange={(checked) => handleDocumentSelect(doc.file_id, !!checked)}
                          />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={`doc-${doc.file_id}`} className="text-sm font-medium cursor-pointer">
                              {doc.filename}
                            </Label>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {doc.category_name || '미분류'}
                              </Badge>
                              <Badge 
                                variant={doc.vectorized ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {doc.vectorized ? '벡터화됨' : '대기중'}
                              </Badge>
                              {doc.status === 'failed' && (
                                <Badge variant="destructive" className="text-xs">
                                  실패
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {doc.chunk_count || 0}개 청크
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.upload_time).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {getFilteredDocuments().length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          검색 결과가 없습니다
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>업로드된 문서가 없습니다</p>
                      <Button
                        onClick={fetchDocuments}
                        variant="outline"
                        size="sm"
                        className="mt-4"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        새로고침
                      </Button>
                    </div>
                  )}
                </div>

                {/* 경고 메시지 */}
                {selectedDocuments.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="text-sm text-red-800 dark:text-red-200">
                      <p className="font-medium mb-1">삭제 시 주의사항</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>물리적 파일이 삭제됩니다</li>
                        <li>모든 메타데이터가 제거됩니다</li>
                        <li>관련 벡터 데이터가 삭제됩니다</li>
                        <li>이 작업은 되돌릴 수 없습니다</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedDocuments.length > 0 && (
                      <span>{selectedDocuments.length}개 문서 선택됨</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedDocuments.length > 0 && (
                      <Button 
                        onClick={() => setSelectedDocuments([])}
                        variant="outline"
                        size="sm"
                      >
                        선택 해제
                      </Button>
                    )}
                    <Button
                      onClick={() => setShowDocumentDeleteModal(true)}
                      variant="destructive"
                      disabled={documentDeleteLoading || selectedDocuments.length === 0}
                    >
                      {documentDeleteLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      선택된 문서 삭제 ({selectedDocuments.length}개)
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 동기화 결과 */}
          {syncResults && (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  동기화 결과
                </CardTitle>
                <CardDescription>
                  최근 동기화 작업의 결과입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">업데이트된 파일</p>
                      <p className="text-muted-foreground">{syncResults.summary?.updated_files_count || 0}개</p>
                    </div>
                    <div>
                      <p className="font-medium">고아 메타데이터</p>
                      <p className="text-muted-foreground">{syncResults.summary?.orphaned_metadata_count || 0}개</p>
                    </div>
                    <div>
                      <p className="font-medium">고아 벡터</p>
                      <p className="text-muted-foreground">{syncResults.summary?.orphaned_vectors_count || 0}개</p>
                    </div>
                    <div>
                      <p className="font-medium">오류</p>
                      <p className="text-muted-foreground">{syncResults.summary?.errors_count || 0}개</p>
                    </div>
                  </div>

                  {syncResults.updated_files && syncResults.updated_files.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">업데이트된 파일</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {syncResults.updated_files.map((file: any, index: number) => (
                          <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-muted-foreground">
                              {file.recorded_chunks} → {file.actual_chunks} 
                              ({file.difference > 0 ? '+' : ''}{file.difference})
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {syncResults.errors && syncResults.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2 text-red-600">오류</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {syncResults.errors.map((error: string, index: number) => (
                          <div key={index} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-800 dark:text-red-200">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-4">
                    동기화 시간: {syncResults.summary?.sync_timestamp ? 
                      new Date(syncResults.summary.sync_timestamp).toLocaleString('ko-KR') : 
                      '알 수 없음'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 동기화 확인 모달 */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              데이터베이스 동기화
            </DialogTitle>
            <DialogDescription>
              메타데이터 DB와 ChromaDB를 동기화하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-2">동기화 과정</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>ChromaDB에서 실제 벡터 수를 조회합니다</li>
                    <li>메타데이터 DB의 청크 수를 실제 값으로 업데이트합니다</li>
                    <li>고아 데이터(연결되지 않은 데이터)를 찾습니다</li>
                    <li>동기화 결과를 상세히 보고합니다</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {syncStatus.difference && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>현재 차이:</strong> {Math.abs(syncStatus.difference)}개
                  {syncStatus.difference > 0 ? " (메타데이터가 많음)" : " (ChromaDB가 많음)"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSyncModal(false)}
              disabled={syncLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncLoading}
            >
              {syncLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  동기화 중...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  동기화 시작
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 고아 데이터 정리 확인 모달 */}
      <Dialog open={showCleanupModal} onOpenChange={setShowCleanupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              고아 데이터 정리 확인
            </DialogTitle>
            <DialogDescription>
              청크가 0개인 고아 메타데이터를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium mb-2">정리 대상</p>
                  <p className="mb-3">{orphanedData.total_count || 0}개의 고아 메타데이터</p>
                  <p className="font-medium mb-1">주의사항</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>청크가 0개인 메타데이터만 삭제됩니다</li>
                    <li>실제 파일이나 ChromaDB 벡터는 영향을 받지 않습니다</li>
                    <li>삭제된 메타데이터는 복구할 수 없습니다</li>
                    <li>처리가 실패한 파일의 기록이 제거됩니다</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {orphanedData.orphaned_files && orphanedData.orphaned_files.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">삭제될 파일 목록 (상위 5개)</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {orphanedData.orphaned_files.slice(0, 5).map((file: any, index: number) => (
                    <div key={index} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border">
                      <p className="font-medium">{file.filename}</p>
                      <p className="text-muted-foreground">
                        파일 ID: {file.file_id} | 카테고리: {file.category_name || '없음'}
                      </p>
                    </div>
                  ))}
                </div>
                {orphanedData.total_count > 5 && (
                  <p className="text-xs text-center text-yellow-700 dark:text-yellow-300 mt-2">
                    외 {orphanedData.total_count - 5}개 파일이 더 있습니다.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCleanupModal(false)}
              disabled={cleanupLoading}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleCleanupOrphaned}
              disabled={cleanupLoading}
            >
              {cleanupLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  정리 중...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {orphanedData.total_count || 0}개 파일 정리
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 컬렉션 삭제 확인 모달 */}
      <Dialog open={showCollectionDeleteModal} onOpenChange={setShowCollectionDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-red-600" />
              컬렉션 삭제 확인
            </DialogTitle>
            <DialogDescription>
              선택된 {selectedCollections.length}개의 컬렉션을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium mb-2">삭제될 컬렉션</p>
                  <div className="mb-3 max-h-32 overflow-y-auto">
                    {selectedCollections.map((name, index) => (
                      <div key={name} className="flex items-center justify-between py-1">
                        <span className="font-mono text-xs">{name}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {availableCollections.find(col => col.name === name)?.count || 0}개 벡터
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="font-medium mb-1">주의사항</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>선택된 컬렉션의 모든 벡터 데이터가 영구적으로 삭제됩니다</li>
                    <li>파일 메타데이터는 유지되지만 벡터화 상태는 리셋됩니다</li>
                    <li>삭제 후 해당 파일들을 다시 벡터화해야 합니다</li>
                    <li>이 작업은 되돌릴 수 없습니다</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>현재 벡터 수:</strong> {syncStatus.chromadb_vectors || 0}개
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCollectionDeleteModal(false)}
              disabled={collectionDeleteLoading}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCollections}
              disabled={collectionDeleteLoading}
            >
              {collectionDeleteLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  선택된 컬렉션 삭제
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 문서 삭제 확인 모달 */}
      <Dialog open={showDocumentDeleteModal} onOpenChange={setShowDocumentDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              문서 삭제 확인
            </DialogTitle>
            <DialogDescription>
              선택된 {selectedDocuments.length}개의 문서를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium mb-2">삭제될 문서</p>
                  <div className="mb-3 max-h-32 overflow-y-auto space-y-1">
                    {selectedDocuments.slice(0, 10).map((fileId) => {
                      const doc = documents.find(d => d.file_id === fileId);
                      return doc ? (
                        <div key={fileId} className="p-2 bg-white dark:bg-gray-800 rounded border">
                          <p className="font-medium text-xs">{doc.filename}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {doc.category_name || '미분류'}
                            </Badge>
                            {doc.vectorized && (
                              <Badge variant="default" className="text-xs">
                                {doc.chunk_count || 0}개 청크
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : null;
                    })}
                    {selectedDocuments.length > 10 && (
                      <p className="text-center text-xs">
                        외 {selectedDocuments.length - 10}개 문서...
                      </p>
                    )}
                  </div>
                  <p className="font-medium mb-1">삭제 내용</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>물리적 파일이 영구 삭제됩니다</li>
                    <li>모든 메타데이터가 제거됩니다</li>
                    <li>ChromaDB의 관련 벡터가 삭제됩니다</li>
                    <li>이 작업은 되돌릴 수 없습니다</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>경고:</strong> 삭제 후 복구가 불가능합니다. 필요한 경우 먼저 백업을 수행하세요.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDocumentDeleteModal(false)}
              disabled={documentDeleteLoading}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocuments}
              disabled={documentDeleteLoading}
            >
              {documentDeleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {selectedDocuments.length}개 문서 삭제
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}