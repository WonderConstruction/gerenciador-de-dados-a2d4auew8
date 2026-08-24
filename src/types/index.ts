export type ObraStatus = 'planejamento' | 'em_andamento' | 'pausada' | 'concluida'

export type TransactionType = 'income' | 'expense'

export type TransactionCategory =
  | 'frame'
  | 'labor'
  | 'electrical'
  | 'plumbing'
  | 'materials'
  | 'equipment'
  | 'finishing'
  | 'permits'
  | 'other'

export type BotPlatform = 'telegram' | 'whatsapp' | 'simulated'

export interface Obra {
  id: string
  user_id: string
  name: string
  client_name?: string
  client_email?: string
  client_phone?: string
  total_budget: number
  status: ObraStatus
  address?: string
  start_date?: string
  end_date?: string
  notes?: string
  share_token?: string
  share_password?: string
  google_sheets_url?: string
  google_sheets_id?: string
  last_sheets_sync?: string
  created: string
  updated: string
}

export interface TelegramMessage {
  id: string
  update_id?: number
  chat_id?: number
  message_text?: string
  caption?: string
  file_id?: string
  file_type?: string
  raw_payload?: any
  processed?: boolean
  created: string
  updated: string
}

export interface Transaction {
  id: string
  obra_id: string
  user_id: string
  type: TransactionType
  amount: number
  category: TransactionCategory
  description: string
  date: string
  receipt_file?: string
  source?: 'manual' | 'whatsapp' | 'telegram' | 'import'
  source_message?: string
  status?: 'pending' | 'reviewed' | 'exported'
  project?: string
  raw_bot_text?: string
  ocr_extracted_data?: any
  sheets_synced?: boolean
  notes?: string
  created: string
  updated: string
  expand?: {
    obra_id?: Obra
    source_message?: TelegramMessage
  }
}

export interface BotMessage {
  id: string
  platform: BotPlatform
  sender_id?: string
  sender_name?: string
  obra_id?: string
  media_file?: string
  caption?: string
  suggested_category?: string
  suggested_amount?: number
  suggested_type?: string
  status: 'processed' | 'pending_review' | 'error'
  parsed_transaction_id?: string
  payload_raw?: any
  created: string
  updated: string
}

export interface ReportConfig {
  id: string
  user_id: string
  recipient_email: string
  weekly_enabled: boolean
  weekly_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  weekly_hour: number
  monthly_enabled: boolean
  monthly_day: number
  monthly_hour: number
  include_all_obras: boolean
  telegram_notifications_enabled?: boolean
  telegram_chat_id?: string
  last_weekly_sent?: string
  last_monthly_sent?: string
  created: string
  updated: string
}

export const CATEGORY_LABELS: Record<
  TransactionCategory,
  { label: string; color: string; bg: string; icon: string }
> = {
  frame: {
    label: 'Estrutura / Frame',
    color: '#854d0e',
    bg: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: 'Hammer',
  },
  labor: {
    label: 'Mão de Obra',
    color: '#1e40af',
    bg: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: 'Users',
  },
  electrical: {
    label: 'Elétrica',
    color: '#b45309',
    bg: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: 'Zap',
  },
  plumbing: {
    label: 'Hidráulica',
    color: '#0369a1',
    bg: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: 'Droplet',
  },
  materials: {
    label: 'Materiais Básicos',
    color: '#4d7c0f',
    bg: 'bg-lime-100 text-lime-800 border-lime-300',
    icon: 'Boxes',
  },
  equipment: {
    label: 'Equipamentos / Locação',
    color: '#6d28d9',
    bg: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: 'Wrench',
  },
  finishing: {
    label: 'Acabamentos / Pintura',
    color: '#be185d',
    bg: 'bg-pink-100 text-pink-800 border-pink-300',
    icon: 'Paintbrush',
  },
  permits: {
    label: 'Alvarás / Taxas / ART',
    color: '#334155',
    bg: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: 'FileText',
  },
  other: {
    label: 'Outros / Gerais',
    color: '#475569',
    bg: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: 'MoreHorizontal',
  },
}

export const STATUS_LABELS: Record<
  ObraStatus,
  { label: string; bg: string; text: string; badge: string }
> = {
  planejamento: {
    label: 'Em Planejamento',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  em_andamento: {
    label: 'Em Andamento',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  pausada: {
    label: 'Pausada',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  concluida: {
    label: 'Concluída',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
}
