import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('FOODAI_LINE_ACCESS_TOKEN')!
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SHOP_ID                   = Deno.env.get('FOODAI_SHOP_ID')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// LINEへpushメッセージ送信
async function pushToLine(lineUserId: string, text: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })
  return res.ok
}

// JSTの今日の日付
function todayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// JSTの明日の日付
function tomorrowJST(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv-SE')
}

// JSTの現在時刻（時）
function currentHourJST(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours()
}

Deno.serve(async (req) => {
  // GETまたはPOSTどちらでも動作（Cronはいずれかで呼ぶ）
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const hour = currentHourJST()
  const results: string[] = []

  // 店舗のリマインダー設定を取得
  const { data: shop } = await supabase
    .from('foodai_shops')
    .select('reminder_settings')
    .eq('id', SHOP_ID)
    .single()

  const settings  = shop?.reminder_settings ?? {}
  const dayBefore = settings.day_before ?? { enabled: true, hour: 18 }
  const dayOf     = settings.day_of     ?? { enabled: true, hour: 9  }

  // ── 前日リマインダー
  if (dayBefore.enabled && hour === dayBefore.hour) {
    const tomorrow = tomorrowJST()
    const { data: reservations } = await supabase
      .from('foodai_reservations')
      .select('id, name, date, time, party_size, line_user_id')
      .eq('shop_id', SHOP_ID)
      .eq('date', tomorrow)
      .eq('status', 'confirmed')
      .eq('reminded_day_before', false)
      .not('line_user_id', 'is', null)

    for (const r of reservations ?? []) {
      const dateObj = new Date(r.date + 'T00:00:00+09:00')
      const dateJP  = dateObj.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
      const timeStr = r.time.slice(0, 5)

      const message = `【ご予約リマインダー】\n明日のご予約のご確認です。\n\n▶ ${dateJP} ${timeStr}\n▶ ${r.party_size}名様\n▶ ${r.name}様\n\nご来店をお待ちしております。\nキャンセル・変更はこちらのLINEにてご連絡ください。`

      const ok = await pushToLine(r.line_user_id, message)
      if (ok) {
        await supabase.from('foodai_reservations')
          .update({ reminded_day_before: true })
          .eq('id', r.id)
        results.push(`前日: ${r.name} (${r.date} ${timeStr}) → 送信OK`)
      } else {
        results.push(`前日: ${r.name} → 送信失敗`)
      }
    }
  }

  // ── 当日リマインダー
  if (dayOf.enabled && hour === dayOf.hour) {
    const today = todayJST()
    const { data: reservations } = await supabase
      .from('foodai_reservations')
      .select('id, name, date, time, party_size, line_user_id')
      .eq('shop_id', SHOP_ID)
      .eq('date', today)
      .eq('status', 'confirmed')
      .eq('reminded_day_of', false)
      .not('line_user_id', 'is', null)

    for (const r of reservations ?? []) {
      const timeStr = r.time.slice(0, 5)

      const message = `【本日のご予約】\n本日のご予約をお知らせします。\n\n▶ ${timeStr}\n▶ ${r.party_size}名様\n▶ ${r.name}様\n\nご来店をお待ちしております！\nキャンセル・変更はこちらのLINEにてご連絡ください。`

      const ok = await pushToLine(r.line_user_id, message)
      if (ok) {
        await supabase.from('foodai_reservations')
          .update({ reminded_day_of: true })
          .eq('id', r.id)
        results.push(`当日: ${r.name} (${timeStr}) → 送信OK`)
      } else {
        results.push(`当日: ${r.name} → 送信失敗`)
      }
    }
  }

  const summary = results.length > 0 ? results.join('\n') : `hour=${hour} 対象なし`
  console.log('Reminder results:', summary)
  return new Response(JSON.stringify({ hour, results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
