/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Gets the public base URL accessible by external services (like Telegram webhooks).
 * NEVER returns the internal cluster domain (.shrd00.internal.goskip.dev or *.internal.*).
 */
export function getPublicAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    // If the window origin is already a public domain, use it
    if (!origin.includes('.internal.')) {
      return origin.replace(/\/+$/, '')
    }
  }

  // If window.location is internal (or running server-side), attempt to convert or fallback
  const pbUrl = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/+$/, '')
  if (pbUrl && !pbUrl.includes('.internal.')) {
    return pbUrl
  }

  // Convert internal cluster format to public preview format if matching standard pattern:
  // e.g. https://gerenciador-de-dados-e1ffa.shrd00.internal.goskip.dev -> https://gerenciador-de-dados-e1ffa--preview.goskip.app
  if (pbUrl.includes('.internal.goskip.dev')) {
    const match = pbUrl.match(/https?:\/\/([a-zA-Z0-9_-]+)\.[a-zA-Z0-9_-]+\.internal\.goskip\.dev/)
    if (match && match[1]) {
      return `https://${match[1]}--preview.goskip.app`
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    const match = origin.match(/https?:\/\/([a-zA-Z0-9_-]+)\.[a-zA-Z0-9_-]+\.internal\.goskip\.dev/)
    if (match && match[1]) {
      return `https://${match[1]}--preview.goskip.app`
    }
    return origin.replace(/\/+$/, '')
  }

  return 'https://gerenciador-de-dados-e1ffa--preview.goskip.app'
}

/**
 * Gets the public webhook URL for incoming bot messages (Telegram native PocketBase records API)
 */
export function getBotIncomingWebhookUrl(): string {
  return 'https://gerenciador-de-dados-e1ffa.goskip.app/api/collections/telegram_messages/records'
}
