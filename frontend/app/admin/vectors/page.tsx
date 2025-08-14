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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Search,
  FileText,
  BarChart3,
  Eye,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  Zap,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vectorAPI } from "@/lib/api";

interface VectorMetadata {
  id: number;
  file_id: string;
  filename: string;
  category_id?: string;
  category_name?: string;
  flow_id?: string;
  processing_method: string;
  processing_time: number;
  chunk_count: number;
  file_size: number;
  page_count?: number;
  table_count?: number;
  image_count?: number;
  docling_options?: any;
  created_at: string;
  updated_at: string;
}

interface CollectionInfo {
  name: string;
  id?: string;
  count: number;
  metadata: any;
  sample_metadatas: any[];
  sample_documents: string[];
  error?: string;
}

interface SearchResult {
  collection: string;
  document: string;
  metadata: any;
  distance?: number;
  similarity?: number;
}

export default function VectorAnalysisPage() {
  const { toast } = useToast();
  
  // States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Metadata states
  const [metadata, setMetadata] = useState<VectorMetadata[]>([]);
  const [metadataStats, setMetadataStats] = useState<any>({});
  const [metadataPage, setMetadataPage] = useState(1);
  const [metadataLimit] = useState(20);
  const [metadataTotal, setMetadataTotal] = useState(0);
  const [metadataSearch, setMetadataSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [processingMethodFilter, setProcessingMethodFilter] = useState("all");
  
  // ChromaDB states
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionLimit] = useState(20);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionSearch, setCollectionSearch] = useState("");
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCollection, setSearchCollection] = useState<string>("all");
  const [topK, setTopK] = useState(10);

  // Sync states
  const [syncStatus, setSyncStatus] = useState<any>({});
  const [syncResults, setSyncResults] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{show: boolean, fileId: string, filename: string}>({
    show: false,
    fileId: '',
    filename: ''
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load metadata when filters change
  useEffect(() => {
    if (!loading) {
      loadMetadata();
    }
  }, [metadataPage, metadataSearch, categoryFilter, processingMethodFilter]);

  // Load collection data when selection changes
  useEffect(() => {
    if (selectedCollection) {
      loadCollectionData();
    }
  }, [selectedCollection, collectionPage, collectionSearch]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMetadataStats(),
        loadMetadata(),
        loadCollections(),
        loadSyncStatus()
      ]);
    } catch (error) {
      console.error("초기 데이터 로드 오류:", error);
      toast({
        title: "데이터 로드 실패",
        description: "초기 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMetadataStats = async () => {
    try {
      const stats = await vectorAPI.getMetadataStats();
      setMetadataStats(stats);
    } catch (error) {
      console.error("메타데이터 통계 로드 오류:", error);
    }
  };

  const loadMetadata = async () => {
    try {
      const params = {
        page: metadataPage,
        limit: metadataLimit,
        search: metadataSearch || undefined,
        category_id: categoryFilter === "all" ? undefined : categoryFilter,
        processing_method: processingMethodFilter === "all" ? undefined : processingMethodFilter,
      };
      
      const response = await vectorAPI.getMetadata(params);
      setMetadata(response.metadata || []);
      setMetadataTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error("메타데이터 로드 오류:", error);
      toast({
        title: "메타데이터 로드 실패",
        description: "메타데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadCollections = async () => {
    try {
      const response = await vectorAPI.getChromaCollections();
      setCollections(response.collections || []);
      if (response.collections && response.collections.length > 0) {
        setSelectedCollection(response.collections[0].name);
      }
    } catch (error) {
      console.error("컬렉션 로드 오류:", error);
      toast({
        title: "ChromaDB 컬렉션 로드 실패",
        description: "ChromaDB 컬렉션 정보를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadCollectionData = async () => {
    if (!selectedCollection) return;
    
    try {
      const params = {
        page: collectionPage,
        limit: collectionLimit,
        search: collectionSearch || undefined,
      };
      
      const response = await vectorAPI.getCollectionData(selectedCollection, params);
      setCollectionData(response.documents || []);
      setCollectionTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error("컬렉션 데이터 로드 오류:", error);
      toast({
        title: "컬렉션 데이터 로드 실패",
        description: "컬렉션 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "검색어 입력",
        description: "검색할 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSearchLoading(true);
      const params = {
        query: searchQuery,
        collection_name: searchCollection === "all" ? undefined : searchCollection,
        top_k: topK,
      };
      
      const response = await vectorAPI.searchVectors(params);
      setSearchResults(response.results || []);
      
      toast({
        title: "검색 완료",
        description: `${response.results?.length || 0}개의 결과를 찾았습니다.`,
      });
    } catch (error) {
      console.error("벡터 검색 오류:", error);
      toast({
        title: "검색 실패",
        description: "벡터 검색 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await vectorAPI.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error("동기화 상태 로드 오류:", error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncLoading(true);
      const results = await vectorAPI.syncMetadata();
      setSyncResults(results);
      
      toast({
        title: "동기화 완료",
        description: `${results.summary.updated_files_count}개 파일이 업데이트되었습니다.`,
      });

      // 데이터 새로고침
      await Promise.all([
        loadMetadataStats(),
        loadMetadata(),
        loadSyncStatus()
      ]);

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

  const handleDeleteMetadata = async () => {
    try {
      await vectorAPI.deleteMetadata(showDeleteModal.fileId);
      toast({
        title: "메타데이터 삭제 완료",
        description: `${showDeleteModal.filename}의 메타데이터가 삭제되었습니다.`,
      });
      await loadMetadata();
      await loadMetadataStats();
      setShowDeleteModal({show: false, fileId: '', filename: ''});
    } catch (error) {
      console.error("메타데이터 삭제 오류:", error);
      toast({
        title: "메타데이터 삭제 실패",
        description: "메타데이터 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatProcessingTime = (seconds: number) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>벡터 데이터를 로드하는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">벡터 데이터 분석</h1>
          <p className="text-muted-foreground">
            ChromaDB와 메타데이터 저장소의 벡터화된 데이터를 분석하고 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadInitialData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button 
            onClick={() => setShowSyncModal(true)} 
            disabled={syncLoading}
            variant={syncStatus.sync_needed ? "default" : "outline"}
          >
            {syncLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            {syncLoading ? "동기화 중..." : "DB 동기화"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="metadata">메타데이터</TabsTrigger>
          <TabsTrigger value="chromadb">ChromaDB</TabsTrigger>
          <TabsTrigger value="search">벡터 검색</TabsTrigger>
          <TabsTrigger value="sync">동기화</TabsTrigger>
        </TabsList>

        {/* 개요 탭 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 동기화 상태 알림 */}
          {syncStatus.sync_needed && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    동기화 필요
                  </CardTitle>
                  <Button onClick={() => setShowSyncModal(true)} disabled={syncLoading} size="sm">
                    {syncLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    {syncLoading ? "동기화 중..." : "지금 동기화"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-800">
                  {syncStatus.message || "메타데이터 DB와 ChromaDB 간에 데이터 차이가 발견되었습니다."}
                  {syncStatus.difference && (
                    <span className="block mt-1">
                      차이: {Math.abs(syncStatus.difference)}개 ({syncStatus.difference > 0 ? "메타데이터가 많음" : "ChromaDB가 많음"})
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 파일</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadataStats.total_files || 0}</div>
                <p className="text-xs text-muted-foreground">
                  벡터화된 파일 수
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 청크</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadataStats.total_chunks || 0}</div>
                <p className="text-xs text-muted-foreground">
                  생성된 벡터 청크 수
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 용량</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBytes(metadataStats.total_size || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  처리된 파일 용량
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 처리시간</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatProcessingTime(metadataStats.avg_processing_time || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  파일당 평균 처리시간
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 처리 방법별 통계 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  처리 방법별 통계
                </CardTitle>
                <CardDescription>
                  파일 처리에 사용된 방법별 분포
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(metadataStats.processing_methods || {}).map(([method, data]: [string, any]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={method === 'docling' ? 'default' : 'secondary'}>
                          {method}
                        </Badge>
                        <span className="text-sm">{data.count}개 파일</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        평균 {formatProcessingTime(data.avg_processing_time || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 카테고리별 통계 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  카테고리별 분포
                </CardTitle>
                <CardDescription>
                  카테고리별 파일 및 청크 수
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(metadataStats.categories || {}).slice(0, 5).map(([category, data]: [string, any]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{category}</Badge>
                        <span className="text-sm">{data.count}개 파일</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {data.chunks}개 청크
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ChromaDB 컬렉션 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                ChromaDB 컬렉션 현황
              </CardTitle>
              <CardDescription>
                ChromaDB에 저장된 벡터 컬렉션 정보
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {collections.map((collection) => (
                  <div key={collection.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{collection.name}</h3>
                      {collection.error ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {collection.count.toLocaleString()}개 벡터
                    </p>
                    {collection.error && (
                      <p className="text-xs text-red-600">{collection.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 메타데이터 탭 */}
        <TabsContent value="metadata" className="space-y-6">
          {/* 필터 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                필터 및 검색
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Input
                    placeholder="파일명 검색..."
                    value={metadataSearch}
                    onChange={(e) => setMetadataSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadMetadata()}
                  />
                </div>
                <div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 카테고리</SelectItem>
                      {Object.keys(metadataStats.categories || {}).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={processingMethodFilter} onValueChange={setProcessingMethodFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="처리 방법 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 방법</SelectItem>
                      {Object.keys(metadataStats.processing_methods || {}).map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadMetadata}>
                  <Search className="h-4 w-4 mr-2" />
                  검색
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 메타데이터 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle>벡터 메타데이터</CardTitle>
              <CardDescription>
                총 {metadataTotal}개 파일 • {Math.ceil(metadataTotal / metadataLimit)}페이지 중 {metadataPage}페이지
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>파일명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>처리방법</TableHead>
                    <TableHead>청크수</TableHead>
                    <TableHead>용량</TableHead>
                    <TableHead>처리시간</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metadata.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.filename}</p>
                          <p className="text-xs text-muted-foreground">{item.file_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category_name ? (
                          <Badge variant="outline">{item.category_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.processing_method === 'docling' ? 'default' : 'secondary'}>
                          {item.processing_method}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.chunk_count.toLocaleString()}</TableCell>
                      <TableCell>{formatBytes(item.file_size)}</TableCell>
                      <TableCell>{formatProcessingTime(item.processing_time)}</TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{item.filename}</DialogTitle>
                                <DialogDescription>메타데이터 상세 정보</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid gap-2">
                                  <p><strong>파일 ID:</strong> {item.file_id}</p>
                                  <p><strong>처리 방법:</strong> {item.processing_method}</p>
                                  <p><strong>처리 시간:</strong> {formatProcessingTime(item.processing_time)}</p>
                                  <p><strong>청크 수:</strong> {item.chunk_count}</p>
                                  <p><strong>파일 크기:</strong> {formatBytes(item.file_size)}</p>
                                  {item.page_count && <p><strong>페이지 수:</strong> {item.page_count}</p>}
                                  {item.table_count && <p><strong>테이블 수:</strong> {item.table_count}</p>}
                                  {item.image_count && <p><strong>이미지 수:</strong> {item.image_count}</p>}
                                  <p><strong>생성일:</strong> {new Date(item.created_at).toLocaleString('ko-KR')}</p>
                                  <p><strong>수정일:</strong> {new Date(item.updated_at).toLocaleString('ko-KR')}</p>
                                </div>
                                {item.docling_options && (
                                  <div>
                                    <strong>Docling 옵션:</strong>
                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                                      {JSON.stringify(item.docling_options, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteModal({show: true, fileId: item.file_id, filename: item.filename})}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {metadataTotal > 0 && (
                    `${(metadataPage - 1) * metadataLimit + 1}-${Math.min(metadataPage * metadataLimit, metadataTotal)} / ${metadataTotal}개`
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMetadataPage(Math.max(1, metadataPage - 1))}
                    disabled={metadataPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMetadataPage(metadataPage + 1)}
                    disabled={metadataPage * metadataLimit >= metadataTotal}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ChromaDB 탭 */}
        <TabsContent value="chromadb" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 컬렉션 선택 */}
            <Card>
              <CardHeader>
                <CardTitle>컬렉션 선택</CardTitle>
                <CardDescription>분석할 ChromaDB 컬렉션을 선택하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="컬렉션 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((collection) => (
                      <SelectItem key={collection.name} value={collection.name}>
                        {collection.name} ({collection.count}개)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 검색 */}
            <Card>
              <CardHeader>
                <CardTitle>컬렉션 검색</CardTitle>
                <CardDescription>선택한 컬렉션 내에서 문서를 검색합니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="문서 내용 검색..."
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadCollectionData()}
                  />
                  <Button onClick={loadCollectionData}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 컬렉션 데이터 */}
          {selectedCollection && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedCollection} 컬렉션 데이터</CardTitle>
                <CardDescription>
                  총 {collectionTotal}개 문서 • {Math.ceil(collectionTotal / collectionLimit)}페이지 중 {collectionPage}페이지
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {collectionData.map((doc, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {doc.id && (
                            <Badge variant="outline" className="text-xs">
                              {doc.id.substring(0, 8)}...
                            </Badge>
                          )}
                          {doc.full_document_length && (
                            <span className="text-xs text-muted-foreground">
                              {doc.full_document_length} 문자
                            </span>
                          )}
                        </div>
                        {doc.distance && (
                          <Badge variant="secondary">
                            거리: {doc.distance.toFixed(3)}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm mb-3">{doc.document}</p>
                      
                      {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">메타데이터:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(doc.metadata).slice(0, 5).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value).substring(0, 20)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {collectionTotal > 0 && (
                      `${(collectionPage - 1) * collectionLimit + 1}-${Math.min(collectionPage * collectionLimit, collectionTotal)} / ${collectionTotal}개`
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCollectionPage(Math.max(1, collectionPage - 1))}
                      disabled={collectionPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCollectionPage(collectionPage + 1)}
                      disabled={collectionPage * collectionLimit >= collectionTotal}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 벡터 검색 탭 */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                벡터 유사도 검색
              </CardTitle>
              <CardDescription>
                자연어 질의를 통해 유사한 벡터 데이터를 검색합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Input
                      placeholder="검색할 내용을 입력하세요..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={searchCollection} onValueChange={setSearchCollection}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 컬렉션</SelectItem>
                        {collections.map((collection) => (
                          <SelectItem key={collection.name} value={collection.name}>
                            {collection.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">결과 수:</label>
                    <Select value={topK.toString()} onValueChange={(value) => setTopK(parseInt(value))}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map((num) => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button onClick={handleSearch} disabled={searchLoading}>
                    {searchLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    검색
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>검색 결과</CardTitle>
                <CardDescription>
                  "{searchQuery}"에 대한 {searchResults.length}개 결과
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {searchResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{result.collection}</Badge>
                          {result.similarity && (
                            <Badge variant="default">
                              유사도: {(result.similarity * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        {result.distance && (
                          <span className="text-xs text-muted-foreground">
                            거리: {result.distance.toFixed(3)}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm mb-3">{result.document}</p>
                      
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">메타데이터:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(result.metadata).slice(0, 5).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value).substring(0, 20)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 동기화 탭 */}
        <TabsContent value="sync" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
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
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">메타데이터 DB</p>
                      <p className="text-sm text-muted-foreground">
                        {syncStatus.metadata_files || 0}개 파일, {syncStatus.metadata_chunks || 0}개 청크
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${syncStatus.metadata_db_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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

            {/* 동기화 결과 */}
            {syncResults && (
              <Card>
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
                            <div key={index} className="text-xs p-2 bg-gray-50 rounded">
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
                            <div key={index} className="text-xs p-2 bg-red-50 rounded text-red-800">
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
        </TabsContent>
      </Tabs>

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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
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
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
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

      {/* 메타데이터 삭제 확인 모달 */}
      <Dialog open={showDeleteModal.show} onOpenChange={(open) => setShowDeleteModal({show: open, fileId: '', filename: ''})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              메타데이터 삭제 확인
            </DialogTitle>
            <DialogDescription>
              정말로 이 파일의 메타데이터를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-2">삭제할 파일</p>
                  <p className="mb-3">{showDeleteModal.filename}</p>
                  <p className="font-medium mb-1">주의사항</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>메타데이터만 삭제되며, ChromaDB의 벡터는 유지됩니다</li>
                    <li>삭제된 메타데이터는 복구할 수 없습니다</li>
                    <li>파일 정보 및 처리 통계가 영구적으로 제거됩니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal({show: false, fileId: '', filename: ''})}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMetadata}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}