import { useCallback, useEffect, useState } from 'react'

const CHAVE = 'mnvma:theme'

/**
 * Tema claro/escuro.
 *
 * A escolha inicial já foi aplicada pelo script inline no `index.html`, antes da
 * primeira pintura — este hook só lê o que ficou no `<html>` e permite alternar.
 * Sem aquele script, o app pisca branco antes de virar escuro.
 *
 * Toda leitura/escrita em localStorage vai dentro de try/catch: em janela
 * anônima ou com dados de site bloqueados, o acesso lança e derrubaria o app.
 */
export function useTema() {
  const [escuro, setEscuro] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  const alternar = useCallback(() => {
    setEscuro((atual) => {
      const proximo = !atual
      document.documentElement.classList.toggle('dark', proximo)
      try {
        localStorage.setItem(CHAVE, proximo ? 'dark' : 'light')
      } catch {
        /* storage indisponível: vale só para esta sessão */
      }
      return proximo
    })
  }, [])

  // Acompanha o sistema enquanto a pessoa não tiver escolhido manualmente.
  useEffect(() => {
    let escolheuManualmente = false
    try {
      escolheuManualmente = localStorage.getItem(CHAVE) !== null
    } catch {
      /* ignora */
    }
    if (escolheuManualmente) return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = (evento: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', evento.matches)
      setEscuro(evento.matches)
    }

    media.addEventListener('change', aoMudar)
    return () => media.removeEventListener('change', aoMudar)
  }, [])

  return { escuro, alternar }
}
