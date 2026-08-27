import { useCallback, useEffect, useState } from 'react'

/** Conexão do aparelho, para o app dizer por que a lista está desatualizada. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const subiu = () => setOnline(true)
    const caiu = () => setOnline(false)
    window.addEventListener('online', subiu)
    window.addEventListener('offline', caiu)
    return () => {
      window.removeEventListener('online', subiu)
      window.removeEventListener('offline', caiu)
    }
  }, [])

  return online
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CHAVE_DISPENSADO = 'mnvma:install-dismissed'

/**
 * Convite de instalação.
 *
 * Duas coisas importantes:
 *
 * 1. O Chrome só dispara `beforeinstallprompt` quando o app atende aos
 *    critérios; guardamos o evento porque ele só pode ser usado uma vez, a
 *    partir de um gesto do usuário.
 * 2. **O iOS não dispara esse evento nunca.** No Safari a instalação é manual
 *    (Compartilhar → Adicionar à Tela de Início), então detectamos a plataforma
 *    e mostramos a instrução em vez de um botão que não faria nada.
 */
export function useInstalacao() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalado, setInstalado] = useState(() => estaInstalado())
  const [dispensado, setDispensado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_DISPENSADO) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const capturar = (e: Event) => {
      e.preventDefault()
      setEvento(e as BeforeInstallPromptEvent)
    }
    const instalou = () => {
      setInstalado(true)
      setEvento(null)
    }

    window.addEventListener('beforeinstallprompt', capturar)
    window.addEventListener('appinstalled', instalou)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturar)
      window.removeEventListener('appinstalled', instalou)
    }
  }, [])

  const instalar = useCallback(async () => {
    if (!evento) return false
    await evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    return outcome === 'accepted'
  }, [evento])

  const dispensar = useCallback(() => {
    setDispensado(true)
    try {
      localStorage.setItem(CHAVE_DISPENSADO, '1')
    } catch {
      /* ignora */
    }
  }, [])

  return {
    podeInstalar: evento !== null && !instalado && !dispensado,
    precisaInstrucaoIos: ehIosSafari() && !instalado && !dispensado,
    instalado,
    instalar,
    dispensar,
  }
}

export function estaInstalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari no iOS não usa display-mode; expõe esta propriedade não padrão.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function ehIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua)
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)
  return ios && safari
}
