import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chavesPlantoes } from '@/features/shifts/plantoes.api'
import type { StatusPlantao } from '@/features/shifts/plantoes.api'
import { api, query } from '@/shared/api/client'

export interface PlantaoNaGrade {
  id: string
  customerId: string
  customerName: string
  serviceName: string | null
  startsAt: string
  endsAt: string
  /** Hora local já resolvida pelo backend — o painel não recalcula fuso. */
  startTime: string
  endTime: string
  status: StatusPlantao
  overnight: boolean
  hours: number
  chargeAmount: string
  caregiverCost: string
}

export interface CelulaDaGrade {
  date: string
  shifts: PlantaoNaGrade[]
  hours: number
}

export interface LinhaDaGrade {
  /** Nulo na linha dos plantões descobertos. */
  caregiverId: string | null
  caregiverName: string
  isActive: boolean
  cells: CelulaDaGrade[]
  totalShifts: number
  totalHours: number
  totalCost: string
}

export interface DiaDaGrade {
  date: string
  weekday: number
  weekdayLabel: string
  dayLabel: string
  isWeekend: boolean
}

export interface GradeDaEscala {
  from: string
  to: string
  days: DiaDaGrade[]
  rows: LinhaDaGrade[]
  /** Plantões sem cuidador. Vem sempre, mesmo vazia. */
  uncovered: LinhaDaGrade
  totalShifts: number
  totalHours: number
  uncoveredShifts: number
  chargeTotal: string
  costTotal: string
}

export interface CopiaDeSemana {
  sourceWeekStart: string
  targetWeekStart: string
  repeat?: number
  keepCaregivers?: boolean
}

export interface ResultadoDaCopia {
  created: number
  skipped: number
  conflicts: number
  /** O que não deu, em texto legível. Conflito não interrompe a rodada. */
  warnings: string[]
}

export const chavesEscalas = {
  todos: ['escalas'] as const,
  grade: (filtro: object) => [...chavesEscalas.todos, 'grade', filtro] as const,
}

export function useGradeDaEscala(filtro: {
  from: string
  to: string
  customerId?: string
  includeInactive?: boolean
}) {
  return useQuery({
    queryKey: chavesEscalas.grade(filtro),
    queryFn: ({ signal }) => api.get<GradeDaEscala>(`/schedules${query(filtro)}`, { signal }),
    // Sem isto a grade inteira pisca a cada troca de semana, e navegar de
    // semana em semana é o gesto mais repetido desta tela.
    placeholderData: (anterior) => anterior,
  })
}

export function useCopiarSemana() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: CopiaDeSemana) => api.post<ResultadoDaCopia>('/schedules/copy-week', dados),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: chavesEscalas.todos })
      // A cópia cria plantões de verdade: a agenda precisa saber.
      void cache.invalidateQueries({ queryKey: chavesPlantoes.todos })
    },
  })
}
