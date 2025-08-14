"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { MarkdownPreview } from "./markdown-preview";
import { HtmlPreview } from "./html-preview";
import { SimpleTablePreview } from "./simple-table-preview";
import { CodePreview } from "./code-preview";

interface File {
  id: string;
  mime_type: string;
  content: string;
}

interface ContentPreviewProps {
  file?: File | null;
  active?: boolean;
  content?: string;
}

type PreviewType =
  | "markdown"
  | "html"
  | "table"
  | "code"
  | "unsupported"
  | null;

const ContentPreview: React.FC<ContentPreviewProps> = ({
  file,
  active,
  content,
}) => {
  const [previewType, setPreviewType] = useState<PreviewType>(null);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // content prop이 있으면 직접 렌더링
  if (content) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  useEffect(() => {
    let isCancelled = false;

    if (!active || !file) {
      setPreviewType(null);
      setPreviewContent(null);
      return;
    }

    const processFile = async () => {
      setLoading(true);
      setError(null);
      setPreviewContent(null);

      try {
        const { mime_type, content, id } = file;
        let newPreviewType: PreviewType = "unsupported";
        let newPreviewContent: any = null;

        if (mime_type === "text/markdown") {
          newPreviewType = "markdown";
          newPreviewContent = content;
        } else if (mime_type === "text/html") {
          newPreviewType = "html";
          newPreviewContent = content;
        } else if (
          mime_type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          newPreviewType = "table";
          const response = await fetch(`/api/files/${id}/table`);
          if (!response.ok) {
            throw new Error("Failed to fetch table data");
          }
          newPreviewContent = await response.json();
        } else if (
          mime_type.startsWith("text/") ||
          [
            "application/json",
            "application/javascript",
            "application/x-python-code",
          ].includes(mime_type)
        ) {
          newPreviewType = "code";
          newPreviewContent = content;
        }

        if (!isCancelled) {
          setPreviewType(newPreviewType);
          setPreviewContent(newPreviewContent);
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage =
            err instanceof Error ? err.message : "An unknown error occurred";
          setError(errorMessage);
          toast({
            title: "Error",
            description: `Could not load preview: ${errorMessage}`,
            variant: "destructive",
          });
          setPreviewType("unsupported");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    processFile();

    return () => {
      isCancelled = true;
    };
  }, [file?.id, file?.content, active, toast]);

  if (!active || !file) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a file to see a preview
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Error: {error}
      </div>
    );
  }

  switch (previewType) {
    case "markdown":
      return (
        <MarkdownPreview markdown={previewContent || ""} confidence={0.9} />
      );
    case "html":
      return <HtmlPreview content={previewContent || ""} />;
    case "table":
      return <SimpleTablePreview content={previewContent} />;
    case "code":
      return (
        <CodePreview
          code={previewContent || ""}
          language={file.mime_type}
          confidence={0.9}
        />
      );
    case "unsupported":
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Preview not supported for this file type.
        </div>
      );
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a file to see a preview
        </div>
      );
  }
};

export { ContentPreview };
