"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare,
  Bot,
  Zap,
  Shield,
  Search,
  FileText,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Star,
  ChevronRight,
  Play,
  Globe,
  Database,
  Cpu,
  Brain,
} from "lucide-react";
import { userAPI } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // 로그인 상태 확인 후 적절한 페이지로 이동
  const handleStartNow = async () => {
    setIsLoading(true);
    
    try {
      // 현재 사용자 정보 확인
      const user = await userAPI.getCurrentUser();
      // 로그인된 경우 채팅 페이지로 이동
      router.push('/chat');
    } catch (error: any) {
      // 로그인되지 않은 경우 로그인 페이지로 이동
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/login?redirect=/chat');
      } else {
        console.error('사용자 정보 확인 오류:', error);
        // 오류 발생 시에도 로그인 페이지로 이동
        router.push('/login?redirect=/chat');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Brain,
      title: "AI 기반 지능형 검색",
      description: "고도화된 AI 기술로 사내 문서를 분석하고 정확한 답변을 제공합니다.",
    },
    {
      icon: Database,
      title: "벡터 기반 문서 검색",
      description: "ChromaDB를 활용한 빠르고 정확한 문서 검색 시스템입니다.",
    },
    {
      icon: Shield,
      title: "보안 우선 설계",
      description: "기업용 보안 기준을 만족하는 안전한 문서 관리 시스템입니다.",
    },
    {
      icon: Cpu,
      title: "ThinkFlow 통합",
      description: "노코드 AI 워크플로우 구성으로 맞춤형 응답 처리가 가능합니다.",
    },
    {
      icon: Users,
      title: "사용자 맞춤형",
      description: "개인별 관심 분야와 권한에 따른 개인화된 응답을 제공합니다.",
    },
    {
      icon: BarChart3,
      title: "실시간 분석",
      description: "사용 패턴 분석과 성능 모니터링으로 지속적인 개선을 지원합니다.",
    },
  ];

  const testimonials = [
    {
      name: "김개발",
      role: "개발팀 팀장",
      content: "문서 찾는 시간이 90% 줄어들었습니다. 정말 혁신적이에요!",
      rating: 5,
    },
    {
      name: "이기획",
      role: "기획팀 부장",
      content: "복잡한 정책 문서도 쉽게 이해할 수 있는 답변을 받을 수 있어서 업무 효율성이 크게 향상되었습니다.",
      rating: 5,
    },
    {
      name: "박관리",
      role: "인사팀 과장",
      content: "신입사원 교육 시간이 절반으로 단축되었습니다. 언제든 궁금한 것을 물어볼 수 있어서 좋아요.",
      rating: 5,
    },
  ];

  const stats = [
    { number: "10,000+", label: "처리된 문서" },
    { number: "95%", label: "정확도" },
    { number: "2.3초", label: "평균 응답시간" },
    { number: "500+", label: "일일 사용자" },
  ];

  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/10">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/20 opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
        </div>
        
        <div className="relative container mx-auto px-4 py-24 lg:py-32">
          <div className={`max-w-4xl mx-auto text-center transform transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}>
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Bot className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium text-primary">AI 기반 지식 관리 시스템</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent mb-6 leading-tight">
              ThinkFlow
              <br />
              <span className="text-3xl md:text-5xl lg:text-6xl">스마트 문서 어시스턴트</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              사내 문서를 AI가 이해하고, 당신이 원하는 정보를 즉시 찾아드립니다. 
              복잡한 문서 더미에서 벗어나 효율적인 업무를 경험하세요.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="group h-12 px-8 text-lg font-semibold" 
                onClick={handleStartNow}
                disabled={isLoading}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                {isLoading ? '로딩 중...' : '지금 시작하기'}
                {!isLoading && (
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                )}
              </Button>
              
              <Button variant="outline" size="lg" className="group h-12 px-8 text-lg font-semibold">
                <Play className="h-4 w-4 mr-2" />
                데모 보기
              </Button>
            </div>
            
            <div className="mt-12 flex items-center justify-center space-x-8 text-sm text-muted-foreground">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-primary mr-2" />
                무료 체험
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-primary mr-2" />
                설치 불필요
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-primary mr-2" />
                보안 인증
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  {stat.number}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              왜 ThinkFlow를 선택해야 할까요?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              최신 AI 기술과 사용자 중심 설계로 업무 효율성을 극대화합니다
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-card to-muted/30">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-primary to-accent p-2.5 mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              어떻게 작동하나요?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              간단한 3단계로 원하는 정보를 얻을 수 있습니다
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "질문 입력",
                description: "궁금한 내용을 자연어로 입력하세요",
                icon: MessageSquare,
              },
              {
                step: "02", 
                title: "AI 분석",
                description: "AI가 사내 문서를 분석하고 관련 정보를 찾습니다",
                icon: Search,
              },
              {
                step: "03",
                title: "정확한 답변",
                description: "출처와 함께 정확하고 상세한 답변을 받습니다",
                icon: FileText,
              },
            ].map((step, index) => (
              <div key={index} className="text-center relative">
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary to-transparent" />
                )}
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mb-4 mx-auto">
                  {step.step}
                </div>
                <step.icon className="h-8 w-8 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              사용자들의 이야기
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              실제 사용자들이 경험한 ThinkFlow의 효과를 확인하세요
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 bg-gradient-to-br from-card to-muted/30">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-primary fill-primary" />
                    ))}
                  </div>
                  <blockquote className="text-base mb-4 italic">
                    "{testimonial.content}"
                  </blockquote>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            복잡한 문서 검색은 이제 그만! AI가 당신의 업무 효율성을 높여드립니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              variant="secondary" 
              className="h-12 px-8 text-lg font-semibold" 
              onClick={handleStartNow}
              disabled={isLoading}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              {isLoading ? '로딩 중...' : '무료로 시작하기'}
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-lg font-semibold border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link href="/admin" className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                관리자 페이지
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center mb-4">
                <Bot className="h-8 w-8 text-primary mr-2" />
                <span className="text-2xl font-bold">ThinkFlow</span>
              </div>
              <p className="text-muted-foreground mb-4">
                AI 기반 지능형 문서 검색 시스템으로 업무 효율성을 극대화하세요.
              </p>
              <div className="flex space-x-4">
                <Button size="sm" variant="ghost">
                  <Globe className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">기능</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>AI 문서 검색</li>
                <li>벡터 데이터베이스</li>
                <li>사용자 관리</li>
                <li>실시간 분석</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">지원</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>도움말</li>
                <li>문의하기</li>
                <li>시스템 상태</li>
                <li>API 문서</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 mt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Jisung Solution Works. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}