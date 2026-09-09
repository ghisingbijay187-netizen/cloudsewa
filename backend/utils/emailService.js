const nodemailer = require('nodemailer');

// HTML-escape a value so it cannot inject markup into an email body
const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

let transporter = null;
let testAccount = null;

// Lazy transporter: use the configured SMTP (EMAIL_*) when present, otherwise
// fall back to a throwaway Ethereal test inbox so dev emails actually send and
// can be previewed (per-message URL is logged after each send).
const ensureTransporter = async () => {
  if (transporter) return;
  const configuredHost = (process.env.EMAIL_HOST || '').trim();
  if (configuredHost) {
    transporter = nodemailer.createTransport({
      host: configuredHost,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('[email] Using configured SMTP transport:', configuredHost);
  } else {
    testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('[email] No EMAIL_HOST configured — emails go to a throwaway Ethereal test inbox.');
    console.log(`[email] Ethereal login (view all mail): user=${testAccount.user} pass=${testAccount.pass}`);
  }
  return transporter;
};

// Send email helper
const sendEmail = async (options) => {
  await ensureTransporter();
  const from = process.env.EMAIL_FROM || 'CloudSewa <noreply@cloudsewa.dev>';
  const to = options.to || process.env.ADMIN_EMAIL || (testAccount && testAccount.user);

  const mailOptions = {
    from,
    to,
    subject: options.subject,
    html: options.html
  };

  const info = await transporter.sendMail(mailOptions);

  // In dev (Ethereal) mode, print the preview URL to open the sent message.
  if (testAccount && info) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[email] Preview: ${previewUrl}`);
    }
  }
};

// Backup completed email
const sendBackupCompleteEmail = async (backup) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #1F3864;">Backup Completed Successfully</h2>
        <p>Your <strong>${escapeHtml(backup.type)}</strong> backup has completed successfully.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #D6E4F0;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Backup Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(backup.name)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Type</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(backup.type)}</td>
          </tr>
          <tr style="background-color: #D6E4F0;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Files</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(backup.totalFiles)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Size</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml((backup.totalSize / 1024 / 1024).toFixed(2))} MB</td>
          </tr>
          <tr style="background-color: #D6E4F0;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Completed At</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(new Date(backup.completedAt).toLocaleString())}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `✅ CloudSewa : ${escapeHtml(backup.type)} Backup Completed Successfully`,
    html
  });
};

// Backup failed email
const sendBackupFailedEmail = async (backup, error) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #c0392b;">Backup Failed</h2>
        <p>Your <strong>${escapeHtml(backup.type)}</strong> backup has failed. Please check the system.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #FCE4D6;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Backup Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(backup.name)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Type</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(backup.type)}</td>
          </tr>
          <tr style="background-color: #FCE4D6;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Error</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(error)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Failed At</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(new Date().toLocaleString())}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `❌ CloudSewa : ${escapeHtml(backup.type)} Backup Failed`,
    html
  });
};

// Storage warning email
const sendStorageWarningEmail = async (usedPercentage, usedGB, totalGB) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #e67e22;">Storage Warning</h2>
        <p>Your CloudSewa storage is running low. Please take action to free up space or expand storage.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #FFF2CC;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Storage Used</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(usedGB)} GB of ${escapeHtml(totalGB)} GB (${escapeHtml(usedPercentage)}%)</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #e67e22;"><strong>Warning!! - Storage above 80%</strong></td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `⚠️ CloudSewa —: Storage Warning: ${usedPercentage}% Used`,
    html
  });
};

// New registration awaiting approval — notifies the admin inbox
const sendRegistrationPendingEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #1F3864;">New Registration Awaiting Approval</h2>
        <p>A new user has registered and is waiting for an administrator to approve their account before they can sign in.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #D6E4F0;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(user.name)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(user.email)}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">Log in to the Admin Panel to approve or reject this registration.</p>
        <p style="margin-top: 10px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `🔔 CloudSewa : New Registration Awaiting Approval`,
    html
  });
};

// Registration approved — notifies the new user directly
const sendRegistrationApprovedEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #2e7d32;">Your Account Has Been Approved</h2>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your CloudSewa account has been approved by an administrator. You can now sign in and start using the system.</p>
        <p style="margin-top: 20px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `✅ CloudSewa : Your Account Has Been Approved`,
    html
  });
};

// Registration rejected — notifies the new user directly, with the admin's reason
const sendRegistrationRejectedEmail = async (user, reason) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #c0392b;">Your Registration Was Not Approved</h2>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your CloudSewa account registration was reviewed by an administrator and was not approved.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #FCE4D6;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Reason</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(reason)}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `CloudSewa : Registration Update`,
    html
  });
};

// New password reset request awaiting approval — notifies the admin inbox
const sendResetRequestPendingEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #1F3864;">Password Reset Request Awaiting Approval</h2>
        <p>A user has requested a password reset and is waiting for an administrator to approve it.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #D6E4F0;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(user.name)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(user.email)}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">Log in to the Admin Panel to approve or reject this request.</p>
        <p style="margin-top: 10px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `🔔 CloudSewa : Password Reset Request Awaiting Approval`,
    html
  });
};

// Password reset approved — notifies the user directly
const sendResetApprovedEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #2e7d32;">Password Reset Approved</h2>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your password reset request has been approved. You can now go to the reset password page to set a new password.</p>
        <p style="margin-top: 20px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `✅ CloudSewa : Password Reset Approved`,
    html
  });
};

// Password reset rejected — notifies the user directly, with the admin's reason
const sendResetRejectedEmail = async (user, reason) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CloudSewa</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #c0392b;">Password Reset Request Not Approved</h2>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your password reset request was reviewed by an administrator and was not approved.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #FCE4D6;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Reason</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(reason)}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666;">If you believe this is a mistake, please contact your administrator.</p>
        <p style="margin-top: 10px; color: #666;">This is an automated notification from CloudSewa.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: `CloudSewa : Password Reset Update`,
    html
  });
};

module.exports = {
  sendEmail,
  sendBackupCompleteEmail,
  sendBackupFailedEmail,
  sendStorageWarningEmail,
  sendRegistrationPendingEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendResetRequestPendingEmail,
  sendResetApprovedEmail,
  sendResetRejectedEmail
};
