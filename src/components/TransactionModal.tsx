import { useState, useEffect } from 'react'
import { Obra, TransactionCategory, TransactionType } from '@/types'
import { transactionsService } from '@/services/transactions'
import { botService } from '@/services/botAndReports'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Sparkles,
  Upload,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
} from 'lucide-react'
import { CATEGORY_LABELS } from '@/types'

interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  obras: Obra[]
  defaultObraId?: string | null
  onSaved: () => void
}

export function TransactionModal({
  open,
  onOpenChange,
  obras,
  defaultObraId,
  onSaved,
}: TransactionModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [obraId, setObraId] = useState(defaultObraId || '')
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<TransactionCategory>('other')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)
  const [autoDetectedKeywords, setAutoDetectedKeywords] = useState<string[]>([])

  useEffect(() => {
    if (defaultObraId) {
      setObraId(defaultObraId)
    } else if (obras.length > 0 && !obraId) {
      setObraId(obras[0].id)
    }
  }, [defaultObraId, obras])

  // Handle Description change and trigger intelligent auto-categorization
  const handleDescriptionChange = (val: string) => {
    setDescription(val)
    if (val.trim().length > 3) {
      const detected = botService.categorizeText(val)
      if (detected.confidence > 0.6) {
        setCategory(detected.category)
        if (detected.type) setType(detected.type)
        if (detected.amount && (!amount || amount === '0')) {
          setAmount(detected.amount.toString())
        }
        setAutoDetectedKeywords(detected.matchedKeywords)
      } else {
        setAutoDetectedKeywords([])
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setFilePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setFilePreview(null)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!obraId) {
      toast({
        title: 'Obra necessária',
        description: 'Selecione uma obra para este lançamento.',
        variant: 'destructive',
      })
      return
    }
    const parsedAmt = parseFloat(amount)
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor numérico positivo.',
        variant: 'destructive',
      })
      return
    }
    if (!description.trim()) {
      toast({
        title: 'Descrição necessária',
        description: 'Informe o que foi pago ou recebido.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await transactionsService.create({
        obra_id: obraId,
        type,
        amount: parsedAmt,
        category,
        description,
        date: new Date(date).toISOString(),
        receipt_file: receiptFile,
        source: 'manual',
        raw_bot_text: description,
        notes,
      })

      toast({
        title: 'Lançamento registrado!',
        description: `Transação de R$ ${parsedAmt.toFixed(2)} salva com sucesso.`,
      })

      // Reset form
      setAmount('')
      setDescription('')
      setReceiptFile(null)
      setFilePreview(null)
      setNotes('')
      setAutoDetectedKeywords([])
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar',
        description: err.message || 'Falha ao salvar a transação.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Novo Lançamento Financeiro
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Registre uma despesa ou receita da obra com categorização e comprovante.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Obra and Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="obra" className="text-slate-700 font-medium">
                Obra / Projeto *
              </Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger id="obra">
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
              <Label className="text-slate-700 font-medium">Tipo de Transação</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={type === 'expense' ? 'default' : 'outline'}
                  onClick={() => setType('expense')}
                  className={
                    type === 'expense'
                      ? 'bg-red-600 hover:bg-red-700 text-white font-semibold'
                      : 'border-slate-300 text-slate-700'
                  }
                >
                  <ArrowDownCircle className="w-4 h-4 mr-1.5 text-red-300" />
                  Saída / Despesa
                </Button>
                <Button
                  type="button"
                  variant={type === 'income' ? 'default' : 'outline'}
                  onClick={() => setType('income')}
                  className={
                    type === 'income'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                      : 'border-slate-300 text-slate-700'
                  }
                >
                  <ArrowUpCircle className="w-4 h-4 mr-1.5 text-emerald-300" />
                  Entrada / Receita
                </Button>
              </div>
            </div>
          </div>

          {/* Value and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-slate-700 font-medium">
                Valor (R$) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 1450.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="text-lg font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-slate-700 font-medium">
                Data da Transação *
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Description with Auto-Categorization */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="desc" className="text-slate-700 font-medium">
                Descrição detalhada *
              </Label>
              {autoDetectedKeywords.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>IA detectou: {autoDetectedKeywords.join(', ')}</span>
                </div>
              )}
            </div>
            <Input
              id="desc"
              placeholder="Ex: Compra de 50 sacos de cimento e areia para fundação"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              required
            />
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-slate-700 font-medium">
              Categoria
            </Label>
            <Select value={category} onValueChange={(val: TransactionCategory) => setCategory(val)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Receipt Upload & Preview */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Comprovante / Recibo (Foto ou PDF)</Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <Upload className="w-6 h-6 text-slate-400" />
                <p className="text-sm text-slate-600">
                  {receiptFile ? (
                    <span className="font-semibold text-emerald-600">
                      Arquivo selecionado: {receiptFile.name} (
                      {(receiptFile.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : (
                    <span>Clique ou arraste o comprovante (recibo, cupom fiscal, fatura)</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  Formatos aceitos: JPG, PNG, WEBP, PDF (até 10MB)
                </p>
              </div>
            </div>
            {filePreview && (
              <div className="mt-2 flex items-center gap-3 p-2 border rounded-md bg-slate-50">
                <img
                  src={filePreview}
                  alt="Comprovante"
                  className="w-16 h-16 object-cover rounded border"
                />
                <span className="text-xs text-slate-600">Pré-visualização da foto do recibo</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="txNotes" className="text-slate-700 font-medium">
              Observações Adicionais (Opcional)
            </Label>
            <Textarea
              id="txNotes"
              placeholder="Número de nota fiscal, fornecedor, forma de pagamento (PIX, boleto)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Lançamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
