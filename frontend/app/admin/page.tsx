"use client";

import { useState, useEffect, useMemo } from "react";
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
  Users,
  Factory,
  FileText,
  Bot,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Activity,
  Target,
  ThumbsUp,
  Clock,
  Search,
  MessageSquare,
  ArrowRight,
  Settings,
  Cpu,
  MemoryStick,
  Server,
  PieChart,
  List,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { fileAPI, categoryAPI, statsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// --- 데이터 인터페이스 정의 ---
interface ChromaDBStatus {
  chromadb_available: boolean;
  collection_count: number;
  status: string;
  message: string;
  error?: string;
  requires_migration?: boolean;
}

interface DashboardData {
  system: {
    total_files: number;
    vectorized_files: number;
    total_categories: number;
  };
  usage: {
    daily_questions: {
      today: number;
      yesterday: number;
      this_week: number;
      last_week: number;
      this_month: number;
      last_month: number;
    };
    category_searches: Record<string, number>;
    avg_relevance: number;
    feedback_stats: {
      likes: number;
      dislikes: number;
      like_ratio: number;
    };
  };
  performance: {
    avg_response_time: number;
    system_usage: {
      cpu_avg: number;
      memory_avg: number;
    };
    vector_performance: {
      total_vectors: number;
    };
  };
  categories: {
    categories: Array<{
      name: string;
      file_count: number;
    }>;
  };
  recent_activity: {
    recent_uploads: Array<{
      filename: string;
      upload_time: string;
    }>;
    recent_searches: Array<{
      query: string;
      time: string;
    }>;
  };
}

// --- 재사용 가능한 컴포넌트 ---

// StatCard: 주요 통계 정보를 보여주는 카드
const StatCard = ({ icon, title, value, description, colorClass }) => {
  const Icon = icon;
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

// OverviewChart: 일일 질문 수를 보여주는 바 차트
const OverviewChart = ({ data }) => {
  const chartData = [
    { name: "지난 달", questions: data?.usage.daily_questions.last_month || 0 },
    { name: "이번 달", questions: data?.usage.daily_questions.this_month || 0 },
    { name: "지난 주", questions: data?.usage.daily_questions.last_week || 0 },
    { name: "이번 주", questions: data?.usage.daily_questions.this_week || 0 },
    { name: "어제", questions: data?.usage.daily_questions.yesterday || 0 },
    { name: "오늘", questions: data?.usage.daily_questions.today || 0 },
  ];

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          사용량 개요
        </CardTitle>
        <CardDescription>기간별 질문 수를 비교합니다.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}건`}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Bar dataKey="questions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// CategoryDistributionChart: 카테고리별 파일 분포를 보여주는 파이 차트
const CategoryDistributionChart = ({ data }) => {
  const chartData = useMemo(() => {
    console.log("CategoryDistributionChart 데이터:", data);
    console.log("Categories:", data?.categories?.categories);
    
    if (!data?.categories?.categories) {
      return [];
    }
    
    const filteredData = data.categories.categories
      .filter(cat => cat.file_count > 0)
      .map(cat => ({ name: cat.name, value: cat.file_count }));
    
    console.log("필터링된 차트 데이터:", filteredData);
    return filteredData;
  }, [data]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF1943"];

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          카테고리 분포
        </CardTitle>
        <CardDescription>파일이 포함된 카테고리 분포입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">카테고리 데이터가 없습니다</p>
              <p className="text-xs">파일을 업로드하고 카테고리를 설정해주세요</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// SystemHealthWidget: 시스템 상태 정보를 보여주는 위젯
const SystemHealthWidget = ({ chromaStatus, sqliteStatus, onReset }) => (
  <Card className="shadow-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Server className="h-5 w-5" />
        시스템 상태
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* ChromaDB Status */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">벡터 DB (ChromaDB)</h4>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {chromaStatus?.chromadb_available ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {chromaStatus?.chromadb_available ? "연결됨" : "연결 끊김"}
            </span>
          </div>
          <Badge variant={chromaStatus?.chromadb_available ? "default" : "destructive"}>
            {chromaStatus?.message}
          </Badge>
        </div>
        {chromaStatus?.error && (
          <div className="p-2 bg-destructive/10 text-xs text-destructive rounded-lg">
            {chromaStatus.error}
          </div>
        )}
        {chromaStatus?.requires_migration && (
          <Button onClick={onReset} variant="outline" size="sm" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            데이터베이스 리셋
          </Button>
        )}
      </div>

      {/* SQLite DB Status */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">통계 DB (SQLite)</h4>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {sqliteStatus?.db_available && sqliteStatus?.table_found ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {sqliteStatus?.db_available && sqliteStatus?.table_found ? "정상" : "오류"}
            </span>
          </div>
          <Badge variant={sqliteStatus?.db_available && sqliteStatus?.table_found ? "default" : "destructive"}>
            {sqliteStatus?.message}
          </Badge>
        </div>
        {sqliteStatus?.error && (
          <div className="p-2 bg-destructive/10 text-xs text-destructive rounded-lg">
            {sqliteStatus.error}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

// ActivityFeed: 최근 활동 내역을 보여주는 피드
const ActivityFeed = ({ data }) => (
  <Card className="shadow-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <List className="h-5 w-5" />
        최근 활동
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">최근 업로드</h4>
        <div className="space-y-2 text-xs">
          {data?.recent_activity.recent_uploads.slice(0, 3).map((upload, i) => (
            <div key={i} className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate flex-1">{upload.filename}</span>
              <span className="text-muted-foreground">
                {new Date(upload.upload_time).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-2">최근 검색</h4>
        <div className="space-y-2 text-xs">
          {data?.recent_activity.recent_searches.slice(0, 3).map((search, i) => (
            <div key={i} className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="truncate flex-1">{search.query}</span>
              <span className="text-muted-foreground">
                {new Date(search.time).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

// QuickActions: 빠른 작업 링크
const QuickActions = () => (
  <Card className="shadow-sm">
    <CardHeader>
      <CardTitle>빠른 작업</CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-2 gap-2">
      {[
        { href: "/admin/upload", icon: FileText, label: "파일 업로드" },
        { href: "/admin/categories", icon: Factory, label: "카테고리" },
        { href: "/admin/vectorization", icon: Database, label: "벡터화" },
        { href: "/admin/users", icon: Users, label: "사용자" },
        { href: "/admin/langflow", icon: Bot, label: "LangFlow" },
        { href: "/admin/settings", icon: Settings, label: "설정" },
      ].map(({ href, icon: Icon, label }) => (
        <Button key={href} variant="outline" className="w-full justify-start" asChild>
          <a href={href}>
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </a>
        </Button>
      ))}
    </CardContent>
  </Card>
);

// --- 메인 대시보드 컴포넌트 ---
export default function AdminDashboard() {
  const { toast } = useToast();
  const [chromaDBStatus, setChromaDBStatus] = useState<ChromaDBStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [chromaStatus, dashboardStats] = await Promise.all([
        fileAPI.getChromaDBStatus(),
        statsAPI.getDashboardStats(),
      ]);
      setChromaDBStatus(chromaStatus);
      setDashboardData(dashboardStats.data);
    } catch (error) {
      console.error("대시보드 데이터 로드 실패:", error);
      toast({
        title: "데이터 로드 실패",
        description: "대시보드 정보를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleChromaDBReset = async () => {
    try {
      const result = await fileAPI.resetChromaDB();
      toast({
        title: "ChromaDB 리셋 완료",
        description: result.message,
      });
      loadDashboardData();
    } catch (error) {
      toast({
        title: "리셋 실패",
        description: "ChromaDB 리셋 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">관리자 대시보드</h1>
        </div>
        <div className="text-center py-16">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <Database className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  const systemHealth = chromaDBStatus?.error
    ? "error"
    : chromaDBStatus?.requires_migration
    ? "warning"
    : "healthy";

  return (
    <div className="space-y-6 p-4 md:p-6 bg-muted/40 min-h-screen">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">관리자 대시보드</h1>
          <p className="text-muted-foreground">시스템의 현재 상태와 주요 지표를 확인하세요.</p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 시스템 상태 알림 */}
      {systemHealth !== "healthy" && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-yellow-800 dark:text-yellow-300 font-medium">
                시스템 상태: {systemHealth === "warning" ? "주의" : "오류"}
              </span>
            </div>
            {chromaDBStatus?.error && (
              <p className="text-sm text-yellow-700 dark:text-yellow-400/80 mt-2">
                ChromaDB: {chromaDBStatus.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽 메인 컨텐츠 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 주요 통계 카드 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={FileText}
              title="전체 파일"
              value={dashboardData?.system.total_files || 0}
              description="업로드된 PDF 파일 수"
              colorClass="text-blue-500"
            />
            <StatCard
              icon={Database}
              title="벡터화 완료"
              value={dashboardData?.system.vectorized_files || 0}
              description={`${dashboardData?.performance.vector_performance.total_vectors || 0} 벡터`}
              colorClass="text-green-500"
            />
            <StatCard
              icon={MessageSquare}
              title="오늘 질문"
              value={dashboardData?.usage.daily_questions.today || 0}
              description="오늘 발생한 질문 수"
              colorClass="text-purple-500"
            />
            <StatCard
              icon={Target}
              title="평균 적중률"
              value={`${dashboardData?.usage.avg_relevance || 0}%`}
              description="검색 결과 관련성 점수"
              colorClass="text-orange-500"
            />
          </div>

          {/* 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <OverviewChart data={dashboardData} />
            <CategoryDistributionChart data={dashboardData} />
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="space-y-6">
          <SystemHealthWidget 
            chromaStatus={{ ...chromaDBStatus, status: systemHealth }} 
            sqliteStatus={dashboardData?.system.sqlite_status}
            onReset={handleChromaDBReset} 
          />
          <ActivityFeed data={dashboardData} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}