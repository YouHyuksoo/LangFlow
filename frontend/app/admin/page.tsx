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

// StatCard: 주요 통계 정보를 보여주는 현대적인 그라디언트 카드
const StatCard = ({
  icon: Icon,
  title,
  value,
  description,
  colorClass,
}: StatCardProps) => {
  const gradientClasses = {
    "text-blue-500": "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    "text-green-500": "from-green-500/20 to-emerald-600/20 border-green-500/30",
    "text-purple-500": "from-purple-500/20 to-violet-600/20 border-purple-500/30",
    "text-orange-500": "from-orange-500/20 to-red-500/20 border-orange-500/30",
  };
  
  const gradientClass = gradientClasses[colorClass as keyof typeof gradientClasses] || "from-gray-500/20 to-gray-600/20 border-gray-500/30";
  
  return (
    <Card className={`bg-gradient-to-br ${gradientClass} backdrop-blur-sm border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-white/90">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-white/10">
          <Icon className={`h-5 w-5 ${colorClass || "text-white/70"}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <p className="text-xs text-white/70">{description}</p>
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-white/50 to-white/30 rounded-full animate-pulse"></div>
        </div>
      </CardContent>
    </Card>
  );
};

interface OverviewChartProps {
  data: DashboardData | null;
}

// OverviewChart: 일일 질문 수를 보여주는 현대적인 그라디언트 바 차트
const OverviewChart = ({ data }: OverviewChartProps) => {
  const chartData = [
    { name: "지난 달", questions: data?.usage.daily_questions.last_month || 0, color: "#8B5CF6" },
    { name: "이번 달", questions: data?.usage.daily_questions.this_month || 0, color: "#A855F7" },
    { name: "지난 주", questions: data?.usage.daily_questions.last_week || 0, color: "#C084FC" },
    { name: "이번 주", questions: data?.usage.daily_questions.this_week || 0, color: "#D8B4FE" },
    { name: "어제", questions: data?.usage.daily_questions.yesterday || 0, color: "#E879F9" },
    { name: "오늘", questions: data?.usage.daily_questions.today || 0, color: "#F472B6" },
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <BarChart3 className="h-5 w-5 text-purple-400" />
          </div>
          <span>사용량 개요</span>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">+12.5%</Badge>
        </CardTitle>
        <CardDescription className="text-slate-400">기간별 질문 수 추이와 성장률을 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94A3B8' }}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94A3B8' }}
              tickFormatter={(value) => `${value}건`}
            />
            <Tooltip
              cursor={{ fill: "rgba(139, 92, 246, 0.1)" }}
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                borderRadius: "12px",
                backdropFilter: "blur(16px)",
                color: "white",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
              }}
            />
            <Bar
              dataKey="questions"
              fill="url(#barGradient)"
              radius={[6, 6, 0, 0]}
              stroke="#8B5CF6"
              strokeWidth={1}
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

// CategoryDistributionChart: 카테고리별 파일 분포를 보여주는 현대적인 도넉 차트
const CategoryDistributionChart = ({
  data,
}: CategoryDistributionChartProps) => {
  const chartData = useMemo(() => {
    if (!data?.categories?.categories) {
      return [];
    }

    const filteredData = data.categories.categories
      .filter((cat) => cat.file_count > 0)
      .map((cat) => ({ name: cat.name, value: cat.file_count }));

    return filteredData;
  }, [data]);

  const COLORS = [
    "#8B5CF6", // Purple
    "#EC4899", // Pink  
    "#06B6D4", // Cyan
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <PieChart className="h-5 w-5 text-cyan-400" />
          </div>
          <span>카테고리 분포</span>
          {chartData.length > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {chartData.length}개 카테고리
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-slate-400">파일이 포함된 카테고리별 분산 현황입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <defs>
                {COLORS.map((color, index) => (
                  <linearGradient key={index} id={`gradient${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={color} stopOpacity={0.4}/>
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={85}
                innerRadius={35}
                fill="#8884d8"
                dataKey="value"
                stroke="none"
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#gradient${index % COLORS.length})`}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  borderRadius: "12px",
                  backdropFilter: "blur(16px)",
                  color: "white",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
                }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-slate-400">
            <div className="text-center">
              <div className="p-4 rounded-full bg-slate-800/50 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <PieChart className="h-8 w-8 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-white mb-1">카테고리 데이터가 없습니다</p>
              <p className="text-xs text-slate-500">
                파일을 업로드하고 카테고리를 설정해주세요
              </p>
            </div>
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

// SystemHealthWidget: 시스템 상태 정보를 보여주는 현대적인 위젯
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
    
  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white">
          <div className={`p-2 rounded-lg ${overallHealth ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <Server className={`h-5 w-5 ${overallHealth ? 'text-green-400' : 'text-red-400'}`} />
          </div>
          <span>시스템 상태</span>
          <div className={`w-2 h-2 rounded-full ${overallHealth ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
      {/* ChromaDB Status */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">벡터 DB (ChromaDB)</h4>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {chromaStatus?.connected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {chromaStatus?.connected ? "연결됨" : "연결 끊김"}
            </span>
          </div>
          <Badge variant={chromaStatus?.connected ? "default" : "destructive"}>
            {chromaStatus?.error || "정상"}
          </Badge>
        </div>
        {chromaStatus?.error && (
          <div className="p-2 bg-destructive/10 text-xs text-destructive rounded-lg">
            {chromaStatus.error}
          </div>
        )}
        {/* Removed requires_migration as it's not directly available in the new ChromaDBStatus */}
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
              {sqliteStatus?.db_available && sqliteStatus?.table_found
                ? "정상"
                : "오류"}
            </span>
          </div>
          <Badge
            variant={
              sqliteStatus?.db_available && sqliteStatus?.table_found
                ? "default"
                : "destructive"
            }
          >
            {sqliteStatus?.message}
          </Badge>
        </div>
        {sqliteStatus?.error && (
          <div className="p-2 bg-destructive/10 text-xs text-destructive rounded-lg">
            {sqliteStatus.error}
          </div>
        )}
      </div>

      {/* File Metadata DB Status */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-400" />
          파일 메타데이터 DB
        </h4>
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${fileMetadataStatus?.db_available && fileMetadataStatus?.table_found ? 'bg-green-400 shadow-green-400/50 shadow-lg animate-pulse' : 'bg-red-400 shadow-red-400/50 shadow-lg'}`}></div>
              <span className="text-sm font-medium text-white">
                {fileMetadataStatus?.db_available && fileMetadataStatus?.table_found
                  ? "정상"
                  : "오류"}
              </span>
            </div>
            <Badge className={`${
              fileMetadataStatus?.db_available && fileMetadataStatus?.table_found
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {fileMetadataStatus?.record_count || 0}개 파일
            </Badge>
          </div>
        </div>
        {fileMetadataStatus?.error && (
          <div className="p-3 bg-red-500/10 text-xs text-red-400 rounded-xl border border-red-500/20">
            {fileMetadataStatus.error}
          </div>
        )}
      </div>

      {/* Vector Metadata DB Status */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-400" />
          벡터 메타데이터 DB
        </h4>
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${vectorMetadataStatus?.db_available && vectorMetadataStatus?.chroma_available ? 'bg-green-400 shadow-green-400/50 shadow-lg animate-pulse' : 'bg-red-400 shadow-red-400/50 shadow-lg'}`}></div>
              <span className="text-sm font-medium text-white">
                {vectorMetadataStatus?.db_available && vectorMetadataStatus?.chroma_available
                  ? "정상"
                  : "오류"}
              </span>
            </div>
            <Badge className={`${
              vectorMetadataStatus?.db_available && vectorMetadataStatus?.chroma_available
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {vectorMetadataStatus?.collection_count || 0}개 컬렉션
            </Badge>
          </div>
        </div>
        {vectorMetadataStatus?.error && (
          <div className="p-3 bg-red-500/10 text-xs text-red-400 rounded-xl border border-red-500/20">
            {vectorMetadataStatus.error}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
  );
};

interface ActivityFeedProps {
  data: DashboardData | null;
}

// ActivityFeed: 최근 활동 내역을 보여주는 현대적인 피드
const ActivityFeed = ({ data }: ActivityFeedProps) => (
  <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
    <CardHeader>
      <CardTitle className="flex items-center gap-3 text-white">
        <div className="p-2 rounded-lg bg-orange-500/20">
          <Activity className="h-5 w-5 text-orange-400" />
        </div>
        <span>최근 활동</span>
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3 text-white/90 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
          최근 업로드
        </h4>
        <div className="space-y-3 text-xs">
          {data?.recent_activity.recent_uploads.slice(0, 3).map((upload, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/50 transition-colors">
              <div className="p-1.5 rounded-md bg-blue-500/20">
                <FileText className="h-3 w-3 text-blue-400" />
              </div>
              <span className="truncate flex-1 text-white font-medium">{upload.filename}</span>
              <span className="text-slate-400 font-mono text-[10px]">
                {new Date(upload.upload_time).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-700/50 pt-4">
        <h4 className="text-sm font-medium mb-3 text-white/90 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
          최근 검색
        </h4>
        <div className="space-y-3 text-xs">
          {data?.recent_activity.recent_searches
            .slice(0, 3)
            .map((search, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/50 transition-colors">
                <div className="p-1.5 rounded-md bg-purple-500/20">
                  <Search className="h-3 w-3 text-purple-400" />
                </div>
                <span className="truncate flex-1 text-white font-medium">{search.query}</span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {new Date(search.time).toLocaleTimeString()}
                </span>
              </div>
            ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

// FastActionWidget: 빠른 액션을 위한 현대적인 위젯
const FastActionWidget = () => {
  const actions = [
    {
      title: "파일 업로드",
      description: "새 문서 추가",
      icon: Factory,
      href: "/admin/upload",
      gradient: "from-blue-500 to-cyan-500",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400"
    },
    {
      title: "벡터 관리",
      description: "벡터 데이터 관리",
      icon: Database,
      href: "/admin/vectors",
      gradient: "from-purple-500 to-pink-500",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-400"
    },
    {
      title: "설정",
      description: "시스템 설정",
      icon: Settings,
      href: "/admin/settings",
      gradient: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-400"
    },
    {
      title: "데이터베이스",
      description: "DB 관리",
      icon: Server,
      href: "/admin/settings/database",
      gradient: "from-orange-500 to-red-500",
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-400"
    }
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="p-2 rounded-lg bg-violet-500/20">
            <ArrowRight className="h-5 w-5 text-violet-400" />
          </div>
          <span>빠른 액션</span>
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <div
            key={index}
            className={`group relative overflow-hidden rounded-xl bg-gradient-to-r ${action.gradient} p-[1px] cursor-pointer hover:scale-105 transition-all duration-300`}
            onClick={() => window.location.href = action.href}
          >
            <div className="bg-slate-900/90 rounded-xl p-4 hover:bg-slate-800/90 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${action.iconBg}`}>
                  <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">{action.title}</h4>
                  <p className="text-xs text-slate-400">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
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
        // 기존 파일 API의 ChromaDB 상태 사용
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
    : chromaDBStatus?.connected === false
    ? "warning"
    : "healthy";

  return (
    <div className="space-y-6 p-4 md:p-6 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
            관리자 대시보드
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            시스템의 현재 상태와 주요 지표를 확인하세요.
          </p>
        </div>
        <Button 
          onClick={loadDashboardData} 
          className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 시스템 상태 알림 */}
      {systemHealth !== "healthy" && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-red-500/10 border-amber-500/30 backdrop-blur-sm shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-amber-200 font-medium text-lg">
                시스템 상태: {systemHealth === "warning" ? "주의" : "오류"}
              </span>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
            </div>
            {chromaDBStatus?.error && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm text-red-300 font-medium">
                  ChromaDB: {chromaDBStatus.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* 왼쪽 메인 컨텐츠 */}
        <div className="xl:col-span-3 space-y-6">
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
            <div className="lg:col-span-3">
              <OverviewChart data={dashboardData} />
            </div>
            <div className="lg:col-span-2">
              <CategoryDistributionChart data={dashboardData} />
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="space-y-6">
          <FastActionWidget />
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
    </div>
  );
}
