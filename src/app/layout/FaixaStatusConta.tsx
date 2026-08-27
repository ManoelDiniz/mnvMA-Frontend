import { Link } from 'react-router-dom'
import { AlertTriangle, Clock, Lock } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { cn } from '@/shared/lib/cn'

/**
 * Faixa de estado da conta.
 *
 * Aparece só quando existe algo a dizer, e nunca esconde conteúdo — some
 * assim que a situação se resolve. O tom sobe conforme o caso fica sério, mas
 * mesmo suspenso o texto explica que os dados continuam acessíveis: quem
 * atrasou uma mensalidade não pode achar que perdeu o histórico.
 */
export function FaixaStatusConta() {
  const conta = useAuth((e) => e.conta)
  if (!conta) return null

  const aviso = avisoPara(conta.status, conta.trialDaysLeft)
  if (!aviso) return null

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 text-sm',
        aviso.classe,
      )}
    >
      <aviso.icone className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{aviso.texto}</span>
      <Link
        to="/configuracoes/assinatura"
        className="font-semibold underline underline-offset-2"
      >
        {aviso.acao}
      </Link>
    </div>
  )
}

function avisoPara(status: string, diasRestantes: number) {
  switch (status) {
    case 'TRIAL':
      // Só incomoda quando falta pouco — contador desde o dia 1 vira ruído.
      if (diasRestantes > 5) return null
      return {
        icone: Clock,
        classe: 'border-warning/30 bg-warning-soft text-warning',
        texto:
          diasRestantes <= 1
            ? 'Seu período de teste termina hoje.'
            : `Seu período de teste termina em ${diasRestantes} dias.`,
        acao: 'Ver planos',
      }

    case 'PAST_DUE':
      return {
        icone: AlertTriangle,
        classe: 'border-danger/30 bg-danger-soft text-danger',
        texto: 'Não conseguimos processar seu pagamento. Atualize os dados para continuar.',
        acao: 'Regularizar',
      }

    case 'SUSPENDED':
      return {
        icone: Lock,
        classe: 'border-danger/30 bg-danger-soft text-danger',
        texto:
          'Conta suspensa. Você continua consultando e exportando tudo — para voltar a editar, regularize a assinatura.',
        acao: 'Reativar',
      }

    case 'EXPIRED':
      return {
        icone: Lock,
        classe: 'border-warning/30 bg-warning-soft text-warning',
        // "Período gratuito" cobre os dois casos que chegam aqui: o fim do
        // teste e o fim de uma cortesia por cupom de 100%.
        texto:
          'Seu período gratuito terminou. Os dados estão salvos e disponíveis para consulta — escolha um plano para voltar a editar.',
        acao: 'Ver planos',
      }

    case 'CANCELED':
      return {
        icone: Lock,
        classe: 'border-border bg-surface-muted text-ink-muted',
        texto: 'Assinatura cancelada. Seus dados continuam disponíveis para consulta e exportação.',
        acao: 'Reativar',
      }

    default:
      return null
  }
}
