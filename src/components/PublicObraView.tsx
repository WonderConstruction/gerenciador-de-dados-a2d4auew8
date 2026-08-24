import { useState, useEffect } from 'react'
import { Obra, Transaction } from '@/types'
import { obrasService } from '@/services/obras'
import { transactionsService } from '@/services/transactions'
import { ObraDashboard } from '@/components/ObraDashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HardHat, Lock, Loader2, Building2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PublicObraViewProps {
  shareToken: string
}

export function PublicObraView({ shareToken }: PublicObraViewProps) {
  const { toast } = useToast()
  const [obra, setObra] = useState<Obra | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [inputPassword, setInputPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    loadPublicData()
  }, [shareToken])

  const loadPublicData = async () => {
    setLoading(true)
    try {
      const foundObra = await obrasService.getByShareToken(shareToken)
      if (!foundObra) {
        // Fallback: search by id directly
        try {
          const direct = await obrasService.getById(shareToken)
          setObra(direct)
          if (direct.share_password) {
            setPasswordRequired(true)
          } else {
            setUnlocked(true)
            const txs = await transactionsService.getByObra(direct.id)
            setTransactions(txs)
          }
        } catch {
          setObra(null)
        }
      } else {
        setObra(foundObra)
        if (foundObra.share_password) {
          setPasswordRequired(true)
        } else {
          setUnlocked(true)
          const txs = await transactionsService.getByObra(foundObra.id)
          setTransactions(txs)
        }
      }
    } catch (err) {
      console.error('Error loading public obra:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!obra) return

    if (obra.share_password && inputPassword !== obra.share_password) {
      toast({
        title: 'Senha incorreta',
        description: 'A senha digitada não confere com a chave do projeto.',
        variant: 'destructive',
      })
      return
    }

    setUnlocked(true)
    setPasswordRequired(false)
    try {
      const txs = await transactionsService.getByObra(obra.id)
      setTransactions(txs)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
        <p className="text-sm font-medium text-slate-600">Carregando painel do cliente...</p>
      </div>
    )
  }

  if (!obra) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <Card className="max-w-md w-full p-6 bg-white border-slate-200 shadow-md">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Obra Não Encontrada</h2>
          <p className="text-xs text-slate-500 mt-2 mb-4">
            O link de compartilhamento pode estar incorreto ou o projeto foi arquivado pelo gestor.
          </p>
          <Button
            onClick={() => {
              window.location.search = ''
            }}
            className="w-full bg-slate-900 text-amber-400 font-semibold"
          >
            Voltar ao Início
          </Button>
        </Card>
      </div>
    )
  }

  if (passwordRequired && !unlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-slate-100">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700 text-slate-100 shadow-2xl">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-bold text-white">Área Restrita do Cliente</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              O projeto <strong>{obra.name}</strong> é protegido por senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-xs text-slate-300">
                  Senha de Acesso
                </Label>
                <Input
                  id="pass"
                  type="password"
                  placeholder="••••••••"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  required
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                Acessar Painel da Obra
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Brand Bar for Client View */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900 block leading-tight">
                Gerenciador de Obras
              </span>
              <span className="text-[11px] text-slate-500">Portal de Transparência do Cliente</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.search = ''
            }}
            className="text-xs text-slate-600"
          >
            Acesso do Gestor
          </Button>
        </div>

        <ObraDashboard
          obra={obra}
          transactions={transactions}
          onBack={() => {}}
          onOpenNewTransaction={() => {}}
          onEditObra={() => {}}
          onTransactionDeleted={() => {}}
          isPublicView={true}
        />
      </div>
    </div>
  )
}
