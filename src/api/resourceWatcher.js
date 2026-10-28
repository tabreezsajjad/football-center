// One request at a time; background tabs and offline browsers do not poll.
export function watchResource({
  load,
  onStart,
  onSuccess,
  onError,
  interval = 0,
  env = globalThis,
  now = Date.now,
}) {
  let closed = false;
  let running = false;
  let timer;
  let dueAt = 0;
  const controller = new AbortController();
  const available = () =>
    env.document?.visibilityState !== 'hidden' && env.navigator?.onLine !== false;
  const schedule = () => {
    env.clearTimeout(timer);
    if (!closed && interval > 0) timer = env.setTimeout(run, Math.max(interval, dueAt - now()));
  };
  async function run() {
    if (closed || running) return;
    if (interval > 0 && (!available() || now() < dueAt)) {
      schedule();
      return;
    }
    running = true;
    onStart();
    let retryAt = 0;
    try {
      const data = await load(controller.signal);
      if (!closed) onSuccess(data, now());
    } catch (error) {
      retryAt = Number(error.retryAt) || 0;
      if (!closed) onError(error);
    } finally {
      running = false;
      dueAt = Math.max(now() + interval, retryAt);
      schedule();
    }
  }
  const resume = () => {
    if (available() && now() >= dueAt) void run();
  };
  if (interval > 0) {
    env.document?.addEventListener('visibilitychange', resume);
    env.addEventListener('focus', resume);
    env.addEventListener('online', resume);
  }
  // Start after the effect has returned; cleanup can cancel before any work starts.
  Promise.resolve().then(run);
  return () => {
    closed = true;
    controller.abort();
    env.clearTimeout(timer);
    if (interval > 0) {
      env.document?.removeEventListener('visibilitychange', resume);
      env.removeEventListener('focus', resume);
      env.removeEventListener('online', resume);
    }
  };
}
