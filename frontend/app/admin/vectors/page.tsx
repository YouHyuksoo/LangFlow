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
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
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
import { vectorAPI, fileAPI } from "@/lib/api";

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
  has_images?: boolean;
  related_images?: any[];
  image_count?: number;
}

interface FileMetadata {
  file_id: string;
  filename: string;
  saved_filename: string;
  status: string;
  file_size: number;
  file_path?: string;
  file_hash?: string;
  category_id?: string;
  category_name?: string;
  upload_time: string;
  preprocessing_started_at?: string;
  preprocessing_completed_at?: string;
  vectorization_started_at?: string;
  vectorization_completed_at?: string;
  error_message?: string;
  chunk_count?: number;
  preprocessing_method?: string;
  vectorized: boolean;
  processing_options?: any;
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
  
  // ChromaDB 필터 states
  const [collectionCategoryFilter, setCollectionCategoryFilter] = useState("all");
  const [collectionFilenameFilter, setCollectionFilenameFilter] = useState("");
  const [collectionImageFilter, setCollectionImageFilter] = useState("all");
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // searchCollection 제거 - VectorService 통합 검색 사용
  const [topK, setTopK] = useState(10);

  // File metadata states
  const [fileMetadata, setFileMetadata] = useState<FileMetadata[]>([]);
  const [fileMetadataTotal, setFileMetadataTotal] = useState(0);
  const [fileMetadataPage, setFileMetadataPage] = useState(1);
  const [fileMetadataLimit] = useState(20);
  const [fileMetadataSearch, setFileMetadataSearch] = useState("");
  const [fileCategoryFilter, setFileCategoryFilter] = useState("all");
  const [fileStatusFilter, setFileStatusFilter] = useState("all");

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
  }, [selectedCollection, collectionPage, collectionSearch, collectionCategoryFilter, collectionFilenameFilter, collectionImageFilter]);

  // Load file metadata when filters change
  useEffect(() => {
    if (!loading) {
      loadFileMetadata();
    }
  }, [fileMetadataPage, fileMetadataSearch, fileCategoryFilter, fileStatusFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMetadataStats(),
        loadMetadata(),
        loadCollections(),
        loadFileMetadata()
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


  const loadFileMetadata = async () => {
    try {
      const categoryId = fileCategoryFilter === "all" ? undefined : fileCategoryFilter;
      const files = await fileAPI.getFiles(categoryId);
      
      // 검색 필터 적용
      let filteredFiles = files;
      if (fileMetadataSearch) {
        filteredFiles = files.filter((file: FileMetadata) => 
          file.filename.toLowerCase().includes(fileMetadataSearch.toLowerCase()) ||
          file.file_id.toLowerCase().includes(fileMetadataSearch.toLowerCase())
        );
      }
      
      // 상태 필터 적용
      if (fileStatusFilter !== "all") {
        filteredFiles = filteredFiles.filter((file: FileMetadata) => file.status === fileStatusFilter);
      }
      
      // 페이지네이션 적용
      const startIndex = (fileMetadataPage - 1) * fileMetadataLimit;
      const endIndex = startIndex + fileMetadataLimit;
      const paginatedFiles = filteredFiles.slice(startIndex, endIndex);
      
      setFileMetadata(paginatedFiles);
      setFileMetadataTotal(filteredFiles.length);
    } catch (error) {
      console.error("파일 메타데이터 로드 오류:", error);
      toast({
        title: "파일 메타데이터 로드 실패",
        description: "파일 메타데이터를 불러오는 중 오류가 발생했습니다.",
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
        category_name: collectionCategoryFilter === "all" ? undefined : collectionCategoryFilter,
        filename: collectionFilenameFilter || undefined,
        has_images: collectionImageFilter === "all" ? undefined : collectionImageFilter === "true",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">벡터 데이터 분석</h1>
          <p className="text-muted-foreground">
            ChromaDB와 메타데이터 저장소의 벡터화된 데이터를 분석하고 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadInitialData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="metadata">벡터 메타데이터</TabsTrigger>
          <TabsTrigger value="filedata">파일 메타데이터</TabsTrigger>
          <TabsTrigger value="chromadb">ChromaDB</TabsTrigger>
          <TabsTrigger value="search">벡터 검색</TabsTrigger>
        </TabsList>

        {/* 개요 탭 */}
        <TabsContent value="overview" className="space-y-6">

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="stat-card relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 파일</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadataStats.total_files || 0}</div>
                <p className="text-xs text-muted-foreground">
                  벡터화된 파일 수
                </p>
              </CardContent>
            </Card>

            <Card className="stat-card relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 청크</CardTitle>
                <Database className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadataStats.total_chunks || 0}</div>
                <p className="text-xs text-muted-foreground">
                  생성된 벡터 청크 수
                </p>
              </CardContent>
            </Card>

            <Card className="stat-card relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 용량</CardTitle>
                <HardDrive className="h-4 w-4 text-purple-500" />
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

            <Card className="stat-card relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 처리시간</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
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
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {collection.count.toLocaleString()}개 벡터
                    </p>
                    {collection.error && (
                      <p className="text-xs text-destructive">{collection.error}</p>
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
                                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
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

          {/* 고급 필터 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                고급 필터
              </CardTitle>
              <CardDescription>
                메타데이터 기반으로 문서를 필터링합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">카테고리</label>
                  <Select value={collectionCategoryFilter} onValueChange={setCollectionCategoryFilter}>
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
                  <label className="text-sm font-medium mb-2 block">파일명</label>
                  <Input
                    placeholder="파일명 검색..."
                    value={collectionFilenameFilter}
                    onChange={(e) => setCollectionFilenameFilter(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadCollectionData()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">이미지 포함</label>
                  <Select value={collectionImageFilter} onValueChange={setCollectionImageFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="이미지 필터" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="true">이미지 포함</SelectItem>
                      <SelectItem value="false">이미지 없음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={loadCollectionData} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    필터 적용
                  </Button>
                </div>
              </div>
              
              {/* 필터 초기화 버튼 */}
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setCollectionCategoryFilter("all");
                    setCollectionFilenameFilter("");
                    setCollectionImageFilter("all");
                    setCollectionSearch("");
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  필터 초기화
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 컬렉션 데이터 */}
          {selectedCollection && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedCollection} 컬렉션 데이터</CardTitle>
                <CardDescription>
                  총 {collectionTotal}개 문서 • {Math.ceil(collectionTotal / collectionLimit)}페이지 중 {collectionPage}페이지
                  {(collectionCategoryFilter !== "all" || collectionFilenameFilter || collectionImageFilter !== "all" || collectionSearch) && (
                    <span className="text-primary"> (필터 적용됨)</span>
                  )}
                </CardDescription>
                {/* 적용된 필터 표시 */}
                {(collectionCategoryFilter !== "all" || collectionFilenameFilter || collectionImageFilter !== "all" || collectionSearch) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {collectionSearch && (
                      <Badge variant="secondary" className="text-xs">
                        검색: {collectionSearch}
                      </Badge>
                    )}
                    {collectionCategoryFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        카테고리: {collectionCategoryFilter}
                      </Badge>
                    )}
                    {collectionFilenameFilter && (
                      <Badge variant="secondary" className="text-xs">
                        파일명: {collectionFilenameFilter}
                      </Badge>
                    )}
                    {collectionImageFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        이미지: {collectionImageFilter === "true" ? "포함" : "없음"}
                      </Badge>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {collectionData.map((doc, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 파일명 표시 (우선순위: filename > file_id) */}
                          {doc.metadata?.filename ? (
                            <Badge variant="default" className="text-xs">
                              📄 {doc.metadata.filename}
                            </Badge>
                          ) : doc.metadata?.file_id && (
                            <Badge variant="outline" className="text-xs">
                              ID: {doc.metadata.file_id.substring(0, 8)}...
                            </Badge>
                          )}
                          
                          {/* 카테고리명 표시 (우선순위: category_name > category_id) */}
                          {doc.metadata?.category_name ? (
                            <Badge variant="secondary" className="text-xs">
                              📁 {doc.metadata.category_name}
                            </Badge>
                          ) : doc.metadata?.category_id && (
                            <Badge variant="outline" className="text-xs">
                              카테고리: {doc.metadata.category_id.substring(0, 8)}...
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
                          <p className="text-xs font-medium mb-1">기타 메타데이터:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(doc.metadata)
                              .filter(([key]) => !['filename', 'category_name', 'file_id', 'category_id'].includes(key))
                              .slice(0, 5)
                              .map(([key, value]) => {
                                const valueStr = String(value);
                                const isLongContent = valueStr.length > 20;
                                const displayValue = isLongContent ? valueStr.substring(0, 20) + "..." : valueStr;
                                
                                if (key === 'file_images_json' || isLongContent) {
                                  const tooltipContent = key === 'file_images_json' ? 
                                    (() => {
                                      try {
                                        return JSON.stringify(JSON.parse(valueStr), null, 2);
                                      } catch (e) {
                                        return valueStr;
                                      }
                                    })() : valueStr;
                                  
                                  return (
                                    <div key={key} className="relative group">
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs cursor-help hover:bg-muted"
                                      >
                                        {key}: {displayValue}
                                      </Badge>
                                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-96 max-w-lg">
                                        <div className="bg-black text-white text-xs rounded p-3 shadow-lg border">
                                          <pre className="whitespace-pre-wrap break-words max-h-60 overflow-auto">
                                            {tooltipContent}
                                          </pre>
                                        </div>
                                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <Badge key={key} variant="outline" className="text-xs">
                                    {key}: {displayValue}
                                  </Badge>
                                );
                              })}
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

        {/* 파일 메타데이터 탭 */}
        <TabsContent value="filedata" className="space-y-6">
          {/* 필터 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                파일 필터 및 검색
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Input
                    placeholder="파일명 또는 ID 검색..."
                    value={fileMetadataSearch}
                    onChange={(e) => setFileMetadataSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && loadFileMetadata()}
                  />
                </div>
                <div>
                  <Select value={fileCategoryFilter} onValueChange={setFileCategoryFilter}>
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
                  <Select value={fileStatusFilter} onValueChange={setFileStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 상태</SelectItem>
                      <SelectItem value="uploaded">업로드됨</SelectItem>
                      <SelectItem value="preprocessing">전처리 중</SelectItem>
                      <SelectItem value="preprocessed">전처리 완료</SelectItem>
                      <SelectItem value="vectorizing">벡터화 중</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                      <SelectItem value="failed">실패</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadFileMetadata}>
                  <Search className="h-4 w-4 mr-2" />
                  검색
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 파일 메타데이터 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle>파일 메타데이터</CardTitle>
              <CardDescription>
                총 {fileMetadataTotal}개 파일 • {Math.ceil(fileMetadataTotal / fileMetadataLimit)}페이지 중 {fileMetadataPage}페이지
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>파일명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>벡터화</TableHead>
                    <TableHead>청크수</TableHead>
                    <TableHead>용량</TableHead>
                    <TableHead>업로드일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileMetadata.map((file) => (
                    <TableRow key={file.file_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">{file.file_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {file.category_name ? (
                          <Badge variant="outline">{file.category_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          file.status === "completed" ? "default" :
                          file.status === "failed" ? "destructive" :
                          file.status === "preprocessing" || file.status === "vectorizing" ? "secondary" :
                          "outline"
                        }>
                          {file.status === "uploaded" ? "업로드됨" :
                           file.status === "preprocessing" ? "전처리 중" :
                           file.status === "preprocessed" ? "전처리 완료" :
                           file.status === "vectorizing" ? "벡터화 중" :
                           file.status === "completed" ? "완료" :
                           file.status === "failed" ? "실패" : file.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={file.vectorized ? "default" : "outline"}>
                          {file.vectorized ? "완료" : "미완료"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {file.chunk_count ? file.chunk_count.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>{formatBytes(file.file_size)}</TableCell>
                      <TableCell>
                        {new Date(file.upload_time).toLocaleDateString('ko-KR')}
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
                                <DialogTitle>{file.filename}</DialogTitle>
                                <DialogDescription>파일 메타데이터 상세 정보</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid gap-2">
                                  <p><strong>파일 ID:</strong> {file.file_id}</p>
                                  <p><strong>저장 파일명:</strong> {file.saved_filename}</p>
                                  <p><strong>파일 경로:</strong> {file.file_path || "N/A"}</p>
                                  <p><strong>파일 해시:</strong> {file.file_hash || "N/A"}</p>
                                  <p><strong>파일 크기:</strong> {formatBytes(file.file_size)}</p>
                                  <p><strong>상태:</strong> {file.status}</p>
                                  <p><strong>벡터화:</strong> {file.vectorized ? "완료" : "미완료"}</p>
                                  {file.chunk_count && <p><strong>청크 수:</strong> {file.chunk_count}</p>}
                                  {file.preprocessing_method && <p><strong>전처리 방법:</strong> {file.preprocessing_method}</p>}
                                  <p><strong>업로드 시간:</strong> {new Date(file.upload_time).toLocaleString('ko-KR')}</p>
                                  {file.preprocessing_started_at && (
                                    <p><strong>전처리 시작:</strong> {new Date(file.preprocessing_started_at).toLocaleString('ko-KR')}</p>
                                  )}
                                  {file.preprocessing_completed_at && (
                                    <p><strong>전처리 완료:</strong> {new Date(file.preprocessing_completed_at).toLocaleString('ko-KR')}</p>
                                  )}
                                  {file.vectorization_started_at && (
                                    <p><strong>벡터화 시작:</strong> {new Date(file.vectorization_started_at).toLocaleString('ko-KR')}</p>
                                  )}
                                  {file.vectorization_completed_at && (
                                    <p><strong>벡터화 완료:</strong> {new Date(file.vectorization_completed_at).toLocaleString('ko-KR')}</p>
                                  )}
                                  {file.error_message && (
                                    <p className="text-red-600"><strong>오류 메시지:</strong> {file.error_message}</p>
                                  )}
                                </div>
                                {file.processing_options && (
                                  <div>
                                    <strong>처리 옵션:</strong>
                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                                      {JSON.stringify(file.processing_options, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {fileMetadataTotal > 0 && (
                    `${(fileMetadataPage - 1) * fileMetadataLimit + 1}-${Math.min(fileMetadataPage * fileMetadataLimit, fileMetadataTotal)} / ${fileMetadataTotal}개`
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFileMetadataPage(Math.max(1, fileMetadataPage - 1))}
                    disabled={fileMetadataPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFileMetadataPage(fileMetadataPage + 1)}
                    disabled={fileMetadataPage * fileMetadataLimit >= fileMetadataTotal}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
                    {/* VectorService 통합 검색 사용 - 컬렉션 선택 불필요 */}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">📊 {result.collection}</Badge>
                          
                          {/* 파일명 표시 (우선순위: filename > file_id) */}
                          {result.metadata?.filename ? (
                            <Badge variant="default" className="text-xs">
                              📄 {result.metadata.filename}
                            </Badge>
                          ) : result.metadata?.file_id && (
                            <Badge variant="outline" className="text-xs">
                              ID: {result.metadata.file_id.substring(0, 8)}...
                            </Badge>
                          )}
                          
                          {/* 카테고리명 표시 (우선순위: category_name > category_id) */}
                          {result.metadata?.category_name ? (
                            <Badge variant="secondary" className="text-xs">
                              📁 {result.metadata.category_name}
                            </Badge>
                          ) : result.metadata?.category_id && (
                            <Badge variant="outline" className="text-xs">
                              카테고리: {result.metadata.category_id.substring(0, 8)}...
                            </Badge>
                          )}
                          
                          {result.similarity && (
                            <Badge variant="default">
                              유사도: {(result.similarity * 100).toFixed(1)}%
                            </Badge>
                          )}
                          
                          {/* 이미지 정보 표시 */}
                          {result.has_images && result.image_count && result.image_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              🖼️ 이미지 {result.image_count}개
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
                      
                      {/* 관련 이미지 표시 */}
                      {result.related_images && result.related_images.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium mb-2">관련 이미지:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {result.related_images.slice(0, 3).map((image, imgIndex) => (
                              <div key={imgIndex} className="border rounded p-2 bg-muted text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    📄 페이지 {image.page}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {image.relationship_type === 'adjacent' ? '인접' : '페이지 맥락'}
                                  </Badge>
                                  <Badge variant="default" className="text-xs">
                                    신뢰도: {(image.confidence * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                                {image.image_path && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    경로: {image.image_path}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">기타 메타데이터:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(result.metadata)
                              .filter(([key]) => !['filename', 'category_name', 'file_id', 'category_id'].includes(key))
                              .slice(0, 5)
                              .map(([key, value]) => {
                                const valueStr = String(value);
                                const isLongContent = valueStr.length > 20;
                                const displayValue = isLongContent ? valueStr.substring(0, 20) + "..." : valueStr;
                                
                                if (key === 'file_images_json' || isLongContent) {
                                  const tooltipContent = key === 'file_images_json' ? 
                                    (() => {
                                      try {
                                        return JSON.stringify(JSON.parse(valueStr), null, 2);
                                      } catch (e) {
                                        return valueStr;
                                      }
                                    })() : valueStr;
                                  
                                  return (
                                    <div key={key} className="relative group">
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs cursor-help hover:bg-muted"
                                      >
                                        {key}: {displayValue}
                                      </Badge>
                                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-96 max-w-lg">
                                        <div className="bg-black text-white text-xs rounded p-3 shadow-lg border">
                                          <pre className="whitespace-pre-wrap break-words max-h-60 overflow-auto">
                                            {tooltipContent}
                                          </pre>
                                        </div>
                                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <Badge key={key} variant="outline" className="text-xs">
                                    {key}: {displayValue}
                                  </Badge>
                                );
                              })}
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

      </Tabs>

      {/* 메타데이터 삭제 확인 모달 */}
      <Dialog open={showDeleteModal.show} onOpenChange={(open) => setShowDeleteModal({show: open, fileId: '', filename: ''})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              메타데이터 삭제 확인
            </DialogTitle>
            <DialogDescription>
              정말로 이 파일의 메타데이터를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="text-sm text-destructive-foreground">
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