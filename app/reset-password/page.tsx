<!-- Supabase → Authentication → Email Templates → "Reset Password" → paste this as the message body -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>Reset your password</title>
<style>
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-weight:inherit!important;}
</style>
</head>
<body style="margin:0; padding:0; background:#FAFAF5; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

<!-- preheader (hidden) -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#FAFAF5; font-size:1px; line-height:1px;">
  Your YourKitchen password reset code is inside. It expires in 1 hour.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF5;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">

        <!-- header -->
        <tr>
          <td align="center" style="background:#1E2620; border-radius:16px 16px 0 0; padding:32px 24px;">
            <div style="font-size:11px; font-weight:500; letter-spacing:5px; color:#6B9E7E; text-transform:uppercase; margin-bottom:4px;">Your</div>
            <div style="font-family:'Lora', Georgia, 'Times New Roman', serif; font-size:30px; font-weight:500; color:#FAFAF5;">Kitchen</div>
          </td>
        </tr>

        <!-- card -->
        <tr>
          <td style="background:#FFFFFF; border:1px solid #DDE8E0; border-top:none; border-radius:0 0 16px 16px; padding:36px 32px;">

            <h1 style="margin:0 0 12px; font-family:'Lora', Georgia, serif; font-size:23px; font-weight:500; color:#1E2620; letter-spacing:-0.3px;">Reset your password</h1>
            <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#6B7066; font-weight:300;">
              Tap your code or the button below &mdash; the reset page opens with everything filled in, so you just choose a new password. Prefer to type it? The 6 digits are above. Expires in 1&nbsp;hour.
            </p>

            <!-- code box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#EAF2ED; border:1px solid #DDE8E0; border-radius:12px; padding:22px 16px;">
                  <div style="font-size:11px; font-weight:500; letter-spacing:2px; color:#6B7066; text-transform:uppercase; margin-bottom:8px;">Your reset code</div>
                  <a href="https://app.yourkitchen.app/reset-password?email={{ .Email }}&amp;code={{ .Token }}" style="display:inline-block; font-family:'DM Sans', monospace; font-size:34px; font-weight:600; letter-spacing:10px; color:#3D6B4F; text-decoration:none; padding-left:10px;">{{ .Token }}</a>
                </td>
              </tr>
            </table>

            <!-- button -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
              <tr>
                <td align="center">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://app.yourkitchen.app/reset-password?email={{ .Email }}&amp;code={{ .Token }}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="#3D6B4F">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Open password reset</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="https://app.yourkitchen.app/reset-password?email={{ .Email }}&amp;code={{ .Token }}"
                     style="display:inline-block; background:#3D6B4F; color:#ffffff; text-decoration:none; font-size:15px; font-weight:500; padding:14px 32px; border-radius:10px;">
                    Open password reset
                  </a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#6B7066; font-weight:300;">
              Didn't request this? You can safely ignore this email &mdash; your password won't change.
            </p>

          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="padding:24px 24px 8px;">
            <div style="font-family:'Lora', Georgia, serif; font-style:italic; font-size:14px; color:#3D6B4F; margin-bottom:6px;">Your kitchen, covered.</div>
            <div style="font-size:12px; color:#6B7066; font-weight:300;">
              Questions? <a href="mailto:marques@yourkitchen.app" style="color:#3D6B4F; text-decoration:none;">marques@yourkitchen.app</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
