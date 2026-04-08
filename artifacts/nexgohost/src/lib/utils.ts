import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtInvNum(num: string): string {
  const m = num.match(/^(?:NOE|DEP)-(\d+)$/);
  if (m) return `#${m[1]}`;
  return num;
}
