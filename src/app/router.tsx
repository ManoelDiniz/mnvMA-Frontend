import { lazy } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { ExigirAutenticacao, ExigirAnonimo, ExigirSuperAdmin } from './guards'
import { EmBreve, NaoEncontrado } from './PaginasSimples'

/*
 * Cada rota é um chunk próprio.
 *
 * O cuidador que abre o app para ver a agenda não deveria baixar o módulo
 * financeiro, nem o de escalas que a conta dele nem tem. Em 4G no meio da rua
 * isso é a diferença entre abrir em 1s e abrir em 5s.
 */
const EntrarPage = lazy(() => import('@/features/auth/pages/EntrarPage'))
const CriarContaPage = lazy(() => import('@/features/auth/pages/CriarContaPage'))
const EsqueciSenhaPage = lazy(() => import('@/features/auth/pages/EsqueciSenhaPage'))
const RedefinirSenhaPage = lazy(() => import('@/features/auth/pages/RedefinirSenhaPage'))
const InicioPage = lazy(() => import('@/features/dashboard/InicioPage'))
const ClientesPage = lazy(() => import('@/features/customers/ClientesPage'))
const ClienteFormPage = lazy(() => import('@/features/customers/ClienteFormPage'))
const ClienteDetalhePage = lazy(() => import('@/features/customers/ClienteDetalhePage'))
const ServicosPage = lazy(() => import('@/features/services/ServicosPage'))
const ServicoFormPage = lazy(() => import('@/features/services/ServicoFormPage'))
const AgendaPage = lazy(() => import('@/features/shifts/AgendaPage'))
const PlantaoFormPage = lazy(() => import('@/features/shifts/PlantaoFormPage'))
const PlantaoDetalhePage = lazy(() => import('@/features/shifts/PlantaoDetalhePage'))
const CuidadoresPage = lazy(() => import('@/features/caregivers/CuidadoresPage'))
const CuidadorFormPage = lazy(() => import('@/features/caregivers/CuidadorFormPage'))
const LancamentosPage = lazy(() => import('@/features/finance/LancamentosPage'))
const LancamentoFormPage = lazy(() => import('@/features/finance/LancamentoFormPage'))
const FluxoCaixaPage = lazy(() => import('@/features/finance/FluxoCaixaPage'))
const DisponibilidadePage = lazy(() => import('@/features/caregivers/DisponibilidadePage'))
const RelatoriosPage = lazy(() => import('@/features/reports/RelatoriosPage'))
const MinhaDisponibilidadePage = lazy(
  () => import('@/features/caregivers/MinhaDisponibilidadePage'),
)
const EscalasPage = lazy(() => import('@/features/schedules/EscalasPage'))
const DocumentosPage = lazy(() => import('@/features/documents/DocumentosPage'))
const OcorrenciasPage = lazy(() => import('@/features/occurrences/OcorrenciasPage'))
const ContratosPage = lazy(() => import('@/features/contracts/ContratosPage'))
const ContratoFormPage = lazy(() => import('@/features/contracts/ContratoFormPage'))
const EquipePage = lazy(() => import('@/features/users/EquipePage'))
const AceitarConvitePage = lazy(() => import('@/features/users/AceitarConvitePage'))
const PlanosPage = lazy(() => import('@/features/billing/PlanosPage'))
const AssinaturaPage = lazy(() => import('@/features/billing/AssinaturaPage'))
const RetornoDoCheckoutPage = lazy(() => import('@/features/billing/RetornoPage'))
const CorePainelPage = lazy(() => import('@/features/core/PainelPage'))
const CoreContasPage = lazy(() => import('@/features/core/ContasPage'))
const CoreContaDetalhePage = lazy(() => import('@/features/core/ContaDetalhePage'))
const CoreCuponsPage = lazy(() => import('@/features/core/CuponsPage'))

export const router = createBrowserRouter([
  {
    element: <ExigirAnonimo />,
    children: [
      { path: '/entrar', element: <EntrarPage /> },
      { path: '/criar-conta', element: <CriarContaPage /> },
      { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
    ],
  },
  {
    element: <ExigirAutenticacao />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <InicioPage /> },

          { path: '/clientes', element: <ClientesPage /> },
          // `/clientes/novo` antes de `/clientes/:id`: senão "novo" seria lido
          // como um id e a tela tentaria carregar um cliente inexistente.
          { path: '/clientes/novo', element: <ClienteFormPage /> },
          { path: '/clientes/:id', element: <ClienteDetalhePage /> },
          { path: '/clientes/:id/editar', element: <ClienteFormPage /> },

          // Sprints seguintes — a rota já existe para o menu não levar a lugar
          // nenhum e para o roteador não devolver 404 em item visível.
          { path: '/agenda', element: <AgendaPage /> },
          { path: '/plantoes', element: <AgendaPage /> },
          // "novo" antes de ":id", senão a rota o interpretaria como um id.
          { path: '/plantoes/novo', element: <PlantaoFormPage /> },
          { path: '/plantoes/:id', element: <PlantaoDetalhePage /> },
          { path: '/plantoes/:id/editar', element: <PlantaoFormPage /> },
          { path: '/escalas', element: <EscalasPage /> },
          { path: '/documentos', element: <DocumentosPage /> },
          { path: '/ocorrencias', element: <OcorrenciasPage /> },
          { path: '/contratos', element: <ContratosPage /> },
          // "novo" antes de ":id", senão a rota o interpretaria como um id.
          { path: '/contratos/novo', element: <ContratoFormPage /> },
          { path: '/contratos/:id', element: <ContratoFormPage /> },
          { path: '/cuidadores', element: <CuidadoresPage /> },
          { path: '/cuidadores/novo', element: <CuidadorFormPage /> },
          { path: '/cuidadores/:id', element: <CuidadorFormPage /> },
          { path: '/cuidadores/:id/disponibilidade', element: <DisponibilidadePage /> },
          { path: '/disponibilidade', element: <MinhaDisponibilidadePage /> },
          { path: '/servicos', element: <ServicosPage /> },
          { path: '/servicos/novo', element: <ServicoFormPage /> },
          { path: '/servicos/:id', element: <ServicoFormPage /> },
          { path: '/financeiro/receber', element: <LancamentosPage lado="receber" /> },
          { path: '/financeiro/receber/novo', element: <LancamentoFormPage lado="receber" /> },
          { path: '/financeiro/pagar', element: <LancamentosPage lado="pagar" /> },
          { path: '/financeiro/pagar/novo', element: <LancamentoFormPage lado="pagar" /> },
          { path: '/financeiro/fluxo', element: <FluxoCaixaPage /> },
          { path: '/relatorios', element: <RelatoriosPage /> },
          { path: '/equipe', element: <EquipePage /> },

          { path: '/planos', element: <PlanosPage /> },
          { path: '/assinatura', element: <AssinaturaPage /> },
          // Para onde o Mercado Pago devolve o navegador depois do checkout.
          // Não ativa nada: só pergunta ao backend até o webhook chegar.
          { path: '/assinatura/retorno', element: <RetornoDoCheckoutPage /> },

          { path: '/configuracoes', element: <EmBreve titulo="Configurações" sprint="Sprint 8" /> },
          // A faixa de status da conta e os e-mails antigos apontam para cá.
          // Link que já foi para a caixa de entrada de alguém não pode quebrar.
          {
            path: '/configuracoes/assinatura',
            element: <Navigate to="/assinatura" replace />,
          },
          { path: '/mais', element: <EmBreve titulo="Mais" sprint="Sprint 2" /> },

          /*
           * MNVMA Core — o painel do dono do SaaS.
           *
           * Mora dentro do mesmo app, atrás de um guard de papel, em vez de ser
           * um segundo deploy: enquanto quem usa é uma pessoa só, um build e um
           * domínio a mais seriam custo sem contrapartida. As telas são chunks
           * próprios, então quem não é SUPER_ADMIN nem baixa esse código.
           */
          {
            element: <ExigirSuperAdmin />,
            children: [
              { path: '/core', element: <CorePainelPage /> },
              { path: '/core/contas', element: <CoreContasPage /> },
              { path: '/core/contas/:id', element: <CoreContaDetalhePage /> },
              { path: '/core/cupons', element: <CoreCuponsPage /> },
            ],
          },
        ],
      },
    ],
  },
  /*
   * Fora dos dois guards de propósito. `ExigirAnonimo` mandaria para o início
   * quem já está logado em OUTRA conta — e é justamente essa pessoa que precisa
   * conseguir abrir o convite que recebeu.
   */
  { path: '/convite/:token', element: <AceitarConvitePage /> },

  /*
   * Fora dos guards pelo mesmo motivo do convite: quem redefine a senha pode
   * estar logado em outra conta no mesmo navegador, e `ExigirAnonimo` o
   * mandaria para o início em vez de deixá-lo abrir o link que recebeu.
   */
  { path: '/redefinir-senha/:token', element: <RedefinirSenhaPage /> },

  { path: '/login', element: <Navigate to="/entrar" replace /> },
  { path: '*', element: <NaoEncontrado /> },
])
