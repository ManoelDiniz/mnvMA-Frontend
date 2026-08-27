import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { ApiError } from '@/shared/api/client'
import { apenasDigitos, mascararCpf, mascararTelefone } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CheckboxField, InputField, TextareaField } from '@/shared/ui/Field'
import { Carregando, SemPermissao } from '@/shared/ui/feedback'
import { useAuth } from '@/features/auth/auth.store'
import { useAtualizarCliente, useCliente, useCriarCliente } from './clientes.api'

const responsavelEsquema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Informe o nome do responsável').max(120),
  relationship: z.string().trim().max(60).optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
  isFinancial: z.boolean().optional(),
  isEmergency: z.boolean().optional(),
})

const esquema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente').max(160),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || apenasDigitos(v).length === 11, 'CPF incompleto'),
  birthDate: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  notes: z.string().max(4000).optional(),
  responsibles: z.array(responsavelEsquema),
})

type Formulario = z.infer<typeof esquema>

const VAZIO: Formulario = {
  name: '',
  cpf: '',
  birthDate: '',
  phone: '',
  email: '',
  notes: '',
  responsibles: [],
}

export default function ClienteFormPage() {
  const { id } = useParams<{ id: string }>()
  const edicao = Boolean(id)
  const navegar = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const { data: cliente, isLoading } = useCliente(id)
  const criar = useCriarCliente()
  const atualizar = useAtualizarCliente(id ?? '')

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({ resolver: zodResolver(esquema), defaultValues: VAZIO })

  const { fields, append, remove } = useFieldArray({ control, name: 'responsibles' })

  useEffect(() => {
    if (!cliente) return
    reset({
      name: cliente.name,
      cpf: cliente.cpf ? mascararCpf(cliente.cpf) : '',
      birthDate: cliente.birthDate ?? '',
      phone: cliente.phone ? mascararTelefone(cliente.phone) : '',
      email: cliente.email ?? '',
      notes: cliente.notes ?? '',
      responsibles: (cliente.responsibles ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        relationship: r.relationship ?? '',
        phone: r.phone ? mascararTelefone(r.phone) : '',
        email: r.email ?? '',
        isPrimary: r.isPrimary,
        isFinancial: r.isFinancial,
        isEmergency: r.isEmergency,
      })),
    })
  }, [cliente, reset])

  if (!pode('customers:write') || somenteLeitura()) return <SemPermissao />
  if (edicao && isLoading) return <Carregando texto="Carregando cliente…" />

  async function enviar(dados: Formulario) {
    setErroGeral(null)

    // Máscaras são só para os olhos: a API recebe dígitos e campo vazio some.
    const payload = {
      name: dados.name,
      cpf: apenasDigitos(dados.cpf) || undefined,
      birthDate: dados.birthDate || undefined,
      phone: apenasDigitos(dados.phone) || undefined,
      email: dados.email || undefined,
      notes: dados.notes || undefined,
      responsibles: dados.responsibles.map((r) => ({
        id: r.id,
        name: r.name,
        relationship: r.relationship || undefined,
        phone: apenasDigitos(r.phone) || undefined,
        email: r.email || undefined,
        isPrimary: r.isPrimary ?? false,
        isFinancial: r.isFinancial ?? false,
        isEmergency: r.isEmergency ?? false,
      })),
    }

    try {
      const salvo = edicao
        ? await atualizar.mutateAsync(payload)
        : await criar.mutateAsync(payload)
      void navegar(`/clientes/${salvo.id}`, { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          const raiz = campo.split('.')[0] as keyof Formulario
          if (raiz in VAZIO) setError(raiz, { message: mensagem })
        }
        return
      }
      setErroGeral(
        erro instanceof ApiError ? erro.message : 'Não conseguimos salvar. Tente de novo.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to="/clientes"
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para a lista de clientes"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {edicao ? 'Editar cliente' : 'Novo cliente'}
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
          <CardHeader titulo="Dados do cliente" />
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

            <TextareaField
              label="Observações de cuidado"
              ajuda="Rotina, medicações, restrições, preferências — o que o cuidador precisa saber."
              erro={errors.notes?.message}
              {...register('notes')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Responsáveis"
            descricao="Familiares e contatos. Quem recebe a cobrança pode não ser quem se aciona numa emergência."
          />
          <CardBody className="flex flex-col gap-4">
            {fields.length === 0 && (
              <p className="text-ink-muted">Nenhum responsável cadastrado ainda.</p>
            )}

            {fields.map((campo, indice) => (
              <fieldset
                key={campo.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <legend className="text-sm font-semibold text-ink-muted">
                    Responsável {indice + 1}
                  </legend>
                  <button
                    type="button"
                    onClick={() => remove(indice)}
                    className="touch-target grid place-items-center rounded-lg text-danger hover:bg-danger-soft"
                    aria-label={`Remover responsável ${indice + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="Nome"
                    obrigatorio
                    erro={errors.responsibles?.[indice]?.name?.message}
                    {...register(`responsibles.${indice}.name`)}
                  />
                  <InputField
                    label="Parentesco"
                    placeholder="Filha, filho, sobrinha…"
                    {...register(`responsibles.${indice}.relationship`)}
                  />
                  <InputField
                    label="Telefone"
                    inputMode="tel"
                    {...register(`responsibles.${indice}.phone`)}
                  />
                  <InputField
                    label="E-mail"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    erro={errors.responsibles?.[indice]?.email?.message}
                    {...register(`responsibles.${indice}.email`)}
                  />
                </div>

                <div className="flex flex-col">
                  <CheckboxField
                    label="Contato principal"
                    {...register(`responsibles.${indice}.isPrimary`)}
                  />
                  <CheckboxField
                    label="Responsável financeiro"
                    descricao="Recebe as cobranças"
                    {...register(`responsibles.${indice}.isFinancial`)}
                  />
                  <CheckboxField
                    label="Contato de emergência"
                    {...register(`responsibles.${indice}.isEmergency`)}
                  />
                </div>
              </fieldset>
            ))}

            <Button
              variante="secondary"
              onClick={() =>
                append({
                  name: '',
                  relationship: '',
                  phone: '',
                  email: '',
                  isPrimary: fields.length === 0,
                  isFinancial: fields.length === 0,
                  isEmergency: false,
                })
              }
              iconeEsquerda={<Plus className="size-4" aria-hidden="true" />}
            >
              Adicionar responsável
            </Button>
          </CardBody>
        </Card>

        {/* Barra de ação fixa no rodapé do celular: em formulário longo, rolar
            até o fim para achar "Salvar" é o caminho mais curto para desistir. */}
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
            {edicao ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </div>
      </form>
    </div>
  )
}
