import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Category utility functions
export interface Category {
  category_id: string;
  name: string;
  description: string;
  icon?: string;
  color: string;
  document_count?: number;
}

/**
 * Convert category ID to category name
 * @param categoryId - Single category ID
 * @param categories - Array of category objects
 * @returns Category name or the original ID if not found
 */
export function getCategoryName(categoryId: string, categories: Category[]): string {
  return categories.find((c) => c.category_id === categoryId)?.name || categoryId;
}

/**
 * Convert comma-separated category IDs to category names
 * @param categoryString - Comma-separated category IDs (e.g., "uuid1,uuid2,uuid3")
 * @param categories - Array of category objects
 * @returns Comma-separated category names
 */
export function convertCategoryIdsToNames(categoryString: string | null, categories: Category[]): string | null {
  if (!categoryString) return null;
  
  const categoryIds = categoryString.split(',').map(id => id.trim()).filter(id => id);
  if (categoryIds.length === 0) return null;
  
  const categoryNames = categoryIds.map(id => getCategoryName(id, categories));
  return categoryNames.join(', ');
}

/**
 * Convert array of category IDs to array of category names
 * @param categoryIds - Array of category IDs
 * @param categories - Array of category objects
 * @returns Array of category names
 */
export function convertCategoryIdsArrayToNames(categoryIds: string[], categories: Category[]): string[] {
  return categoryIds.map(id => getCategoryName(id, categories));
}
