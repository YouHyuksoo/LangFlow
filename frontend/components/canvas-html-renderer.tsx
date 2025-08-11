"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Palette
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CanvasHtmlRendererProps {
  htmlContent: string;
  width?: number;
  height?: number;
  className?: string;
}

export function CanvasHtmlRenderer({ 
  htmlContent, 
  width = 600, 
  height = 400, 
  className = "" 
}: CanvasHtmlRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { toast } = useToast();

  // HTML을 Canvas에 렌더링하는 함수
  const renderHtmlToCanvas = async () => {
    if (!canvasRef.current) return;

    setIsRendering(true);
    setRenderError(null);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context를 가져올 수 없습니다.');

      // Canvas 크기 설정
      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      // 고해상도 디스플레이 지원
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr * scale;
      canvas.height = height * dpr * scale;
      ctx.scale(dpr * scale, dpr * scale);

      // 배경색 설정
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 임시 DOM 요소 생성하여 HTML 파싱
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.width = `${width}px`;
      tempDiv.style.height = `${height}px`;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.fontSize = '14px';
      tempDiv.style.lineHeight = '1.4';
      tempDiv.style.color = '#333333';
      
      document.body.appendChild(tempDiv);

      // HTML을 SVG로 변환하여 Canvas에 그리기
      await renderDomToCanvas(tempDiv, ctx, width, height);

      // 임시 요소 제거
      document.body.removeChild(tempDiv);

    } catch (error) {
      console.error('Canvas 렌더링 오류:', error);
      setRenderError(error instanceof Error ? error.message : '렌더링 중 오류가 발생했습니다.');
      toast({
        title: "렌더링 오류",
        description: "HTML을 Canvas에 렌더링하는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsRendering(false);
    }
  };

  // DOM 요소를 Canvas에 렌더링하는 함수
  const renderDomToCanvas = async (element: HTMLElement, ctx: CanvasRenderingContext2D, width: number, height: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // foreignObject를 사용하여 HTML을 SVG로 변환
        const svgData = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #333; padding: 10px;">
                ${element.innerHTML}
              </div>
            </foreignObject>
          </svg>
        `;

        const img = new Image();
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
          try {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve();
          } catch (drawError) {
            URL.revokeObjectURL(url);
            reject(drawError);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          // SVG 렌더링이 실패한 경우 기본 텍스트 렌더링 시도
          renderTextToCanvas(element, ctx, width, height);
          resolve();
        };

        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  };

  // 텍스트만 Canvas에 렌더링하는 폴백 함수
  const renderTextToCanvas = (element: HTMLElement, ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const textContent = element.textContent || '';
    const lines = textContent.split('\n');
    
    ctx.fillStyle = '#333333';
    ctx.font = '14px Arial, sans-serif';
    ctx.textBaseline = 'top';

    let y = 20;
    const lineHeight = 20;
    const maxWidth = width - 40;

    lines.forEach(line => {
      if (y > height - lineHeight) return;
      
      // 텍스트가 너무 길면 줄바꿈
      if (ctx.measureText(line).width > maxWidth) {
        const words = line.split(' ');
        let currentLine = '';
        
        words.forEach(word => {
          const testLine = currentLine + word + ' ';
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            ctx.fillText(currentLine.trim(), 20, y);
            currentLine = word + ' ';
            y += lineHeight;
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine && y <= height - lineHeight) {
          ctx.fillText(currentLine.trim(), 20, y);
          y += lineHeight;
        }
      } else {
        ctx.fillText(line, 20, y);
        y += lineHeight;
      }
    });
  };

  // 컴포넌트 마운트 시 렌더링
  useEffect(() => {
    if (htmlContent.trim()) {
      renderHtmlToCanvas();
    }
  }, [htmlContent, scale]);

  // Canvas를 이미지로 다운로드
  const downloadCanvas = () => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const link = document.createElement('a');
      link.download = `html-canvas-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast({
        title: "다운로드 완료",
        description: "Canvas 이미지가 다운로드되었습니다."
      });
    } catch (error) {
      console.error('다운로드 오류:', error);
      toast({
        title: "다운로드 오류",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // 확대/축소
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.2));
  const handleResetZoom = () => setScale(1);

  return (
    <Card className={`border ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-sm">Canvas HTML 렌더링</CardTitle>
            <Badge variant="secondary" className="text-xs">
              실험적 기능
            </Badge>
            {isRendering && (
              <Badge variant="outline" className="text-xs">
                렌더링 중...
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={scale <= 0.2}
              className="text-xs"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={scale >= 3}
              className="text-xs"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={renderHtmlToCanvas}
              disabled={isRendering}
              className="text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${isRendering ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadCanvas}
              className="text-xs"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {renderError ? (
          <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-center">
              <Palette className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600">{renderError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={renderHtmlToCanvas}
                className="mt-2 text-xs"
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto"
              style={{
                border: '1px solid #e5e7eb',
                display: 'block'
              }}
            />
          </div>
        )}
        
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>배율: {Math.round(scale * 100)}%</span>
          <span>크기: {width} × {height}px</span>
        </div>
      </CardContent>
    </Card>
  );
}