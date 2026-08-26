'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface SearchResult {
  id: string
  title: string
  difficulty: number
  minutes: number
  tags: string[]
}

/** 最小结构类型：仅覆盖本页用到的 Web Speech API 面 */
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

const FALLBACK_CHAIN = [
  { name: '① Web Speech API', desc: 'Safari/Chrome 可用时零成本即时转写（本页正在验证）' },
  { name: '② 系统键盘听写', desc: '所有输入框原生自带的麦克风按钮，永远可用' },
  { name: '③ 录音上传 + 服务端 ASR', desc: 'MediaRecorder 录音上传，服务端转写（M1 接入）' },
]

const POPULAR_SEARCHES = ['西红柿炒鸡蛋', '回锅肉', '红烧肉', '青椒土豆丝', '可乐鸡翅']

/** 把 Web Speech 错误码转为面向用户的友好中文提示（PRD §6#9） */
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
      return '语音服务网络异常，请改用文字搜索'
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
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const accumulatedFinalRef = useRef('')

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null)
    setMediaRecorderSupported(typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined')
    return () => recognitionRef.current?.stop()
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
        // 副作用在事件处理器内直接触发，不写在 setState updater 内部
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
      // 若识别结束时未获得任何文字且无显式报错，按「没听清」提示兜底
      if (!accumulatedFinalRef.current.trim()) {
        setErrorText((prev) => prev || '没听清，请再说一次或改用文字搜索')
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-12 pb-10">
      <Link href="/" className="mb-6 text-sm text-ink/50">
        ← 返回首页
      </Link>
      <h1 className="mb-1 text-xl font-bold">🎙️ 语音搜索</h1>
      <p className="mb-6 text-sm text-ink/60">
        按住说话，或直接说出想做的菜
      </p>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span
            className={`size-2.5 rounded-full ${supported === null ? 'bg-gray-300' : supported ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span>
            {supported === null
              ? '检测中…'
              : supported
                ? 'Web Speech API 可用'
                : 'Web Speech API 不可用（请使用文字输入或键盘听写）'}
          </span>
        </div>

        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={supported === false}
          className={`w-full rounded-xl px-5 py-3.5 font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-40 ${
            listening ? 'bg-brand-deep' : 'bg-brand'
          }`}
        >
          {listening ? '⏹ 停止识别' : '🎤 开始说话'}
        </button>

        {errorText && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            {errorText}
          </div>
        )}

        <div className="mt-4 min-h-20 rounded-xl bg-brand-soft p-4 text-[15px] leading-7">
          {finalText}
          <span className="text-ink/40">{interimText}</span>
          {!finalText && !interimText && <span className="text-ink/30">识别文本会显示在这里…</span>}
        </div>

        {/* 文字搜索兜底输入框（PRD §6#9） */}
        <form onSubmit={handleManualSearch} className="mt-4 flex gap-2">
          <input
            type="text"
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            placeholder="没听清？直接输菜名试试"
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-sm outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            disabled={!manualText.trim() || searching}
            className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            搜索
          </button>
        </form>

        {/* 热门推荐占位（PRD §6#9） */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink/60">
          <span>热门：</span>
          {POPULAR_SEARCHES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleQuickSearch(item)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-ink/70 active:bg-neutral-200"
            >
              {item}
            </button>
          ))}
        </div>

        {(searching || (searched && searchResults.length > 0)) && (
          <div className="mt-5 border-t border-neutral-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink/70">
              {searching ? '搜索中…' : `找到 ${searchResults.length} 道菜`}
            </h3>
            <ul className="space-y-2">
              {searchResults.map((recipe) => (
                <li key={recipe.id}>
                  <Link
                    href={`/recipes/${encodeURIComponent(recipe.id)}`}
                    className="flex items-center justify-between rounded-lg bg-white px-4 py-3 text-sm shadow-sm active:bg-neutral-50"
                  >
                    <span className="font-medium">{recipe.title}</span>
                    <span className="text-xs text-ink/45">⏱ {recipe.minutes} 分钟</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {searched && !searching && searchResults.length === 0 && (
          <div className="mt-5 border-t border-neutral-100 pt-4 text-center text-xs text-ink/50">
            未找到匹配的菜谱，换个词试试
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-ink/80">降级链路</h2>
        <ul className="space-y-3">
          {FALLBACK_CHAIN.map((item, index) => (
            <li key={item.name} className="flex gap-3 text-sm">
              <span
                className={`mt-0.5 shrink-0 ${
                  index === 0
                    ? supported
                      ? 'text-green-600'
                      : 'text-red-500'
                    : index === 2
                      ? mediaRecorderSupported
                        ? 'text-green-600'
                        : 'text-amber-500'
                      : 'text-green-600'
                }`}
              >
                {index === 0
                  ? supported
                    ? '✓'
                    : '✗'
                  : index === 2
                    ? mediaRecorderSupported
                      ? '✓'
                      : '!'
                    : '✓'}
              </span>
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-ink/55">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg bg-brand-soft px-3 py-2 text-xs leading-5 text-ink/60">
          注：iOS 需在「设置 → Safari → 麦克风」允许权限；微信内置浏览器不支持录音，但点单方只需点选，不受影响。
        </p>
      </section>
    </main>
  )
}
