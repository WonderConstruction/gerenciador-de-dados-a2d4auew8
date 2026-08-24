import { useState, useEffect } from 'react'
import { Obra, ReportConfig } from '@/types'
import { reportsService } from '@/services/botAndReports'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Calendar,
  Send,
  Clock,
  CheckCircle2,
  Sparkles,
  Eye,
  Loader2,
  BellRing,
  FileText,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ReportsPageProps {
  obras: Obra[]
}

export function ReportsPage({ obras }: ReportsPageProps) {
  const { toast } = useToast()
  const [config, setConfig] = useState<ReportConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)

  // Form states
  const [recipientEmail, setRecipientEmail] = useState('obrunolimaus@gmail.com')
  const [weeklyEnabled, setWeeklyEnabled] = useState(true)
  const [weeklyDay, setWeeklyDay] = useState<any>('monday')
  const [weeklyHour, setWeeklyHour] = useState(8)
  const [monthlyEnabled, setMonthlyEnabled] = useState(true)
  const [monthlyDay, setMonthlyDay] = useState(1)
  const [monthlyHour, setMonthlyHour] = useState(8)

  // Preview dialog state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const cfg = await reportsService.getConfig()
      if (cfg) {
        setConfig(cfg)
        setRecipientEmail(cfg.recipient_email || 'obrunolimaus@gmail.com')
        setWeeklyEnabled(cfg.weekly_enabled ?? true)
        setWeeklyDay(cfg.weekly_day || 'monday')
        setWeeklyHour(cfg.weekly_hour ?? 8)
        setMonthlyEnabled(cfg.monthly_enabled ?? true)
        setMonthlyDay(cfg.monthly_day ?? 1)
        setMonthlyHour(cfg.monthly_hour ?? 8)
      }
    } catch (err) {
      console.error('Error loading report config:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientEmail.trim()) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe o e-mail de destino dos relatórios.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const saved = await reportsService.saveConfig({
        recipient_email: recipientEmail,
        weekly_enabled: weeklyEnabled,
        weekly_day: weeklyDay,
        weekly_hour: weeklyHour,
        monthly_enabled: monthlyEnabled,
        monthly_day: monthlyDay,
        monthly_hour: monthlyHour,
      })
      setConfig(saved)
      toast({
        title: 'Configurações de Relatório Salvas!',
        description: `Os relatórios serão enviados periodicamente para ${recipientEmail}.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestTrigger = async (type: 'weekly' | 'monthly') => {
    setTriggering(true)
    try {
      const res: any = await reportsService.triggerReport(type, recipientEmail)
      if (res && res.htmlPreview) {
        setPreviewHtml(res.htmlPreview)
      }
      toast({
        title: `Relatório ${type === 'weekly' ? 'Semanal' : 'Mensal'} Gerado!`,
        description: `E-mail consolidado com resumo de ${obras.length} obras gerado com sucesso.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao disparar relatório',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Relatórios Automáticos por E-mail
              </h1>
              <p className="text-sm text-slate-500">
                Resumos periódicos da saúde financeira de todas as obras direto na sua caixa de
                entrada.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleTestTrigger('weekly')}
            disabled={triggering}
            className="border-slate-300 text-slate-800 bg-white text-xs font-semibold"
          >
            {triggering ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            )}
            Testar / Pré-visualizar Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Schedule & Preferences form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveConfig}>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900">
                  Agendamento de Envios Automáticos
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Defina os horários e o e-mail que receberá os relatórios semanais e mensais.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Recipient Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="repEmail" className="text-xs font-semibold text-slate-700">
                    E-mail de Destino dos Relatórios *
                  </Label>
                  <Input
                    id="repEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    required
                    placeholder="seu-email@gestao.com"
                    className="bg-slate-50 text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-400">
                    Você pode alterar para o e-mail do seu sócio, contador ou diretoria.
                  </p>
                </div>

                {/* Weekly Report Config (Toda segunda 8am) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-bold text-slate-900">
                          Relatório Semanal Consolidado
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Resumo da semana anterior: total de entradas, despesas e top gastos por
                        categoria.
                      </p>
                    </div>
                    <Switch checked={weeklyEnabled} onCheckedChange={setWeeklyEnabled} />
                  </div>

                  {weeklyEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Dia da Semana
                        </Label>
                        <Select value={weeklyDay} onValueChange={setWeeklyDay}>
                          <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monday">Toda Segunda-feira (Padrão)</SelectItem>
                            <SelectItem value="friday">Toda Sexta-feira</SelectItem>
                            <SelectItem value="sunday">Todo Domingo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Horário de Envio
                        </Label>
                        <Select
                          value={String(weeklyHour)}
                          onValueChange={(v) => setWeeklyHour(Number(v))}
                        >
                          <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="8">08:00 AM (Início do expediente)</SelectItem>
                            <SelectItem value="9">09:00 AM</SelectItem>
                            <SelectItem value="18">18:00 PM (Fim do dia)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Monthly Report Config (Todo dia 1) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-slate-900">
                          Relatório Mensal de Fechamento
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Fechamento do mês anterior com comparativo de orçamento executado de cada
                        obra.
                      </p>
                    </div>
                    <Switch checked={monthlyEnabled} onCheckedChange={setMonthlyEnabled} />
                  </div>

                  {monthlyEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">
                          Dia do Mês
                        </Label>
                        <Select
                          value={String(monthlyDay)}
                          onValueChange={(v) => setMonthlyDay(Number(v))}
                        >
                          <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Dia 01 de cada mês (Padrão)</SelectItem>
                            <SelectItem value="5">Dia 05 de cada mês</SelectItem>
                            <SelectItem value="10">Dia 10 de cada mês</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-600 font-semibold">Horário</Label>
                        <Select
                          value={String(monthlyHour)}
                          onValueChange={(v) => setMonthlyHour(Number(v))}
                        >
                          <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="8">08:00 AM</SelectItem>
                            <SelectItem value="9">09:00 AM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar Agendamentos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Right: Triggers & Architecture Info */}
        <div className="space-y-6">
          <Card className="bg-slate-900 text-slate-100 border-slate-800 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Disparo Imediato de Relatório
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Gere e veja o relatório em tempo real sem esperar o agendamento semanal.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Button
                onClick={() => handleTestTrigger('weekly')}
                disabled={triggering}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs justify-start"
              >
                <Calendar className="w-4 h-4 mr-2 text-amber-400" />
                Gerar Resumo Semanal (Segunda 8h)
              </Button>

              <Button
                onClick={() => handleTestTrigger('monthly')}
                disabled={triggering}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs justify-start"
              >
                <FileText className="w-4 h-4 mr-2 text-blue-400" />
                Gerar Fechamento Mensal (Dia 01)
              </Button>

              <div className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1.5 mt-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cron Engine PocketBase Pronto</span>
                </div>
                <p>
                  O backend possui endpoints dedicados em <code>/api/custom/reports/trigger</code>{' '}
                  prontos para orquestração automática.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* HTML Email Preview Modal */}
      {previewHtml && (
        <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white p-6">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600" />
                Pré-visualização do E-mail Formatado (HTML)
              </DialogTitle>
            </DialogHeader>

            <div
              className="mt-4 border rounded-lg p-2 bg-slate-50"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />

            <div className="flex justify-end pt-3">
              <Button
                size="sm"
                onClick={() => setPreviewHtml(null)}
                className="bg-slate-900 text-white"
              >
                Fechar Prévia
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
