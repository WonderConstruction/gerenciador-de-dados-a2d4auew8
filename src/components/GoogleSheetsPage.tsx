import { useState, useEffect } from 'react'
import { Obra, Transaction } from '@/types'
import { sheetsService } from '@/services/botAndReports'
import { obrasService } from '@/services/obras'
import { googleSheetsService } from '@/services/googleSheets'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  FileSpreadsheet,
  Download,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Copy,
  Table,
  Key,
  HelpCircle,
  FolderSync,
  AlertTriangle,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react'

interface VerifiedSheetData {
  range: string
  totalRows: number
  headerRow?: (string | number)[]
  recentRows: (string | number)[][]
  rawValues: (string | number)[][]
  spreadsheetId: string
  verifiedAt: Date
}

interface GoogleSheetsPageProps {
  obras: Obra[]
  transactions: Transaction[]
  onRefresh: () => void
}

export function GoogleSheetsPage({ obras, transactions, onRefresh }: GoogleSheetsPageProps) {
  const { toast } = useToast()
  const [selectedObraId, setSelectedObraId] = useState<string>(obras[0]?.id || '')
  const [sheetUrlInput, setSheetUrlInput] = useState('')
  const [isUpdatingUrl, setIsUpdatingUrl] = useState(false)
  const [isTestingSync, setIsTestingSync] = useState(false)
  const [isTestingConn, setIsTestingConn] = useState(false)
  const [connResult, setConnResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isVerifyingSheet, setIsVerifyingSheet] = useState(false)
  const [verifiedData, setVerifiedData] = useState<VerifiedSheetData | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const selectedObra = obras.find((o) => o.id === selectedObraId) || obras[0]
  const obraTransactions = transactions.filter((t) => t.obra_id === selectedObra?.id)
  const serviceAccountEmail = googleSheetsService.getServiceAccountEmail()

  useEffect(() => {
    if (selectedObra) {
      setSheetUrlInput(selectedObra.google_sheets_url || '')
      setVerifiedData(null)
      setVerifyError(null)
      setConnResult(null)
    }
  }, [selectedObra])

  const handleTestConnection = async () => {
    if (!sheetUrlInput.trim()) {
      toast({
        title: 'Informe a URL ou ID da Planilha',
        description: 'Insira o link do Google Sheets para testar a comunicação.',
        variant: 'destructive',
      })
      return
    }

    setIsTestingConn(true)
    setConnResult(null)
    try {
      const res = await googleSheetsService.testConnection(sheetUrlInput)
      if (res.success && res.metadata) {
        const sheetsList = res.metadata.sheets.map((s) => s.title).join(', ')
        const msg = `Planilha "${res.metadata.title}" conectada com sucesso! Abas encontradas: ${sheetsList}`
        setConnResult({ success: true, message: msg })
        toast({
          title: '✅ Conexão Google Sheets Aprovada!',
          description: msg,
        })
      } else {
        const errorMsg = res.error || 'Não foi possível acessar a planilha.'
        setConnResult({ success: false, message: errorMsg })
        toast({
          title: '❌ Falha de Acesso à Planilha',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      setConnResult({ success: false, message: err?.message || 'Erro inesperado' })
      toast({
        title: 'Erro ao testar',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setIsTestingConn(false)
    }
  }

  const handleVerifySheet = async () => {
    const sheetTarget =
      sheetUrlInput.trim() ||
      selectedObra?.google_sheets_url ||
      selectedObra?.google_sheets_id ||
      (selectedObra?.name?.toLowerCase().includes('720')
        ? '1jaVk5ZXIR3-Woau6dxFrsmINFpV7WkThVVIZJaZV3BU'
        : '')

    if (!sheetTarget) {
      toast({
        title: 'Informe a Planilha',
        description: 'Insira o link ou ID do Google Sheets para verificar os lançamentos.',
        variant: 'destructive',
      })
      return
    }

    setIsVerifyingSheet(true)
    setVerifyError(null)

    try {
      const res = await googleSheetsService.readRecentRows(sheetTarget, 10)
      if (res.success && res.data) {
        setVerifiedData({
          ...res.data,
          verifiedAt: new Date(),
        })
        toast({
          title: '✅ Planilha Verificada com Sucesso!',
          description: `${res.data.totalRows} linha(s) encontrada(s) no intervalo "${res.data.range}".`,
        })
      } else {
        const errorMsg = res.error || 'Não foi possível ler as linhas da planilha.'
        setVerifyError(errorMsg)
        toast({
          title: 'Erro ao verificar planilha',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Falha na comunicação com o Google Sheets.'
      setVerifyError(errorMsg)
      toast({
        title: 'Erro ao verificar planilha',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setIsVerifyingSheet(false)
    }
  }

  const handleSaveSheetUrl = async () => {
    if (!selectedObra) return
    setIsUpdatingUrl(true)
    try {
      const sheetId = googleSheetsService.extractSpreadsheetId(sheetUrlInput) || ''
      await obrasService.update(selectedObra.id, {
        google_sheets_url: sheetUrlInput,
        google_sheets_id: sheetId,
      })
      toast({
        title: 'URL da Planilha Salva!',
        description: `Planilha vinculada à obra "${selectedObra.name}".`,
      })
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingUrl(false)
    }
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(serviceAccountEmail)
    toast({
      title: 'E-mail copiado!',
      description: 'Cole no Google Sheets > Compartilhar > Adicionar pessoas como Editor.',
    })
  }

  const handleExportCsv = (obra: Obra) => {
    const txs = transactions.filter((t) => t.obra_id === obra.id)
    sheetsService.exportToCsv(obra.name, txs)
    toast({
      title: 'Planilha Gerada!',
      description: `Arquivo CSV da obra "${obra.name}" com ${txs.length} transações foi exportado.`,
    })
  }

  const handleSyncReviewedToSheets = async () => {
    if (!selectedObra) return
    const reviewedTxs = obraTransactions.filter((t) => t.status === 'reviewed')
    if (reviewedTxs.length === 0) {
      toast({
        title: 'Nenhum lançamento revisado',
        description:
          'Apenas lançamentos com status "reviewed" (confirmados) são enviados para a planilha.',
      })
      return
    }

    setIsTestingSync(true)
    try {
      const res = await googleSheetsService.syncBatchToSheet(reviewedTxs, selectedObra)
      if (res.errorsCount === 0) {
        toast({
          title: '✅ Sincronização Concluída!',
          description: `${res.syncedCount} lançamento(s) gravado(s) com sucesso no Google Sheets.`,
        })
      } else {
        toast({
          title: `⚠️ Sincronizado ${res.syncedCount} com ${res.errorsCount} erro(s)`,
          description:
            res.lastError || 'Verifique se a planilha está compartilhada com a Conta de Serviço.',
          variant: 'destructive',
        })
      }
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Falha na escrita Google Sheets',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsTestingSync(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Google Sheets por Obra (Escrita Real)
              </h1>
              <p className="text-sm text-slate-500">
                Cada projeto possui sua própria planilha com escrita em tempo real via Google Sheets
                API v4.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Obras Sheets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Obra selector & Live Sync Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>Configurar Planilha da Obra</span>
                {selectedObra && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300"
                  >
                    {obraTransactions.length} Lançamentos Prontos
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Selecione a obra para gerenciar o link do Google Sheets e sincronizar os
                lançamentos.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Selecione a Obra</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {obras.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedObraId(o.id)}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        selectedObraId === o.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block truncate">{o.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {transactions.filter((t) => t.obra_id === o.id).length} transações
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedObra && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sheetUrl" className="text-xs font-semibold text-slate-700">
                      Link da Planilha Google Sheets para "{selectedObra.name}"
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="sheetUrl"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={sheetUrlInput}
                        onChange={(e) => setSheetUrlInput(e.target.value)}
                        className="bg-white text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveSheetUrl}
                        disabled={isUpdatingUrl}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 font-semibold text-xs"
                      >
                        Salvar Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTestingConn}
                        className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shrink-0 font-semibold text-xs"
                      >
                        {isTestingConn ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        )}
                        Testar Permissão
                      </Button>
                    </div>
                    {connResult && (
                      <div
                        className={`p-2.5 rounded text-xs font-medium border ${
                          connResult.success
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-red-50 text-red-900 border-red-200'
                        }`}
                      >
                        {connResult.message}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-700 font-medium">
                        Colunas esperadas na planilha:
                      </span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      [ Data | Categoria | Descrição | Valor | Link do Recibo ]
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* Verify Sheet Button */}
                {selectedObra && (
                  <Button
                    onClick={handleVerifySheet}
                    disabled={isVerifyingSheet}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                  >
                    {isVerifyingSheet ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Verificar Planilha
                  </Button>
                )}

                {selectedObra && (
                  <Button
                    onClick={handleSyncReviewedToSheets}
                    disabled={isTestingSync}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    {isTestingSync ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <FolderSync className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    )}
                    Escrever Lançamentos na Planilha
                  </Button>
                )}

                {selectedObra?.google_sheets_url && (
                  <a
                    href={selectedObra.google_sheets_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Abrir no Google Drive
                  </a>
                )}

                {selectedObra && (
                  <Button
                    variant="outline"
                    onClick={() => handleExportCsv(selectedObra)}
                    className="border-slate-300 text-slate-800 bg-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Exportar Backup (CSV)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Sheet Verification Result */}
          {isVerifyingSheet && (
            <Card className="bg-emerald-50/50 border-emerald-200 shadow-sm animate-pulse">
              <CardContent className="p-6 flex items-center justify-center gap-3 text-emerald-800 text-sm font-medium">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span>Lendo dados diretamente da API Google Sheets v4...</span>
              </CardContent>
            </Card>
          )}

          {verifyError && (
            <Card className="bg-red-50 border-red-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Erro ao verificar a planilha no Google Sheets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-red-800 leading-relaxed font-mono whitespace-pre-wrap">
                  {verifyError}
                </p>
                <p className="text-[11px] text-red-700">
                  Dica: Verifique se a conta de serviço{' '}
                  <code className="font-mono bg-red-100 px-1 py-0.5 rounded text-[10px]">
                    {serviceAccountEmail}
                  </code>{' '}
                  foi adicionada como Editora ou Leitora no botão "Compartilhar" da planilha no
                  Google Drive.
                </p>
              </CardContent>
            </Card>
          )}

          {verifiedData && (
            <Card className="bg-white border-emerald-300 shadow-md">
              <CardHeader className="pb-3 bg-emerald-50/60 border-b border-emerald-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Conteúdo Real da Planilha Google Sheets
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono">
                      Intervalo: {verifiedData.range}
                    </Badge>
                    <Badge variant="outline" className="text-slate-600 text-[10px]">
                      Total: {verifiedData.totalRows} linha(s)
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    Exibindo as <strong>últimas {verifiedData.recentRows.length} linhas</strong>{' '}
                    lidas via Google Sheets API (Conta de Serviço).
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Verificado às {verifiedData.verifiedAt.toLocaleTimeString('pt-BR')}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {verifiedData.rawValues.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    A planilha está vazia (nenhuma linha encontrada).
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 w-10 text-center text-slate-500">#</th>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Categoria</th>
                          <th className="p-2.5">Descrição</th>
                          <th className="p-2.5 text-right">Valor</th>
                          <th className="p-2.5 text-center">Recibo / Anexo</th>
                          {/* If there are extra columns */}
                          {verifiedData.headerRow &&
                            verifiedData.headerRow.slice(5).map((h, i) => (
                              <th key={i} className="p-2.5">
                                {String(h || `Col ${i + 6}`)}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {verifiedData.recentRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400">
                              Apenas cabeçalho encontrado na planilha.
                            </td>
                          </tr>
                        ) : (
                          verifiedData.recentRows.map((row, idx) => {
                            const dateCol = row[0] !== undefined ? String(row[0]) : '—'
                            const catCol = row[1] !== undefined ? String(row[1]) : '—'
                            const descCol = row[2] !== undefined ? String(row[2]) : '—'
                            const valCol = row[3] !== undefined ? String(row[3]) : '—'
                            const receiptCol = row[4] !== undefined ? String(row[4]) : ''

                            const isReceiptUrl =
                              typeof receiptCol === 'string' &&
                              (receiptCol.startsWith('http://') ||
                                receiptCol.startsWith('https://'))

                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-emerald-50/40 transition-colors ${
                                  idx === verifiedData.recentRows.length - 1
                                    ? 'bg-emerald-50/20 font-medium'
                                    : ''
                                }`}
                              >
                                <td className="p-2.5 text-center text-slate-400 font-mono text-[10px]">
                                  {verifiedData.totalRows -
                                    verifiedData.recentRows.length +
                                    idx +
                                    1}
                                </td>
                                <td className="p-2.5 text-slate-700 font-mono whitespace-nowrap">
                                  {dateCol}
                                </td>
                                <td className="p-2.5 text-slate-800">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal bg-slate-50 border-slate-300"
                                  >
                                    {catCol}
                                  </Badge>
                                </td>
                                <td className="p-2.5 text-slate-900 max-w-xs font-normal">
                                  {descCol}
                                </td>
                                <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                  {valCol.startsWith('R$') || isNaN(Number(valCol))
                                    ? valCol
                                    : `R$ ${Number(valCol).toFixed(2)}`}
                                </td>
                                <td className="p-2.5 text-center">
                                  {isReceiptUrl ? (
                                    <a
                                      href={receiptCol}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline"
                                    >
                                      <FileText className="w-3 h-3" />
                                      Ver Recibo
                                    </a>
                                  ) : receiptCol ? (
                                    <span className="text-[11px] text-slate-500 font-mono truncate max-w-[120px] block mx-auto">
                                      {receiptCol}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-300">—</span>
                                  )}
                                </td>
                                {row.slice(5).map((extraCell, i) => (
                                  <td key={i} className="p-2.5 text-slate-600">
                                    {String(extraCell ?? '')}
                                  </td>
                                ))}
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Confirmado: Leitura direta realizada via Google Sheets API v4.</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleVerifySheet}
                    disabled={isVerifyingSheet}
                    className="h-7 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100"
                  >
                    <RefreshCw
                      className={`w-3 h-3 mr-1 ${isVerifyingSheet ? 'animate-spin' : ''}`}
                    />
                    Atualizar Leitura
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mini Table Preview of the Sheet content */}
          <Card className="bg-white border-slate-200 shadow-sm">
            {' '}
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-600" />
                Prévia dos Lançamentos da Obra
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Colunas formatadas para a planilha:{' '}
                <strong>[ Data | Categoria | Descrição | Valor (R$) | Sincronizado ]</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5 text-right">Valor</th>
                      <th className="p-2.5 text-center">Sheets Synced</th>
                      <th className="p-2.5 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {obraTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          Nenhum lançamento nesta obra.
                        </td>
                      </tr>
                    ) : (
                      obraTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-600 whitespace-nowrap">
                            {new Date(t.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-2.5 font-semibold">
                            {t.type === 'income' ? (
                              <span className="text-emerald-700">Entrada</span>
                            ) : (
                              <span className="text-red-700">Saída</span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-800 capitalize">{t.category}</td>
                          <td className="p-2.5 text-slate-900 max-w-xs truncate">
                            {t.description}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                            R$ {Number(t.amount || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            {t.sheets_synced ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                SIM ✅
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[10px]">
                                NÃO ⏳
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const res = await googleSheetsService.syncTransactionToSheet(
                                    t,
                                    selectedObra,
                                  )
                                  if (res.success) {
                                    toast({ title: '✅ Sincronizado!', description: res.message })
                                  } else {
                                    toast({
                                      title: 'Erro ao sincronizar',
                                      description: res.error || res.message,
                                      variant: 'destructive',
                                    })
                                  }
                                  onRefresh()
                                } catch (e: any) {
                                  toast({
                                    title: 'Falha',
                                    description: e.message,
                                    variant: 'destructive',
                                  })
                                }
                              }}
                              className="h-6 px-2 text-[10px] font-medium border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                              <FileSpreadsheet className="w-3 h-3 mr-1 text-emerald-600" />
                              Reenviar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Google API Service Account Instructions & Sharing Banner */}
        <div className="space-y-6">
          <Card className="bg-slate-900 text-slate-100 border-slate-800 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                Conta de Serviço (Google Sheets API)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                A conta de serviço abaixo precisa ser adicionada como <strong>Editora</strong> na
                sua planilha Google Sheets.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  E-mail da Conta de Serviço:
                </span>
                <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded border border-slate-700">
                  <span className="font-mono text-[11px] text-slate-200 break-all select-all">
                    {serviceAccountEmail}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyEmail}
                    className="h-7 px-2 text-slate-300 hover:text-white shrink-0"
                    title="Copiar e-mail"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-white block">
                  Passo a passo para liberar escrita:
                </span>
                <ol className="list-decimal pl-4 space-y-2 text-slate-300 text-[11px] leading-relaxed">
                  <li>
                    Abra a planilha no Google Sheets (ex: <strong>Obra 720H</strong>).
                  </li>
                  <li>
                    Clique no botão azul <strong>"Compartilhar"</strong> (canto superior direito).
                  </li>
                  <li>
                    Cole o e-mail da conta de serviço{' '}
                    <code className="text-amber-300 font-mono text-[10px]">
                      {serviceAccountEmail}
                    </code>
                    .
                  </li>
                  <li>
                    Mantenha a permissão como <strong>"Editor"</strong> e desmarque "Notificar
                    pessoas", depois clique em <strong>"Compartilhar"</strong>.
                  </li>
                  <li>
                    Pronto! As transações revisadas serão gravadas diretamente nas linhas da
                    planilha.
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1 text-amber-200 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Erro HTTP 403 (Permission Denied)?</span>
                </div>
                <p className="text-slate-300 leading-snug">
                  Se a API retornar erro 403, significa que a planilha ainda não foi compartilhada
                  com o e-mail acima. Após compartilhar, clique em "Escrever Lançamentos na
                  Planilha" novamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
