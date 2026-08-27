import { Suspense, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { cn } from '@/shared/lib/cn'
import { iniciais } from '@/shared/lib/format'
import { Carregando } from '@/shared/ui/feedback'
import { Button } from '@/shared/ui/Button'
import { useTema } from '@/shared/hooks/useTema'
import { ModalLimiteDoPlano } from '@/features/billing/ModalLimiteDoPlano'
import { ITEM_MAIS, MENU, filtrarMenu } from '../navigation'
import { FaixaStatusConta } from './FaixaStatusConta'

export function AppShell() {
  const navegar = useNavigate()
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const { escuro, alternar } = useTema()

  const usuario = useAuth((e) => e.usuario)
  const conta = useAuth((e) => e.conta)
  const sair = useAuth((e) => e.sair)

  // Assinar os Sets, e não os métodos `pode`/`temModulo`: aqueles leem via
  // get() e têm referência estável, então o menu nunca recalcularia quando as
  // permissões mudassem — ao migrar de conta individual para empresarial, por
  // exemplo, "Escalas" só apareceria depois de recarregar a página.
  const permissoes = useAuth((e) => e.permissoes)
  const modulos = useAuth((e) => e.modulos)

  const grupos = useMemo(
    () =>
      filtrarMenu(
        MENU,
        (m) => modulos.has(m),
        (p) => permissoes.has(p),
        usuario?.role,
      ),
    [modulos, permissoes, usuario?.role],
  )

  const itensCelular = useMemo(() => {
    const planos = grupos.flatMap((g) => g.itens).filter((i) => i.noCelular)
    return [...planos.slice(0, 4), ITEM_MAIS]
  }, [grupos])

  async function encerrar() {
    await sair()
    void navegar('/entrar', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-surface-muted">
      {/* ─── Sidebar (desktop) ────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-drawer w-72 border-r border-border bg-surface',
          'flex flex-col transition-transform duration-200 lg:translate-x-0',
          gavetaAberta ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu principal"
      >
        <div className="flex items-center justify-between px-5 pt-safe pb-4">
          <Marca nomeConta={conta?.name} />
          <button
            type="button"
            onClick={() => setGavetaAberta(false)}
            className="touch-target -mr-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {grupos.map((grupo, indice) => (
            <div key={grupo.titulo ?? indice} className="mb-5">
              {grupo.titulo && (
                <h2 className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                  {grupo.titulo}
                </h2>
              )}
              <ul className="flex flex-col gap-0.5">
                {grupo.itens.map((item) => (
                  <li key={item.para}>
                    <NavLink
                      to={item.para}
                      end={item.para === '/'}
                      onClick={() => setGavetaAberta(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-base transition-colors',
                          isActive
                            ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100'
                            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                        )
                      }
                    >
                      <item.icone className="size-5 shrink-0" aria-hidden="true" />
                      {item.rotulo}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white dark:bg-brand-500 dark:text-brand-950"
              aria-hidden="true"
            >
              {iniciais(usuario?.name ?? '?')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {usuario?.name}
              </span>
              <span className="block truncate text-xs text-ink-muted">{usuario?.email}</span>
            </span>
          </div>
          <Button
            variante="ghost"
            larguraTotal
            onClick={() => void encerrar()}
            iconeEsquerda={<LogOut className="size-4" aria-hidden="true" />}
            className="mt-1 justify-start"
          >
            Sair
          </Button>
        </div>
      </aside>

      {/* Fundo escurecido atrás da gaveta no celular */}
      {gavetaAberta && (
        <button
          type="button"
          className="fixed inset-0 z-sticky bg-slate-900/50 lg:hidden"
          onClick={() => setGavetaAberta(false)}
          aria-label="Fechar menu"
        />
      )}

      {/* ─── Conteúdo ─────────────────────────────────────────────────────── */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-sticky border-b border-border bg-surface/95 backdrop-blur pt-safe">
          <div className="flex min-h-14 items-center gap-2 px-3 sm:px-5">
            <button
              type="button"
              onClick={() => setGavetaAberta(true)}
              className="touch-target grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={gavetaAberta}
            >
              <Menu className="size-6" aria-hidden="true" />
            </button>

            <span className="lg:hidden">
              <Marca compacta />
            </span>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={alternar}
                className="touch-target grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
                aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
              >
                {escuro ? (
                  <Sun className="size-5" aria-hidden="true" />
                ) : (
                  <Moon className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </header>

        <FaixaStatusConta />

        {/* pb-24 no celular: a barra inferior fixa não pode cobrir o conteúdo */}
        <main className="mx-auto w-full max-w-6xl px-3 pt-4 pb-24 sm:px-5 lg:pb-8">
          <Suspense fallback={<Carregando />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* ─── Barra inferior (celular) ─────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface pb-safe lg:hidden"
        aria-label="Navegação rápida"
      >
        <ul className="flex">
          {itensCelular.map((item) => (
            <li key={item.para} className="flex-1">
              <NavLink
                to={item.para}
                end={item.para === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                    'text-xs font-medium transition-colors',
                    isActive
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icone
                      className={cn('size-6 shrink-0', isActive && 'stroke-[2.4]')}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.rotulo}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Fora do <main>: o limite do plano pode estourar em qualquer tela. */}
      <ModalLimiteDoPlano />
    </div>
  )
}

function Marca({ nomeConta, compacta }: { nomeConta?: string; compacta?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" width={32} height={32} />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight text-ink">MNVMA Care</span>
        {!compacta && nomeConta && (
          <span className="max-w-45 truncate text-xs text-ink-muted">{nomeConta}</span>
        )}
      </span>
    </span>
  )
}
