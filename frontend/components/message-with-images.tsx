"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ExternalLink } from "lucide-react";
import { getImageUrl } from "@/lib/config";

interface MessageWithImagesProps {
  content: string;
  className?: string;
}

interface ImageReference {
  imagePath: string;
  description: string;
  fullText: string;
}

export const MessageWithImages: React.FC<MessageWithImagesProps> = ({
  content,
  className = "",
}) => {
  const [imageError, setImageError] = useState<Set<string>>(new Set());
  
  // 이미지 참조 패턴 매칭 ([이미지: /uploads/images/...] 텍스트)
  const extractImageReferences = (text: string): ImageReference[] => {
    const imagePattern = /\[이미지:\s*([^\]]+)\]\s*([^[\n]*)/g;
    const references: ImageReference[] = [];
    let match;
    
    while ((match = imagePattern.exec(text)) !== null) {
      references.push({
        imagePath: match[1].trim(),
        description: match[2].trim(),
        fullText: match[0]
      });
    }
    
    return references;
  };

  const imageReferences = extractImageReferences(content);
  
  // 이미지 참조가 없으면 일반 텍스트 렌더링
  if (imageReferences.length === 0) {
    return (
      <div className={`whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    );
  }

  // 이미지 참조를 실제 이미지로 교체하여 렌더링
  const renderContentWithImages = () => {
    let processedContent = content;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    imageReferences.forEach((ref, index) => {
      const refIndex = processedContent.indexOf(ref.fullText, lastIndex);
      
      if (refIndex !== -1) {
        // 이전 텍스트 추가
        if (refIndex > lastIndex) {
          elements.push(
            <span key={`text-${index}`}>
              {processedContent.substring(lastIndex, refIndex)}
            </span>
          );
        }

        // 이미지 컴포넌트 추가
        elements.push(
          <ImageDisplay
            key={`image-${index}`}
            imagePath={ref.imagePath}
            description={ref.description}
            onError={() => {
              setImageError(prev => {
                const newSet = new Set(prev);
                newSet.add(ref.imagePath);
                return newSet;
              });
            }}
            hasError={imageError.has(ref.imagePath)}
          />
        );

        lastIndex = refIndex + ref.fullText.length;
      }
    });

    // 남은 텍스트 추가
    if (lastIndex < processedContent.length) {
      elements.push(
        <span key="text-final">
          {processedContent.substring(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  return (
    <div className={`${className}`}>
      {renderContentWithImages()}
    </div>
  );
};

interface ImageDisplayProps {
  imagePath: string;
  description: string;
  onError: () => void;
  hasError: boolean;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({
  imagePath,
  description,
  onError,
  hasError
}) => {
  const imageUrl = getImageUrl(imagePath);
  
  if (hasError) {
    return (
      <div className="my-3 p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500">
          <ExternalLink className="h-4 w-4" />
          <span className="text-sm">
            이미지를 로드할 수 없습니다: {description || "이미지 설명 없음"}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          경로: {imagePath}
        </p>
      </div>
    );
  }

  return (
    <div className="my-3">
      <Dialog>
        <DialogTrigger asChild>
          <div className="group cursor-pointer">
            <div className="relative inline-block max-w-sm">
              <img
                src={imageUrl}
                alt={description || "문서 이미지"}
                className="rounded-lg border shadow-sm hover:shadow-md transition-shadow max-h-48 object-contain"
                onError={onError}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {description && (
              <p className="text-sm text-gray-600 mt-2 italic">
                {description}
              </p>
            )}
          </div>
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl">
          <div className="space-y-4">
            <img
              src={imageUrl}
              alt={description || "문서 이미지"}
              className="w-full max-h-[70vh] object-contain rounded-lg"
              onError={onError}
            />
            {description && (
              <div className="text-center">
                <p className="text-gray-700">{description}</p>
              </div>
            )}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => window.open(imageUrl, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                새 탭에서 열기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// 유틸리티 함수: 텍스트에 이미지 참조가 있는지 확인
export const hasImageReferences = (text: string): boolean => {
  const imagePattern = /\[이미지:\s*([^\]]+)\]/;
  return imagePattern.test(text);
};