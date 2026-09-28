import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import {
  buildCardPngFilename,
  buildCardsArchiveFilename,
  createZipArchive,
  type ZipEntry,
} from '@/export/ZipArchive';

describe('ZIP archive export', () => {
  it('builds stable zero-padded card filenames', () => {
    expect(buildCardPngFilename(0, 1)).toBe('card-01.png');
    expect(buildCardPngFilename(8, 12)).toBe('card-09.png');
    expect(buildCardPngFilename(99, 120)).toBe('card-100.png');
  });

  it('builds a local-date archive filename', () => {
    expect(buildCardsArchiveFilename(new Date(2026, 8, 25, 12))).toBe('cardcraft-cards-2026-09-25.zip');
  });

  it('preserves entry names, order and bytes', async () => {
    const source = [
      { name: 'card-01.png', bytes: [137, 80, 78, 71, 1] },
      { name: 'card-02.png', bytes: [137, 80, 78, 71, 2] },
    ];
    const entries = async function* (): AsyncGenerator<ZipEntry> {
      for (const entry of source) {
        yield { name: entry.name, blob: new Blob([new Uint8Array(entry.bytes)]) };
      }
    };

    const archive = await createZipArchive(entries());
    const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    expect(Object.keys(files)).toEqual(source.map((entry) => entry.name));
    expect(Array.from(files['card-01.png'])).toEqual(source[0].bytes);
    expect(Array.from(files['card-02.png'])).toEqual(source[1].bytes);
  });

  it('aborts before consuming entries', async () => {
    const abort = new AbortController();
    abort.abort();
    const entries = async function* (): AsyncGenerator<ZipEntry> {
      yield { name: 'card-01.png', blob: new Blob(['never']) };
    };
    await expect(createZipArchive(entries(), abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
