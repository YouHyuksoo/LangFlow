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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Bot,
  Activity,
  Settings,
  FileText,
  AlertTriangle,
  Eye,
  Power,
  Star,
  Search,
  Trash2,
  RefreshCw,
  Filter,
} from "lucide-react";
import { fileAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface LangFlowStatus {
  default_vectorization_flow_id: string | null;
  default_search_flow_id: string | null;
  total_flows: number;
  flows: Array<{
    flow_id: string;
    name: string;
    description: string;
    is_active: boolean;
    created_at: string;
    flow_type?: string;
    endpoint_name?: string;
  }>;
  langflow_configured: boolean;
}

interface FlowDetails {
  flow_id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  flow_type?: string;
  endpoint_name?: string;
  components?: any[];
  connections?: any[];
}

export default function LangFlowPage() {
  const { toast } = useToast();
  const [langflowStatus, setLangflowStatus] = useState<LangFlowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<FlowDetails | null>(null);
  const [flowDetailsLoading, setFlowDetailsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const loadLangFlowStatus = async () => {
    try {
      setLoading(true);
      const status = await fileAPI.getLangflowStatus();
      setLangflowStatus(status);
    } catch (error) {
      console.error("LangFlow 상태 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "LangFlow 상태를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFlowDetails = async (flowId: string) => {
    try {
      setFlowDetailsLoading(true);
      const details = await fileAPI.getLangflowFlowDetails(flowId);
      setSelectedFlow(details);
    } catch (error) {
      console.error("Flow 상세 정보 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "Flow 상세 정보를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setFlowDetailsLoading(false);
    }
  };

  const toggleFlowStatus = async (flowId: string) => {
    try {
      await fileAPI.toggleFlowStatus(flowId);
      toast({
        title: "상태 변경 완료",
        description: "Flow 상태가 성공적으로 변경되었습니다.",
      });
      loadLangFlowStatus(); // 상태 새로고침
    } catch (error) {
      console.error("Flow 상태 변경 실패:", error);
      toast({
        title: "상태 변경 실패",
        description: "Flow 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const setDefaultVectorizationFlow = async (flowId: string) => {
    try {
      await fileAPI.setDefaultVectorizationFlow(flowId);
      toast({
        title: "기본 벡터화 Flow 설정 완료",
        description: "기본 벡터화 Flow가 성공적으로 설정되었습니다.",
      });
      loadLangFlowStatus(); // 상태 새로고침
    } catch (error) {
      console.error("기본 벡터화 Flow 설정 실패:", error);
      toast({
        title: "설정 실패",
        description: "기본 벡터화 Flow 설정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const setSearchFlow = async (flowId: string) => {
    try {
      await fileAPI.setSearchFlow(flowId);
      toast({
        title: "검색 Flow 설정 완료",
        description: "검색 Flow가 성공적으로 설정되었습니다.",
      });
      loadLangFlowStatus(); // 상태 새로고침
    } catch (error) {
      console.error("검색 Flow 설정 실패:", error);
      toast({
        title: "설정 실패",
        description: "검색 Flow 설정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const deleteFlow = async (flowId: string) => {
    try {
      await fileAPI.deleteFlow(flowId);
      toast({
        title: "Flow 삭제 완료",
        description: "Flow가 성공적으로 삭제되었습니다.",
      });
      loadLangFlowStatus(); // 상태 새로고침
    } catch (error) {
      console.error("Flow 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "Flow 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const filteredFlows = langflowStatus?.flows.filter((flow) => {
    if (filterType === "all") return true;
    if (filterType === "active") return flow.is_active;
    if (filterType === "inactive") return !flow.is_active;
    if (filterType === "vectorization") return flow.flow_type === "vectorization" || flow.flow_id === langflowStatus.default_vectorization_flow_id;
    if (filterType === "search") return flow.flow_type === "search" || flow.flow_id === langflowStatus.default_search_flow_id;
    return true;
  }) || [];

  useEffect(() => {
    loadLangFlowStatus();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">LangFlow 관리</h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="text-muted-foreground">LangFlow 상태를 불러오는 중...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">LangFlow 관리</h1>
        <Button onClick={loadLangFlowStatus} variant="outline">
          상태 새로고침
        </Button>
      </div>

      {/* 상태 알림 */}
      {!langflowStatus?.langflow_configured && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800 font-medium">LangFlow 설정 필요</span>
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              기본 벡터화 Flow 또는 검색 Flow가 설정되지 않았습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 통계 카드들 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">설정 상태</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge 
                variant={langflowStatus?.langflow_configured ? "default" : "secondary"}
              >
                {langflowStatus?.langflow_configured ? "설정됨" : "미설정"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              기본 Flow 설정 상태
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 Flow</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{langflowStatus?.total_flows || 0}</div>
            <p className="text-xs text-muted-foreground">등록된 Flow 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 Flow</CardTitle>
            <Settings className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {langflowStatus?.flows.filter(f => f.is_active).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">실행 가능한 Flow</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">기본 Flow</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {[langflowStatus?.default_vectorization_flow_id, langflowStatus?.default_search_flow_id].filter(Boolean).length}
            </div>
            <p className="text-xs text-muted-foreground">벡터화 + 검색 Flow</p>
          </CardContent>
        </Card>
      </div>

      {/* Flow 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>등록된 Flow 목록</CardTitle>
            <CardDescription>
              LangFlow에 등록된 Flow들을 관리할 수 있습니다.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
                <SelectItem value="vectorization">벡터화</SelectItem>
                <SelectItem value="search">검색</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredFlows || filteredFlows.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {filterType === "all" ? "등록된 Flow가 없습니다." : `${filterType} Flow가 없습니다.`}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                LangFlow에서 Flow를 생성하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFlows.map((flow) => (
                <div
                  key={flow.flow_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Bot className="h-8 w-8 text-blue-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{flow.name}</p>
                        {flow.flow_id === langflowStatus?.default_vectorization_flow_id && (
                          <Badge variant="default" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            기본 벡터화
                          </Badge>
                        )}
                        {flow.flow_id === langflowStatus?.default_search_flow_id && (
                          <Badge variant="secondary" className="text-xs">
                            <Search className="h-3 w-3 mr-1" />
                            기본 검색
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{flow.description}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-xs text-muted-foreground">
                          ID: {flow.flow_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          생성일: {new Date(flow.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={flow.is_active ? "default" : "secondary"}>
                      {flow.is_active ? "활성" : "비활성"}
                    </Badge>
                    
                    {/* 상세 보기 다이얼로그 */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => loadFlowDetails(flow.flow_id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          상세
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{selectedFlow?.name || "Flow 상세 정보"}</DialogTitle>
                          <DialogDescription>
                            Flow의 상세 정보를 확인할 수 있습니다.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {flowDetailsLoading ? (
                            <div className="text-center py-4">
                              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                              <p className="text-muted-foreground">로딩 중...</p>
                            </div>
                          ) : selectedFlow ? (
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium">Flow ID</label>
                                <p className="text-sm text-muted-foreground">{selectedFlow.flow_id}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">이름</label>
                                <p className="text-sm text-muted-foreground">{selectedFlow.name}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">설명</label>
                                <p className="text-sm text-muted-foreground">{selectedFlow.description}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">상태</label>
                                <Badge variant={selectedFlow.is_active ? "default" : "secondary"}>
                                  {selectedFlow.is_active ? "활성" : "비활성"}
                                </Badge>
                              </div>
                              <div>
                                <label className="text-sm font-medium">생성일</label>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(selectedFlow.created_at).toLocaleString()}
                                </p>
                              </div>
                              {selectedFlow.endpoint_name && (
                                <div>
                                  <label className="text-sm font-medium">엔드포인트</label>
                                  <p className="text-sm text-muted-foreground font-mono">
                                    {selectedFlow.endpoint_name}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">정보를 불러올 수 없습니다.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* 활성/비활성 토글 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFlowStatus(flow.flow_id)}
                      className={flow.is_active ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                    >
                      <Power className="h-4 w-4 mr-1" />
                      {flow.is_active ? "비활성" : "활성"}
                    </Button>

                    {/* 기본 Flow 설정 드롭다운 */}
                    <Select onValueChange={(value) => {
                      if (value === "vectorization") setDefaultVectorizationFlow(flow.flow_id);
                      if (value === "search") setSearchFlow(flow.flow_id);
                    }}>
                      <SelectTrigger className="w-[100px]">
                        <Settings className="h-4 w-4 mr-1" />
                        <SelectValue placeholder="설정" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vectorization">벡터화 기본</SelectItem>
                        <SelectItem value="search">검색 기본</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* 삭제 버튼 */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Flow 삭제</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{flow.name}" Flow를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFlow(flow.flow_id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 설정 정보 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 font-medium">현재 설정</span>
            </div>
            <div className="text-sm text-blue-700 mt-3 space-y-2">
              <div className="flex justify-between">
                <span>기본 벡터화 Flow:</span>
                <span className="font-mono">
                  {langflowStatus?.default_vectorization_flow_id || "미설정"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>기본 검색 Flow:</span>
                <span className="font-mono">
                  {langflowStatus?.default_search_flow_id || "미설정"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>총 Flow 수:</span>
                <span>{langflowStatus?.total_flows || 0}개</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">관리 기능</span>
            </div>
            <div className="text-sm text-green-700 mt-3 space-y-2">
              <ul className="list-disc list-inside space-y-1">
                <li>Flow 상세 정보 조회</li>
                <li>Flow 활성/비활성 전환</li>
                <li>기본 벡터화/검색 Flow 설정</li>
                <li>Flow 삭제</li>
                <li>타입별 Flow 필터링</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}