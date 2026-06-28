/**
 * Vineyard Ops — notifier (hazards + low chemical stock)
 * ------------------------------------------------------------
 * Replaces the earlier hazard-only script. Handles:
 *   • type: "hazard"     — emails you when an operator reports a hazard
 *   • type: "low_stock"  — emails you when shed stock drops below minimum
 *
 * SETUP: https://script.google.com → New project → paste this in →
 *   set DEFAULT_RECIPIENT → Deploy ▸ New deployment ▸ Web app
 *   (Execute as: Me · Who has access: Anyone) → copy the Web app URL →
 *   paste it into the app: Manager ▸ Setup ▸ Webhook URL.
 * (If you already deployed the old script, paste this over it and
 *  Deploy ▸ Manage deployments ▸ edit ▸ New version.)
 * ------------------------------------------------------------
 */

var DEFAULT_RECIPIENT = 'you@example.com';   // comma-separate for several

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var to = (d.notifyEmail && String(d.notifyEmail).trim()) ? String(d.notifyEmail).trim() : DEFAULT_RECIPIENT;
    var site = d.siteName || 'Vineyard Ops';

    // If the app sent a ready-made subject/body (low_stock and future types), use them.
    if (d.subject && d.body) {
      MailApp.sendEmail({ to: to, subject: d.subject, body: d.body + '\n\n— sent automatically by ' + site });
      return ContentService.createTextOutput('ok');
    }

    // Otherwise format a hazard email.
    var sev = (d.severity || '').toString().toUpperCase();
    var where = d.block || d.location || 'location not given';
    var subject = '[' + site + '] ' + sev + ' hazard — ' + where;
    var body = [
      'A hazard has been reported in the vineyard.',
      '',
      'Severity:     ' + (d.severity || ''),
      'Type:         ' + (d.hazardType || ''),
      'Block:        ' + (d.block || ''),
      'Location:     ' + (d.location || ''),
      'Reported by:  ' + (d.reportedBy || ''),
      'When:         ' + (d.date || '') + ' ' + (d.time || ''),
      '',
      'Description:',
      (d.description || '(none given)'),
      '',
      '— sent automatically by ' + site
    ].join('\n');
    MailApp.sendEmail({ to: to, subject: subject, body: body });
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

function testEmail() {
  doPost({ postData: { contents: JSON.stringify({
    type: 'low_stock', siteName: 'Vineyard Ops',
    subject: '[Vineyard Ops] Low chemical stock — 1 product',
    body: 'These products are at or below their minimum:\n\n• Shark: 3 L left (min 5)'
  }) } });
}
