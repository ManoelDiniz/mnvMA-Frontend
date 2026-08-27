import { describe, expect, it } from 'vitest'
import { TAMANHO_MAXIMO_BYTES, problemaNoArquivo, tamanhoEmTexto } from './documentos.api'

/**
 * A validação de arquivo do lado do navegador não é segurança — o backend
 * confere os primeiros bytes e é ele quem manda. O que se testa aqui é o
 * respeito ao tempo de quem está no 4G: recusar antes de subir 9 MB, e recusar
 * com uma frase que diga o que fazer.
 */
function arquivo(nome: string, tipo: string, tamanho: number): File {
  const falso = new File(['x'], nome, { type: tipo })
  // `File` não deixa escrever `size`; o conteúdo real seria caro de fabricar
  // para o caso de 10 MB, então o tamanho é redefinido na instância.
  Object.defineProperty(falso, 'size', { value: tamanho })
  return falso
}

describe('problemaNoArquivo', () => {
  it('aceita os quatro formatos do backend', () => {
    expect(problemaNoArquivo(arquivo('coren.pdf', 'application/pdf', 2048))).toBeNull()
    expect(problemaNoArquivo(arquivo('foto.jpg', 'image/jpeg', 2048))).toBeNull()
    expect(problemaNoArquivo(arquivo('scan.png', 'image/png', 2048))).toBeNull()
    expect(problemaNoArquivo(arquivo('scan.webp', 'image/webp', 2048))).toBeNull()
  })

  it('recusa formato que o backend não guarda', () => {
    expect(problemaNoArquivo(arquivo('planilha.xlsx', 'application/vnd.ms-excel', 2048))).toMatch(
      /PDF, JPG, PNG ou WEBP/,
    )
  })

  it('aceita quando o Android não manda o tipo, decidindo pela extensão', () => {
    // Arquivo vindo do gerenciador de arquivos chega com `type` vazio em parte
    // dos Android. Barrar aqui seria recusar upload legítimo.
    expect(problemaNoArquivo(arquivo('coren.pdf', '', 2048))).toBeNull()
  })

  it('recusa acima de 10 MB dizendo o tamanho e o que fazer', () => {
    const recado = problemaNoArquivo(arquivo('foto.jpg', 'image/jpeg', TAMANHO_MAXIMO_BYTES + 1))
    expect(recado).toMatch(/10 MB/)
    expect(recado).toMatch(/resolução menor/)
  })

  it('aceita exatamente no limite', () => {
    expect(problemaNoArquivo(arquivo('foto.jpg', 'image/jpeg', TAMANHO_MAXIMO_BYTES))).toBeNull()
  })

  it('recusa arquivo vazio antes de gastar a subida', () => {
    expect(problemaNoArquivo(arquivo('vazio.pdf', 'application/pdf', 0))).toMatch(/vazio/)
  })
})

describe('tamanhoEmTexto', () => {
  it('usa a vírgula decimal do português', () => {
    expect(tamanhoEmTexto(2_516_582)).toBe('2,4 MB')
  })

  it('sobe de unidade sem casa decimal desnecessária', () => {
    expect(tamanhoEmTexto(512)).toBe('512 B')
    expect(tamanhoEmTexto(2048)).toBe('2 KB')
  })
})
