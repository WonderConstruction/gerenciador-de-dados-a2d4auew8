import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { botService } from '@/services/botAndReports'
import { telegramPolling, TelegramPollingStatus } from '@/services/telegramPolling'
import { Obra } from '@/types'
import {
  Send,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Trash2,
  Check,
  Radio,
  Zap,
  Activity,
  Bot,
  Layers,
  Database,
  Clock,
} from 'lucide-react'

interface TelegramWebhookConfigProps {
  obras?: Obra[]
  onWebhookConfigured?: () => void
}

export function TelegramWebhookConfig({ obras, onWebhookConfigured }: TelegramWebhookConfigProps) {
  const { toast } = useToast()

  // State
  const [botToken, setBotToken] = useState('8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSyncingNow, setIsSyncingNow] = useState(false)
  const [isCleaningWebhook, setIsCleaningWebhook] = useState(false)
  const [pollingStatus, setPollingStatus] = useState<TelegramPollingStatus>(
    telegramPolling.getStatus(),
  )

  // Bot Info & Webhook Status from Telegram API
  const [botProfile, setBotProfile] = useState<{
    id?: number
    first_name?: string
    username?: string
    can_join_groups?: boolean
    can_read_all_group_messages?: boolean
    supports_inline_queries?: boolean
  } | null>(null)

  const [webhookInfo, setWebhookInfo] = useState<{
    url?: string
    has_custom_certificate?: boolean
    pending_update_count?: number
    last_error_date?: number
    last_error_message?: string
    max_connections?: number
    allowed_updates?: string[]
  } | null>(null)

  // Backend state
  const [telegramState, setTelegramState] = useState<
    Record<string, { value?: number; text_value?: string; updated?: string }>
  >({})
  const [totalMessagesCount, setTotalMessagesCount] = useState<number>(0)
  const [lastSyncResult, setLastSyncResult] = useState<{ processed: number; at: string } | null>(
    null,
  )

  // Load state and bot profile on mount
  const refreshBackendData = useCallback(async () => {
    try {
      const [stateMap, count] = await Promise.all([
        botService.getTelegramState(),
        botService.getTelegramMessagesCount(),
      ])
      setTelegramState(stateMap)
      setTotalMessagesCount(count)
    } catch (err) {
      console.error('Error loading telegram backend state:', err)
    }
  }, [])

  // Auto-verify bot profile and check status on mount
  const handleVerifyBot = useCallback(
    async (tokenToVerify?: string) => {
      const cleanToken = (tokenToVerify || botToken).trim()
      if (!cleanToken) return

      setIsVerifying(true)
      try {
        const [getMeRes, webhookRes] = await Promise.all([
          botService.manageTelegramWebhook({
            bot_token: cleanToken,
            action: 'getMe',
          }),
          botService.manageTelegramWebhook({
            bot_token: cleanToken,
            action: 'getWebhookInfo',
          }),
        ])

        if (getMeRes && getMeRes.ok && getMeRes.result) {
          setBotProfile(getMeRes.result)
          localStorage.setItem('telegram_bot_token', cleanToken)
        }

        if (webhookRes && webhookRes.ok && webhookRes.result) {
          setWebhookInfo(webhookRes.result)
        }
      } catch (err: any) {
        console.error('Error verifying bot:', err)
      } finally {
        setIsVerifying(false)
      }
    },
    [botToken],
  )

  useEffect(() => {
    const savedToken = localStorage.getItem('telegram_bot_token')
    const token = savedToken || '8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y'
    setBotToken(token)
    handleVerifyBot(token)
    refreshBackendData()

    // Subscribe to Telegram polling service live status
    const unsubscribePolling = telegramPolling.subscribe((status) => {
      setPollingStatus(status)
    })

    // Poll backend state every 10 seconds to show live updates
    const interval = setInterval(() => {
      refreshBackendData()
    }, 10000)

    return () => {
      clearInterval(interval)
      unsubscribePolling()
    }
  }, [handleVerifyBot, refreshBackendData])

  // Manual Trigger: Pull updates now
  const handleSyncUpdatesNow = async () => {
    const cleanToken = botToken.trim()
    if (!cleanToken) {
      toast({
        title: 'Token não configurado',
        description: 'Informe o token do bot para sincronizar mensagens.',
        variant: 'destructive',
      })
      return
    }

    setIsSyncingNow(true)
    try {
      const result = await botService.processClientUpdates(cleanToken)
      setLastSyncResult({
        processed: result.processed,
        at: new Date().toLocaleTimeString('pt-BR'),
      })
      await Promise.all([refreshBackendData(), handleVerifyBot(cleanToken)])

      if (result.processed > 0) {
        toast({
          title: `📥 ${result.processed} nova(s) mensagem(ns) processada(s)!`,
          description: 'Recibos e lançamentos foram criados e categorizados automaticamente.',
        })
        if (onWebhookConfigured) onWebhookConfigured()
      } else {
        toast({
          title: '🔄 Polling executado com sucesso',
          description: 'Nenhuma nova mensagem pendente no Telegram no momento.',
        })
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Falha ao buscar atualizações do Telegram.'
      const isConflict =
        errMsg.includes('409') ||
        errMsg.includes('405') ||
        errMsg.toLowerCase().includes('webhook') ||
        errMsg.toLowerCase().includes('conflict')

      if (isConflict) {
        toast({
          title: '⚠️ Conflito de Webhook Detectado (HTTP 409/405)',
          description:
            'O Telegram não permite getUpdates enquanto houver um webhook registrado. Desative o webhook para destravar o polling.',
          variant: 'destructive',
          action: (
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-rose-700 hover:bg-rose-50 border-rose-200 text-xs font-bold"
              onClick={handleEnsurePollingClean}
            >
              Destravar Bot Agora
            </Button>
          ),
        } as any)
      } else {
        toast({
          title: 'Erro ao executar polling',
          description: errMsg,
          variant: 'destructive',
        })
      }
    } finally {
      setIsSyncingNow(false)
    }
  }

  // Delete webhook with drop_pending_updates=true to ensure polling mode works cleanly (prevent 405 error)
  const handleEnsurePollingClean = async () => {
    const cleanToken = botToken.trim()
    if (!cleanToken) {
      toast({
        title: 'Token não informado',
        description: 'Digite o token do bot para desativar o webhook.',
        variant: 'destructive',
      })
      return
    }

    setIsCleaningWebhook(true)
    try {
      // Clear webhook on Telegram with drop_pending_updates=true
      const res = await telegramPolling.clearWebhook(cleanToken)

      if (res && res.ok) {
        toast({
          title: '✅ Webhook desativado com sucesso!',
          description:
            'O conflito com a API do Telegram foi removido. O bot agora pode receber mensagens via Polling sem erros 405/409.',
        })
        // Immediately refresh diagnostic and bot status
        await Promise.all([handleVerifyBot(cleanToken), refreshBackendData()])
      } else {
        toast({
          title: 'Resposta do Telegram',
          description: res?.description || 'Webhook desativado ou já estava inativo.',
        })
        await handleVerifyBot(cleanToken)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao remover webhook',
        description: err.message || 'Falha na comunicação com o Telegram.',
        variant: 'destructive',
      })
    } finally {
      setIsCleaningWebhook(false)
    }
  }

  const lastUpdateId = telegramState['last_update_id']?.value ?? 0
  const lastPollAt = telegramState['last_poll_at']?.text_value
    ? new Date(telegramState['last_poll_at'].text_value).toLocaleString('pt-BR')
    : telegramState['last_update_id']?.updated
      ? new Date(telegramState['last_update_id'].updated).toLocaleString('pt-BR')
      : 'Ativo via Cron'

  return (
    <div className="space-y-6">
      {/* Hero card / Polling System Overview */}
      <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-sky-800/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Polling Ativo no Navegador</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>GitHub Actions 24h Configurado</span>
            </div>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Telegram Bot 24/7 (Background + Navegador)
          </h2>
          <p className="text-sm text-sky-100/80 leading-relaxed">
            Receba notas fiscais, fotos e descrições no Telegram 24h por dia sem manter a aba
            aberta. O workflow do <strong>GitHub Actions</strong> roda em nuvem a cada 5 minutos
            (100% gratuito) e o polling instantâneo no navegador opera em tempo real quando você
            estiver com o painel aberto.
          </p>
        </div>

        {/* Polling Live Metric Pill */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-800/40 shrink-0 space-y-3 min-w-[220px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-sky-400 block tracking-wider">
              Status Operacional
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-emerald-400">Pronto para Ingestão</span>
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-950 text-emerald-300 border-emerald-600"
              >
                24h + Realtime
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-400" />
              Offset: {lastUpdateId > 0 ? `#${lastUpdateId}` : pollingStatus.offset}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Total no Banco:</span>
            <span className="font-bold text-white font-mono">{totalMessagesCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Control Panel & Live State */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Polling Status & Bot Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Live Status & Controls */}
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Painel de Controle e Status do Polling
                </CardTitle>
                <Badge className="bg-emerald-600 text-white text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Pronto para Receber
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5 text-xs">
              {/* Status Indicator Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-sky-600" />
                    Último Update ID
                  </span>
                  <p className="text-lg font-bold font-mono text-slate-900">
                    {lastUpdateId > 0 ? `#${lastUpdateId}` : 'Inicial (0)'}
                  </p>
                  <p className="text-[10px] text-slate-400">Ponto de partida no getUpdates</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Mensagens no Banco
                  </span>
                  <p className="text-lg font-bold font-mono text-slate-900">{totalMessagesCount}</p>
                  <p className="text-[10px] text-slate-400">Coleção telegram_messages</p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    Modo de Recepção
                  </span>
                  <p className="text-lg font-bold text-emerald-700 font-medium flex items-center gap-1">
                    Polling HTTP
                  </p>
                  <p className="text-[10px] text-slate-400">Sem necessidade de portas externas</p>
                </div>
              </div>

              {/* Action Buttons: Sync Now & Cleanup */}
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                      Sincronização Imediata (Manual)
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      Execute uma consulta imediata à API do Telegram para processar qualquer
                      mensagem pendente.
                    </p>
                  </div>
                  <Button
                    onClick={handleSyncUpdatesNow}
                    disabled={isSyncingNow}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shrink-0 shadow-sm"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 mr-1.5 ${isSyncingNow ? 'animate-spin' : ''}`}
                    />
                    {isSyncingNow ? 'Consultando...' : 'Buscar Novas Mensagens Agora'}
                  </Button>
                </div>

                {lastSyncResult && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                    <span>
                      Última verificação manual às <strong>{lastSyncResult.at}</strong>:
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-slate-800 text-emerald-300 border-slate-700"
                    >
                      {lastSyncResult.processed} mensagens importadas
                    </Badge>
                  </div>
                )}
              </div>

              {/* Webhook Conflict Alert / Recovery Banner (Always visible if webhook exists, pending updates, or error) */}
              {((webhookInfo?.url && webhookInfo.url !== '') ||
                (webhookInfo?.pending_update_count && webhookInfo.pending_update_count > 0) ||
                pollingStatus.lastError?.includes('409') ||
                pollingStatus.lastError?.includes('405') ||
                pollingStatus.lastError?.toLowerCase().includes('webhook')) && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {webhookInfo?.url
                          ? `Webhook Ativo Detectado: ${webhookInfo.url}`
                          : 'Possível Conflito de Webhook ou Mensagens Pendentes'}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      O Telegram bloqueia o Polling (retorna 405/409) enquanto um webhook estiver
                      associado ao bot. Remova o webhook para destravar as mensagens.
                      {webhookInfo?.pending_update_count !== undefined && (
                        <span className="font-semibold block mt-0.5">
                          Mensagens pendentes no Telegram:{' '}
                          <span className="font-mono text-amber-950">
                            {webhookInfo.pending_update_count}
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleEnsurePollingClean}
                    disabled={isCleaningWebhook}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0 font-bold shadow-sm"
                  >
                    {isCleaningWebhook ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Destravar Bot (Remover Conflito)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Bot Token Configuration */}
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-600" />
                  Token do Bot no Telegram
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-white text-slate-700">
                  @BotFather
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="botTokenInput" className="text-xs font-bold text-slate-800">
                  Token de Autenticação HTTP:
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="botTokenInput"
                    placeholder="Ex: 8855089577:AAGwcjSJzSqZp8u_zPu2DN2V36MY23LhY2Y"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="font-mono text-xs bg-slate-50 border-slate-300"
                  />
                  <Button
                    onClick={() => handleVerifyBot()}
                    disabled={isVerifying || !botToken.trim()}
                    className="bg-sky-600 hover:bg-sky-700 text-white shrink-0 font-semibold text-xs"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Validar Bot
                  </Button>
                </div>
              </div>

              {/* Bot profile tile if loaded */}
              {botProfile && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-950 block">
                        Bot Conectado: {botProfile.first_name}
                      </span>
                      <a
                        href={`https://t.me/${botProfile.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-700 font-medium hover:underline flex items-center gap-1"
                      >
                        @{botProfile.username}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Token Válido ✅</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Instructions & Live Telegram Diagnostics */}
        <div className="space-y-6">
          {/* Diagnostic Card */}
          <Card className="bg-slate-900 text-slate-100 border-slate-800 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  Diagnóstico Telegram State
                </CardTitle>
                <button
                  onClick={() => {
                    refreshBackendData()
                    handleVerifyBot()
                  }}
                  disabled={isVerifying}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Atualizar diagnóstico"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 text-xs">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Bot:</span>
                  <span className="font-bold text-white font-mono">
                    {botProfile?.username ? `@${botProfile.username}` : 'Carregando...'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Modo de Operação:</span>
                  <Badge
                    variant="outline"
                    className="bg-emerald-950 text-emerald-300 border-emerald-600 text-[10px] flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Frontend Polling (2s)
                  </Badge>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Offset do Polling (localStorage):</span>
                  <span className="font-bold text-amber-400 font-mono">{pollingStatus.offset}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Recebidas nesta sessão:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {pollingStatus.sessionReceivedCount}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Offset (last_update_id):</span>
                  <span className="font-bold text-amber-400 font-mono">{lastUpdateId}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Última Execução:</span>
                  <span className="text-slate-300 font-mono text-[11px] text-right">
                    {lastPollAt}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Backend processando mensagens via onRecordCreate pipeline.</span>
                </div>

                {/* Conflict / Webhook Status in Diagnostic Card */}
                {webhookInfo && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Webhook no Telegram:</span>
                      <span
                        className={`font-mono font-bold ${
                          webhookInfo.url ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {webhookInfo.url ? 'Ativo (Conflito)' : 'Nenhum (Liberado)'}
                      </span>
                    </div>

                    {webhookInfo.pending_update_count !== undefined && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Updates Pendentes Telegram:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {webhookInfo.pending_update_count}
                        </span>
                      </div>
                    )}

                    {pollingStatus.lastError && (
                      <div className="p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] space-y-1">
                        <span className="font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                          Último erro registrado:
                        </span>
                        <p className="font-mono break-all text-[10px] text-rose-200">
                          {pollingStatus.lastError}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Highlighted Button in Diagnostics to Remove Conflict / Delete Webhook */}
                <div className="pt-2 border-t border-slate-800">
                  <Button
                    onClick={handleEnsurePollingClean}
                    disabled={isCleaningWebhook}
                    className={`w-full text-xs font-bold transition-all shadow-sm ${
                      webhookInfo?.url ||
                      (webhookInfo?.pending_update_count && webhookInfo.pending_update_count > 0)
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isCleaningWebhook ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    )}
                    Destravar Bot (Remover Conflito de Webhook)
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5 leading-tight">
                    Chama a API <code>deleteWebhook</code> do Telegram para limpar bloqueios e
                    restabelecer o getUpdates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* GitHub Actions 24/7 Setup Guide Card */}
          <Card className="bg-gradient-to-br from-indigo-50 via-slate-50 to-sky-50 border-indigo-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-indigo-950 uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Ativação GitHub Actions (24h Sem Custo)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-indigo-950 leading-relaxed">
              <p className="text-[11px] text-slate-700">
                O workflow{' '}
                <code className="px-1.5 py-0.5 rounded bg-indigo-100 font-mono text-[10px] text-indigo-900">
                  .github/workflows/telegram-sync.yml
                </code>{' '}
                já está criado no projeto para rodar a cada 5 minutos.
              </p>

              <div className="p-2.5 bg-white/80 rounded-lg border border-indigo-200/80 space-y-1.5">
                <span className="font-bold text-[11px] text-indigo-900 block">
                  Passos para rodar no GitHub:
                </span>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700">
                  <li>
                    Conecte seu repositório ao <strong>GitHub</strong> no painel de configurações do
                    projeto.
                  </li>
                  <li>
                    No repositório do GitHub, acesse{' '}
                    <strong>Settings &gt; Secrets and variables &gt; Actions</strong>.
                  </li>
                  <li>
                    (Opcional) Cadastre as variáveis/secrets se quiser sobrescrever os padrões:
                    <ul className="list-disc pl-3 mt-1 space-y-0.5 font-mono text-[10px] text-slate-600">
                      <li>
                        <code>TELEGRAM_BOT_TOKEN</code>
                      </li>
                      <li>
                        <code>POCKETBASE_URL</code> (já aponta para a URL pública)
                      </li>
                      <li>
                        <code>PB_AUTH_EMAIL</code> &amp; <code>PB_AUTH_PASSWORD</code>
                      </li>
                    </ul>
                  </li>
                  <li>
                    Na aba <strong>Actions</strong> do GitHub, o workflow{' '}
                    <em>Telegram 24/7 Background Poller</em> rodará automaticamente a cada 5 min!
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
          {/* Test real guide */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-amber-950 uppercase flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-amber-600" />
                Como Enviar Lançamentos pelo Telegram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs text-amber-900 leading-relaxed">
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                <li>Abra o Telegram no seu celular ou desktop.</li>
                <li>
                  Inicie conversa com{' '}
                  <a
                    href={`https://t.me/${botProfile?.username || 'ConstrutoraGestaoBot'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline text-amber-950"
                  >
                    @{botProfile?.username || 'ConstrutoraGestaoBot'}
                  </a>
                  .
                </li>
                <li>
                  Envie uma foto de nota fiscal com a legenda:
                  <div className="p-1.5 my-1 bg-amber-100/80 rounded font-mono text-[10px] text-amber-950 border border-amber-300/60">
                    "50 sacos de cimento Votoran para obra R$ 1.800,00"
                  </div>
                </li>
                <li>
                  O Polling captura a mensagem, a IA categoriza em <strong>materiais</strong> e o
                  lançamento é registrado automaticamente no extrato!
                </li>
              </ol>
            </CardContent>
          </Card>{' '}
        </div>
      </div>
    </div>
  )
}
