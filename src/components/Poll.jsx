// src/components/Poll.jsx
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

export default function Poll({ slug, customOptions }) {
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [voted, setVoted] = useState(false)

  useEffect(() => {
    if (!supabase) return // 🔥 防 SSR / env 還沒載入

    init()
  }, [])

  async function init() {
    if (!supabase) return

    // 1️⃣ 建立或取得 poll
    const { data: poll, error } = await supabase.rpc('get_or_create_poll', {
      slug_input: slug
    })

    if (error || !poll) {
      console.error('poll error:', error)
      return
    }

    setPoll(poll)

    // 2️⃣ 檢查 options 是否存在
    const { data: existing, error: optError } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', poll.id)

    if (optError) {
      console.error('options check error:', optError)
      return
    }

    // 👉 只在第一次建立
    if ((!existing || existing.length === 0) && customOptions) {
      const { error: insertError } = await supabase.from('options').insert(
        customOptions.map(o => ({
          poll_id: poll.id,
          text: o,
          votes: 0
        }))
      )

      if (insertError) {
        console.error('insert options error:', insertError)
      }
    }

    // 3️⃣ 載入資料
    await loadOptions(poll.id)

    // 4️⃣ 即時更新
    subscribe(poll.id)

    // 5️⃣ 是否投過
    if (localStorage.getItem('voted-' + poll.id)) {
      setVoted(true)
    }
  }

  async function loadOptions(pollId) {
    if (!supabase) return

    const { data, error } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', pollId)

    if (error) {
      console.error('load options error:', error)
      return
    }

    setOptions(data || [])
  }

  function subscribe(pollId) {
    if (!supabase) return

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
    if (voted || !poll || !supabase) return

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

    // 👉 立即更新 UI
    loadOptions(poll.id)
  }

  const total = options.reduce((s, o) => s + (o.votes || 0), 0)

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
            disabled={voted}
            className={`poll-option relative w-full border rounded-lg px-4 py-2 text-left overflow-hidden transition ${
              voted ? 'opacity-80 cursor-default' : 'hover:bg-muted'
            }`}
          >
            {/* 進度條 */}
            <div
              className="absolute left-0 top-0 h-full bg-primary/20 transition-all duration-500"
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