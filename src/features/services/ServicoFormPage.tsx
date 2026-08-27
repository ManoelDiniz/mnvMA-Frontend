import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CheckboxField, InputField, TextareaField } from '@/shared/ui/Field'
import { Carregando, SemPermissao } from '@/shared/ui/feedback'
import {
  ROTULO_UNIDADE,
  useAtualizarServico,
  useCriarServico,
  useRemoverServico,
  useServico,
  type UnidadeServico,
} from './servicos.api'

/** "1.234,56" ou "1234.56" → "1234.56". A API só aceita ponto decimal. */
function paraDecimal(valor: string | undefined): string | undefined {
  if (!valor) return undefined
  const limpo = valor.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  return limpo || undefined
}

const dinheiroOpcional = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(paraDecimal(v))), 'Valor inválido')

const esquema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do serviço').max(160),
  code: z.string().trim().max(30).optional(),
  unit: z.enum(['PLANTAO', 'HORA', 'DIA']),
  salePrice: z
    .string()
    .min(1, 'Informe quanto você cobra')
    .refine((v) => !Number.isNaN(Number(paraDecimal(v))), 'Valor inválido'),
  caregiverCost: dinheiroOpcional,
  hours: dinheiroOpcional,
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

type Formulario = z.infer<typeof esquema>

const UNIDADES: UnidadeServico[] = ['PLANTAO', 'HORA', 'DIA']

export default function ServicoFormPage() {
  const { id } = useParams<{ id: string }>()
  const edicao = Boolean(id)
  const navegar = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)
  const empresa = useAuth((e) => e.conta?.type === 'COMPANY')

  const { data: servico, isLoading } = useServico(id)
  const criar = useCriarServico()
  const atualizar = useAtualizarServico(id ?? '')
  const remover = useRemoverServico()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      name: '',
      code: '',
      unit: 'PLANTAO',
      salePrice: '',
      caregiverCost: '',
      hours: '',
      notes: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (!servico) return
    reset({
      name: servico.name,
      code: servico.code ?? '',
      unit: servico.unit,
      salePrice: servico.salePrice,
      caregiverCost: servico.caregiverCost ?? '',
      hours: servico.hours ?? '',
      notes: servico.notes ?? '',
      isActive: servico.isActive,
    })
  }, [servico, reset])

  const unidade = watch('unit')
  const venda = watch('salePrice')
  const custo = watch('caregiverCost')

  // Prévia local, só para orientar quem está digitando. O valor que vale é o
  // que o backend devolve depois de salvar.
  const previa = useMemo(() => {
    const v = Number(paraDecimal(venda) ?? 0)
    const c = Number(paraDecimal(custo) ?? 0)
    if (!v) return null
    const margem = v - c
    return { margem, percentual: Math.round((margem / v) * 1000) / 10 }
  }, [venda, custo])

  if (!pode('services:write') || somenteLeitura()) return <SemPermissao />
  if (edicao && isLoading) return <Carregando texto="Carregando serviço…" />

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    const payload = {
      name: dados.name,
      code: dados.code || undefined,
      unit: dados.unit,
      salePrice: paraDecimal(dados.salePrice)!,
      caregiverCost: paraDecimal(dados.caregiverCost),
      hours: paraDecimal(dados.hours),
      notes: dados.notes || undefined,
      ...(edicao ? { isActive: dados.isActive } : {}),
    }

    try {
      if (edicao) await atualizar.mutateAsync(payload)
      else await criar.mutateAsync(payload)
      void navegar('/servicos', { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          setError(campo as keyof Formulario, { message: mensagem })
        }
        return
      }
      setErroGeral(
        erro instanceof ApiError ? erro.message : 'Não conseguimos salvar. Tente de novo.',
      )
    }
  }

  async function excluir() {
    if (!servico) return
    if (!window.confirm(`Remover o serviço "${servico.name}"?`)) return
    await remover.mutateAsync(servico.id)
    void navegar('/servicos', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to="/servicos"
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para a lista de serviços"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {edicao ? 'Editar serviço' : 'Novo serviço'}
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
          <CardBody className="flex flex-col gap-4">
            <InputField
              label="Nome do serviço"
              placeholder="Cuidador 12h diurno"
              obrigatorio
              erro={errors.name?.message}
              {...register('name')}
            />

            <fieldset>
              <legend className="pb-2 text-sm font-medium text-ink">Como você cobra?</legend>
              <div className="grid grid-cols-3 gap-2">
                {UNIDADES.map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setValue('unit', valor)}
                    aria-pressed={unidade === valor}
                    className={cn(
                      'min-h-11 rounded-xl border-2 px-2 text-sm font-medium transition-colors',
                      unidade === valor
                        ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100'
                        : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-muted',
                    )}
                  >
                    {ROTULO_UNIDADE[valor].replace('por ', '')}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Valor cobrado do cliente"
                inputMode="decimal"
                placeholder="300,00"
                obrigatorio
                erro={errors.salePrice?.message}
                {...register('salePrice')}
              />
              <InputField
                label="Duração em horas"
                inputMode="decimal"
                placeholder="12"
                ajuda="Opcional. Serve para calcular o valor por hora."
                erro={errors.hours?.message}
                {...register('hours')}
              />
            </div>

            {/* Custo com cuidador só existe quando há equipe. Numa conta
                individual esse campo confundiria: o valor todo é da pessoa. */}
            {empresa && (
              <InputField
                label="Valor pago ao cuidador"
                inputMode="decimal"
                placeholder="180,00"
                ajuda="É a partir daqui que o sistema calcula sua margem em cada plantão."
                erro={errors.caregiverCost?.message}
                {...register('caregiverCost')}
              />
            )}

            <InputField
              label="Código interno"
              placeholder="CD12D"
              ajuda="Opcional. Aparece nos relatórios."
              erro={errors.code?.message}
              {...register('code')}
            />

            <TextareaField
              label="Observações"
              rows={3}
              ajuda="O que está incluso, o que não está."
              erro={errors.notes?.message}
              {...register('notes')}
            />

            {edicao && (
              <CheckboxField
                label="Serviço ativo"
                descricao="Serviços inativos não aparecem na hora de criar um plantão."
                {...register('isActive')}
              />
            )}
          </CardBody>
        </Card>

        {empresa && previa && (
          <Card>
            <CardHeader titulo="Resultado por atendimento" />
            <CardBody className="flex flex-wrap items-baseline gap-x-6 gap-y-2 pt-2">
              <span>
                <span className="block text-sm text-ink-muted">Sobra</span>
                <span
                  className={cn(
                    'tabular text-xl font-bold',
                    previa.margem >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {formatarDinheiro(previa.margem)}
                </span>
              </span>
              <span>
                <span className="block text-sm text-ink-muted">Margem</span>
                <span
                  className={cn(
                    'tabular text-xl font-bold',
                    previa.percentual >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {previa.percentual}%
                </span>
              </span>
              {previa.margem < 0 && (
                <p className="w-full text-sm text-danger">
                  Você está pagando ao cuidador mais do que cobra do cliente.
                </p>
              )}
            </CardBody>
          </Card>
        )}

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
            {edicao ? 'Salvar alterações' : 'Cadastrar serviço'}
          </Button>
        </div>
      </form>

      {edicao && (
        <Button
          variante="ghost"
          onClick={() => void excluir()}
          carregando={remover.isPending}
          iconeEsquerda={<Trash2 className="size-4" aria-hidden="true" />}
          className="self-start text-danger hover:bg-danger-soft"
        >
          Remover serviço
        </Button>
      )}
    </div>
  )
}
