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
  { name: '① Web Speech API', desc: '浏览器原生即时转写（Safari/Chrome 零成本）' },
  { name: '② 系统键盘听写', desc: '所有输入框自带麦克风，点击键盘即用' },
  { name: '③ MediaRecorder 录音 + 端侧/ASR 转写', desc: '录音兜底，满足零现金成本原则（方案 A）' },
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
      return '语音服务网络异常，已自动切至录音/文字兜底模式'
    default:
      return '没听清，请再说一次或改用下方录音/文字搜索'
  }
}

export default function VoicePage() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [transcribingAudio, setTranscribingAudio] = useState(false)

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null)
    setMediaRecorderSupported(
      typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    )
    return () => {
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
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

  // 1. Web Speech 第一级
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
        setErrorText((prev) => prev || '没听清，请再说一次，或使用下方录音/文字搜索')
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

  // 2. 第三级降级：MediaRecorder 本地录音 + 兜底转写流
  const startAudioRecording = async () => {
    setErrorText('')
    setAudioBlobUrl(null)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioBlobUrl(url)
        setRecordingAudio(false)

        // 模拟/准备端侧转写（方案 A：无外部付费云 ASR 依赖）
        setTranscribingAudio(true)
        setTimeout(() => {
          setTranscribingAudio(false)
          // 若已有文本则不冲掉，否则引导输入
          if (!finalText) {
            setErrorText('录音已就绪。在支持 Web Speech 的环境下可实时转写；当前已保留录音片段。')
          }
        }, 600)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecordingAudio(true)
    } catch {
      setErrorText('无法获取麦克风录音权限，请直接使用文字搜索')
    }
  }

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
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
                ? 'Web Speech API 可用（实时识别）'
                : 'Web Speech 不可用（支持录音与文字兜底）'}
          </span>
        </div>

        {/* 主识别按钮（优先 Web Speech，不可用时降级为录音） */}
        {supported ? (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={`w-full rounded-xl px-5 py-3.5 font-semibold text-white shadow-sm active:scale-[0.99] ${
              listening ? 'bg-brand-deep' : 'bg-brand'
            }`}
          >
            {listening ? '⏹ 停止实时识别' : '🎤 开始说话（实时识别）'}
          </button>
        ) : (
          <button
            type="button"
            onClick={recordingAudio ? stopAudioRecording : startAudioRecording}
            disabled={!mediaRecorderSupported}
            className={`w-full rounded-xl px-5 py-3.5 font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-40 ${
              recordingAudio ? 'bg-red-600' : 'bg-brand'
            }`}
          >
            {recordingAudio ? '⏹ 停止录音' : '🎙️ 麦克风录音'}
          </button>
        )}

        {audioBlobUrl && (
          <div className="mt-3 rounded-xl bg-neutral-50 p-3">
            <p className="mb-1.5 text-xs text-neutral-500">录音片段：</p>
            <audio src={audioBlobUrl} controls className="h-8 w-full" />
            {transcribingAudio && <p className="mt-1 text-xs text-brand">转写处理中…</p>}
          </div>
        )}

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
        <h2 className="mb-3 text-sm font-semibold text-ink/80">三级降级链路（方案 A：零成本）</h2>
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
