import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useCaregivers } from '@/features/caregivers/cuidadores.api'
import { useClientes } from '@/features/customers/clientes.api'
import { hojeChave } from '@/features/shifts/calendario'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody } from '@/shared/ui/Card'
import { InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { SemPermissao } from '@/shared/ui/feedback'
import { CATEGORIAS, useCriarLancamento, type LadoFinanceiro } from './financeiro.api'

const esquema = z.object({
  customerId: z.string().optional(),
  caregiverId: z.string().optional(),
  supplier: z.string().max(160).optional(),
  category: z.string().optional(),
  description: z.string().trim().min(2, 'Informe a descrição').max(200),
  amount: z.string().min(1, 'Informe o valor'),
  dueDate: z.string().min(1, 'Informe o vencimento'),
  notes: z.string().max(2000).optional(),
})

type Formulario = z.infer<typeof esquema>

export default function LancamentoFormPage({ lado }: { lado: LadoFinanceiro }) {
  const receber = lado === 'receber'
  const navegar = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const { data: clientes } = useClientes({ perPage: 100, status: 'active' })
  const { data: cuidadores } = useCaregivers({ status: 'active' })
  const criar = useCriarLancamento(lado)

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      customerId: '',
      caregiverId: '',
      supplier: '',
      category: 'OTHER',
      description: '',
      amount: '',
      dueDate: hojeChave(),
      notes: '',
    },
  })

  const categoria = watch('category')

  if (!pode('finance:write') || somenteLeitura()) return <SemPermissao />

  async function enviar(dados: Formulario) {
    setErroGeral(null)

    const payload = receber
      ? {
          customerId: dados.customerId,
          description: dados.description,
          amount: dados.amount.replace(',', '.'),
          dueDate: dados.dueDate,
          notes: dados.notes || undefined,
        }
      : {
          // Pagamento de cuidador aponta para a pessoa; as demais despesas
          // apontam para o fornecedor. Nunca os dois.
          caregiverId: dados.category === 'CAREGIVER' ? dados.caregiverId || undefined : undefined,
          supplier: dados.category === 'CAREGIVER' ? undefined : dados.supplier || undefined,
          category: dados.category,
          description: dados.description,
          amount: dados.amount.replace(',', '.'),
          dueDate: dados.dueDate,
          notes: dados.notes || undefined,
        }

    try {
      await criar.mutateAsync(payload)
      void navegar(`/financeiro/${lado}`, { replace: true })
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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to={`/financeiro/${lado}`}
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {receber ? 'Nova conta a receber' : 'Nova despesa'}
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
            {receber ? (
              <Selecao
                label="Cliente"
                obrigatorio
                placeholder="Escolha o cliente"
                erro={errors.customerId?.message}
                opcoes={(clientes?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
                {...register('customerId')}
              />
            ) : (
              <>
                <Selecao
                  label="Categoria"
                  obrigatorio
                  placeholder="Escolha a categoria"
                  erro={errors.category?.message}
                  opcoes={Object.entries(CATEGORIAS).map(([valor, rotulo]) => ({ valor, rotulo }))}
                  {...register('category')}
                />

                {categoria === 'CAREGIVER' ? (
                  <Selecao
                    label="Cuidador"
                    placeholder="Escolha o cuidador"
                    erro={errors.caregiverId?.message}
                    opcoes={(cuidadores?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
                    {...register('caregiverId')}
                  />
                ) : (
                  <InputField
                    label="Fornecedor"
                    placeholder="Posto, farmácia, contador…"
                    erro={errors.supplier?.message}
                    {...register('supplier')}
                  />
                )}
              </>
            )}

            <InputField
              label="Descrição"
              placeholder={receber ? 'Mensalidade de setembro' : 'Combustível das visitas'}
              obrigatorio
              erro={errors.description?.message}
              {...register('description')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Valor"
                inputMode="decimal"
                placeholder="1.500,00"
                obrigatorio
                erro={errors.amount?.message}
                {...register('amount')}
              />
              <InputField
                label="Vencimento"
                type="date"
                obrigatorio
                erro={errors.dueDate?.message}
                {...register('dueDate')}
              />
            </div>

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
            Lançar
          </Button>
        </div>
      </form>
    </div>
  )
}
