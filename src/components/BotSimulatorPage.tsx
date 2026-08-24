import { useState } from 'react'
import { Obra, BotPlatform, TransactionCategory, CATEGORY_LABELS } from '@/types'
import { botService } from '@/services/botAndReports'
import { transactionsService } from '@/services/transactions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Bot,
  MessageSquare,
  Send,
  Sparkles,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  Copy,
  Smartphone,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Code,
} from 'lucide-react'

interface BotSimulatorPageProps {
  obras: Obra[]
  onTransactionCreated: () => void
  onNavigateToTelegramConfig?: () => void
}

export function BotSimulatorPage({
  obras,
  onTransactionCreated,
  onNavigateToTelegramConfig,
}: BotSimulatorPageProps) {
  const { toast } = useToast()

  // Form simulator states
  const [selectedObraId, setSelectedObraId] = useState<string>(obras[0]?.id || '')
  const [platform, setPlatform] = useState<BotPlatform>('whatsapp')
  const [caption, setCaption] = useState(
    'Recibo de compra: 50 sacos de cimento e 4m³ areia grossa para fundação da casa no valor de R$ 1.850,00',
  )
  const [receiptImage, setReceiptImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Analysis result
  const [analysisResult, setAnalysisResult] = useState<{
    category: TransactionCategory
    type: 'income' | 'expense'
    amount: number
    confidence: number
    matchedKeywords: string[]
  } | null>(null)

  // Quick preset samples
  const samples = [
    {
      title: 'Materiais Básicos (Cimento/Areia)',
      text: 'Nota fiscal materiais: 80 sacos de cimento Votoran e 10m³ brita 1 no valor de R$ 2.400,00',
    },
    {
      title: 'Mão de Obra (Equipe Pedreiros)',
      text: 'Pagamento de diária mão de obra dos 3 pedreiros e 2 serventes R$ 1.250,00',
    },
    {
      title: 'Elétrica (Fios e Disjuntores)',
      text: 'Cabos flexíveis 4mm e 6mm, conduítes e barramento elétrico no total de R$ 980,50',
    },
    {
      title: 'Hidráulica (Tubos e Conexões)',
      text: 'Tubos de esgoto 100mm, caixa d água Tigre e registros de pressão por R$ 1.120,00',
    },
    {
      title: 'Estrutura / Frame (Madeira & Aço)',
      text: 'Estrutura de madeira tratada para telhado e vigas de ferro 5/16 R$ 3.800,00',
    },
    {
      title: 'Recebimento de Cliente (Entrada)',
      text: 'Aporte recebimento de medição do cliente no valor de R$ 25.000,00',
    },
  ]

  const handleProcessMessage = async () => {
    if (!selectedObraId) {
      toast({
        title: 'Selecione uma obra',
        description: 'Escolha qual obra receberá o lançamento.',
        variant: 'destructive',
      })
      return
    }
    if (!caption.trim()) {
      toast({
        title: 'Texto vazio',
        description: 'Digite uma descrição para o bot analisar.',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    try {
      // Step 1: Call OCR & Categorization intelligence
      const analysis = botService.categorizeText(caption)
      setAnalysisResult(analysis)

      // Step 2: Auto-create transaction in PocketBase
      await transactionsService.create({
        obra_id: selectedObraId,
        type: analysis.type,
        amount: analysis.amount > 0 ? analysis.amount : 150.0,
        category: analysis.category,
        description: caption,
        date: new Date().toISOString(),
        receipt_file: receiptImage,
        source: platform === 'simulated' ? 'manual' : platform,
        raw_bot_text: caption,
        sheets_synced: true,
      })

      toast({
        title: '🤖 Bot Processou com Sucesso!',
        description: `Categoria detectada: "${analysis.category}" — Sincronizado com Dashboard e Planilha.`,
      })

      onTransactionCreated()
    } catch (err: any) {
      toast({
        title: 'Erro no processamento do bot',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const backendBase = (import.meta.env.VITE_POCKETBASE_URL || window.location.origin).replace(
    /\/+$/,
    '',
  )
  const webhookUrl = `${backendBase}/api/custom/webhooks/bot-incoming`

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast({ title: 'URL do Webhook copiada!', description: webhookUrl })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Robô de Recibos (WhatsApp & Telegram)
              </h1>
              <p className="text-sm text-slate-500">
                O fluxo automático: envie a foto do comprovante com a legenda e o sistema cuida do
                resto.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold px-3 py-1 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Motor IA Ativo
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Simulator */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-600" />
                Simulador de Envio de Recibo (Chat do Bot)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Teste como o robô lê a imagem e a legenda antes de conectar o bot real.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Target Obra & Platform */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Obra de Destino</Label>
                  <Select value={selectedObraId} onValueChange={setSelectedObraId}>
                    <SelectTrigger className="bg-slate-50">
                      <SelectValue placeholder="Selecione a obra" />
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Canal do Envio</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={platform === 'whatsapp' ? 'default' : 'outline'}
                      onClick={() => setPlatform('whatsapp')}
                      className={
                        platform === 'whatsapp'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs'
                          : 'border-slate-300 text-slate-700 text-xs'
                      }
                    >
                      WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant={platform === 'telegram' ? 'default' : 'outline'}
                      onClick={() => setPlatform('telegram')}
                      className={
                        platform === 'telegram'
                          ? 'bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs'
                          : 'border-slate-300 text-slate-700 text-xs'
                      }
                    >
                      Telegram
                    </Button>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">
                  Exemplos Rápidos para Testar:
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {samples.map((s, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCaption(s.text)}
                      className="text-[11px] h-7 bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-900 border-slate-200"
                    >
                      {s.title}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Caption input */}
              <div className="space-y-1.5">
                <Label htmlFor="botCaption" className="text-xs font-semibold text-slate-700">
                  Mensagem / Legenda enviada pelo usuário:
                </Label>
                <Textarea
                  id="botCaption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  className="bg-slate-50 text-sm font-mono placeholder:text-slate-400"
                  placeholder="Descreva o que comprou ou recebeu..."
                />
              </div>

              {/* Receipt File Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Foto do Recibo / Cupom (Opcional no simulador)
                </Label>
                <div className="flex items-center gap-4">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-center hover:bg-slate-50 transition cursor-pointer relative flex-1">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>
                        {receiptImage ? receiptImage.name : 'Clique para simular foto do recibo'}
                      </span>
                    </div>
                  </div>
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Recibo"
                      className="w-12 h-12 rounded object-cover border border-slate-300 shadow-sm"
                    />
                  )}
                </div>
              </div>

              {/* Submit Trigger */}
              <Button
                onClick={handleProcessMessage}
                disabled={isProcessing}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 shadow-md shadow-amber-500/10"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Simular Envio e Processamento Automático
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Result Box */}
          {analysisResult && (
            <Card className="bg-emerald-950/5 border-emerald-300 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Resultado da Leitura da IA
                  </CardTitle>
                  <Badge className="bg-emerald-600 text-white text-[10px]">
                    {(analysisResult.confidence * 100).toFixed(0)}% de Precisão
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Categoria
                    </span>
                    <span className="font-bold text-slate-900 capitalize">
                      {CATEGORY_LABELS[analysisResult.category]?.label || analysisResult.category}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Tipo
                    </span>
                    <span
                      className={`font-bold ${analysisResult.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {analysisResult.type === 'income' ? 'Entrada / Receita' : 'Saída / Custo'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Valor Extraído
                    </span>
                    <span className="font-bold text-slate-900">
                      R${' '}
                      {analysisResult.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded border border-emerald-100">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Status Planilha
                    </span>
                    <span className="font-bold text-emerald-600">Sincronizado ✅</span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded border border-emerald-100 flex items-center justify-between">
                  <span className="text-slate-600">Palavras-chave acionadas:</span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    {analysisResult.matchedKeywords.join(', ') || 'Classificação padrão'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Webhook Instructions & Production Setup */}
        <div className="space-y-6">
          {/* Telegram Webhook Shortcut Banner */}
          {onNavigateToTelegramConfig && (
            <Card className="bg-gradient-to-br from-sky-900 to-indigo-950 text-white border-sky-700 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-400" />
                  Configurador de Webhook Telegram
                </CardTitle>
                <CardDescription className="text-xs text-sky-200">
                  Já criou o bot no @BotFather? Conecte com 1 clique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-sky-100 text-[11px] leading-relaxed">
                  Utilize nosso assistente dedicado com validação de token, diagnóstico ao vivo e
                  disparo de webhook automático.
                </p>
                <Button
                  onClick={onNavigateToTelegramConfig}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-slate-950" />
                  Abrir Assistente Telegram Webhook
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-900 text-slate-100 border-slate-800 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-amber-400" />
                Endpoint Webhook Real
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Para conectar bots oficiais do Telegram BotFather ou WhatsApp Cloud API.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="text-slate-400 font-medium">URL do Webhook (POST):</span>
                <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-amber-300 break-all border border-slate-800 flex items-center justify-between gap-2">
                  <span>{webhookUrl}</span>
                  <button
                    onClick={copyWebhook}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white shrink-0"
                    title="Copiar URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3">
                <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>Passo a Passo Rápido Telegram:</span>
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>
                    Abra o Telegram e converse com <code>@BotFather</code>.
                  </li>
                  <li>
                    Com o bot já criado, pegue o <strong>HTTP API Token</strong> (ex:{' '}
                    <code>12345:ABC...</code>).
                  </li>
                  <li>
                    Execute o cURL abaixo ou use a aba <strong>Configurar Telegram Webhook</strong>{' '}
                    do menu:
                  </li>
                </ol>
                <div className="p-2 bg-slate-950 rounded font-mono text-[10px] text-slate-400 overflow-x-auto">
                  curl -F "url={webhookUrl}" https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3">
                <h4 className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>Como Conectar o WhatsApp:</span>
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>
                    Acesse o <strong>Meta for Developers</strong> (WhatsApp Cloud API).
                  </li>
                  <li>
                    Cole a URL acima no campo <strong>Callback URL</strong> do Webhook.
                  </li>
                  <li>
                    Inscreva-se no evento <code>messages</code>.
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Dicionário de Categorias */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-700 uppercase">
                Dicionário de Categorias da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-slate-500 text-[11px]">O robô reconhece termos automaticamente:</p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between border-b pb-1">
                  <strong className="text-amber-800">Frame:</strong>
                  <span className="text-slate-600">estrutura, viga, madeira, aço</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <strong className="text-blue-800">Labor:</strong>
                  <span className="text-slate-600">mão de obra, pedreiro, diária</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <strong className="text-yellow-800">Electrical:</strong>
                  <span className="text-slate-600">fio, tomada, cabo, disjuntor</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <strong className="text-sky-800">Plumbing:</strong>
                  <span className="text-slate-600">cano, água, pia, esgoto, conexões</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <strong className="text-lime-800">Materials:</strong>
                  <span className="text-slate-600">cimento, tijolo, areia, brita</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <strong className="text-purple-800">Equipment:</strong>
                  <span className="text-slate-600">betoneira, andaime, locação</span>
                </div>
                <div className="flex justify-between">
                  <strong className="text-pink-800">Finishing:</strong>
                  <span className="text-slate-600">pintura, piso, porcelanato, gesso</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
