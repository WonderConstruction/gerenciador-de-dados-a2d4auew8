import { useState } from 'react'
import { Obra, ObraStatus } from '@/types'
import { obrasService } from '@/services/obras'
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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface ObraModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  obraToEdit?: Obra | null
  onSaved: (savedObra: Obra) => void
}

export function ObraModal({ open, onOpenChange, obraToEdit, onSaved }: ObraModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState(obraToEdit?.name || '')
  const [clientName, setClientName] = useState(obraToEdit?.client_name || '')
  const [clientEmail, setClientEmail] = useState(obraToEdit?.client_email || '')
  const [clientPhone, setClientPhone] = useState(obraToEdit?.client_phone || '')
  const [totalBudget, setTotalBudget] = useState(obraToEdit?.total_budget?.toString() || '')
  const [status, setStatus] = useState<ObraStatus>(obraToEdit?.status || 'em_andamento')
  const [address, setAddress] = useState(obraToEdit?.address || '')
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(obraToEdit?.google_sheets_url || '')
  const [notes, setNotes] = useState(obraToEdit?.notes || '')
  const [sharePassword, setSharePassword] = useState(obraToEdit?.share_password || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome da obra.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const payload: Partial<Obra> = {
        name,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        total_budget: totalBudget ? parseFloat(totalBudget) : 0,
        status,
        address,
        google_sheets_url: googleSheetsUrl,
        notes,
        share_password: sharePassword,
      }

      let res: Obra
      if (obraToEdit) {
        res = await obrasService.update(obraToEdit.id, payload)
        toast({ title: 'Obra atualizada!', description: `"${res.name}" foi salva com sucesso.` })
      } else {
        res = await obrasService.create(payload)
        toast({
          title: 'Obra criada!',
          description: `"${res.name}" está pronta para receber lançamentos.`,
        })
      }
      onSaved(res)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar obra',
        description: err.message || 'Verifique os dados informados.',
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
          <DialogTitle className="text-xl font-bold text-slate-900">
            {obraToEdit ? 'Editar Obra / Projeto' : 'Nova Obra / Projeto'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Cadastre os dados da obra, orçamento total e configurações de compartilhamento com o
            cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name" className="text-slate-700 font-medium">
                Nome da Obra *
              </Label>
              <Input
                id="name"
                placeholder="Ex: Residencial Alphaville - Casa 42"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="totalBudget" className="text-slate-700 font-medium">
                Orçamento Total (R$)
              </Label>
              <Input
                id="totalBudget"
                type="number"
                placeholder="Ex: 250000"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-slate-700 font-medium">
                Status da Obra
              </Label>
              <Select value={status} onValueChange={(val: ObraStatus) => setStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejamento">Em Planejamento</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientName" className="text-slate-700 font-medium">
                Nome do Cliente
              </Label>
              <Input
                id="clientName"
                placeholder="Ex: Carlos Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientEmail" className="text-slate-700 font-medium">
                E-mail do Cliente
              </Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="carlos@exemplo.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientPhone" className="text-slate-700 font-medium">
                WhatsApp / Telefone Cliente
              </Label>
              <Input
                id="clientPhone"
                placeholder="+55 (11) 98765-4321"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-slate-700 font-medium">
                Endereço da Obra
              </Label>
              <Input
                id="address"
                placeholder="Rua, Número, Bairro, Cidade"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="googleSheetsUrl" className="text-slate-700 font-medium">
                Link da Planilha Google Sheets (Opcional)
              </Label>
              <Input
                id="googleSheetsUrl"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={googleSheetsUrl}
                onChange={(e) => setGoogleSheetsUrl(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Cada obra pode ter sua própria planilha vinculada para sincronização.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sharePassword" className="text-slate-700 font-medium">
                Senha do Link Público (Opcional)
              </Label>
              <Input
                id="sharePassword"
                type="text"
                placeholder="Deixe em branco para acesso direto via link"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes" className="text-slate-700 font-medium">
                Observações / Detalhes do Projeto
              </Label>
              <Textarea
                id="notes"
                placeholder="Escopo da obra, especificações técnicas, prazos de entrega..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
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
              {obraToEdit ? 'Salvar Alterações' : 'Criar Obra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
