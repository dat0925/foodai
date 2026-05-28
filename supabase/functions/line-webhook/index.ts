import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── 環境変数
const LINE_CHANNEL_SECRET    = Deno.env.get('LINE_CHANNEL_SECRET')!
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY      = Deno.env.get('ANTHROPIC_API_KEY')!
const SHOP_ID                = Deno.env.get('FOODAI_SHOP_ID')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── LINE署名検証
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(LINE_CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return expected === signature
}

// ── LINEへ返信
async function replyToLine(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

// ── 会話履歴を取得（直近10件）
async function getHistory(lineUserId: string) {
  const { data } = await supabase
    .from('foodai_conversations')
    .select('role, content')
    .eq('shop_id', SHOP_ID)
    .eq('line_user_id', lineUserId)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data ?? []).reverse()
}

// ── 会話履歴を保存
async function saveMessage(lineUserId: string, role: string, content: string) {
  await supabase.from('foodai_conversations').insert({
    shop_id: SHOP_ID,
    line_user_id: lineUserId,
    role,
    content,
  })
}

// ── 店舗情報を取得
async function getShopInfo() {
  const { data } = await supabase
    .from('foodai_shops')
    .select('name, opening_hours, faq')
    .eq('id', SHOP_ID)
    .single()
  return data
}

// ── 予約を保存
async function saveReservation(params: {
  lineUserId: string
  name: string
  date: string
  time: string
  partySize: number
  note?: string
}) {
  const { data, error } = await supabase.from('foodai_reservations').insert({
    shop_id: SHOP_ID,
    line_user_id: params.lineUserId,
    name: params.name,
    date: params.date,
    time: params.time,
    party_size: params.partySize,
    note: params.note ?? null,
    status: 'confirmed',
  }).select().single()
  return { data, error }
}

// ── Claude APIで応答生成
async function chat(lineUserId: string, userMessage: string): Promise<string> {
  const [history, shop] = await Promise.all([
    getHistory(lineUserId),
    getShopInfo(),
  ])

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Tokyo',
  })

  const systemPrompt = `あなたは「${shop?.name ?? '当店'}」のLINE予約アシスタントです。
今日は${today}です。

【あなたの役割】
お客様のLINEメッセージに対して、予約受付・変更・キャンセル・よくある質問への回答を行います。

【営業時間】
${JSON.stringify(shop?.opening_hours ?? {})}

【よくある質問と回答】
${JSON.stringify(shop?.faq ?? [])}

【予約受付ルール】
- 予約に必要な情報: 日時・人数・お名前
- 情報が不足している場合は、1つずつ丁寧に確認する
- 情報が揃ったら「確認」として内容をまとめて伝え、確定する
- 予約確定時は必ず以下のJSON形式を返答の最後に含める（お客様には見えません）:
  <RESERVATION>{"name":"名前","date":"YYYY-MM-DD","time":"HH:MM","party_size":人数}</RESERVATION>

【返答のルール】
- 丁寧かつ簡潔に（3〜5行以内）
- 絵文字は控えめに使用
- 敬語を使う
- 質問は1回に1つだけ`

  const messages = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  })

  const data = await res.json()
  const reply = data.content?.[0]?.text ?? 'しばらくお待ちいただき、もう一度お試しください。'

  // 予約情報をパースして保存
  const match = reply.match(/<RESERVATION>(.+?)<\/RESERVATION>/s)
  if (match) {
    try {
      const reservation = JSON.parse(match[1])
      await saveReservation({
        lineUserId,
        name: reservation.name,
        date: reservation.date,
        time: reservation.time,
        partySize: reservation.party_size,
      })
    } catch (e) {
      console.error('予約パースエラー:', e)
    }
  }

  // タグを除いたテキストをお客様に返す
  const cleanReply = reply.replace(/<RESERVATION>.*?<\/RESERVATION>/s, '').trim()
  return cleanReply
}

// ── メインハンドラ
Deno.serve(async (req) => {
  // LINEの疎通確認（空のbody）
  if (req.method === 'GET') {
    return new Response('OK', { status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  // 署名検証
  const valid = await verifySignature(body, signature)
  if (!valid) {
    console.error('署名検証失敗')
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = JSON.parse(body)

  // イベントを並列処理
  await Promise.all(
    (payload.events ?? []).map(async (event: any) => {
      // テキストメッセージのみ処理
      if (event.type !== 'message' || event.message?.type !== 'text') return

      const lineUserId  = event.source.userId
      const userMessage = event.message.text
      const replyToken  = event.replyToken

      // 会話履歴に保存
      await saveMessage(lineUserId, 'user', userMessage)

      // Claude で返答生成
      const reply = await chat(lineUserId, userMessage)

      // 会話履歴に保存
      await saveMessage(lineUserId, 'assistant', reply)

      // LINEへ返信
      await replyToLine(replyToken, reply)
    })
  )

  return new Response('OK', { status: 200 })
})
