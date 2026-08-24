import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Obra, Transaction } from '@/types'
import { obrasService } from '@/services/obras'
import { transactionsService } from '@/services/transactions'
import { AppLayout } from '@/components/AppLayout'
import { AuthModal } from '@/components/AuthModal'
import { GeneralDashboard } from '@/components/GeneralDashboard'
import { ObraDashboard } from '@/components/ObraDashboard'
import { TransactionsListPage } from '@/components/TransactionsListPage'
import { BotSimulatorPage } from '@/components/BotSimulatorPage'
import { TelegramWebhookConfig } from '@/components/TelegramWebhookConfig'
import { GoogleSheetsPage } from '@/components/GoogleSheetsPage'
import { ReportsPage } from '@/components/ReportsPage'
import { ObraModal } from '@/components/ObraModal'
import { TransactionModal } from '@/components/TransactionModal'
import { PublicObraView } from '@/components/PublicObraView'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Index() {
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null)

  // Data State
  const [obras, setObras] = useState<Obra[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Modal States
  const [isObraModalOpen, setIsObraModalOpen] = useState(false)
  const [obraToEdit, setObraToEdit] = useState<Obra | null>(null)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [defaultTxObraId, setDefaultTxObraId] = useState<string | undefined>(undefined)

  // Check URL query for public share token
  const urlParams = new URLSearchParams(window.location.search)
  const shareToken = urlParams.get('share')

  // Load user data
  useEffect(() => {
    if (user && !shareToken) {
      loadAllData()
    }
  }, [user, shareToken])

  const loadAllData = async () => {
    setLoadingData(true)
    try {
      const [allObras, allTxs] = await Promise.all([
        obrasService.getAll(),
        transactionsService.getAll(),
      ])
      setObras(allObras)
      setTransactions(allTxs)
    } catch (err: any) {
      console.error('Error loading data:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: err.message || 'Falha na sincronização com o banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setLoadingData(false)
    }
  }

  // Handle Public Client Share link
  if (shareToken) {
    return <PublicObraView shareToken={shareToken} />
  }

  // Handle Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-300">Carregando Gerenciador de Obras...</p>
      </div>
    )
  }

  // If user is not logged in, show Auth Screen
  if (!user) {
    return <AuthModal />
  }

  // Selected Obra for detail view
  const currentSelectedObra = selectedObraId ? obras.find((o) => o.id === selectedObraId) : null
  const currentObraTransactions = selectedObraId
    ? transactions.filter((t) => t.obra_id === selectedObraId)
    : []

  // Navigation handlers
  const handleSelectObra = (obraId: string | null) => {
    setSelectedObraId(obraId)
    if (obraId) {
      setActiveTab('obra-detail')
    }
  }

  const handleOpenNewObra = () => {
    setObraToEdit(null)
    setIsObraModalOpen(true)
  }

  const handleEditObra = (obra: Obra) => {
    setObraToEdit(obra)
    setIsObraModalOpen(true)
  }

  const handleOpenNewTransaction = (obraId?: string) => {
    setDefaultTxObraId(obraId || selectedObraId || obras[0]?.id)
    setIsTxModalOpen(true)
  }

  return (
    <AppLayout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        if (tab !== 'obra-detail') {
          setSelectedObraId(null)
        }
        setActiveTab(tab)
      }}
      selectedObraId={selectedObraId}
      onSelectObra={handleSelectObra}
      onOpenNewTransaction={() => handleOpenNewTransaction()}
      onOpenNewObra={handleOpenNewObra}
    >
      {loadingData && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900/90 text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg border border-amber-500/30">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Sincronizando dados...</span>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'dashboard' && (
        <GeneralDashboard
          obras={obras}
          transactions={transactions}
          onSelectObra={handleSelectObra}
          onOpenNewObra={handleOpenNewObra}
          onOpenNewTransaction={handleOpenNewTransaction}
        />
      )}

      {activeTab === 'obras' && (
        <GeneralDashboard
          obras={obras}
          transactions={transactions}
          onSelectObra={handleSelectObra}
          onOpenNewObra={handleOpenNewObra}
          onOpenNewTransaction={handleOpenNewTransaction}
        />
      )}

      {activeTab === 'obra-detail' && currentSelectedObra && (
        <ObraDashboard
          obra={currentSelectedObra}
          transactions={currentObraTransactions}
          onBack={() => {
            setSelectedObraId(null)
            setActiveTab('dashboard')
          }}
          onOpenNewTransaction={handleOpenNewTransaction}
          onEditObra={handleEditObra}
          onTransactionDeleted={loadAllData}
        />
      )}

      {activeTab === 'transacoes' && (
        <TransactionsListPage
          obras={obras}
          transactions={transactions}
          onOpenNewTransaction={handleOpenNewTransaction}
          onRefresh={loadAllData}
        />
      )}

      {activeTab === 'telegram-config' && (
        <TelegramWebhookConfig obras={obras} onWebhookConfigured={loadAllData} />
      )}

      {activeTab === 'bot-simulador' && (
        <BotSimulatorPage
          obras={obras}
          onTransactionCreated={loadAllData}
          onNavigateToTelegramConfig={() => setActiveTab('telegram-config')}
        />
      )}

      {activeTab === 'google-sheets' && (
        <GoogleSheetsPage obras={obras} transactions={transactions} onRefresh={loadAllData} />
      )}

      {activeTab === 'relatorios' && <ReportsPage obras={obras} />}

      {/* Modals */}
      <ObraModal
        open={isObraModalOpen}
        onOpenChange={setIsObraModalOpen}
        obraToEdit={obraToEdit}
        onSaved={loadAllData}
      />

      <TransactionModal
        open={isTxModalOpen}
        onOpenChange={setIsTxModalOpen}
        obras={obras}
        defaultObraId={defaultTxObraId}
        onSaved={loadAllData}
      />
    </AppLayout>
  )
}
