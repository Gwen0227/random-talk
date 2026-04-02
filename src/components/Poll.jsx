// src/components/Poll.jsx
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

export default function Poll({ slug, customOptions }) {
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [voted, setVoted] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    // 1️⃣ 取得或建立 poll
    const { data: poll, error } = await supabase.rpc('get_or_create_poll', {
      slug_input: slug
    })

    if (error) {
      console.error('poll error:', error)
      return
    }

    setPoll(poll)

    // 2️⃣ 檢查 options 是否已存在（⚠️重點修正）
    const { data: existing } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', poll.id)

    // 👉 只有「第一次」才建立選項
    if ((!existing || existing.length === 0) && customOptions) {
      await supabase.from('options').insert(
        customOptions.map(o => ({
          poll_id: poll.id,
          text: o,
          votes: 0
        }))
      )
    }

    // 3️⃣ 載入選項
    loadOptions(poll.id)

    // 4️⃣ 訂閱即時更新
    subscribe(poll.id)

    // 5️⃣ 判斷是否投過票
    if (localStorage.getItem('voted-' + poll.id)) {
      setVoted(true)
    }
  }

  async function loadOptions(pollId) {
    const { data, error } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', pollId)

    if (error) {
      console.error('load options error:', error)
      return
    }

    setOptions(data)
  }

  function subscribe(pollId) {
    supabase
      .channel('poll-' + pollId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'options',
          filter: `poll_id=eq.${pollId}`
        },
        () => loadOptions(pollId)
      )
      .subscribe()
  }

  async function vote(optionId) {
    if (voted || !poll) return

    const fp = localStorage.getItem('fp') || crypto.randomUUID()
    localStorage.setItem('fp', fp)

    const { error } = await supabase.rpc('vote', {
      poll_id_input: poll.id,
      option_id_input: optionId,
      fingerprint_input: fp
    })

    if (error) {
      console.error('vote error:', error)
      return
    }

    localStorage.setItem('voted-' + poll.id, '1')
    setVoted(true)

    // 👉 立即刷新（避免延遲）
    loadOptions(poll.id)
  }

  const total = options.reduce((s, o) => s + o.votes, 0)

  return (
    <div className="poll mt-10 space-y-3">
      <h3 className="text-lg font-semibold">
        {poll?.question || '你覺得這篇如何？'}
      </h3>

      {options.map(o => {
        const percent = total ? Math.round((o.votes / total) * 100) : 0

        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            className={`poll-option relative w-full border rounded-lg px-4 py-2 text-left overflow-hidden ${
              voted ? 'opacity-80' : 'hover:bg-muted'
            }`}
          >
            {/* 背景條 */}
            <div
              className="absolute left-0 top-0 h-full bg-primary/20 transition-all"
              style={{ width: voted ? percent + '%' : '0%' }}
            />

            <div className="relative flex justify-between">
              <span>{o.text}</span>
              {voted && <span>{percent}%</span>}
            </div>
          </button>
        )
      })}

      <small className="text-muted-foreground">
        {total} votes
      </small>
    </div>
  )
}