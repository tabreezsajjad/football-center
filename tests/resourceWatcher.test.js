import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchResource } from '../src/api/resourceWatcher.js';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function browser() {
  const env = new EventTarget();
  env.document = new EventTarget();
  env.document.visibilityState = 'visible';
  env.navigator = { onLine: true };
  env.time = 0;
  env.timers = new Map();
  let id = 0;
  env.setTimeout = (fn, delay) => {
    env.timers.set(++id, { fn, at: env.time + delay });
    return id;
  };
  env.clearTimeout = (timer) => env.timers.delete(timer);
  env.advance = async (ms) => {
    env.time += ms;
    for (const [key, timer] of [...env.timers])
      if (timer.at <= env.time) {
        env.timers.delete(key);
        timer.fn();
      }
    await flush();
  };
  return env;
}

test('checks periodically, pauses hidden/offline pages, and resumes when overdue', async () => {
  const env = browser();
  let calls = 0;
  const stop = watchResource({
    env,
    now: () => env.time,
    interval: 1000,
    load: async () => ++calls,
    onStart() {},
    onSuccess() {},
    onError: assert.fail,
  });
  await flush();
  assert.equal(calls, 1);
  await env.advance(1000);
  assert.equal(calls, 2);
  env.document.visibilityState = 'hidden';
  await env.advance(2000);
  assert.equal(calls, 2);
  env.document.visibilityState = 'visible';
  env.document.dispatchEvent(new Event('visibilitychange'));
  env.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls, 3, 'focus and visibility events must not duplicate a request');
  env.navigator.onLine = false;
  await env.advance(2000);
  assert.equal(calls, 3);
  env.navigator.onLine = true;
  env.dispatchEvent(new Event('online'));
  await flush();
  assert.equal(calls, 4);
  stop();
  assert.equal(env.timers.size, 0);
});

test('automatic checks honor retry deadlines even after focus changes', async () => {
  const env = browser();
  let calls = 0;
  const stop = watchResource({
    env,
    now: () => env.time,
    interval: 1000,
    load: async () => {
      calls++;
      throw Object.assign(new Error('cooldown'), { retryAt: 5000 });
    },
    onStart() {},
    onSuccess: assert.fail,
    onError() {},
  });
  await flush();
  await env.advance(1000);
  env.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls, 1);
  await env.advance(4000);
  assert.equal(calls, 2);
  stop();
});

test('cleanup aborts in-flight work, removes listeners and ignores late responses', async () => {
  const env = browser();
  let signal;
  let finish;
  let results = 0;
  let calls = 0;
  const stop = watchResource({
    env,
    now: () => env.time,
    interval: 1000,
    load: (input) => {
      calls++;
      signal = input;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    onStart() {},
    onSuccess: () => {
      results++;
    },
    onError: assert.fail,
  });
  await flush();
  await env.advance(2000);
  env.dispatchEvent(new Event('focus'));
  assert.equal(calls, 1);
  stop();
  assert.equal(signal.aborted, true);
  finish({ fixtures: [] });
  await flush();
  env.dispatchEvent(new Event('focus'));
  assert.equal(results, 0);
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 0);
});
