import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, CalendarClock, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { ApiError } from '@/shared/api/client'
import { apenasDigitos, mascararCpf, mascararTelefone } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CheckboxField, InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { Carregando, SemPermissao } from '@/shared/ui/feedback'
import {
  TIPOS_CONTRATO,
  useAtualizarCuidador,
  useCriarCuidador,
  useCuidador,
  useRemoverCuidador,
} from './cuidadores.api'

const esquema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || apenasDigitos(v).length === 11, 'CPF incompleto'),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  birthDate: z.string().optional(),
  contractType: z.string().optional(),
  hourlyRate: z.string().optional(),
  shiftRate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

type Formulario = z.infer<typeof esquema>

export default function CuidadorFormPage() {
  const { id } = useParams<{ id: string }>()
  const edicao = Boolean(id)
  const navegar = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const { data: cuidador, isLoading } = useCuidador(id)
  const criar = useCriarCuidador()
  const atualizar = useAtualizarCuidador(id ?? '')
  const remover = useRemoverCuidador()

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
      cpf: '',
      phone: '',
      email: '',
      birthDate: '',
      contractType: '',
      hourlyRate: '',
      shiftRate: '',
      notes: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (!cuidador) return
    reset({
      name: cuidador.name,
      cpf: cuidador.cpf ? mascararCpf(cuidador.cpf) : '',
      phone: cuidador.phone ? mascararTelefone(cuidador.phone) : '',
      email: cuidador.email ?? '',
      birthDate: cuidador.birthDate ?? '',
      contractType: cuidador.contractType ?? '',
      hourlyRate: cuidador.hourlyRate ?? '',
      shiftRate: cuidador.shiftRate ?? '',
      notes: cuidador.notes ?? '',
      isActive: cuidador.isActive,
    })
  }, [cuidador, reset])

  if (!pode('caregivers:write') || somenteLeitura()) return <SemPermissao />
  if (edicao && isLoading) return <Carregando texto="Carregando cuidador…" />

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    const payload = {
      name: dados.name,
      cpf: apenasDigitos(dados.cpf) || undefined,
      phone: apenasDigitos(dados.phone) || undefined,
      email: dados.email || undefined,
      birthDate: dados.birthDate || undefined,
      contractType: dados.contractType || undefined,
      hourlyRate: dados.hourlyRate?.replace(',', '.') || undefined,
      shiftRate: dados.shiftRate?.replace(',', '.') || undefined,
      notes: dados.notes || undefined,
      ...(edicao ? { isActive: dados.isActive } : {}),
    }

    try {
      if (edicao) await atualizar.mutateAsync(payload)
      else await criar.mutateAsync(payload)
      void navegar('/cuidadores', { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          setError(campo as keyof Formulario, { message: mensagem })
        }
        return
      }
      setErroGeral(erro instanceof ApiError ? erro.message : 'Não conseguimos salvar.')
    }
  }

  async function excluir() {
    if (!cuidador) return
    if (!window.confirm(`Remover ${cuidador.name} da equipe?`)) return
    try {
      await remover.mutateAsync(cuidador.id)
      void navegar('/cuidadores', { replace: true })
    } catch (erro) {
      setErroGeral(erro instanceof ApiError ? erro.message : 'Não conseguimos remover.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to="/cuidadores"
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para a lista de cuidadores"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {edicao ? 'Editar cuidador' : 'Novo cuidador'}
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
          <CardHeader titulo="Dados do profissional" />
          <CardBody className="flex flex-col gap-4">
            <InputField
              label="Nome completo"
              autoCapitalize="words"
              obrigatorio
              erro={errors.name?.message}
              {...register('name')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="CPF"
                inputMode="numeric"
                placeholder="000.000.000-00"
                erro={errors.cpf?.message}
                {...register('cpf')}
                onChange={(e) => setValue('cpf', mascararCpf(e.target.value))}
                value={watch('cpf') ?? ''}
              />
              <InputField
                label="Data de nascimento"
                type="date"
                erro={errors.birthDate?.message}
                {...register('birthDate')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Telefone"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                erro={errors.phone?.message}
                {...register('phone')}
                onChange={(e) => setValue('phone', mascararTelefone(e.target.value))}
                value={watch('phone') ?? ''}
              />
              <InputField
                label="E-mail"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                erro={errors.email?.message}
                {...register('email')}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Contratação e valores"
            descricao="É daqui que sai o custo de cada plantão — e, com ele, a sua margem."
          />
          <CardBody className="flex flex-col gap-4">
            <Selecao
              label="Tipo de contratação"
              placeholder="Não informado"
              erro={errors.contractType?.message}
              opcoes={Object.entries(TIPOS_CONTRATO).map(([valor, rotulo]) => ({ valor, rotulo }))}
              {...register('contractType')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Valor por hora"
                inputMode="decimal"
                placeholder="25,00"
                erro={errors.hourlyRate?.message}
                {...register('hourlyRate')}
              />
              <InputField
                label="Valor por plantão"
                inputMode="decimal"
                placeholder="180,00"
                erro={errors.shiftRate?.message}
                {...register('shiftRate')}
              />
            </div>

            <TextareaField
              label="Observações"
              rows={3}
              ajuda="Especialidades, restrições, preferências de escala."
              erro={errors.notes?.message}
              {...register('notes')}
            />

            {edicao && !cuidador?.isOwner && (
              <CheckboxField
                label="Cuidador ativo"
                descricao="Inativos não aparecem na hora de montar a escala."
                {...register('isActive')}
              />
            )}
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
            {edicao ? 'Salvar alterações' : 'Cadastrar cuidador'}
          </Button>
        </div>
      </form>

      {edicao && pode('availability:read') && (
        <Link
          to={`/cuidadores/${id}/disponibilidade`}
          className={estilosBotao({ variante: 'secondary', className: 'gap-2 self-start' })}
        >
          <CalendarClock className="size-4" aria-hidden="true" />
          Disponibilidade e bloqueios
        </Link>
      )}

      {edicao && !cuidador?.isOwner && pode('caregivers:delete') && (
        <Button
          variante="ghost"
          onClick={() => void excluir()}
          carregando={remover.isPending}
          iconeEsquerda={<Trash2 className="size-4" aria-hidden="true" />}
          className="self-start text-danger hover:bg-danger-soft"
        >
          Remover da equipe
        </Button>
      )}
    </div>
  )
}
