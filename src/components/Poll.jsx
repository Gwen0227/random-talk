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
    const { data: poll } = await supabase.rpc('get_or_create_poll', {
      slug_input: slug
    })

    setPoll(poll)

    // 如果有自訂選項（第一次會覆蓋）
    if (customOptions) {
      await supabase.from('options').delete().eq('poll_id', poll.id)

      await supabase.from('options').insert(
        customOptions.map(o => ({
          poll_id: poll.id,
          text: o
        }))
      )
    }

    loadOptions(poll.id)
    subscribe(poll.id)

    // 判斷是否投過
    if (localStorage.getItem('voted-' + poll.id)) {
      setVoted(true)
    }
  }

  async function loadOptions(pollId) {
    const { data } = await supabase
      .from('options')
      .select('*')
      .eq('poll_id', pollId)

    setOptions(data)
  }

  function subscribe(pollId) {
    supabase
      .channel('poll-' + pollId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'options',
        filter: `poll_id=eq.${pollId}`
      }, () => loadOptions(pollId))
      .subscribe()
  }

  async function vote(optionId) {
    if (voted) return

    const fp = localStorage.getItem('fp') || crypto.randomUUID()
    localStorage.setItem('fp', fp)

    await supabase.rpc('vote', {
      poll_id_input: poll.id,
      option_id_input: optionId,
      fingerprint_input: fp
    })

    localStorage.setItem('voted-' + poll.id, '1')
    setVoted(true)
  }

  const total = options.reduce((s, o) => s + o.votes, 0)

  return (
    <div className="poll">
      <h3>{poll?.question}</h3>

      {options.map(o => {
        const percent = total ? Math.round((o.votes / total) * 100) : 0

        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            className={`poll-option ${voted ? 'voted' : ''}`}
          >
            <div
              className="bar"
              style={{ width: voted ? percent + '%' : '0%' }}
            />
            <span>{o.text}</span>
            {voted && <span>{percent}%</span>}
          </button>
        )
      })}

      <small>{total} votes</small>
    </div>
  )
}