// src/components/Todos.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Todos() {
  const [data, setData] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('todos')
      .select('*')

    if (error) {
      console.error(error)
      return
    }

    setData(data)
  }

  return (
    <ul>
      {data.map((entry) => (
        <li key={entry.id}>{entry.name}</li>
      ))}
    </ul>
  )
}