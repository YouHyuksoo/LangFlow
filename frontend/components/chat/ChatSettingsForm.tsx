"use client";

import { useForm, Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import { CategorySelector } from "@/components/category-selector";
import { cn } from "@/lib/utils";

interface ChatSettingsFormData {
  categories: string[];
  personaId: string | undefined;
  topK: number;
}

interface ChatSettingsFormProps {
  initialData?: Partial<ChatSettingsFormData>;
  categories: any[];
  personas: any[];
  onSubmit: (data: ChatSettingsFormData) => void;
  onChange?: (data: Partial<ChatSettingsFormData>) => void;
  autoSave?: boolean;
  compact?: boolean;
  className?: string;
}

export function ChatSettingsForm({
  initialData = {},
  categories,
  personas,
  onSubmit,
  onChange,
  autoSave = true,
  compact = false,
  className
}: ChatSettingsFormProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [hasChanges, setHasChanges] = useState(false);

  const form = useForm<ChatSettingsFormData>({
    defaultValues: {
      categories: initialData.categories || [],
      personaId: initialData.personaId || undefined,
      topK: initialData.topK || 5,
    },
    mode: "onChange"
  });

  const { control, handleSubmit, watch, formState: { isValid, errors } } = form;
  const watchedValues = watch();

  // Auto-save when values change
  useEffect(() => {
    if (autoSave && onChange) {
      onChange(watchedValues);
      setHasChanges(true);
      
      // Debounce auto-save
      const timer = setTimeout(() => {
        setHasChanges(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [watchedValues, onChange, autoSave]);


  // Compact Summary View
  if (compact && !isExpanded) {
    return (
      <div className={cn("mb-4 p-3 bg-muted/20 rounded-lg border", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">대화 설정</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(true)}
            className="h-7 w-7"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Full Form View
  return (
    <div className={cn("mb-4 p-4 bg-muted/20 rounded-lg border", className)}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Category Selection */}
        <Controller
          name="categories"
          control={control}
          rules={{ required: "최소 하나의 주제를 선택해주세요" }}
          render={({ field }) => (
            <div>
              <CategorySelector
                selectedCategories={field.value}
                onCategoryChange={field.onChange}
                categories={categories}
                showDocumentCount={true}
                compactMode={true}
              />
              {errors.categories && (
                <p className="text-xs text-destructive mt-1">{errors.categories.message}</p>
              )}
            </div>
          )}
        />

        {/* AI Settings */}
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="personaId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={(value) => field.onChange(value || undefined)}
              >
                <SelectTrigger className="w-full select-trigger">
                  <SelectValue placeholder="페르소나 선택" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((persona) => (
                    <SelectItem key={persona.persona_id} value={persona.persona_id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <Controller
            name="topK"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value.toString()}
                onValueChange={(value) => field.onChange(parseInt(value))}
              >
                <SelectTrigger className="w-full select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3개</SelectItem>
                  <SelectItem value="5">5개</SelectItem>
                  <SelectItem value="10">10개</SelectItem>
                  <SelectItem value="15">15개</SelectItem>
                  <SelectItem value="20">20개</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {compact && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              완료
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}