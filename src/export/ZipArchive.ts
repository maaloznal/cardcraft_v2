export interface ZipEntry {
  name: string;
  blob: Blob;
}

export function buildCardPngFilename(index: number, total: number): string {
  const width = Math.max(2, String(Math.max(total, 1)).length);
  return `card-${String(index + 1).padStart(width, '0')}.png`;
}

export function buildCardsArchiveFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `cardcraft-cards-${year}-${month}-${day}.zip`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/**
 * Build a store-only ZIP from an async stream of PNG blobs. PNG is already
 * compressed, so recompressing wastes CPU and memory. Streaming entries means
 * only the final archive chunks plus the current PNG are retained in memory.
 */
export async function createZipArchive(
  entries: AsyncIterable<ZipEntry>,
  signal?: AbortSignal,
  onFinalize?: () => void,
): Promise<Blob> {
  throwIfAborted(signal);
  const { Zip, ZipPassThrough } = await import('fflate');
  throwIfAborted(signal);

  const chunks: ArrayBuffer[] = [];
  let resolveArchive: ((blob: Blob) => void) | null = null;
  let rejectArchive: ((error: unknown) => void) | null = null;
  const completion = new Promise<Blob>((resolve, reject) => {
    resolveArchive = resolve;
    rejectArchive = reject;
  });
  const archive = new Zip((error, chunk, final) => {
    if (error) {
      rejectArchive?.(error);
      return;
    }
    const ownedChunk = new Uint8Array(chunk.byteLength);
    ownedChunk.set(chunk);
    chunks.push(ownedChunk.buffer);
    if (final) resolveArchive?.(new Blob(chunks, { type: 'application/zip' }));
  });

  const abort = (): void => {
    archive.terminate();
    rejectArchive?.(new DOMException('Aborted', 'AbortError'));
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    for await (const entry of entries) {
      throwIfAborted(signal);
      const file = new ZipPassThrough(entry.name);
      archive.add(file);
      const bytes = new Uint8Array(await entry.blob.arrayBuffer());
      throwIfAborted(signal);
      file.push(bytes, true);
    }
    onFinalize?.();
    archive.end();
    return await completion;
  } catch (error) {
    archive.terminate();
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
