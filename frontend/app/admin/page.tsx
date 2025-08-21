"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
import { fileAPI, categoryAPI, statsAPI, vectorAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// --- 데이터 인터페이스 정의 ---
interface ChromaDBStatus {
  connected: boolean;
  total_vectors: number;
  collection_count: number;
  collections: string[];
  error: string | null;
}

interface SQLiteStatus {
  db_available: boolean;
  table_found: boolean;
  message: string;
  error?: string;
}

interface FileMetadataStatus {
  db_available: boolean;
  table_found: boolean;
  message: string;
  error?: string;
  record_count: number;
}

interface VectorMetadataStatus {
  db_available: boolean;
  chroma_available: boolean;
  message: string;
  error?: string;
  collection_count: number;
}

interface DashboardData {
  system: {
    total_files: number;
    vectorized_files: number;
    total_categories: number;
    sqlite_status: SQLiteStatus;
    file_metadata_status: FileMetadataStatus;
    vector_metadata_status: VectorMetadataStatus;
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

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description: string;
  colorClass?: string;
}

const StatCard = ({
  icon: Icon,
  title,
  value,
  description,
  colorClass,
}: StatCardProps) => {
  return (
    <Card className="stat-card relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-muted-foreground ${colorClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

interface OverviewChartProps {
  data: DashboardData | null;
}

const OverviewChart = ({ data }: OverviewChartProps) => {
  const chartData = [
    { name: "지난 달", questions: data?.usage.daily_questions.last_month || 0 },
    { name: "이번 달", questions: data?.usage.daily_questions.this_month || 0 },
    { name: "지난 주", questions: data?.usage.daily_questions.last_week || 0 },
    { name: "이번 주", questions: data?.usage.daily_questions.this_week || 0 },
    { name: "어제", questions: data?.usage.daily_questions.yesterday || 0 },
    { name: "오늘", questions: data?.usage.daily_questions.today || 0 },
  ];

  return (
    <Card className="stat-card relative overflow-hidden">
      <CardHeader>
        <CardTitle>사용량 개요</CardTitle>
        <CardDescription>기간별 질문 수 추이입니다.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
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
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Bar 
              dataKey="questions" 
              fill="url(#colorGradient)" 
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

interface CategoryDistributionChartProps {
  data: DashboardData | null;
}

const CategoryDistributionChart = ({
  data,
}: CategoryDistributionChartProps) => {
  const chartData = useMemo(() => {
    if (!data?.categories?.categories) {
      return [];
    }
    return data.categories.categories
      .filter((cat) => cat.file_count > 0)
      .map((cat) => ({ name: cat.name, value: cat.file_count }));
  }, [data]);

  const COLORS = [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500  
    "#8b5cf6", // violet-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#06b6d4", // cyan-500
    "#84cc16", // lime-500
    "#ec4899", // pink-500
  ];

  return (
    <Card className="stat-card relative overflow-hidden">
      <CardHeader>
        <CardTitle>카테고리 분포</CardTitle>
        <CardDescription>파일이 포함된 카테고리별 분산 현황입니다.</CardDescription>
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
            <p>데이터가 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface SystemHealthWidgetProps {
  chromaStatus: ChromaDBStatus | null;
  sqliteStatus: SQLiteStatus | undefined;
  fileMetadataStatus: FileMetadataStatus | undefined;
  vectorMetadataStatus: VectorMetadataStatus | undefined;
  onReset: () => void;
}

const SystemHealthWidget = ({
  chromaStatus,
  sqliteStatus,
  fileMetadataStatus,
  vectorMetadataStatus,
  onReset,
}: SystemHealthWidgetProps) => {
  const overallHealth = 
    chromaStatus?.connected && 
    sqliteStatus?.db_available && 
    fileMetadataStatus?.db_available && 
    vectorMetadataStatus?.db_available;
    
  const StatusIndicator = ({ healthy }: { healthy: boolean }) => (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${healthy ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500 shadow-sm shadow-red-500/50'}`} />
      <span className={`text-sm font-medium ${healthy ? 'text-emerald-500' : 'text-red-500'}`}>{healthy ? "정상" : "오류"}</span>
    </div>
  );

  return (
    <Card className="stat-card relative overflow-hidden">
      <CardHeader>
        <CardTitle>시스템 상태</CardTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator healthy={!!overallHealth} />
          <span className="text-xs text-muted-foreground">전체 상태</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between items-center">
          <span>벡터 DB (ChromaDB)</span>
          <StatusIndicator healthy={!!chromaStatus?.connected} />
        </div>
        <div className="flex justify-between items-center">
          <span>통계 DB (SQLite)</span>
          <StatusIndicator healthy={!!(sqliteStatus?.db_available && sqliteStatus?.table_found)} />
        </div>
        <div className="flex justify-between items-center">
          <span>파일 메타데이터 DB</span>
          <StatusIndicator healthy={!!(fileMetadataStatus?.db_available && fileMetadataStatus?.table_found)} />
        </div>
        <div className="flex justify-between items-center">
          <span>벡터 메타데이터 DB</span>
          <StatusIndicator healthy={!!(vectorMetadataStatus?.db_available && vectorMetadataStatus?.chroma_available)} />
        </div>
      </CardContent>
    </Card>
  );
};

interface ActivityFeedProps {
  data: DashboardData | null;
}

const ActivityFeed = ({ data }: ActivityFeedProps) => (
  <Card className="stat-card relative overflow-hidden">
    <CardHeader>
      <CardTitle>최근 활동</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">최근 업로드</h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          {data?.recent_activity.recent_uploads.slice(0, 3).map((upload, i) => (
            <div key={i} className="flex justify-between">
              <span className="truncate">{upload.filename}</span>
              <span>{new Date(upload.upload_time).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-2">최근 검색</h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          {data?.recent_activity.recent_searches
            .slice(0, 3)
            .map((search, i) => (
              <div key={i} className="flex justify-between">
                <span className="truncate">{search.query}</span>
                <span>{new Date(search.time).toLocaleTimeString()}</span>
              </div>
            ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

interface FastActionWidgetProps {
  actions: Array<{
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
  }>;
}

const FastActionWidget = ({ actions }: FastActionWidgetProps) => {
  return (
    <Card className="stat-card relative overflow-hidden">
      <CardHeader>
        <CardTitle>빠른 액션</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action, index) => (
          <Link href={action.href} key={index} className="block">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
              <action.icon className={`h-4 w-4 ${
                action.title === '파일 업로드' ? 'text-blue-500' :
                action.title === '벡터 관리' ? 'text-green-500' :
                action.title === '설정' ? 'text-purple-500' :
                action.title === '데이터베이스' ? 'text-orange-500' :
                'text-muted-foreground'
              }`} />
              <div>
                <h4 className="text-sm font-medium">{action.title}</h4>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
};

// --- 메인 대시보드 컴포넌트 ---
export default function AdminDashboard() {
  const { toast } = useToast();
  const [chromaDBStatus, setChromaDBStatus] = useState<ChromaDBStatus | null>(
    null
  );
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
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
      const result = await vectorAPI.resetChromaDB();
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

  const fastActions = [
    { title: "파일 업로드", description: "새 문서 추가", icon: Factory, href: "/admin/upload" },
    { title: "벡터 관리", description: "벡터 데이터 관리", icon: Database, href: "/admin/vectors" },
    { title: "설정", description: "시스템 설정", icon: Settings, href: "/admin/settings" },
    { title: "데이터베이스", description: "DB 관리", icon: Server, href: "/admin/settings/database" },
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">관리자 대시보드</h1>
        </div>
        <div className="text-center py-16">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <Database className="h-12 w-12 text-blue-500" />
            <p className="text-muted-foreground">데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  const systemHealth = chromaDBStatus?.error
    ? "error"
    : chromaDBStatus?.connected === false
    ? "warning"
    : "healthy";

  return (
    <div className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">관리자 대시보드</h1>
          <p className="text-muted-foreground">
            시스템의 현재 상태와 주요 지표를 확인하세요.
          </p>
        </div>
        <Button onClick={loadDashboardData} size="sm">
          <RefreshCw className="h-4 w-4 mr-2 text-blue-500" />
          새로고침
        </Button>
      </div>

      {/* 시스템 상태 알림 */}
      {systemHealth !== "healthy" && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-destructive font-medium">
                시스템 상태: {systemHealth === "warning" ? "주의" : "오류"}
              </span>
            </div>
            {chromaDBStatus?.error && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive font-medium">
                  ChromaDB: {chromaDBStatus.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          description={`${
            dashboardData?.performance.vector_performance.total_vectors || 0
          } 벡터`}
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <OverviewChart data={dashboardData} />
        </div>
        <div className="lg:col-span-3">
          <CategoryDistributionChart data={dashboardData} />
        </div>
      </div>

      {/* 빠른액션, 시스템상태, 최근활동 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FastActionWidget actions={fastActions} />
        <SystemHealthWidget
          chromaStatus={chromaDBStatus}
          sqliteStatus={dashboardData?.system.sqlite_status}
          fileMetadataStatus={dashboardData?.system.file_metadata_status}
          vectorMetadataStatus={dashboardData?.system.vector_metadata_status}
          onReset={handleChromaDBReset}
        />
        <ActivityFeed data={dashboardData} />
      </div>
    </div>
  );
}
