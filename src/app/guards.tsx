import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth.store'
import { Splash } from './PaginasSimples'

/**
 * Rota protegida.
 *
 * O access token vive só em memória, então ao abrir o PWA o app sempre começa
 * sem sessão e tenta recuperá-la pelo cookie de refresh. Enquanto isso o estado
 * é `carregando` e mostramos o splash — sem essa espera, quem já está logado
 * veria a tela de login piscar a cada abertura.
 */
export function ExigirAutenticacao() {
  const boot = useAuth((e) => e.boot)
  const local = useLocation()

  if (boot === 'carregando') return <Splash />

  if (boot === 'anonimo') {
    // Guarda para onde a pessoa ia: depois do login ela volta para lá, em vez
    // de cair no início e ter que navegar de novo.
    return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />
  }

  return <Outlet />
}

/**
 * MNVMA Core: só o dono do SaaS.
 *
 * A conferência é do PAPEL, não de permissão: o titular de cada conta cliente
 * também tem todas as permissões — dentro da conta dele. Confundir as duas
 * coisas aqui significaria mostrar a lista de todos os clientes para qualquer
 * um deles.
 *
 * O guard do front é conveniência de navegação; quem realmente decide é o
 * backend, que recusa a rota com 403. Uma tela escondida no bundle nunca foi
 * proteção — o JavaScript inteiro está no navegador de quem quiser ler.
 */
export function ExigirSuperAdmin() {
  const boot = useAuth((e) => e.boot)
  const papel = useAuth((e) => e.usuario?.role)

  if (boot === 'carregando') return <Splash />
  if (papel !== 'SUPER_ADMIN') return <Navigate to="/" replace />

  return <Outlet />
}

/** Login e cadastro: quem já tem sessão não deveria ver estas telas. */
export function ExigirAnonimo() {
  const boot = useAuth((e) => e.boot)

  if (boot === 'carregando') return <Splash />
  if (boot === 'autenticado') return <Navigate to="/" replace />

  return <Outlet />
}
