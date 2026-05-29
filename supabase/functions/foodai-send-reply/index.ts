import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_ACCESS_TOKEN  = Deno.env.get('FOODAI_LINE_ACCESS_TOKEN')!
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SHOP_ID            = Deno.env.get('FOODAI_SHOP_ID')!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const { line_user_id, message } = await req.json()
  if (!line_user_id || !message) {
    return new Response(JSON.stringify({ error: 'line_user_id と message が必要です' }), { status: 400 })
  }

  // LINEにpushメッセージで送信
  const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: line_user_id,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!lineRes.ok) {
    const err = await lineRes.text()
    return new Response(JSON.stringify({ error: err }), { status: 500 })
  }

  // 会話履歴に保存
  await supabase.from('foodai_conversations').insert({
    shop_id: SHOP_ID,
    line_user_id,
    role: 'assistant',
    content: message,
  })

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
