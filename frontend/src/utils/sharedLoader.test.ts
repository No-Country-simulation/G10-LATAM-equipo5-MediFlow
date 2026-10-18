import { describe, it, expect, vi } from 'vitest';
import { createSharedLoader } from './sharedLoader';

describe('createSharedLoader', () => {
  it('shares one request between callers until it is invalidated', async () => {
    const fetcher = vi.fn().mockResolvedValue('datos');
    const loader = createSharedLoader(fetcher);

    await Promise.all([loader.load(), loader.load()]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    loader.invalidate();
    await loader.load();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failure (also a synchronous one): the next call retries', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('fallo síncrono');
      })
      .mockResolvedValue('datos');
    const loader = createSharedLoader(fetcher);

    await expect(loader.load()).rejects.toThrow('fallo síncrono');
    await expect(loader.load()).resolves.toBe('datos');
  });
});
