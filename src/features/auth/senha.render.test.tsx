import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import EntrarPage from './pages/EntrarPage'
import EsqueciSenhaPage from './pages/EsqueciSenhaPage'
import RedefinirSenhaPage from './pages/RedefinirSenhaPage'

/**
 * Smoke das telas de senha.
 *
 * Mesma ideia do smoke do módulo empresarial: o que se pega aqui é import
 * errado, hook fora de ordem e componente indefinido — a classe de erro que
 * deixa a tela em branco no celular e não aparece no `tsc`.
 */
function renderizar(elemento: React.ReactElement, rota = '/'): string {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return renderToString(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/redefinir-senha/:token" element={elemento} />
          <Route path="*" element={elemento} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('telas de senha', () => {
  it('a tela de entrar oferece o caminho de recuperação', () => {
    const html = renderizar(<EntrarPage />, '/entrar')
    expect(html).toContain('Esqueci minha senha')
    expect(html).toContain('/esqueci-senha')
  })

  it('esqueci-senha pede o e-mail sem prometer que a conta existe', () => {
    const html = renderizar(<EsqueciSenhaPage />, '/esqueci-senha')
    expect(html).toContain('Esqueceu a senha?')
    expect(html).toContain('Enviar link')
  })

  it('redefinir mostra o estado de conferência antes do formulário', () => {
    const html = renderizar(<RedefinirSenhaPage />, '/redefinir-senha/token-qualquer')
    // A prévia ainda não voltou: a tela não pode pedir senha antes de saber se
    // o link vale.
    expect(html).toContain('Conferindo o link')
    expect(html).not.toContain('Nova senha')
  })
})
