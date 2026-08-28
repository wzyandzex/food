'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { IconChevronRight, IconMic, IconSearch } from '@/components/icons'
import { NavBar } from '@/components/ui'

interface SearchResult {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const POPULAR_SEARCHES = ['西红柿炒鸡蛋', '回锅肉', '红烧肉', '青椒土豆丝', '可乐鸡翅']

function formatRecognitionError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限已被拒绝，请在浏览器或系统设置中允许使用麦克风'
    case 'no-speech':
      return '没听清，请再说一次，或直接在下方输入'
    case 'audio-capture':
      return '未找到可用的麦克风设备'
    case 'network':
      return '语音服务网络异常，已自动切至文字兜底'
    default:
      return '没听清，请再说一次或改用文字搜索'
  }
}

export default function VoicePage() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [errorText, setErrorText] = useState('')
  const [manualText, setManualText] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const recognitionRef = useRef<RecognitionLike | null>(null)
  const accumulatedFinalRef = useRef('')

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null)
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const searchRecipes = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setSearching(true)
    setSearched(true)
    try {
      const response = await fetch(`/api/recipes/search?q=${encodeURIComponent(trimmed)}`)
      const body = (await response.json()) as { recipes: SearchResult[] }
      setSearchResults(body.recipes ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleManualSearch = (event: React.FormEvent) => {
    event.preventDefault()
    if (!manualText.trim()) return
    setFinalText(manualText)
    void searchRecipes(manualText)
  }

  const handleQuickSearch = (keyword: string) => {
    setManualText(keyword)
    setFinalText(keyword)
    void searchRecipes(keyword)
  }

  const startListening = () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    accumulatedFinalRef.current = ''
    setErrorText('')
    setFinalText('')
    setInterimText('')
    setSearchResults([])
    setSearched(false)

    const recognition = new Ctor()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result?.[0]?.transcript ?? ''
        if (result?.isFinal) finalChunk += transcript
        else interimChunk += transcript
      }

      if (finalChunk) {
        accumulatedFinalRef.current += finalChunk
        const currentText = accumulatedFinalRef.current
        setFinalText(currentText)
        void searchRecipes(currentText)
      }
      setInterimText(interimChunk)
    }

    recognition.onerror = (event) => {
      setErrorText(formatRecognitionError(event.error))
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      if (!accumulatedFinalRef.current.trim()) {
        setErrorText((prev) => prev || '没听清，请再说一次或直接搜索')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  return (
    <div className="screen">
      <NavBar title="语音搜菜" back="/me" backLabel="我的" />

      {/* 语音听写主区域 */}
      <section className="card mt-4 p-5 text-center space-y-4">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          className={`mx-auto flex size-20 items-center justify-center rounded-full transition active:scale-95 ${
            listening
              ? 'bg-tint text-white animate-pulse'
              : 'bg-tint-soft text-tint-deep'
          }`}
          aria-label="按住说话"
        >
          <IconMic className="size-8" />
        </button>

        <p className="text-[13px] font-medium text-ink">
          {listening ? '正在倾听… 点击结束' : '点击麦克风，说出想做的菜'}
        </p>

        {/* 识别文本回显 */}
        <div className="min-h-16 rounded-xl bg-fill p-3 text-[14px] leading-6 text-ink">
          {finalText}
          <span className="text-ink-3">{interimText}</span>
          {!finalText && !interimText && <span className="text-ink-3">说出来的菜名会显示在这里…</span>}
        </div>

        {errorText && (
          <p className="text-[12px] text-caution bg-caution-soft p-2.5 rounded-lg text-left">
            {errorText}
          </p>
        )}

        {/* 文字搜索兜底 */}
        <form onSubmit={handleManualSearch} className="flex gap-2 pt-2">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="没听清？直接输菜名试试"
            className="field text-[13px]"
          />
          <button
            type="submit"
            disabled={!manualText.trim() || searching}
            className="shrink-0 rounded-xl bg-fill px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-40"
          >
            搜索
          </button>
        </form>

        {/* 常用热门点选 */}
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-ink-3">热门：</span>
          {POPULAR_SEARCHES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleQuickSearch(item)}
              className="chip text-[12px]"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {/* 搜索结果 */}
      {(searching || (searched && searchResults.length > 0)) && (
        <section className="mt-6">
          <h2 className="text-[13px] font-medium text-ink-3 px-1 mb-2">
            {searching ? '搜索中…' : `找到 ${searchResults.length} 道菜`}
          </h2>
          <div className="list-group">
            {searchResults.map((recipe, idx) => {
              const isLast = idx === searchResults.length - 1
              return (
                <Link
                  key={recipe.id}
                  href={`/recipes/${encodeURIComponent(recipe.id)}`}
                  className={`flex items-center justify-between px-4 py-3.5 transition-colors active:bg-fill ${
                    isLast ? '' : 'border-b border-line'
                  }`}
                >
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{recipe.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">⏱ {recipe.minutes} 分钟</p>
                  </div>
                  <IconChevronRight className="size-4 text-ink-3/60" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {searched && !searching && searchResults.length === 0 && (
        <div className="card mt-6 p-6 text-center text-[13px] text-ink-3">
          未找到匹配的菜谱，换个词试试
        </div>
      )}
    </div>
  )
}
