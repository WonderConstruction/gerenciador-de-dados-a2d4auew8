import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { botService } from '@/services/botAndReports'
import { Obra } from '@/types'
import {
  Send,
  CheckCircle2,
  Copy,
  Terminal,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Trash2,
  Check,
  Globe,
  Radio,
  FileCode,
  Zap,
  Info,
} from 'lucide-react'

interface TelegramWebhookConfigProps {
  obras?: Obra[]
  onWebhookConfigured?: () => void
}

export function TelegramWebhookConfig({ obras, onWebhookConfigured }: TelegramWebhookConfigProps) {
  const { toast } = useToast()

  // State
  const [botToken, setBotToken] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [customSecret, setCustomSecret] = useState('')
  const [activeStep, setActiveStep] = useState<'step1' | 'step2' | 'step3' | 'step4'>('step1')

  // API Call Statuses
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSettingWebhook, setIsSettingWebhook] = useState(false)
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

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

  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Auto-fill default Webhook URL on mount
  useEffect(() => {
    const origin = window.location.origin
    const defaultUrl = `${origin}/api/custom/webhooks/bot-incoming`
    setWebhookUrl(defaultUrl)

    // Load saved token from localStorage if exists
    const savedToken = localStorage.getItem('telegram_bot_token')
    if (savedToken) {
      setBotToken(savedToken)
    }
  }, [])

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    toast({
      title: 'Copiado para a área de transferência!',
      description: text.length > 60 ? `${text.slice(0, 60)}...` : text,
    })
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // 1. Verify Bot Token (getMe)
  const handleVerifyBot = async () => {
    const cleanToken = botToken.trim()
    if (!cleanToken) {
      toast({
        title: 'Token não informado',
        description: 'Digite ou cole o token gerado pelo @BotFather.',
        variant: 'destructive',
      })
      return
    }

    setIsVerifying(true)
    try {
      const res: any = await botService.manageTelegramWebhook({
        bot_token: cleanToken,
        action: 'getMe',
      })

      if (res && res.ok && res.result) {
        setBotProfile(res.result)
        localStorage.setItem('telegram_bot_token', cleanToken)
        toast({
          title: '🤖 Bot do Telegram validado com sucesso!',
          description: `Conectado ao bot @${res.result.username} (${res.result.first_name}).`,
        })
        // Automatically check current webhook info
        handleCheckWebhookInfo(cleanToken)
        setActiveStep('step3')
      } else {
        toast({
          title: 'Token inválido',
          description:
            res?.description || 'O Telegram rejeitou o token. Verifique e tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao validar token',
        description: err.message || 'Verifique a conexão ou se o token está correto.',
        variant: 'destructive',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // 2. Check Webhook Info
  const handleCheckWebhookInfo = async (tokenOverride?: string) => {
    const token = tokenOverride || botToken.trim()
    if (!token) return

    setIsCheckingStatus(true)
    try {
      const res: any = await botService.manageTelegramWebhook({
        bot_token: token,
        action: 'getWebhookInfo',
      })

      if (res && res.ok && res.result) {
        setWebhookInfo(res.result)
      }
    } catch (err: any) {
      console.error('Error fetching webhook info:', err)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  // 3. Set Webhook with 1-Click
  const handleSetWebhook = async () => {
    const cleanToken = botToken.trim()
    const cleanUrl = webhookUrl.trim()

    if (!cleanToken) {
      toast({
        title: 'Token ausente',
        description: 'Por favor, insira o token do bot.',
        variant: 'destructive',
      })
      return
    }
    if (!cleanUrl) {
      toast({
        title: 'URL do Webhook ausente',
        description: 'Informe a URL pública onde as mensagens serão recebidas.',
        variant: 'destructive',
      })
      return
    }

    setIsSettingWebhook(true)
    try {
      const res: any = await botService.manageTelegramWebhook({
        bot_token: cleanToken,
        action: 'setWebhook',
        webhook_url: cleanUrl,
      })

      if (res && res.ok) {
        toast({
          title: '🎉 Webhook do Telegram Ativado com Sucesso!',
          description:
            res.description ||
            'O Telegram agora enviará todas as fotos e mensagens para o sistema.',
        })
        await handleCheckWebhookInfo(cleanToken)
        setActiveStep('step4')
        if (onWebhookConfigured) onWebhookConfigured()
      } else {
        toast({
          title: 'Falha ao configurar webhook',
          description: res?.description || 'Erro ao registrar Webhook no Telegram.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao configurar webhook',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSettingWebhook(false)
    }
  }

  // 4. Delete Webhook (reset to polling)
  const handleDeleteWebhook = async () => {
    const cleanToken = botToken.trim()
    if (!cleanToken) return

    if (
      !confirm(
        'Deseja realmente remover o webhook ativo no Telegram? O bot parará de enviar mensagens automaticamente para esta URL.',
      )
    ) {
      return
    }

    setIsDeletingWebhook(true)
    try {
      const res: any = await botService.manageTelegramWebhook({
        bot_token: cleanToken,
        action: 'deleteWebhook',
      })

      if (res && res.ok) {
        toast({
          title: 'Webhook removido',
          description: 'O webhook foi desativado no Telegram.',
        })
        await handleCheckWebhookInfo(cleanToken)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao remover webhook',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsDeletingWebhook(false)
    }
  }

  // Pre-generated cURL, Python, Node.js and Browser commands
  const curlCommand = `curl -F "url=${webhookUrl}" https://api.telegram.org/bot${botToken || '<SEU_TOKEN>'}/setWebhook`
  const getWebhookCurl = `curl https://api.telegram.org/bot${botToken || '<SEU_TOKEN>'}/getWebhookInfo`
  const browserUrl = `https://api.telegram.org/bot${botToken || '<SEU_TOKEN>'}/setWebhook?url=${encodeURIComponent(webhookUrl)}`

  return (
    <div className="space-y-6">
      {/* Hero card / Welcome */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-sky-800/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-semibold">
            <Send className="w-3.5 h-3.5" />
            <span>Assistente de Configuração do Telegram Bot</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Como Configurar o Webhook no Telegram?
          </h2>
          <p className="text-sm text-sky-100/80 leading-relaxed">
            Como você já criou o bot no <strong>@BotFather</strong>, o próximo passo é associar a
            URL do Webhook do seu Gerenciador de Obras ao bot. Assim, toda foto de recibo e mensagem
            enviada no Telegram cai diretamente no sistema para leitura automática via IA.
          </p>
        </div>

        {/* Status preview pill */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-sky-800/40 shrink-0 space-y-2">
          <span className="text-[11px] font-semibold uppercase text-sky-400 block tracking-wider">
            Status do Webhook
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full animate-pulse ${
                webhookInfo?.url ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-sm text-white">
              {webhookInfo?.url ? 'Webhook Ativo' : 'Aguardando Ativação'}
            </span>
          </div>
          {webhookInfo?.url && (
            <p
              className="text-[11px] text-slate-300 font-mono truncate max-w-[200px]"
              title={webhookInfo.url}
            >
              {webhookInfo.url}
            </p>
          )}
        </div>
      </div>

      {/* Step by step wizard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Step by Step interactive cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Obtenha o HTTP Token do BotFather */}
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Pegar o HTTP Token do @BotFather
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-white text-slate-700">
                  Já criou o bot?
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Quando você criou seu bot usando o comando <code>/newbot</code>, o{' '}
                <strong>@BotFather</strong> te enviou uma mensagem com a frase{' '}
                <em>"Use this token to access the HTTP API:"</em>.
              </p>

              <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] space-y-1">
                <span className="text-slate-400 block font-sans font-bold text-[10px] uppercase">
                  Exemplo de mensagem do @BotFather:
                </span>
                <p className="text-emerald-400">
                  Done! Congratulations on your new bot.
                  <br />
                  Use this token to access the HTTP API:
                  <br />
                  <strong className="text-amber-300 font-bold">
                    7192837482:AAH9fklzXq_dK9sL0...
                  </strong>
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="botTokenInput" className="text-xs font-bold text-slate-800">
                  Cole seu Token do Telegram Bot aqui:
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="botTokenInput"
                    placeholder="Ex: 7192837482:AAH9fklzXq_dK9sL0vN1w..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="font-mono text-xs bg-slate-50 border-slate-300"
                  />
                  <Button
                    onClick={handleVerifyBot}
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

              {/* Verified Bot card */}
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

          {/* Step 2: URL do Webhook do Gerenciador de Obras */}
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  URL do Webhook do Gerenciador de Obras
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-white text-slate-700">
                  Endpoint Seguro (HTTPS)
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Esta é a URL pública que o Telegram chamará via requisição <code>POST</code> toda
                vez que alguém enviar uma foto de nota fiscal, recibo ou comprovante de pagamento
                para o bot.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="webhookUrlInput" className="text-xs font-bold text-slate-800">
                  URL de Destino do Webhook (Pronta):
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookUrlInput"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="font-mono text-xs bg-slate-50 border-slate-300 text-slate-900 font-medium"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(webhookUrl, 'webhook_url')}
                    className="shrink-0 border-slate-300 text-slate-700 text-xs"
                  >
                    {copiedKey === 'webhook_url' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copiar URL
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  Importante sobre o Telegram Webhook:
                </span>
                <p className="text-[11px] text-amber-800">
                  O Telegram exige que a URL do webhook utilize protocolo <strong>
                    HTTPS
                  </strong>{' '}
                  válido com porta padrão 443 (ou 80/88/8443). Nossa infraestrutura já provê SSL
                  automático.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Registrar o Webhook no Telegram (1-Clique ou Manual) */}
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  Ativar o Webhook no Telegram
                </CardTitle>
                <Badge className="bg-emerald-600 text-white text-[10px]">
                  Recomendado: 1 Clique
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4 text-xs">
              {/* Opção A: 1-Clique Direto pelo Sistema */}
              <div className="p-4 rounded-xl bg-emerald-950/5 border border-emerald-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      Opção 1: Configuração Automática em 1 Clique
                    </h4>
                    <p className="text-emerald-800 text-xs mt-0.5">
                      O sistema se comunica diretamente com a API do Telegram e ativa o webhook
                      imediatamente.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={handleSetWebhook}
                    disabled={isSettingWebhook || !botToken.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                  >
                    {isSettingWebhook ? (
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    )}
                    Ativar Webhook Agora (setWebhook)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleCheckWebhookInfo()}
                    disabled={isCheckingStatus || !botToken.trim()}
                    className="border-slate-300 text-slate-700 text-xs bg-white"
                  >
                    {isCheckingStatus ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Radio className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                    )}
                    Consultar Status Atual (getWebhookInfo)
                  </Button>

                  {webhookInfo?.url && (
                    <Button
                      variant="ghost"
                      onClick={handleDeleteWebhook}
                      disabled={isDeletingWebhook}
                      className="text-red-600 hover:bg-red-50 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1 text-red-500" />
                      Remover Webhook
                    </Button>
                  )}
                </div>
              </div>

              {/* Opção B: Métodos Manuais (cURL, Navegador, etc.) */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-slate-600" />
                  Opção 2: Métodos Manuais Alternativos
                </h4>

                <Tabs defaultValue="curl" className="w-full">
                  <TabsList className="bg-slate-100 p-0.5 h-8">
                    <TabsTrigger value="curl" className="text-xs h-7">
                      cURL (Terminal)
                    </TabsTrigger>
                    <TabsTrigger value="browser" className="text-xs h-7">
                      Via Navegador (URL)
                    </TabsTrigger>
                    <TabsTrigger value="status" className="text-xs h-7">
                      Consultar Status
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab cURL */}
                  <TabsContent value="curl" className="pt-2 space-y-2">
                    <p className="text-slate-600 text-[11px]">
                      Abra o terminal do seu computador (PowerShell, Terminal macOS/Linux) e
                      execute:
                    </p>
                    <div className="relative group">
                      <pre className="p-3 bg-slate-900 text-amber-300 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                        {curlCommand}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(curlCommand, 'curl')}
                        className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        title="Copiar comando cURL"
                      >
                        {copiedKey === 'curl' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </TabsContent>

                  {/* Tab Browser */}
                  <TabsContent value="browser" className="pt-2 space-y-2">
                    <p className="text-slate-600 text-[11px]">
                      Você também pode simplesmente colar esta URL na barra de endereços de qualquer
                      navegador:
                    </p>
                    <div className="relative group">
                      <pre className="p-3 bg-slate-900 text-sky-300 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                        {browserUrl}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(browserUrl, 'browser')}
                        className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        title="Copiar Link"
                      >
                        {copiedKey === 'browser' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </TabsContent>

                  {/* Tab Status */}
                  <TabsContent value="status" className="pt-2 space-y-2">
                    <p className="text-slate-600 text-[11px]">
                      Para ver se o Telegram está entregando as mensagens ou se houve erros de
                      conexão:
                    </p>
                    <div className="relative group">
                      <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                        {getWebhookCurl}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(getWebhookCurl, 'get_webhook')}
                        className="absolute right-2 top-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      >
                        {copiedKey === 'get_webhook' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 col: Live Inspection & Telegram BotFather Tips */}
        <div className="space-y-6">
          {/* Live Webhook Inspection Card */}
          <Card className="bg-slate-900 text-slate-100 border-slate-800 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  Diagnóstico da API Telegram
                </CardTitle>
                <button
                  onClick={() => handleCheckWebhookInfo()}
                  disabled={isCheckingStatus || !botToken.trim()}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Atualizar diagnóstico"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 text-xs">
              {webhookInfo ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">URL Registrada:</span>
                    <span
                      className="font-mono text-[11px] text-amber-400 max-w-[170px] truncate"
                      title={webhookInfo.url}
                    >
                      {webhookInfo.url || 'Nenhuma (Polling)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Atualizações pendentes:</span>
                    <span className="font-bold text-white font-mono">
                      {webhookInfo.pending_update_count || 0}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Conexões simultâneas:</span>
                    <span className="font-bold text-white font-mono">
                      {webhookInfo.max_connections || 40}
                    </span>
                  </div>

                  {webhookInfo.last_error_message && (
                    <div className="p-2.5 rounded bg-red-950/60 border border-red-800 text-red-200 text-[11px] space-y-1">
                      <span className="font-bold block flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        Último erro registrado pelo Telegram:
                      </span>
                      <p className="font-mono text-[10px]">{webhookInfo.last_error_message}</p>
                    </div>
                  )}

                  {!webhookInfo.last_error_message && webhookInfo.url && (
                    <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Telegram pronto e sincronizando mensagens!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 space-y-2">
                  <Terminal className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">
                    Insira o Token do Bot no Passo 1 para inspecionar o status do webhook.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comandos Úteis do BotFather */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-sky-600" />
                Guia Rápido de Comandos @BotFather
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-2 text-slate-600 text-[11px]">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="text-sky-700 font-mono">/token</strong>
                  <p className="text-slate-500 mt-0.5">
                    Recupera ou gera novamente o token de um bot existente.
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="text-sky-700 font-mono">/setdescription</strong>
                  <p className="text-slate-500 mt-0.5">
                    Define o texto que os membros veem antes de clicar em Começar (ex: "Envie fotos
                    de recibos").
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="text-sky-700 font-mono">/setuserpic</strong>
                  <p className="text-slate-500 mt-0.5">
                    Define a foto do perfil do seu bot (ex: logo da construtora).
                  </p>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <strong className="text-sky-700 font-mono">/setcommands</strong>
                  <p className="text-slate-500 mt-0.5">
                    Configura comandos de ajuda no menu do chat.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Abrir BotFather no Telegram:</span>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 font-bold hover:underline flex items-center gap-1"
                >
                  @BotFather
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Passo 4: Teste Real */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-amber-950 uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Como Testar o Robô no Telegram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs text-amber-900 leading-relaxed">
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                <li>Abra o Telegram no seu celular ou desktop.</li>
                <li>
                  Procure pelo seu bot digitando{' '}
                  <code>@{botProfile?.username || 'seu_bot_username'}</code>.
                </li>
                <li>
                  Envie uma foto de recibo com a legenda:{' '}
                  <em>"50 sacos de cimento Votoran para obra R$ 1.800,00"</em>.
                </li>
                <li>
                  O bot recebe no Webhook, nossa IA categoriza em <strong>materials</strong> e
                  adiciona no extrato da obra e na planilha!
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
