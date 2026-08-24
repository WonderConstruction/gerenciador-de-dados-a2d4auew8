import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  HardHat,
  Building2,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Bot,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function AuthModal() {
  const { login, register, loginAsDemo } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('obrunolimaus@gmail.com')
  const [loginPassword, setLoginPassword] = useState('Skip@Pass')

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await login(loginEmail, loginPassword)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Autenticação realizada com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro de autenticação',
        description: err.message || 'Verifique seu e-mail e senha.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await register(regName, regEmail, regPassword)
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Sua conta no Gerenciador de Obras está pronta.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro no cadastro',
        description: err.message || 'Não foi possível concluir o cadastro.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemo = async () => {
    setIsLoading(true)
    try {
      await loginAsDemo()
      toast({
        title: 'Acesso Rápido Liberado',
        description: 'Logado como Bruno Lima (Gestor de Obras).',
      })
    } catch (err: any) {
      toast({
        title: 'Erro no acesso rápido',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left hero info */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium">
            <HardHat className="w-4 h-4" />
            <span>Automação Financeira para Construção Civil</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Gerenciador de Obras
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              Envie fotos de recibos via <strong>WhatsApp</strong> ou <strong>Telegram</strong>.
              Nossa IA categoriza custos automaticamente, alimenta suas planilhas e atualiza o
              dashboard do cliente em tempo real.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Controle Multi-Obra:</strong> Cada cliente e projeto possui dashboard e
                planilha independentes.
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <Bot className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Categorização Automática:</strong> Frame, labor, electrical, plumbing,
                materials e mais.
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Relatórios Automáticos:</strong> Resumos semanais (segunda 8h) e mensais no
                seu e-mail.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDemo}
              disabled={isLoading}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold border-amber-400 shadow-lg shadow-amber-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4 mr-2" />
              )}
              Entrar como Demonstração (1 Clique)
            </Button>
          </div>
        </div>

        {/* Right card form */}
        <div>
          <Card className="bg-slate-900/90 border-slate-700 backdrop-blur-md shadow-2xl text-slate-100">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl text-white">Acesse o Sistema</CardTitle>
              <CardDescription className="text-slate-400">
                Entre com sua conta de gestor para gerenciar seus projetos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-800 text-slate-400 mb-6">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-medium"
                  >
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-medium"
                  >
                    Cadastrar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-200">
                        E-mail
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-slate-200">
                          Senha
                        </Label>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Acessar Painel
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name" className="text-slate-200">
                        Nome Completo
                      </Label>
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="Eng. João Silva"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="text-slate-200">
                        E-mail Corporativo
                      </Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="joao@construtora.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-pass" className="text-slate-200">
                        Senha (mínimo 8 caracteres)
                      </Label>
                      <Input
                        id="reg-pass"
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 mr-2" />
                      )}
                      Criar Conta de Gestor
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="border-t border-slate-800/80 pt-4 text-xs text-slate-400 text-center flex justify-center">
              Acesso seguro com criptografia e armazenamento Skip Cloud PocketBase
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
