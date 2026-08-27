import { create } from 'zustand'
import { ApiError } from '@/shared/api/client'

export interface LimiteAtingido {
  /** `customers`, `caregivers`, `users`, `shiftsPerMonth`. */
  recurso: string
  limite: number | null
  usado: number | null
  planoNome: string | null
  mensagem: string
}

interface EstadoLimite {
  atual: LimiteAtingido | null
  registrar: (erro: unknown) => boolean
  fechar: () => void
}

const ROTULOS: Record<string, string> = {
  customers: 'clientes',
  caregivers: 'cuidadores',
  users: 'usuários',
  shiftsPerMonth: 'plantões neste mês',
}

export function rotuloDoRecurso(recurso: string): string {
  return ROTULOS[recurso] ?? 'registros'
}

/**
 * O 402 que vira convite ao upgrade.
 *
 * Fica num store global, e não no `catch` de cada tela, por um motivo prático:
 * o limite pode estourar em qualquer criação — cliente, cuidador, usuário,
 * plantão — e replicar o tratamento em cada formulário garantiria que um deles
 * ficasse de fora, mostrando ao cliente um erro seco onde deveria haver um
 * caminho. Aqui é um lugar só, alimentado pelo `MutationCache` do react-query.
 */
export const useLimiteDoPlano = create<EstadoLimite>((set) => ({
  atual: null,

  /** Devolve `true` quando reconheceu o erro como limite de plano. */
  registrar(erro) {
    if (!(erro instanceof ApiError) || !erro.isLimiteDoPlano) return false

    const extra = erro.extra
    set({
      atual: {
        recurso: typeof extra.resource === 'string' ? extra.resource : 'registros',
        limite: typeof extra.limit === 'number' ? extra.limit : null,
        usado: typeof extra.used === 'number' ? extra.used : null,
        planoNome: typeof extra.planName === 'string' ? extra.planName : null,
        mensagem: erro.message,
      },
    })
    return true
  },

  fechar: () => set({ atual: null }),
}))
