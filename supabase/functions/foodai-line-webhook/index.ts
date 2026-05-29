import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── 環境変数
const LINE_CHANNEL_SECRET       = Deno.env.get('FOODAI_LINE_CHANNEL_SECRET')!
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('FOODAI_LINE_ACCESS_TOKEN')!
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY         = Deno.env.get('FOODAI_ANTHROPIC_API_KEY')!
const SHOP_ID                   = Deno.env.get('FOODAI_SHOP_ID')!

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
    .select('name, opening_hours, faq, capacity_per_slot, slot_minutes')
    .eq('id', SHOP_ID)
    .single()
  return data
}

// ── 空席チェック
async function checkAvailability(date: string, time: string, partySize: number): Promise<{
  available: boolean
  remaining: number
  alternatives: string[]
}> {
  const { data: shop } = await supabase
    .from('foodai_shops')
    .select('capacity_per_slot, slot_minutes')
    .eq('id', SHOP_ID)
    .single()

  const capacity   = shop?.capacity_per_slot ?? 20
  const slotMins   = shop?.slot_minutes ?? 30

  const slotStart = time.slice(0, 5)
  const [h, m] = slotStart.split(':').map(Number)
  const slotEndMin = h * 60 + m + slotMins
  const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2,'0')}:${String(slotEndMin % 60).padStart(2,'0')}`

  const { data: existing } = await supabase
    .from('foodai_reservations')
    .select('party_size, time')
    .eq('shop_id', SHOP_ID)
    .eq('date', date)
    .in('status', ['confirmed', 'pending'])
    .gte('time', slotStart)
    .lt('time', slotEnd)

  const usedCapacity = (existing ?? []).reduce((s, r) => s + r.party_size, 0)
  const remaining = capacity - usedCapacity
  const available = remaining >= partySize

  // 空き代替時間を探す（前後3枠）
  const alternatives: string[] = []
  if (!available) {
    for (let delta = 1; delta <= 3; delta++) {
      for (const sign of [-1, 1]) {
        const altMin = h * 60 + m + sign * delta * slotMins
        if (altMin < 0 || altMin >= 23 * 60) continue
        const altTime = `${String(Math.floor(altMin / 60)).padStart(2,'0')}:${String(altMin % 60).padStart(2,'0')}`
        const altEnd  = `${String(Math.floor((altMin + slotMins) / 60)).padStart(2,'0')}:${String((altMin + slotMins) % 60).padStart(2,'0')}`

        const { data: altExisting } = await supabase
          .from('foodai_reservations')
          .select('party_size')
          .eq('shop_id', SHOP_ID)
          .eq('date', date)
          .in('status', ['confirmed', 'pending'])
          .gte('time', altTime)
          .lt('time', altEnd)

        const altUsed = (altExisting ?? []).reduce((s, r) => s + r.party_size, 0)
        if (capacity - altUsed >= partySize) {
          alternatives.push(altTime)
          if (alternatives.length >= 3) break
        }
      }
      if (alternatives.length >= 3) break
    }
  }

  return { available, remaining, alternatives }
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
    shop_id:      SHOP_ID,
    line_user_id: params.lineUserId,
    name:         params.name,
    date:         params.date,
    time:         params.time,
    party_size:   params.partySize,
    note:         params.note ?? null,
    status:       'confirmed',
  }).select().single()
  return { data, error }
}

// ── Claude APIを呼ぶ共通関数
async function callClaude(systemPrompt: string, messages: {role: 'user'|'assistant', content: string}[]): Promise<string> {
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
  return data.content?.[0]?.text ?? 'しばらくお待ちいただき、もう一度お試しください。'
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

【空席管理】
- 1枠（${shop?.slot_minutes ?? 30}分）あたりの最大受入人数: ${shop?.capacity_per_slot ?? 20}名
- 予約確定前に必ず空席チェックが必要です
- 満席の場合は代替時間を提案してください

【予約受付ルール】
- 予約に必要な情報: 日時・人数・お名前
- 情報が不足している場合は、1つずつ丁寧に確認する
- 情報が揃ったら以下のタグで空席チェックを要求する（お客様には見えません）:
  <CHECK_AVAILABILITY>{"date":"YYYY-MM-DD","time":"HH:MM","party_size":人数}</CHECK_AVAILABILITY>
- 空席確認後に予約確定する場合は以下のタグを含める（お客様には見えません）:
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

  // ── 1回目のClaude呼び出し
  let reply = await callClaude(systemPrompt, messages)

  // ── 空席チェック
  const checkMatch = reply.match(/<CHECK_AVAILABILITY>(.+?)<\/CHECK_AVAILABILITY>/s)
  if (checkMatch) {
    try {
      const req = JSON.parse(checkMatch[1])
      const { available, remaining, alternatives } = await checkAvailability(req.date, req.time, req.party_size)

      if (available) {
        // ✅ 空きあり → Claudeを再呼び出しして予約確定メッセージを生成
        const confirmMessages = [
          ...messages,
          { role: 'assistant' as const, content: reply },
          {
            role: 'user' as const,
            content: `[システム通知] 空席確認完了: ${req.date} ${req.time} は空きがあります（残り${remaining}名分）。予約を確定し、お客様に確定メッセージを送ってください。<RESERVATION>タグで予約を保存してください。`,
          },
        ]
        reply = await callClaude(systemPrompt, confirmMessages)
      } else {
        // 満席 → 代替時間を含むメッセージを直接返す
        const altText = alternatives.length > 0
          ? `\n代わりに ${alternatives.join('、')} でしたらご案内できます。いかがでしょうか？`
          : '\n大変申し訳ございませんが、その日はご希望の時間帯が満席となっております。'
        return `申し訳ございません。${req.date} ${req.time}は満席です。${altText}`
      }
    } catch (e) {
      console.error('空席チェックエラー:', e)
    }
  }

  // ── 予約保存
  const reservationMatch = reply.match(/<RESERVATION>(.+?)<\/RESERVATION>/s)
  if (reservationMatch) {
    try {
      const reservation = JSON.parse(reservationMatch[1])
      await saveReservation({
        lineUserId,
        name:       reservation.name,
        date:       reservation.date,
        time:       reservation.time,
        partySize:  reservation.party_size,
      })
    } catch (e) {
      console.error('予約パースエラー:', e)
    }
  }

  // タグを除いたテキストを返す
  const cleanReply = reply
    .replace(/<CHECK_AVAILABILITY>.*?<\/CHECK_AVAILABILITY>/s, '')
    .replace(/<RESERVATION>.*?<\/RESERVATION>/s, '')
    .trim()
  return cleanReply
}

// ── メインハンドラ
Deno.serve(async (req) => {
  if (req.method === 'GET') return new Response('OK', { status: 200 })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const body      = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  const valid = await verifySignature(body, signature)
  if (!valid) {
    console.error('署名検証失敗')
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = JSON.parse(body)

  await Promise.all(
    (payload.events ?? []).map(async (event: any) => {
      if (event.type !== 'message' || event.message?.type !== 'text') return

      const lineUserId  = event.source.userId
      const userMessage = event.message.text
      const replyToken  = event.replyToken

      await saveMessage(lineUserId, 'user', userMessage)
      const reply = await chat(lineUserId, userMessage)
      await saveMessage(lineUserId, 'assistant', reply)
      await replyToLine(replyToken, reply)
    })
  )

  return new Response('OK', { status: 200 })
})
