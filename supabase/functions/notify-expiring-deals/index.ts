// supabase/functions/notify-expiring-deals/index.ts
// Runs daily via pg_cron. Finds watched deals expiring within 7 days
// and sends a branded email via Resend to each watcher.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL         = Deno.env.get('FROM_EMAIL') ?? 'StreamDeal <noreply@yourdomain.com>'
const APP_URL            = Deno.env.get('APP_URL') ?? 'https://streamdeal.vercel.app'

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch all watchlist entries needing notification
    const { data: entries, error } = await supabase
      .from('expiring_watchlist')
      .select('*')

    if (error) throw error
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No expiring deals to notify.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Group entries by user so each user gets one email listing all their expiring deals
    const byUser = entries.reduce((acc: Record<string, typeof entries>, entry) => {
      if (!acc[entry.user_id]) acc[entry.user_id] = []
      acc[entry.user_id].push(entry)
      return acc
    }, {})

    let sent = 0
    const watchlistIds: string[] = []

    for (const [, userEntries] of Object.entries(byUser)) {
      const { email, full_name } = userEntries[0]
      const firstName = full_name?.split(' ')[0] || 'there'

      const emailHtml = buildEmail(firstName, userEntries, APP_URL)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      [email],
          subject: `⏰ ${userEntries.length} deal${userEntries.length > 1 ? 's' : ''} you're watching expire${userEntries.length === 1 ? 's' : ''} soon`,
          html:    emailHtml,
        }),
      })

      if (res.ok) {
        sent++
        userEntries.forEach(e => watchlistIds.push(e.watchlist_id))
      } else {
        const err = await res.json()
        console.error(`Failed to send to ${email}:`, err)
      }
    }

    // Mark notified
    if (watchlistIds.length > 0) {
      await supabase
        .from('watchlist')
        .update({ notified_at: new Date().toISOString() })
        .in('id', watchlistIds)
    }

    return new Response(JSON.stringify({ sent, notified: watchlistIds.length }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('notify-expiring-deals error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// ── Email builder ─────────────────────────────────────────────

function daysLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function buildEmail(firstName: string, deals: any[], appUrl: string): string {
  const dealRows = deals.map(d => {
    const days = daysLeft(d.expires_at)
    const urgency = days <= 3 ? '#ff6b6b' : '#c9a84c'
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td bgcolor="#1a1a2e" style="background-color:#1a1a2e;border-radius:12px;padding:20px 24px;border-left:4px solid ${d.color};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:${d.color};letter-spacing:0.1em;text-transform:uppercase;">${d.service}</p>
                  <p style="margin:0 0 6px 0;font-family:Georgia,Times,'Times New Roman',serif;font-size:17px;font-weight:bold;color:#f0ece0;">${d.logo} ${d.deal_title}</p>
                  <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b6b7e;">${d.discount}</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${urgency};">
                    ⏰ Expires in ${days} day${days !== 1 ? 's' : ''}
                  </p>
                </td>
                <td align="right" valign="middle" style="padding-left:16px;">
                  <a href="${d.link || appUrl}" style="display:inline-block;background-color:${d.color};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;text-decoration:none;padding:9px 18px;border-radius:8px;">
                    Claim →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `
  }).join('')

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Deals expiring soon — StreamDeal</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a14;" bgcolor="#0a0a14">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a14" style="background-color:#0a0a14;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="font-size:26px;line-height:1;">💎</div>
              <div style="font-family:Georgia,Times,'Times New Roman',serif;font-size:20px;font-weight:bold;color:#f0ece0;margin-top:8px;">
                Stream<span style="color:#c9a84c;">Deal</span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="#12121f" style="background-color:#12121f;border-radius:16px;padding:40px;">

              <!-- Eyebrow -->
              <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#c9a84c;letter-spacing:0.12em;text-transform:uppercase;">
                EXPIRY ALERT
              </p>

              <!-- Heading -->
              <p style="margin:0 0 10px 0;font-family:Georgia,Times,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#f0ece0;line-height:1.25;">
                Hey ${firstName}, don't miss out
              </p>

              <!-- Subheading -->
              <p style="margin:0 0 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b6b7e;line-height:1.7;">
                ${deals.length === 1
                  ? 'A deal you\'re watching is expiring within 7 days.'
                  : `${deals.length} deals you're watching are expiring within 7 days.`
                }
                Claim ${deals.length === 1 ? 'it' : 'them'} before ${deals.length === 1 ? 'it\'s' : 'they\'re'} gone.
              </p>

              <!-- Deal rows -->
              ${dealRows}

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr><td style="border-top:1px solid #1e1e2e;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#c9a84c" style="background-color:#c9a84c;border-radius:10px;">
                    <a href="${appUrl}" style="display:inline-block;padding:13px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0a0a14;text-decoration:none;">
                      View All Deals →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#2e2e42;line-height:1.7;">
                You're receiving this because you're watching these deals on StreamDeal.<br/>
                &copy; StreamDeal &mdash; Never miss a streaming deal.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
