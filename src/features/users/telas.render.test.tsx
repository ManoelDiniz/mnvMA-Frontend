import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth.store'
import ContratosPage from '@/features/contracts/ContratosPage'
import DocumentosPage from '@/features/documents/DocumentosPage'
import OcorrenciasPage from '@/features/occurrences/OcorrenciasPage'
import EscalasPage from '@/features/schedules/EscalasPage'
import AceitarConvitePage from './AceitarConvitePage'
import EquipePage from './EquipePage'

/**
 * Smoke de renderização.
 *
 * Não substitui abrir o app no navegador — nenhum clique acontece aqui. O que
 * este teste pega é a classe de erro que mais dói: import errado, hook fora de
 * ordem, componente indefinido. Tudo isso derruba a tela inteira em branco no
 * celular de quem está trabalhando, e nada disso aparece no `tsc`.
 *
 * Roda em ambiente Node de propósito: `renderToString` não precisa de DOM, e o
 * projeto não carrega jsdom só para isto.
 */
function renderizar(elemento: React.ReactElement, rota = '/'): string {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return renderToString(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/convite/:token" element={elemento} />
          <Route path="*" element={elemento} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function comPermissoes(permissoes: string[]) {
  useAuth.setState({
    boot: 'autenticado',
    usuario: { id: 'u1', name: 'Sirlene', email: 'sirlene@teste.com', role: 'OWNER' },
    conta: { id: 't1', name: 'Cuidar Bem', type: 'COMPANY', status: 'ACTIVE', trialDaysLeft: 0 },
    permissoes: new Set(permissoes),
    modulos: new Set(['users', 'contracts', 'finance', 'schedules', 'documents', 'occurrences']),
  })
}

describe('telas do módulo empresarial', () => {
  beforeEach(() => {
    comPermissoes([])
  })

  it('Equipe barra quem não tem users:read', () => {
    const html = renderizar(<EquipePage />)
    expect(html).toContain('Você não tem acesso a esta área')
  })

  it('Equipe abre para quem pode ler, e só oferece convidar a quem pode escrever', () => {
    comPermissoes(['users:read'])
    const somenteLeitura = renderizar(<EquipePage />)
    expect(somenteLeitura).toContain('Equipe')
    expect(somenteLeitura).not.toContain('Convidar')

    comPermissoes(['users:read', 'users:write'])
    expect(renderizar(<EquipePage />)).toContain('Convidar')
  })

  it('Contratos só mostra a rodada de cobrança para quem tem finance:write', () => {
    comPermissoes(['contracts:read'])
    const html = renderizar(<ContratosPage />)
    expect(html).toContain('Contratos')
    // Sem contrato ativo carregado a rodada não aparece nem para quem pode —
    // o que este caso garante é que a tela sobe sem quebrar.
    expect(html).not.toContain('Cobrança do mês')
  })

  it('Escalas sobe com a navegação de semana', () => {
    comPermissoes(['schedules:read'])
    const html = renderizar(<EscalasPage />)
    expect(html).toContain('Escalas')
    expect(html).toContain('Semana anterior')
    // Sem schedules:write não se oferece copiar semana.
    expect(html).not.toContain('Repetir semana')
  })

  it('Documentos abre no filtro de pendências, não na lista inteira', () => {
    comPermissoes(['documents:read'])
    const html = renderizar(<DocumentosPage />)
    expect(html).toContain('Precisam de atenção')
    expect(html).not.toContain('Novo documento')
  })

  it('Ocorrências abre nas que estão em aberto', () => {
    comPermissoes(['occurrences:read', 'occurrences:write'])
    const html = renderizar(<OcorrenciasPage />)
    expect(html).toContain('Ocorrências')
    expect(html).toContain('Em aberto')
    expect(html).toContain('Registrar')
  })

  it('Aceite de convite mostra a conferência antes de pedir a senha', () => {
    const html = renderizar(<AceitarConvitePage />, '/convite/token-qualquer')
    expect(html).toContain('Conferindo o convite')
  })
})
