import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth.store'
import { EstadoVazio } from '@/shared/ui/feedback'

/**
 * "Minha disponibilidade" para quem é cuidador.
 *
 * Na conta individual o titular é o próprio profissional, e mandar essa pessoa
 * navegar até a lista de cuidadores para se achar seria absurdo — o menu leva
 * direto para o cadastro dela.
 */
export default function MinhaDisponibilidadePage() {
  const caregiverId = useAuth((e) => e.usuario?.caregiverId)

  if (!caregiverId) {
    return (
      <EstadoVazio
        titulo="Seu usuário não está vinculado a um cuidador"
        descricao="Esta tela é para quem executa plantões. Para ver a disponibilidade da equipe, abra Cuidadores."
      />
    )
  }

  return <Navigate to={`/cuidadores/${caregiverId}/disponibilidade`} replace />
}
