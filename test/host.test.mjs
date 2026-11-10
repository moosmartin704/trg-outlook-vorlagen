import test from 'node:test';
import assert from 'node:assert/strict';

// Minimaler Office.js-Ersatz, um den Outlook-Pfad in host.js ohne Outlook zu prüfen.
function mockOffice({ to = [], subject = '', failSelected = false } = {}) {
  const calls = { selected: [], prepend: [], subject: [] };
  const ok = (value) => ({ status: 'succeeded', value });
  const fail = { status: 'failed', error: { message: 'kein Cursor' } };
  globalThis.Office = {
    AsyncResultStatus: { Succeeded: 'succeeded' },
    CoercionType: { Html: 'html' },
    HostType: { Outlook: 'Outlook' },
    onReady: (cb) => cb({ host: 'Outlook' }),
    context: {
      mailbox: {
        userProfile: { displayName: 'Max Absender' },
        item: {
          to: { getAsync: (cb) => cb(ok(to)) },
          subject: { getAsync: (cb) => cb(ok(subject)), setAsync: (t, cb) => { calls.subject.push(t); cb(ok()); } },
          body: {
            setSelectedDataAsync: (html, opts, cb) => { calls.selected.push([html, opts.coercionType]); cb(failSelected ? fail : ok()); },
            prependAsync: (html, opts, cb) => { calls.prepend.push(html); cb(ok()); },
          },
        },
      },
    },
  };
  return calls;
}

test('Outlook-Pfad: Kontext lesen und HTML einfügen', async () => {
  const calls = mockOffice({ to: [{ displayName: 'Erika Muster', emailAddress: 'e@x.de' }], subject: 'Hallo' });
  const host = await import('../src/host.js?a');
  assert.equal(await host.initHost(), true);
  assert.equal(host.isOutlook(), true);
  const ctx = await host.getContext();
  assert.equal(ctx.me, 'Max Absender');
  assert.equal(ctx.subject, 'Hallo');
  assert.equal(ctx.to[0].displayName, 'Erika Muster');
  await host.insertHtml('<p>Hi</p>');
  assert.deepEqual(calls.selected, [['<p>Hi</p>', 'html']]);
  await host.setSubject('Neu');
  assert.deepEqual(calls.subject, ['Neu']);
});

test('Outlook-Pfad: ohne Cursor wird am Textanfang eingefügt', async () => {
  const calls = mockOffice({ failSelected: true });
  const host = await import('../src/host.js?b');
  await host.initHost();
  await host.insertHtml('<p>Hi</p>');
  assert.deepEqual(calls.prepend, ['<p>Hi</p>']);
});

test('Ohne Office: Testmodus liefert Beispieldaten', async () => {
  delete globalThis.Office;
  const host = await import('../src/host.js?c');
  assert.equal(await host.initHost(), false);
  const ctx = await host.getContext();
  assert.equal(ctx.to.length, 1);
});
