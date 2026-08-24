import { useState, useMemo } from 'react'
import { Obra, Transaction, STATUS_LABELS } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
} from 'lucide-react'

interface GeneralDashboardProps {
  obras: Obra[]
  transactions: Transaction[]
  onSelectObra: (obraId: string) => void
  onOpenNewObra: () => void
  onOpenNewTransaction: (obraId?: string) => void
}

export function GeneralDashboard({
  obras,
  transactions,
  onSelectObra,
  onOpenNewObra,
  onOpenNewTransaction,
}: GeneralDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Overall calculations
  const stats = useMemo(() => {
    let totalBudget = 0
    let totalIncome = 0
    let totalExpenses = 0

    obras.forEach((o) => {
      totalBudget += Number(o.total_budget) || 0
    })

    transactions.forEach((tx) => {
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

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Painel Geral de Obras
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão consolidada do fluxo de caixa e orçamento de todas as suas construções.
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
