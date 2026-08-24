import { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Bot,
  FileSpreadsheet,
  Mail,
  LogOut,
  HardHat,
  Menu,
  ExternalLink,
  PlusCircle,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

interface AppLayoutProps {
  children: ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
  selectedObraId?: string | null
  onSelectObra?: (obraId: string | null) => void
  onOpenNewTransaction?: () => void
  onOpenNewObra?: () => void
}

export function AppLayout({
  children,
  activeTab,
  setActiveTab,
  selectedObraId,
  onSelectObra,
  onOpenNewTransaction,
  onOpenNewObra,
}: AppLayoutProps) {
  const { user, logout } = useAuth()

  const navItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard, badge: undefined },
    { id: 'obras', label: 'Minhas Obras', icon: Building2, badge: undefined },
    { id: 'transacoes', label: 'Transações / Lançamentos', icon: Receipt, badge: undefined },
    { id: 'telegram-config', label: 'Configurar Telegram Webhook', icon: Bot, badge: 'Novo' },
    { id: 'bot-simulador', label: 'WhatsApp & Telegram (Bot)', icon: Bot, badge: 'IA' },
    {
      id: 'google-sheets',
      label: 'Google Sheets & Planilhas',
      icon: FileSpreadsheet,
      badge: undefined,
    },
    { id: 'relatorios', label: 'Relatórios Automáticos', icon: Mail, badge: 'Email' },
  ]

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight">Gerenciador de Obras</h1>
            <p className="text-xs text-amber-400 font-medium">Automação Financeira</p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="p-4 space-y-2 border-b border-slate-800">
        <Button
          onClick={() => {
            if (onOpenNewTransaction) onOpenNewTransaction()
            else setActiveTab('transacoes')
          }}
          className="w-full justify-start bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm shadow-sm"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Novo Lançamento
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (onOpenNewObra) onOpenNewObra()
            else setActiveTab('obras')
          }}
          className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-sm"
        >
          <Building2 className="w-4 h-4 mr-2 text-amber-400" />
          Nova Obra / Projeto
        </Button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Navegação Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                if (item.id === 'obras' && onSelectObra) {
                  // Keep or reset as needed
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <Badge
                  variant="outline"
                  className={
                    item.badge === 'IA'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] px-1.5 py-0'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] px-1.5 py-0'
                  }
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          )
        })}

        <div className="pt-4 mt-4 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Fluxo do Recibo
          </div>
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Bot className="w-3.5 h-3.5" />
              <span>Como Funciona:</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              1. Envie foto de recibo com descrição pelo WhatsApp/Telegram.
              <br />
              2. O robô extrai categoria e valor.
              <br />
              3. Planilha e dashboard são atualizados!
            </p>
          </div>
        </div>
      </div>

      {/* User profile footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.name || 'Gestor de Obras'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          title="Sair do sistema"
          className="text-slate-400 hover:text-red-400 hover:bg-slate-800 shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-72 shrink-0 h-screen sticky top-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile Header Bar */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
            <HardHat className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm tracking-tight">Gerenciador de Obras</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenNewTransaction}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold px-2.5 h-8"
          >
            + Lançar
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-200 hover:bg-slate-800">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-r-slate-800 bg-slate-900">
              {sidebarContent}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
