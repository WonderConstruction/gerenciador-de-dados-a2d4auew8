import { useState, useMemo } from 'react'
import { Obra, Transaction, STATUS_LABELS, CATEGORY_LABELS, TransactionCategory } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Search,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
  Send,
  Sparkles,
  Loader2,
  Calendar,
  Check,
  Edit2,
  Trash2,
} from 'lucide-react'
import { transactionsService } from '@/services/transactions'
import { googleSheetsService } from '@/services/googleSheets'
import { useToast } from '@/hooks/use-toast'

interface GeneralDashboardProps {
  obras: Obra[]
  transactions: Transaction[]
  onSelectObra: (obraId: string) => void
  onOpenNewObra: () => void
  onOpenNewTransaction: (obraId?: string) => void
  onRefreshData?: () => void
}

export function GeneralDashboard({
  obras,
  transactions,
  onSelectObra,
  onOpenNewObra,
  onOpenNewTransaction,
  onRefreshData,
}: GeneralDashboardProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [reviewingTxId, setReviewingTxId] = useState<string | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [editingTx, setEditingTx] = useState<{
    id: string
    amount: string
    category: TransactionCategory
    obra_id: string
    description: string
  } | null>(null)

  // Pending receipts (source telegram or pending status)
  const pendingTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.status === 'pending' || (t.source === 'telegram' && !t.status),
    )
  }, [transactions])

  // Overall calculations
  const stats = useMemo(() => {
    let totalBudget = 0
    let totalIncome = 0
    let totalExpenses = 0

    obras.forEach((o) => {
      totalBudget += Number(o.total_budget) || 0
    })

    transactions.forEach((tx) => {
      // only count reviewed or non-pending transactions in totals if amount > 0
      const amt = Number(tx.amount) || 0
      if (tx.type === 'income') totalIncome += amt
      else totalExpenses += amt
    })

    const netBalance = totalIncome - totalExpenses
    const globalPercent = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0

    return {
      totalBudget,
      totalIncome,
      totalExpenses,
      netBalance,
      globalPercent,
      activeObrasCount: obras.filter((o) => o.status === 'em_andamento').length,
    }
  }, [obras, transactions])

  // Obra-level summaries
  const obrasData = useMemo(() => {
    return obras.map((obra) => {
      const obraTxs = transactions.filter((t) => t.obra_id === obra.id)
      let income = 0
      let expenses = 0

      obraTxs.forEach((t) => {
        const amt = Number(t.amount) || 0
        if (t.type === 'income') income += amt
        else expenses += amt
      })

      const budget = Number(obra.total_budget) || 0
      const percentUsed = budget > 0 ? (expenses / budget) * 100 : 0
      const isOverBudget = expenses > budget && budget > 0
      const balance = income - expenses

      return {
        ...obra,
        income,
        expenses,
        balance,
        percentUsed,
        isOverBudget,
        transactionsCount: obraTxs.length,
      }
    })
  }, [obras, transactions])

  const filteredObras = useMemo(() => {
    if (!searchTerm.trim()) return obrasData
    const lower = searchTerm.toLowerCase()
    return obrasData.filter(
      (o) =>
        o.name.toLowerCase().includes(lower) ||
        (o.client_name && o.client_name.toLowerCase().includes(lower)) ||
        (o.address && o.address.toLowerCase().includes(lower)),
    )
  }, [obrasData, searchTerm])

  const getObraName = (obraId?: string) => {
    if (!obraId) return 'Sem obra vinculada'
    const found = obras.find((o) => o.id === obraId)
    return found ? found.name : 'Obra Geral'
  }

  // Handle Review & Confirmation of Pending Transaction
  const handleConfirmTransaction = async (tx: Transaction) => {
    setReviewingTxId(tx.id)
    try {
      const targetObra = obras.find((o) => o.id === tx.obra_id) || obras[0]

      // Update status to 'reviewed'
      try {
        await transactionsService.update(tx.id, {
          status: 'reviewed',
        })
      } catch (err: any) {
        console.warn('Could not update status locally:', err?.message)
      }

      // Send/Sync to Google Sheets service
      const syncResult = await googleSheetsService.syncTransactionToSheet(
        { ...tx, status: 'reviewed' },
        targetObra,
      )

      if (syncResult.success) {
        toast({
          title: '✅ Recibo Confirmado & Sincronizado!',
          description:
            syncResult.message ||
            `Lançamento de R$ ${Number(tx.amount || 0).toFixed(2)} aprovado e gravado no Google Sheets!`,
        })
      } else {
        toast({
          title: '❌ Falha ao enviar para Google Sheets',
          description:
            syncResult.error ||
            syncResult.message ||
            'Verifique o compartilhamento da planilha com a Conta de Serviço.',
          variant: 'destructive',
        })
      }

      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      toast({
        title: '❌ Falha ao confirmar lançamento',
        description: err.message || 'Não foi possível comunicar com os serviços.',
        variant: 'destructive',
      })
    } finally {
      setReviewingTxId(null)
    }
  }

  // Handle Quick Edit Save for a Pending Transaction
  const handleSaveEdit = async () => {
    if (!editingTx) return
    setReviewingTxId(editingTx.id)
    try {
      const parsedAmt = parseFloat(editingTx.amount) || 0
      await transactionsService.update(editingTx.id, {
        amount: parsedAmt,
        category: editingTx.category,
        obra_id: editingTx.obra_id,
        description: editingTx.description,
        status: 'reviewed',
      })

      const targetObra = obras.find((o) => o.id === editingTx.obra_id)
      const syncResult = await googleSheetsService.syncTransactionToSheet(
        {
          id: editingTx.id,
          amount: parsedAmt,
          category: editingTx.category,
          obra_id: editingTx.obra_id,
          description: editingTx.description,
          date: new Date().toISOString(),
          type: 'expense',
          user_id: '',
          created: '',
          updated: '',
          status: 'reviewed',
        },
        targetObra,
      )

      if (syncResult.success) {
        toast({
          title: 'Recibo Editado e Sincronizado!',
          description: 'Lançamento atualizado com sucesso e gravado na planilha do Google Sheets.',
        })
      } else {
        toast({
          title: 'Recibo Editado (Aviso Google Sheets)',
          description: `Atualizado no banco. Google Sheets: ${syncResult.message}`,
          variant: 'destructive',
        })
      }
      setEditingTx(null)
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar edição',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setReviewingTxId(null)
    }
  }

  // Batch Confirm All Pending Receipts
  const handleConfirmAllPending = async () => {
    if (pendingTransactions.length === 0) return
    setIsSyncingAll(true)
    try {
      let count = 0
      let syncedCount = 0
      let lastError = ''

      for (const tx of pendingTransactions) {
        const targetObra = obras.find((o) => o.id === tx.obra_id) || obras[0]
        await transactionsService.update(tx.id, { status: 'reviewed' })
        const res = await googleSheetsService.syncTransactionToSheet(
          { ...tx, status: 'reviewed' },
          targetObra,
        )
        count++
        if (res.success) {
          syncedCount++
        } else {
          lastError = res.message
        }
      }

      if (syncedCount === count) {
        toast({
          title: 'Todos os Recibos Confirmados & Gravados!',
          description: `${count} lançamento(s) foram aprovados e gravados nas planilhas do Google Sheets.`,
        })
      } else {
        toast({
          title: `${count} Recibos Confirmados (${syncedCount} gravados no Sheets)`,
          description: lastError
            ? `Aviso no Google Sheets: ${lastError}`
            : 'Algumas planilhas necessitam de permissão de editor.',
          variant: syncedCount > 0 ? 'default' : 'destructive',
        })
      }
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      toast({
        title: 'Erro no processamento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleDeletePending = async (txId: string) => {
    try {
      await transactionsService.delete(txId)
      toast({
        title: 'Recibo descartado',
        description: 'A mensagem foi removida da lista de pendentes.',
      })
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Painel Geral de Obras
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão consolidada do fluxo de caixa, orçamento e automação de recibos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => onOpenNewTransaction()}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Lançamento
          </Button>
          <Button
            onClick={onOpenNewObra}
            variant="outline"
            className="border-slate-300 text-slate-700 bg-white"
          >
            <Building2 className="w-4 h-4 mr-1.5 text-amber-600" />
            Nova Obra
          </Button>
        </div>
      </div>

      {/* Telegram Automation Alert & Pending Review Banner */}
      {pendingTransactions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/40 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500 text-slate-950 shadow-sm shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Você tem {pendingTransactions.length} novo
                    {pendingTransactions.length > 1 ? 's' : ''} recibo
                    {pendingTransactions.length > 1 ? 's' : ''} do Telegram para revisar
                  </h3>
                  <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-500 text-xs">
                    Pendente de Aprovação
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  As mensagens recebidas pelo bot foram processadas e categorizadas. Ao clicar em{' '}
                  <strong>"Confirmar"</strong>, o status muda para <strong>reviewed</strong> e os
                  dados são sincronizados diretamente na planilha da obra no Google Sheets.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleConfirmAllPending}
              disabled={isSyncingAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0 shadow-sm"
            >
              {isSyncingAll ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Confirmar Todos ({pendingTransactions.length})
            </Button>
          </div>

          {/* Pending Receipts Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingTransactions.map((tx) => {
              const catCfg = CATEGORY_LABELS[tx.category] || CATEGORY_LABELS.materials
              const isEditingThis = editingTx?.id === tx.id
              const isConfirmingThis = reviewingTxId === tx.id

              if (isEditingThis && editingTx) {
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-lg bg-white border-2 border-amber-400 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        Editar Lançamento
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingTx(null)}
                        className="h-6 px-2 text-xs text-slate-400 hover:text-slate-700"
                      >
                        Cancelar
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          Valor (R$)
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingTx.amount}
                          onChange={(e) => setEditingTx({ ...editingTx, amount: e.target.value })}
                          className="h-8 text-xs font-bold"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Obra</span>
                        <Select
                          value={editingTx.obra_id}
                          onValueChange={(val) => setEditingTx({ ...editingTx, obra_id: val })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-slate-50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {obras.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Categoria
                      </span>
                      <Select
                        value={editingTx.category}
                        onValueChange={(val: TransactionCategory) =>
                          setEditingTx({ ...editingTx, category: val })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-slate-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Descrição
                      </span>
                      <Input
                        value={editingTx.description}
                        onChange={(e) =>
                          setEditingTx({ ...editingTx, description: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={isConfirmingThis}
                        className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                      >
                        {isConfirmingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 mr-1" />
                        )}
                        Salvar e Confirmar
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-lg bg-white border border-amber-200/80 shadow-sm flex flex-col justify-between hover:border-amber-400 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${catCfg.bg}`}
                        >
                          {catCfg.label}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-50 text-slate-700 border-slate-200"
                        >
                          <Building2 className="w-3 h-3 mr-1 text-amber-600" />
                          {getObraName(tx.obra_id)}
                        </Badge>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm sm:text-base font-extrabold text-slate-900 block">
                          R${' '}
                          {Number(tx.amount || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(tx.created || tx.date).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 font-medium line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">
                      "{tx.description || tx.raw_bot_text || 'Sem texto'}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditingTx({
                            id: tx.id,
                            amount: String(tx.amount || ''),
                            category: tx.category,
                            obra_id: tx.obra_id,
                            description: tx.description,
                          })
                        }
                        className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Ajustar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePending(tx.id)}
                        className="h-7 px-2 text-xs text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleConfirmTransaction(tx)}
                      disabled={isConfirmingThis}
                      className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                    >
                      {isConfirmingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <Check className="w-3.5 h-3.5 mr-1" />
                      )}
                      Confirmar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Orçamento Previsto
            </CardTitle>
            <div className="p-2 rounded-md bg-slate-100 text-slate-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              R$ {stats.totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Soma de {obras.length} projetos ({stats.activeObrasCount} em andamento)
            </p>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Total Saídas / Custos
            </CardTitle>
            <div className="p-2 rounded-md bg-red-50 text-red-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Executado</span>
                <span>{stats.globalPercent.toFixed(1)}% do orçamento</span>
              </div>
              <Progress value={Math.min(stats.globalPercent, 100)} className="h-1.5 bg-slate-100" />
            </div>
          </CardContent>
        </Card>

        {/* Total Incomes */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Total Entradas / Aportes
            </CardTitle>
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              R$ {stats.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Recebido dos clientes e medições</p>
          </CardContent>
        </Card>

        {/* Net Cash Balance */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Saldo Líquido em Caixa
            </CardTitle>
            <div
              className={`p-2 rounded-md ${
                stats.netBalance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
              }`}
            >
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
            >
              R$ {stats.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.netBalance >= 0 ? 'Superávit acumulado' : 'Atenção: Déficit no período'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Obras Grid Header & Search */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-900">Projetos & Obras Individuais</h2>
          <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-semibold">
            {filteredObras.length}
          </Badge>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por obra ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Obras Cards Grid */}
      {filteredObras.length === 0 ? (
        <Card className="bg-white border-slate-200 text-center py-12">
          <CardContent className="space-y-4">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-700">Nenhuma obra encontrada</h3>
              <p className="text-xs text-slate-500 mt-1">
                Cadastre sua primeira obra para começar a lançar gastos e entradas.
              </p>
            </div>
            <Button onClick={onOpenNewObra} className="bg-amber-500 text-slate-950 font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Criar Nova Obra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredObras.map((obra) => {
            const statusStyle = STATUS_LABELS[obra.status] || STATUS_LABELS.planejamento

            return (
              <Card
                key={obra.id}
                className={`bg-white border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                  obra.isOverBudget
                    ? 'border-red-300 ring-1 ring-red-400/30'
                    : 'border-slate-200 hover:border-amber-400/60'
                }`}
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle
                          className="text-base font-bold text-slate-900 hover:text-amber-600 transition cursor-pointer"
                          onClick={() => onSelectObra(obra.id)}
                        >
                          {obra.name}
                        </CardTitle>
                        {obra.client_name && (
                          <CardDescription className="text-xs text-slate-500 font-medium">
                            Cliente:{' '}
                            <span className="text-slate-700 font-semibold">{obra.client_name}</span>
                          </CardDescription>
                        )}
                      </div>

                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[11px] ${statusStyle.badge}`}
                      >
                        {statusStyle.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* Progress against Budget */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Orçamento:</span>
                        <span className="font-bold text-slate-800">
                          R${' '}
                          {obra.total_budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Gasto Atual:</span>
                        <span
                          className={`font-bold ${obra.isOverBudget ? 'text-red-600' : 'text-slate-800'}`}
                        >
                          R$ {obra.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="pt-1 space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Progresso</span>
                          <span
                            className={`font-semibold ${
                              obra.isOverBudget ? 'text-red-600' : 'text-slate-600'
                            }`}
                          >
                            {obra.percentUsed.toFixed(1)}%
                          </span>
                        </div>
                        <Progress
                          value={Math.min(obra.percentUsed, 100)}
                          className={`h-2 ${obra.isOverBudget ? 'bg-red-100 [&>div]:bg-red-600' : 'bg-slate-200'}`}
                        />
                      </div>

                      {obra.isOverBudget && (
                        <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-semibold pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Orçamento estourado em R${' '}
                            {(obra.expenses - obra.total_budget).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Financial pills */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-emerald-50/70 border border-emerald-100">
                        <span className="text-emerald-700 text-[11px] block font-medium">
                          Entradas
                        </span>
                        <span className="font-bold text-emerald-800">
                          R$ {obra.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-100 border border-slate-200">
                        <span className="text-slate-600 text-[11px] block font-medium">
                          Saldo Obra
                        </span>
                        <span
                          className={`font-bold ${
                            obra.balance >= 0 ? 'text-blue-700' : 'text-red-600'
                          }`}
                        >
                          R$ {obra.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5" />
                        <span>{obra.transactionsCount} lançamentos</span>
                      </div>
                      {obra.google_sheets_url && (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Google Sheets</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>

                <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenNewTransaction(obra.id)}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    + Lançar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSelectObra(obra.id)}
                    className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold text-xs"
                  >
                    Abrir Dashboard
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
