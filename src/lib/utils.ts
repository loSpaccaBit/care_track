import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a phone number by removing common prefixes (like +39) and non-digit characters.
 * @param phoneNumber The raw phone number string.
 * @returns The normalized phone number string containing only digits, or an empty string if input is invalid.
 */
export function normalizePhoneNumber(phoneNumber: string | undefined | null): string {
    if (!phoneNumber) {
        return '';
    }
    // Remove leading '+' and potential country code (1-3 digits)
    let normalized = phoneNumber.replace(/^\+\d{1,3}/, '');
    // Remove all remaining non-digit characters
    normalized = normalized.replace(/\D/g, '');
    return normalized;
}
