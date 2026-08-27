import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useClientes } from '@/features/customers/clientes.api'
import { useServicos } from '@/features/services/servicos.api'
import { ApiError } from '@/shared/api/client'
import { formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { Carregando, SemPermissao } from '@/shared/ui/feedback'
import { hojeChave } from './calendario'
import { useAtualizarPlantao, useCriarPlantao, usePlantao } from './plantoes.api'

/** "1.234,56" → "1234.56" */
function paraDecimal(valor: string | undefined): string | undefined {
  if (!valor) return undefined
  const limpo = valor.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  return limpo || undefined
}

const esquema = z.object({
  customerId: z.string().uuid('Selecione o cliente'),
  serviceId: z.string().optional(),
  date: z.string().min(1, 'Informe a data'),
  startTime: z.string().min(1, 'Informe a hora de início'),
  endTime: z.string().min(1, 'Informe a hora de término'),
  chargeAmount: z.string().min(1, 'Informe o valor cobrado'),
  caregiverCost: z.string().optional(),
  otherCosts: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

type Formulario = z.infer<typeof esquema>

/**
 * Monta o instante a partir de data + hora locais.
 *
 * Se a hora final for menor ou igual à inicial, o plantão vira o dia: 19h→07h é
 * plantão noturno, não erro de digitação. Sem esta regra, o caso mais comum do
 * setor seria rejeitado pelo formulário.
 */
function montarPeriodo(date: string, startTime: string, endTime: string) {
  const inicio = new Date(`${date}T${startTime}:00-03:00`)
  let fim = new Date(`${date}T${endTime}:00-03:00`)
  if (fim <= inicio) fim = new Date(fim.getTime() + 86_400_000)
  return { inicio, fim }
}

export default function PlantaoFormPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const edicao = Boolean(id)
  const navegar = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)
  const empresa = useAuth((e) => e.conta?.type === 'COMPANY')

  const { data: plantao, isLoading } = usePlantao(id)
  const { data: clientes } = useClientes({ perPage: 100, status: 'active' })
  const { data: servicos } = useServicos({ status: 'active' })

  const criar = useCriarPlantao()
  const atualizar = useAtualizarPlantao(id ?? '')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      customerId: params.get('cliente') ?? '',
      serviceId: '',
      date: params.get('dia') ?? hojeChave(),
      startTime: '07:00',
      endTime: '19:00',
      chargeAmount: '',
      caregiverCost: '',
      otherCosts: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (!plantao) return
    const inicio = new Date(plantao.startsAt)
    const fim = new Date(plantao.endsAt)
    const hora = (d: Date) =>
      new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(d)

    reset({
      customerId: plantao.customerId,
      serviceId: plantao.serviceId ?? '',
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(inicio),
      startTime: hora(inicio),
      endTime: hora(fim),
      chargeAmount: plantao.chargeAmount,
      caregiverCost: plantao.caregiverCost,
      otherCosts: plantao.otherCosts,
      notes: plantao.notes ?? '',
    })
  }, [plantao, reset])

  const servicoId = watch('serviceId')
  const date = watch('date')
  const startTime = watch('startTime')
  const endTime = watch('endTime')

  // Escolher o serviço preenche os valores — mas eles continuam editáveis:
  // atendimento em feriado ou com adicional é o caso normal, não a exceção.
  useEffect(() => {
    if (!servicoId || edicao) return
    const servico = servicos?.data.find((s) => s.id === servicoId)
    if (!servico) return
    setValue('chargeAmount', servico.salePrice)
    setValue('caregiverCost', servico.caregiverCost ?? '')
  }, [servicoId, servicos, setValue, edicao])

  const duracao = useMemo(() => {
    if (!date || !startTime || !endTime) return null
    const { inicio, fim } = montarPeriodo(date, startTime, endTime)
    const horas = (fim.getTime() - inicio.getTime()) / 3_600_000
    return { horas: Math.round(horas * 100) / 100, viraODia: fim.getUTCDate() !== inicio.getUTCDate() }
  }, [date, startTime, endTime])

  if (!pode('shifts:write') || somenteLeitura()) return <SemPermissao />
  if (edicao && isLoading) return <Carregando texto="Carregando plantão…" />

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    const { inicio, fim } = montarPeriodo(dados.date, dados.startTime, dados.endTime)

    const payload = {
      customerId: dados.customerId,
      serviceId: dados.serviceId || undefined,
      startsAt: inicio.toISOString(),
      endsAt: fim.toISOString(),
      chargeAmount: paraDecimal(dados.chargeAmount),
      caregiverCost: paraDecimal(dados.caregiverCost) ?? '0',
      otherCosts: paraDecimal(dados.otherCosts) ?? '0',
      notes: dados.notes || undefined,
    }

    try {
      const salvo = edicao ? await atualizar.mutateAsync(payload) : await criar.mutateAsync(payload)
      void navegar(`/plantoes/${salvo.id}`, { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          setError(campo as keyof Formulario, { message: mensagem })
        }
        return
      }
      // Conflito de agenda merece destaque: é o erro mais comum aqui e a
      // mensagem do backend já diz com quem é o choque.
      setErroGeral(
        erro instanceof ApiError ? erro.message : 'Não conseguimos salvar. Tente de novo.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to="/agenda"
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para a agenda"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {edicao ? 'Editar plantão' : 'Novo plantão'}
        </h1>
      </header>

      <form onSubmit={(e) => void handleSubmit(enviar)(e)} className="flex flex-col gap-4" noValidate>
        {erroGeral && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            {erroGeral}
          </p>
        )}

        <Card>
          <CardHeader titulo="Quem e quando" />
          <CardBody className="flex flex-col gap-4">
            <Selecao
              label="Cliente"
              obrigatorio
              erro={errors.customerId?.message}
              placeholder="Escolha o cliente"
              opcoes={(clientes?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
              {...register('customerId')}
            />

            <Selecao
              label="Serviço"
              ajuda="Preenche os valores automaticamente. Você pode ajustar depois."
              placeholder="Sem serviço definido"
              erro={errors.serviceId?.message}
              opcoes={(servicos?.data ?? []).map((s) => ({
                valor: s.id,
                rotulo: `${s.name} — ${formatarDinheiro(s.salePrice)}`,
              }))}
              {...register('serviceId')}
            />

            <InputField
              label="Data"
              type="date"
              obrigatorio
              erro={errors.date?.message}
              {...register('date')}
            />

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Início"
                type="time"
                obrigatorio
                erro={errors.startTime?.message}
                {...register('startTime')}
              />
              <InputField
                label="Término"
                type="time"
                obrigatorio
                erro={errors.endTime?.message}
                {...register('endTime')}
              />
            </div>

            {duracao && (
              <p className="text-sm text-ink-muted">
                Duração: <span className="tabular font-medium text-ink">{duracao.horas}h</span>
                {duracao.viraODia && ' · termina no dia seguinte'}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader titulo="Valores" />
          <CardBody className="flex flex-col gap-4">
            <InputField
              label="Valor cobrado do cliente"
              inputMode="decimal"
              placeholder="300,00"
              obrigatorio
              erro={errors.chargeAmount?.message}
              {...register('chargeAmount')}
            />

            {empresa && (
              <>
                <InputField
                  label="Valor pago ao cuidador"
                  inputMode="decimal"
                  placeholder="180,00"
                  erro={errors.caregiverCost?.message}
                  {...register('caregiverCost')}
                />
                <InputField
                  label="Outros custos"
                  inputMode="decimal"
                  placeholder="0,00"
                  ajuda="Transporte, alimentação, material deste plantão."
                  erro={errors.otherCosts?.message}
                  {...register('otherCosts')}
                />
              </>
            )}

            <TextareaField
              label="Observações"
              rows={3}
              erro={errors.notes?.message}
              {...register('notes')}
            />
          </CardBody>
        </Card>

        <div className="sticky bottom-20 z-sticky flex gap-3 rounded-card border border-border bg-surface p-3 shadow-raised lg:static lg:bottom-auto lg:shadow-none">
          <Button
            variante="secondary"
            onClick={() => navegar(-1)}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" carregando={isSubmitting} className="flex-[2]">
            {edicao ? 'Salvar alterações' : 'Agendar plantão'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/**
 * Select nativo, de propósito.
 *
 * No celular ele abre a roda nativa do sistema, que é maior, funciona com uma
 * mão só e já é familiar. Um combobox customizado ficaria mais bonito e seria
 * pior de usar exatamente para o público deste app.
 */
