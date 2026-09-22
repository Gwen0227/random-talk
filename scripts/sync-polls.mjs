import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 找不到 Supabase 設定')
  console.error('')
  console.error('請確認 .env 有：')
  console.error('PUBLIC_SUPABASE_URL=...')
  console.error('SUPABASE_SERVICE_ROLE_KEY=...')
  process.exit(1)
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
)

const BLOG_DIR = path.resolve('src/content/blog')

function getMdxFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...getMdxFiles(fullPath))
      continue
    }

    if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push(fullPath)
    }
  }

  return files
}

function getPostSlug(filePath) {
  const relativePath = path.relative(BLOG_DIR, filePath)
  const parts = relativePath.split(path.sep)

  if (parts.length >= 2) {
    return parts[0]
  }

  return path.basename(parts[0], path.extname(parts[0]))
}

async function syncPoll(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const { data } = matter(content)

  if (!data.poll) {
    return
  }

  if (!data.poll.question || !Array.isArray(data.poll.options)) {
    console.error(`❌ Poll 格式錯誤：${filePath}`)
    return
  }

  if (data.poll.options.length < 2) {
    console.error(`❌ Poll 至少需要 2 個選項：${filePath}`)
    return
  }

  const postSlug = getPostSlug(filePath)

  console.log(`\n🗳️ ${postSlug}`)
  console.log(`   問題：${data.poll.question}`)
  console.log(`   選項：${data.poll.options.join(' / ')}`)

  const { data: existingPoll, error: findError } = await supabase
    .from('polls')
    .select('id, question')
    .eq('post_slug', postSlug)
    .maybeSingle()

  if (findError) {
    console.error('❌ 查詢 Poll 失敗：', findError.message)
    return
  }

  let pollId

  if (existingPoll) {
    pollId = existingPoll.id

    console.log(`   ✓ Poll 已存在，ID: ${pollId}`)

    if (existingPoll.question !== data.poll.question) {
      const { error: updateError } = await supabase
        .from('polls')
        .update({
          question: data.poll.question,
        })
        .eq('id', pollId)

      if (updateError) {
        console.error('❌ 更新問題失敗：', updateError.message)
        return
      }

      console.log('   ✓ Poll 問題已更新')
    }
  } else {
    const { data: newPoll, error: insertError } = await supabase
      .from('polls')
      .insert({
        post_slug: postSlug,
        question: data.poll.question,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('❌ 建立 Poll 失敗：', insertError.message)
      return
    }

    pollId = newPoll.id

    console.log(`   ✓ 已建立 Poll，ID: ${pollId}`)
  }

  const { data: existingOptions, error: optionsError } = await supabase
    .from('poll_options')
    .select('id, option_text, sort_order')
    .eq('poll_id', pollId)
    .order('sort_order')

  if (optionsError) {
    console.error('❌ 查詢 Poll 選項失敗：', optionsError.message)
    return
  }

  const existingTexts = new Set(
    existingOptions.map((option) => option.option_text)
  )

  const newOptions = data.poll.options
    .map((option, index) => ({
      poll_id: pollId,
      option_text: option,
      sort_order: index,
    }))
    .filter((option) => !existingTexts.has(option.option_text))

  if (newOptions.length > 0) {
    const { error: optionsInsertError } = await supabase
      .from('poll_options')
      .insert(newOptions)

    if (optionsInsertError) {
      console.error(
        '❌ 建立 Poll 選項失敗：',
        optionsInsertError.message
      )
      return
    }

    console.log(`   ✓ 新增 ${newOptions.length} 個選項`)
  } else {
    console.log('   ✓ 選項已存在')
  }
}

async function main() {
  console.log('🚀 開始同步 Poll...\n')

  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`❌ 找不到文章資料夾：${BLOG_DIR}`)
    process.exit(1)
  }

  const files = getMdxFiles(BLOG_DIR)

  let pollCount = 0

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(content)

    if (data.poll) {
      pollCount++
      await syncPoll(filePath)
    }
  }

  console.log('\n--------------------------------')
  console.log(`✅ 同步完成！找到 ${pollCount} 篇有 Poll 的文章`)
  console.log('--------------------------------')
}

main().catch((error) => {
  console.error('\n❌ 發生錯誤：', error)
  process.exit(1)
})