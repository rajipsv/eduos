// Website emails through an SMTP mailbox (e.g. Hostinger), checked against a tiny fake mail server.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { emailProvider, isEmailConfigured, sendInviteEmail, sendPasswordResetEmail } from '../server/email.js';

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY', 'EMAIL_FROM'];

/** Minimal SMTP server: accepts AUTH PLAIN and one message per connection, records what it got. */
function fakeSmtp() {
  const received = [];
  const server = net.createServer((socket) => {
    let mail = { auth: null, from: null, to: [], data: '' };
    let inData = false;
    let buffer = '';
    socket.write('220 fake.smtp ready\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let i;
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            received.push(mail);
            mail = { auth: mail.auth, from: null, to: [], data: '' };
            socket.write('250 OK queued\r\n');
          } else mail.data += `${line}\n`;
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-fake.smtp\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (cmd.startsWith('AUTH PLAIN')) {
          const [, user, pass] = Buffer.from(line.split(' ')[2], 'base64').toString('utf8').split('\0');
          mail.auth = { user, pass };
          socket.write('235 Authenticated\r\n');
        } else if (cmd.startsWith('MAIL FROM')) { mail.from = line; socket.write('250 OK\r\n'); }
        else if (cmd.startsWith('RCPT TO')) { mail.to.push(line); socket.write('250 OK\r\n'); }
        else if (cmd === 'DATA') { inData = true; socket.write('354 Go ahead\r\n'); }
        else if (cmd === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, received })));
}

async function withEnv(values, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, values);
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('provider: SMTP wins when fully set, then Resend, else none', async () => {
  await withEnv({}, () => {
    assert.equal(emailProvider(), null);
    assert.equal(isEmailConfigured(), false);
  });
  await withEnv({ RESEND_API_KEY: 're_x' }, () => assert.equal(emailProvider(), 'resend'));
  await withEnv({ SMTP_HOST: 'smtp.hostinger.com', SMTP_USER: 'hello@tutorsala.com' }, () =>
    assert.equal(emailProvider(), null, 'no password → not configured'),
  );
  await withEnv({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', RESEND_API_KEY: 're_x' }, () =>
    assert.equal(emailProvider(), 'smtp'),
  );
});

test('invite and reset emails go out through the SMTP mailbox', async () => {
  const smtp = await fakeSmtp();
  try {
    await withEnv(
      { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'hello@tutorsala.com', SMTP_PASS: 's3cret' },
      async () => {
        const sent = await sendInviteEmail({
          to: 'meera@example.com',
          name: 'Meera',
          centerName: 'Sunrise <Tuitions>',
          inviteUrl: 'https://www.tutorsala.com/#reset-password/inv_abc',
          days: 7,
        });
        assert.equal(sent, true);
        await sendPasswordResetEmail('ravi@example.com', 'https://www.tutorsala.com/#reset-password/abc');
      },
    );
    assert.equal(smtp.received.length, 2);
    const [invite, reset] = smtp.received;
    assert.deepEqual(invite.auth, { user: 'hello@tutorsala.com', pass: 's3cret' });
    assert.match(invite.from, /hello@tutorsala\.com/, 'sender defaults to the mailbox');
    assert.match(invite.to[0], /meera@example\.com/);
    assert.match(invite.data, /Subject: .*Welcome_to_Sunrise_=3CTuitions=3E/); // encoded subject
    assert.match(invite.data, /inv_abc/);
    assert.ok(!invite.data.includes('<strong>Sunrise <Tuitions></strong>'), 'center name is escaped in HTML');
    assert.match(reset.to[0], /ravi@example\.com/);
    assert.match(reset.data, /Reset your Tutorsala password/);
  } finally {
    smtp.server.close();
  }
});

test('a wrong mailbox password is reported as an error, not silently ignored', async () => {
  const server = net.createServer((s) => {
    s.write('220 ready\r\n');
    s.on('data', (d) => {
      const c = d.toString().toUpperCase();
      if (c.startsWith('EHLO')) s.write('250-x\r\n250 AUTH PLAIN\r\n');
      else if (c.startsWith('AUTH')) s.write('535 Authentication failed\r\n');
      else s.write('250 OK\r\n');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await withEnv(
      { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_USER: 'hello@tutorsala.com', SMTP_PASS: 'wrong' },
      () => assert.rejects(sendPasswordResetEmail('a@b.com', 'https://x/#reset-password/1')),
    );
  } finally {
    server.close();
  }
});
