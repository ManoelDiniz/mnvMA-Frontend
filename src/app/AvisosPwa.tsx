import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw, Share, WifiOff, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { useInstalacao, useOnline } from '@/shared/hooks/usePwa'

/**
 * Avisos do PWA: atualização disponível, app instalável e conexão perdida.
 *
 * Todos ficam ancorados acima da barra inferior no celular, com `z-toast`, e
 * nenhum deles bloqueia a tela — o cuidador pode estar no meio de um plantão.
 */
export function AvisosPwa() {
  return (
    <>
      <AvisoAtualizacao />
      <AvisoOffline />
      <ConviteInstalacao />
    </>
  )
}

function Faixa({
  children,
  tom = 'marca',
}: {
  children: React.ReactNode
  tom?: 'marca' | 'aviso'
}) {
  return (
    <div
      className="fixed inset-x-3 bottom-20 z-toast lg:right-6 lg:bottom-6 lg:left-auto lg:w-96"
      role="status"
    >
      <div
        className={
          tom === 'marca'
            ? 'flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-raised'
            : 'flex items-center gap-3 rounded-card border border-warning/30 bg-warning-soft p-3 text-warning shadow-raised'
        }
      >
        {children}
      </div>
    </div>
  )
}

function AvisoAtualizacao() {
  const {
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Procura versão nova de hora em hora. Sem isso, quem deixa o PWA aberto
      // por dias pode ficar semanas numa versão com bug já corrigido.
      if (registro) setInterval(() => void registro.update(), 60 * 60 * 1000)
    },
  })

  if (!precisaAtualizar) return null

  return (
    <Faixa>
      <RefreshCw className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
      <p className="flex-1 text-sm text-ink">
        Existe uma versão nova do MNVMA Care.
      </p>
      <Button tamanho="sm" onClick={() => void updateServiceWorker(true)}>
        Atualizar
      </Button>
      <button
        type="button"
        onClick={() => setPrecisaAtualizar(false)}
        className="touch-target grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
        aria-label="Agora não"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </Faixa>
  )
}

function AvisoOffline() {
  const online = useOnline()
  const [mostrar, setMostrar] = useState(false)

  // Espera 1s antes de avisar: oscilação curta de sinal não merece alarme.
  useEffect(() => {
    if (online) {
      setMostrar(false)
      return
    }
    const timer = setTimeout(() => setMostrar(true), 1000)
    return () => clearTimeout(timer)
  }, [online])

  if (!mostrar) return null

  return (
    <Faixa tom="aviso">
      <WifiOff className="size-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm">
        Sem conexão. Você continua vendo o que já estava salvo no aparelho.
      </p>
    </Faixa>
  )
}

function ConviteInstalacao() {
  const { podeInstalar, precisaInstrucaoIos, instalar, dispensar } = useInstalacao()
  const [mostrarIos, setMostrarIos] = useState(false)

  if (!podeInstalar && !precisaInstrucaoIos) return null

  if (precisaInstrucaoIos) {
    return (
      <Faixa>
        <Share className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
        <div className="flex-1 text-sm text-ink">
          {mostrarIos ? (
            <p>
              Toque em <strong>Compartilhar</strong> na barra do Safari e escolha{' '}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          ) : (
            <p>Instale o MNVMA Care no seu celular.</p>
          )}
        </div>
        {!mostrarIos && (
          <Button tamanho="sm" variante="secondary" onClick={() => setMostrarIos(true)}>
            Como fazer
          </Button>
        )}
        <button
          type="button"
          onClick={dispensar}
          className="touch-target grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Não mostrar de novo"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </Faixa>
    )
  }

  return (
    <Faixa>
      <Download className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
      <p className="flex-1 text-sm text-ink">Instale o MNVMA Care no seu celular.</p>
      <Button tamanho="sm" onClick={() => void instalar()}>
        Instalar
      </Button>
      <button
        type="button"
        onClick={dispensar}
        className="touch-target grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
        aria-label="Não mostrar de novo"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </Faixa>
  )
}
