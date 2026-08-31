import { useState, useMemo } from 'react'
import { Obra, Transaction, CATEGORY_LABELS, TransactionCategory } from '@/types'
import { transactionsService } from '@/services/transactions'
import { googleSheetsService } from '@/services/googleSheets'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Receipt,
  Plus,
  Trash2,
  Eye,
  ExternalLink,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Building2,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'

interface TransactionsListPageProps {
  obras: Obra[]
  transactions: Transaction[]
  onOpenNewTransaction: (obraId?: string) => void
  onRefresh: () => void
}

export function TransactionsListPage({
  obras,
  transactions,
  onOpenNewTransaction,
  onRefresh,
}: TransactionsListPageProps) {
  const { toast } = useToast()

  const [obraFilter, setObraFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  const [syncingTxId, setSyncingTxId] = useState<string | null>(null)

  const handleSyncToSheets = async (tx: Transaction) => {
    setSyncingTxId(tx.id)
    try {
      const targetObra = obras.find((o) => o.id === tx.obra_id) || obras[0]
      const res = await googleSheetsService.syncTransactionToSheet(tx, targetObra)
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
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro de comunicação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSyncingTxId(null)
    }
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (obraFilter !== 'all' && t.obra_id !== obraFilter) return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
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
  }, [transactions, obraFilter, typeFilter, categoryFilter, searchQuery])

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente remover esta transação?')) {
      try {
        await transactionsService.delete(id)
        toast({ title: 'Transação excluída com sucesso.' })
        onRefresh()
      } catch (err: any) {
        toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
      }
    }
  }

  const getObraName = (obraId: string) => {
    const found = obras.find((o) => o.id === obraId)
    return found ? found.name : 'Obra'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Lançamentos Financeiros Globais
              </h1>
              <p className="text-sm text-slate-500">
                Histórico consolidado de todas as entradas e saídas de todas as obras.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => onOpenNewTransaction()}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Lançamento
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Obra Filter */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Obra</span>
              <Select value={obraFilter} onValueChange={setObraFilter}>
                <SelectTrigger className="h-9 text-xs bg-slate-50">
                  <SelectValue placeholder="Todas as obras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Obras ({obras.length})</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Tipo</span>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-xs bg-slate-50">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="expense">Apenas Saídas</SelectItem>
                  <SelectItem value="income">Apenas Entradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Categoria</span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 text-xs bg-slate-50">
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

            {/* Text Search */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Buscar</span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Descrição ou notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-xs pl-8 bg-slate-50"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Obra</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Google Sheets</th>
                  <th className="py-3 px-4 text-center">Origem</th>
                  <th className="py-3 px-4 text-center">Comprovante</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400">
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const catCfg = CATEGORY_LABELS[tx.category] || CATEGORY_LABELS.other
                    const fileUrl = tx.receipt_file ? transactionsService.getFileUrl(tx) : null
                    const isSyncing = syncingTxId === tx.id

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                          {new Date(tx.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-600" />
                            {getObraName(tx.obra_id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {tx.type === 'income' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              <ArrowUpRight className="w-3 h-3" />
                              Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                              <ArrowDownLeft className="w-3 h-3" />
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
                          {tx.status === 'pending' ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                              Pendente
                            </Badge>
                          ) : tx.status === 'reviewed' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              Revisado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-500">
                              Confirmado
                            </Badge>
                          )}
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
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase text-slate-500 bg-slate-50"
                          >
                            {tx.source || 'manual'}
                          </Badge>
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
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tx.id)}
                            className="h-7 w-7 text-slate-400 hover:text-red-600"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
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
