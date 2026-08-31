import { useState, useMemo } from 'react'
import { Obra, Transaction, CATEGORY_LABELS, STATUS_LABELS, TransactionCategory } from '@/types'
import { transactionsService } from '@/services/transactions'
import { sheetsService } from '@/services/botAndReports'
import { googleSheetsService } from '@/services/googleSheets'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  ArrowLeft,
  Share2,
  FileSpreadsheet,
  Download,
  Filter,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Calendar,
  Smartphone,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ObraDashboardProps {
  obra: Obra
  transactions: Transaction[]
  onBack: () => void
  onOpenNewTransaction: (obraId: string) => void
  onEditObra: (obra: Obra) => void
  onTransactionDeleted: () => void
  isPublicView?: boolean
}

export function ObraDashboard({
  obra,
  transactions,
  onBack,
  onOpenNewTransaction,
  onEditObra,
  onTransactionDeleted,
  isPublicView = false,
}: ObraDashboardProps) {
  const { toast } = useToast()

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  const [syncingTxId, setSyncingTxId] = useState<string | null>(null)

  // Financial metrics for this single obra
  const obraStats = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    const categoryTotals: Record<string, number> = {}

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0
      if (tx.type === 'income') {
        totalIncome += amt
      } else {
        totalExpenses += amt
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amt
      }
    })

    const budget = Number(obra.total_budget) || 0
    const budgetPercent = budget > 0 ? (totalExpenses / budget) * 100 : 0
    const netBalance = totalIncome - totalExpenses
    const remainingBudget = budget - totalExpenses

    // Sort categories by expenditure amount
    const sortedCategories = Object.entries(categoryTotals)
      .map(([cat, sum]) => ({
        category: cat as TransactionCategory,
        sum,
        percent: totalExpenses > 0 ? (sum / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.sum - a.sum)

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      remainingBudget,
      budgetPercent,
      budget,
      sortedCategories,
    }
  }, [obra, transactions])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          t.description.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          t.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [transactions, categoryFilter, typeFilter, searchQuery])

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Deseja realmente excluir este lançamento financeiro?')) {
      try {
        await transactionsService.delete(id)
        toast({ title: 'Lançamento excluído com sucesso.' })
        onTransactionDeleted()
      } catch (err: any) {
        toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}/?share=${obra.share_token || obra.id}`
    navigator.clipboard.writeText(url)
    toast({
      title: 'Link copiado!',
      description:
        'O link público do dashboard da obra foi copiado para sua área de transferência.',
    })
  }

  const handleExportCsv = () => {
    sheetsService.exportToCsv(obra.name, transactions)
    toast({
      title: 'Planilha exportada!',
      description: 'Download do arquivo CSV iniciado.',
    })
  }

  const handleSyncToSheets = async (tx: Transaction) => {
    setSyncingTxId(tx.id)
    try {
      const res = await googleSheetsService.syncTransactionToSheet(tx, obra)
      if (res.success) {
        toast({
          title: '✅ Enviado para a Planilha!',
          description: res.message,
        })
      } else {
        toast({
          title: '❌ Falha ao enviar para Google Sheets',
          description: res.error || res.message,
          variant: 'destructive',
        })
      }
      onTransactionDeleted() // Triggers reload
    } catch (err: any) {
      toast({
        title: '❌ Falha ao enviar para Google Sheets',
        description: err.message || 'Erro inesperado na sincronização.',
        variant: 'destructive',
      })
    } finally {
      setSyncingTxId(null)
    }
  }

  const statusStyle = STATUS_LABELS[obra.status] || STATUS_LABELS.planejamento

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          {!isPublicView && (
            <button
              onClick={onBack}
              className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar para todas as obras
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {obra.name}
            </h1>
            <Badge variant="outline" className={`text-xs ${statusStyle.badge}`}>
              {statusStyle.label}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
            {obra.client_name && (
              <span>
                Cliente: <strong className="text-slate-700">{obra.client_name}</strong>
              </span>
            )}
            {obra.client_phone && <span>Tel: {obra.client_phone}</span>}
            {obra.address && <span>Endereço: {obra.address}</span>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isPublicView && (
            <>
              <Button
                onClick={() => onOpenNewTransaction(obra.id)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Novo Lançamento
              </Button>
              <Button
                variant="outline"
                onClick={() => onEditObra(obra)}
                className="border-slate-300 text-slate-700 bg-white"
              >
                Editar Obra
              </Button>
            </>
          )}

          <Button
            variant="outline"
            onClick={handleCopyShareLink}
            className="border-slate-300 text-slate-700 bg-white"
            title="Copiar link para o cliente"
          >
            <Share2 className="w-4 h-4 mr-1.5 text-blue-600" />
            Link do Cliente
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Baixar Planilha
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Budget */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              Orçamento Contratado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              R$ {obraStats.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Consumido</span>
                <span className="font-semibold">{obraStats.budgetPercent.toFixed(1)}%</span>
              </div>
              <Progress
                value={Math.min(obraStats.budgetPercent, 100)}
                className={`h-2 ${obraStats.budgetPercent > 100 ? 'bg-red-100 [&>div]:bg-red-600' : 'bg-slate-100'}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Total de Saídas (Custos)</span>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {obraStats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {obraStats.remainingBudget >= 0 ? (
                <span className="text-emerald-600 font-medium">
                  R${' '}
                  {obraStats.remainingBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                  restante no teto
                </span>
              ) : (
                <span className="text-red-600 font-bold">
                  Excedeu orçamento em R${' '}
                  {Math.abs(obraStats.remainingBudget).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Total de Entradas (Aportes)</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              R$ {obraStats.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Medições pagas pelo cliente</p>
          </CardContent>
        </Card>

        {/* Net Cash Balance */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
              <span>Saldo em Caixa da Obra</span>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                obraStats.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
            >
              R$ {obraStats.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {obraStats.netBalance >= 0 ? 'Saldo positivo disponível' : 'Necessita novo aporte'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Categories Breakdown (Requested by user: Frame, labor, electrical, plumbing...) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200 lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Despesas por Categoria
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribuição dos gastos conforme leitura automática do bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {obraStats.sortedCategories.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhum gasto registrado ainda.
              </p>
            ) : (
              obraStats.sortedCategories.map(({ category, sum, percent }) => {
                const catCfg = CATEGORY_LABELS[category] || CATEGORY_LABELS.other
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: catCfg.color }}
                        />
                        <span className="font-semibold text-slate-700">{catCfg.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          R$ {sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({percent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: catCfg.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Google Sheets Status Banner & Instructions */}
        <Card className="bg-white border-slate-200 lg:col-span-2 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Planilha Google Sheets Desta Obra
                </CardTitle>
              </div>
              {obra.google_sheets_url && (
                <a
                  href={obra.google_sheets_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  Abrir no Google Sheets
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <CardDescription className="text-xs text-slate-500">
              Cada obra possui sua própria planilha de acompanhamento para alimentar seus clientes.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs text-emerald-900">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sincronização em Tempo Real Habilitada
                </span>
                <span className="text-[11px] text-emerald-700 font-normal">
                  {transactions.length} registros no feed
                </span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Quando um recibo é enviado pelo bot ou lançado manualmente, as abas{' '}
                <strong>Entradas</strong> e <strong>Saídas</strong> da obra são atualizadas com
                data, categoria, descrição e valor.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 border rounded-lg bg-slate-50">
                <span className="font-semibold text-slate-700 block mb-1">
                  🔗 Link da Planilha:
                </span>
                <p className="text-slate-500 truncate font-mono text-[11px]">
                  {obra.google_sheets_url || 'Nenhum link direto configurado (usando fallback CSV)'}
                </p>
              </div>
              <div className="p-3 border rounded-lg bg-slate-50">
                <span className="font-semibold text-slate-700 block mb-1">
                  📱 Envio via WhatsApp/Telegram:
                </span>
                <p className="text-slate-500 text-[11px]">
                  Envie foto com legenda vinculada a esta obra para processamento instantâneo.
                </p>
              </div>
            </div>
          </CardContent>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Formato da Planilha: [Data | Tipo | Categoria | Descrição | Valor]
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="bg-white border-slate-300 text-xs text-slate-700"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Exportar CSV Atualizado
            </Button>
          </div>
        </Card>
      </div>

      {/* Transactions Table & Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Extrato Financeiro da Obra
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Todos os lançamentos de entradas e saídas categorizados.
              </CardDescription>
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="expense">Apenas Saídas</SelectItem>
                    <SelectItem value="income">Apenas Entradas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-44">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder="Filtrar descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs w-36 sm:w-48 bg-slate-50"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Origem</th>
                  <th className="py-3 px-4 text-center">Planilha</th>
                  <th className="py-3 px-4 text-center">Comprovante</th>
                  {!isPublicView && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Nenhum lançamento corresponde aos filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const catCfg = CATEGORY_LABELS[tx.category] || CATEGORY_LABELS.other
                    const fileUrl = tx.receipt_file ? transactionsService.getFileUrl(tx) : null
                    const isSyncing = syncingTxId === tx.id

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                          {new Date(tx.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === 'income' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                              Saída
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${catCfg.bg}`}
                          >
                            {catCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-medium max-w-xs truncate">
                          {tx.description}
                          {tx.notes && (
                            <span className="block text-[11px] text-slate-400 font-normal truncate">
                              Obs: {tx.notes}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 whitespace-nowrap text-right font-bold text-sm ${
                            tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'} R${' '}
                          {Number(tx.amount || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase text-slate-500 bg-slate-100"
                          >
                            {tx.source || 'manual'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncToSheets(tx)}
                            disabled={isSyncing}
                            className="h-6 px-2 text-[10px] font-medium border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                            title="Enviar / Re-sincronizar esta linha na planilha do Google Sheets"
                          >
                            {isSyncing ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1 text-emerald-600" />
                            ) : (
                              <FileSpreadsheet className="w-3 h-3 mr-1 text-emerald-600" />
                            )}
                            Reenviar
                          </Button>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          {fileUrl ? (
                            <button
                              onClick={() => setSelectedReceipt(fileUrl)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {!isPublicView && (
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="h-7 w-7 text-slate-400 hover:text-red-600"
                              title="Excluir lançamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Image Preview Modal */}
      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="max-w-xl bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Comprovante / Recibo da Transação
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center p-2 bg-slate-900 rounded-lg max-h-[70vh] overflow-hidden">
              <img
                src={selectedReceipt}
                alt="Recibo da Obra"
                className="max-h-[65vh] object-contain rounded"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <a
                href={selectedReceipt}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Abrir em tamanho original
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Button size="sm" variant="outline" onClick={() => setSelectedReceipt(null)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
