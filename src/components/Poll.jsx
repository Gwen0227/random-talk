import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

export default function Poll({ slug, customOptions }) {
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [voted, setVoted] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: poll, error } = await supabase.rpc('get_or_create_poll', {
      slug_input: slug
    })

    if (error) {
      console.error(error)
      return
    }

    setPoll(poll)

    const { data: existing } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', poll.id)

    if ((!existing || existing.length === 0) && customOptions) {
      await supabase.from('options').insert(
        customOptions.map(o => ({
          poll_id: poll.id,
          text: o,
          votes: 0
        }))
      )
    }

    loadOptions(poll.id)

    // 👉 還原使用者投票
    const saved = localStorage.getItem('voted-' + poll.id)
    if (saved) {
      setVoted(true)
      setSelectedOption(saved)
    }
  }

  async function loadOptions(pollId) {
    const { data } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', pollId)

    setOptions(data)
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
      console.error(error)
      return
    }

    localStorage.setItem('voted-' + poll.id, optionId)
    setSelectedOption(optionId)
    setVoted(true)

    loadOptions(poll.id)
  }

  const total = options.reduce((s, o) => s + o.votes, 0)
  const maxVotes = Math.max(...options.map(o => o.votes || 0), 0)

  return (
    <div className="mt-10 space-y-4">
      <h3 className="text-lg font-semibold">
        {poll?.question || '你覺得這篇如何？'}
      </h3>

      {options.map(o => {
        const percent = total ? Math.round((o.votes / total) * 100) : 0
        const isWinner = o.votes === maxVotes && voted
        const isSelected = selectedOption == o.id

        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            className={`relative w-full rounded-xl px-4 py-3 text-left border transition-all overflow-hidden
              ${voted ? 'bg-muted/50' : 'hover:scale-[1.02] hover:bg-muted'}
              ${isWinner ? 'ring-2 ring-primary' : ''}
            `}
          >
            {/* 🔥 動畫條 */}
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 transition-all duration-500"
              style={{ width: voted ? percent + '%' : '0%' }}
            />

            <div className="relative flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>{o.text}</span>

                {/* 👉 顯示你投的 */}
                {isSelected && (
                  <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                    ✔ 你投的
                  </span>
                )}

                {/* 👉 第一名 */}
                {isWinner && (
                  <span className="text-xs">🏆</span>
                )}
              </div>

              {voted && (
                <span className="text-sm font-semibold">
                  {percent}%
                </span>
              )}
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