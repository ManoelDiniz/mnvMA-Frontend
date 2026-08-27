import {
  Building,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Coins,
  CreditCard,
  FileSignature,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  UserCog,
  UsersRound,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PapelUsuario } from '@/shared/api/types'

export interface ItemMenu {
  rotulo: string
  para: string
  icone: LucideIcon
  /** Módulo exigido — vem de `/auth/me`, não é constante no cliente. */
  modulo?: string
  /** Permissão exigida — idem. */
  permissao?: string
  /**
   * Papel exigido. Existe só para o MNVMA Core: permissão não separa "dono da
   * conta cliente" de "dono do SaaS", porque o titular de cada conta também tem
   * todas elas dentro da própria conta.
   */
  papel?: PapelUsuario
  /** Aparece na barra inferior do celular (máximo 4 + "Mais"). */
  noCelular?: boolean
}

export interface GrupoMenu {
  titulo?: string
  itens: ItemMenu[]
}

/**
 * O menu inteiro é filtrado por módulo e permissão vindos da sessão. Um cuidador
 * independente simplesmente não tem "Escalas"; o Financeiro some para quem não
 * tem `finance:read`. Nada disso é decidido aqui — isto é só o catálogo.
 */
export const MENU: GrupoMenu[] = [
  {
    itens: [
      { rotulo: 'Início', para: '/', icone: LayoutDashboard, noCelular: true },
    ],
  },
  {
    titulo: 'Operação',
    itens: [
      {
        rotulo: 'Agenda',
        para: '/agenda',
        icone: CalendarDays,
        modulo: 'shifts',
        permissao: 'shifts:read',
        noCelular: true,
      },
      {
        rotulo: 'Plantões',
        para: '/plantoes',
        icone: ClipboardList,
        modulo: 'shifts',
        permissao: 'shifts:read',
      },
      {
        rotulo: 'Escalas',
        para: '/escalas',
        icone: CalendarDays,
        modulo: 'schedules',
        permissao: 'schedules:read',
      },
      {
        rotulo: 'Contratos',
        para: '/contratos',
        icone: FileSignature,
        modulo: 'contracts',
        permissao: 'contracts:read',
      },
      {
        rotulo: 'Clientes',
        para: '/clientes',
        icone: Users,
        modulo: 'customers',
        permissao: 'customers:read',
        noCelular: true,
      },
      {
        rotulo: 'Cuidadores',
        para: '/cuidadores',
        icone: UserCog,
        modulo: 'caregivers',
        permissao: 'caregivers:read',
      },
      {
        rotulo: 'Disponibilidade',
        para: '/disponibilidade',
        icone: CalendarClock,
        modulo: 'availability',
        permissao: 'availability:read',
      },
      {
        rotulo: 'Ocorrências',
        para: '/ocorrencias',
        icone: ShieldAlert,
        modulo: 'occurrences',
        permissao: 'occurrences:read',
      },
      {
        rotulo: 'Documentos',
        para: '/documentos',
        icone: FileText,
        modulo: 'documents',
        permissao: 'documents:read',
      },
      {
        rotulo: 'Serviços',
        para: '/servicos',
        icone: FileText,
        modulo: 'services',
        permissao: 'services:read',
      },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      {
        rotulo: 'A receber',
        para: '/financeiro/receber',
        icone: Coins,
        modulo: 'finance',
        permissao: 'finance:read',
        noCelular: true,
      },
      {
        rotulo: 'A pagar',
        para: '/financeiro/pagar',
        icone: Wallet,
        modulo: 'finance',
        permissao: 'finance:read',
      },
      {
        rotulo: 'Fluxo de caixa',
        para: '/financeiro/fluxo',
        icone: Receipt,
        modulo: 'finance',
        permissao: 'finance:read',
      },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      { rotulo: 'Relatórios', para: '/relatorios', icone: FileText, permissao: 'reports:read' },
      {
        rotulo: 'Equipe',
        para: '/equipe',
        icone: UsersRound,
        modulo: 'users',
        permissao: 'users:read',
      },
      {
        rotulo: 'Assinatura',
        para: '/assinatura',
        icone: CreditCard,
        modulo: 'billing',
        permissao: 'billing:read',
      },
      { rotulo: 'Configurações', para: '/configuracoes', icone: Settings },
    ],
  },
  {
    titulo: 'MNVMA Core',
    itens: [
      { rotulo: 'Painel', para: '/core', icone: ShieldCheck, papel: 'SUPER_ADMIN' },
      { rotulo: 'Contas', para: '/core/contas', icone: Building, papel: 'SUPER_ADMIN' },
      { rotulo: 'Cupons', para: '/core/cupons', icone: Ticket, papel: 'SUPER_ADMIN' },
    ],
  },
]

export const ITEM_MAIS: ItemMenu = {
  rotulo: 'Mais',
  para: '/mais',
  icone: MoreHorizontal,
  noCelular: true,
}

export function filtrarMenu(
  grupos: GrupoMenu[],
  temModulo: (m: string) => boolean,
  pode: (p: string) => boolean,
  papel?: PapelUsuario,
): GrupoMenu[] {
  return grupos
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter(
        (item) =>
          (!item.modulo || temModulo(item.modulo)) &&
          (!item.permissao || pode(item.permissao)) &&
          // O grupo do Core some inteiro para quem não é dono do SaaS — e o
          // grupo vazio é descartado logo abaixo, sem deixar título órfão.
          (!item.papel || item.papel === papel),
      ),
    }))
    .filter((grupo) => grupo.itens.length > 0)
}
