const esc=(v:string)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));

export const vorlenEmailShell=(title:string,bodyHtml:string,preheader='Recruitment support from Vorlen')=>`<!doctype html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#11251f">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f7f5"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce6e1;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 30px;background:#11251f">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td aria-hidden="true" style="width:42px;height:42px;border:2px solid #b8e34b;text-align:center;vertical-align:middle;font-size:24px;font-weight:800;line-height:42px;color:#b8e34b">V</td>
<td style="padding-left:14px"><div style="font-size:21px;line-height:1;font-weight:800;letter-spacing:5px;color:#ffffff">VORLEN</div><div style="padding-top:7px;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:1.6px;color:#b8e34b">RECRUITMENT &amp; TALENT SOLUTIONS</div></td>
</tr></table>
</td></tr>
<tr><td lang="en" dir="ltr" style="padding:34px 30px 36px">${bodyHtml}</td></tr>
<tr><td style="padding:22px 30px;background:#f8faf9;border-top:1px solid #e3ebe7;font-size:11px;line-height:1.65;color:#60716a">
<strong style="color:#11251f">VORLEN</strong> · Recruitment &amp; Talent Solutions<br>
Ivy and Pearls Ltd trading as Vorlen · Company No. 17387520 · Registered in England and Wales<br>
Registered office: 10 South Street, Rochdale, United Kingdom, OL16 2EP<br>
<a href="https://www.vorlen.co.uk" style="color:#153b32;text-decoration:underline">Visit Vorlen</a> · <a href="mailto:contact@vorlen.co.uk" style="color:#153b32;text-decoration:underline">contact@vorlen.co.uk</a> · <a href="https://www.vorlen.co.uk/privacy" style="color:#153b32;text-decoration:underline">Privacy notice</a><br>
<span style="color:#718079">If you'd rather not receive recruitment-service marketing emails from Vorlen, reply “unsubscribe” or email contact@vorlen.co.uk.</span>
</td></tr></table>
</td></tr></table></body></html>`;

export const vorlenEmailBody=(name:string,message:string,signoff='Vorlen Team')=>`
<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#11251f">Hi ${esc(name||'there')},</p>
<div style="font-size:15px;line-height:1.75;color:#253b34;white-space:pre-line">${esc(message)}</div>
<p style="margin:28px 0 0;font-size:15px;line-height:1.7;color:#11251f">Kind regards,<br><strong>${esc(signoff)}</strong><br><span style="color:#60716a">Recruitment &amp; Talent Solutions</span></p>`;

export const vorlenPlainText=(name:string,message:string,signoff='Vorlen Team')=>`Hi ${name||'there'},\n\n${message}\n\nKind regards,\n${signoff}\nRecruitment & Talent Solutions\nVorlen\nhttps://www.vorlen.co.uk\n\nIf you'd rather not receive recruitment-service marketing emails from Vorlen, reply "unsubscribe" or email contact@vorlen.co.uk.`;
