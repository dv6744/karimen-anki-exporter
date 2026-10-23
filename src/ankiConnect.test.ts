import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ankiConnect,
  createModel,
  createDeck,
  findNotes,
  addNote,
  addTags,
  storeMediaFile,
  storeMediaFileData,
  fetchImageAsBase64,
  type ModelSpec,
  type NotePayload,
} from './ankiConnect';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulates GM_xmlhttpRequest calling onload with a valid AnkiConnect response. */
function stubGmSuccess(result: unknown): void {
  vi.stubGlobal(
    'GM_xmlhttpRequest',
    vi.fn(({ onload }: { onload: (r: { responseText: string }) => void }) => {
      onload({ responseText: JSON.stringify({ result, error: null }) });
    }),
  );
}

/** Simulates GM_xmlhttpRequest calling onload with an AnkiConnect error response. */
function stubGmError(errorMsg: string): void {
  vi.stubGlobal(
    'GM_xmlhttpRequest',
    vi.fn(({ onload }: { onload: (r: { responseText: string }) => void }) => {
      onload({ responseText: JSON.stringify({ result: null, error: errorMsg }) });
    }),
  );
}

/** Simulates GM_xmlhttpRequest calling onerror (network failure). */
function stubGmNetworkError(): void {
  vi.stubGlobal(
    'GM_xmlhttpRequest',
    vi.fn(({ onerror }: { onerror: (e: Error) => void }) => {
      onerror(new Error('Network failure'));
    }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// ankiConnect base function
// ---------------------------------------------------------------------------

describe('ankiConnect base', () => {
  it('posts to http://localhost:8765 with correct body shape', async () => {
    stubGmSuccess(42);
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await ankiConnect('testAction', { foo: 'bar' });

    expect(gmSpy).toHaveBeenCalledOnce();
    const call = gmSpy.mock.calls[0][0];
    expect(call.url).toBe('http://localhost:8765');
    expect(call.method).toBe('POST');
    const body = JSON.parse(call.data);
    expect(body).toEqual({ action: 'testAction', version: 6, params: { foo: 'bar' } });
  });

  it('resolves with the result field on success', async () => {
    stubGmSuccess('hello');
    await expect(ankiConnect('ping')).resolves.toBe('hello');
  });

  it('rejects with error message when response has non-null error', async () => {
    stubGmError('some API error');
    await expect(ankiConnect('ping')).rejects.toThrow('some API error');
  });

  it('rejects on network failure (onerror callback)', async () => {
    stubGmNetworkError();
    await expect(ankiConnect('ping')).rejects.toThrow('Network failure');
  });

  it('rejects when response is not valid JSON', async () => {
    vi.stubGlobal(
      'GM_xmlhttpRequest',
      vi.fn(({ onload }: { onload: (r: { responseText: string }) => void }) => {
        onload({ responseText: 'not json!!!' });
      }),
    );
    await expect(ankiConnect('ping')).rejects.toThrow('invalid JSON');
  });
});

// ---------------------------------------------------------------------------
// createModel
// ---------------------------------------------------------------------------

const sampleModelSpec: ModelSpec = {
  modelName: 'Japanese Driving License (Bilingual)',
  inOrderFields: ['UID', 'Question_JA', 'Question_EN'],
  css: '.card {}',
  cardTemplates: [{ Name: 'Card 1', Front: '{{Question_EN}}', Back: '{{FrontSide}}' }],
};

describe('createModel', () => {
  it('resolves with model ID on success', async () => {
    stubGmSuccess(123456789);
    await expect(createModel(sampleModelSpec)).resolves.toBe(123456789);
  });

  it('resolves with null when model already exists (result=null, error=null)', async () => {
    stubGmSuccess(null);
    await expect(createModel(sampleModelSpec)).resolves.toBeNull();
  });

  it('rejects when AnkiConnect returns an error', async () => {
    stubGmError('Model name already exists');
    await expect(createModel(sampleModelSpec)).rejects.toThrow('Model name already exists');
  });
});

// ---------------------------------------------------------------------------
// createDeck
// ---------------------------------------------------------------------------

describe('createDeck', () => {
  it('resolves with numeric deck ID on success', async () => {
    stubGmSuccess(1234567890);
    await expect(createDeck('Japanese Driving License::Karimen (仮免)::Karimen exam no 10')).resolves.toBe(
      1234567890,
    );
  });

  it('passes deck name as params.deck', async () => {
    stubGmSuccess(99);
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await createDeck('My::Deck');

    const body = JSON.parse(gmSpy.mock.calls[0][0].data);
    expect(body.params).toEqual({ deck: 'My::Deck' });
  });

  it('rejects with AnkiConnect error string', async () => {
    stubGmError('cannot create deck');
    await expect(createDeck('Bad Deck')).rejects.toThrow('cannot create deck');
  });
});

// ---------------------------------------------------------------------------
// findNotes
// ---------------------------------------------------------------------------

describe('findNotes', () => {
  it('resolves with array of note IDs', async () => {
    stubGmSuccess([1234567890]);
    await expect(findNotes('UID:q_abc12345')).resolves.toEqual([1234567890]);
  });

  it('resolves with empty array when no notes found', async () => {
    stubGmSuccess([]);
    await expect(findNotes('UID:q_notfound')).resolves.toEqual([]);
  });

  it('passes query in params', async () => {
    stubGmSuccess([]);
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await findNotes('deck:MyDeck');

    const body = JSON.parse(gmSpy.mock.calls[0][0].data);
    expect(body.params).toEqual({ query: 'deck:MyDeck' });
  });

  it('rejects with AnkiConnect error string', async () => {
    stubGmError('invalid query syntax');
    await expect(findNotes('???')).rejects.toThrow('invalid query syntax');
  });
});

// ---------------------------------------------------------------------------
// addNote
// ---------------------------------------------------------------------------

const sampleNote: NotePayload = {
  deckName: 'Japanese Driving License::Karimen (仮免)::Karimen exam no 10',
  modelName: 'Japanese Driving License (Bilingual)',
  fields: { UID: 'q_abc12345', Question_JA: '質問', Question_EN: 'Question' },
  tags: ['license_jp', 'karimen'],
};

describe('addNote', () => {
  it('resolves with new note ID on success', async () => {
    stubGmSuccess(9876543210);
    await expect(addNote(sampleNote)).resolves.toBe(9876543210);
  });

  it('wraps note in params.note', async () => {
    stubGmSuccess(1);
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await addNote(sampleNote);

    const body = JSON.parse(gmSpy.mock.calls[0][0].data);
    expect(body.params.note).toEqual(sampleNote);
  });

  it('rejects on duplicate note error', async () => {
    stubGmError('cannot create note because it is a duplicate');
    await expect(addNote(sampleNote)).rejects.toThrow('duplicate');
  });
});

// ---------------------------------------------------------------------------
// addTags
// ---------------------------------------------------------------------------

describe('addTags', () => {
  it('resolves without error on success (null result)', async () => {
    stubGmSuccess(null);
    await expect(addTags([111, 222], 'failed exam_10')).resolves.toBeNull();
  });

  it('passes notes array and space-separated tags string', async () => {
    stubGmSuccess(null);
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await addTags([111, 222], 'failed exam_10');

    const body = JSON.parse(gmSpy.mock.calls[0][0].data);
    expect(body.params).toEqual({ notes: [111, 222], tags: 'failed exam_10' });
  });

  it('rejects with AnkiConnect error string', async () => {
    stubGmError('notes not found');
    await expect(addTags([999], 'failed')).rejects.toThrow('notes not found');
  });
});

// ---------------------------------------------------------------------------
// storeMediaFile
// ---------------------------------------------------------------------------

describe('storeMediaFile', () => {
  it('resolves with the stored filename on success', async () => {
    stubGmSuccess('sign.png');
    await expect(storeMediaFile('sign.png', 'https://karimen-honmen.com/img/sign.png')).resolves.toBe(
      'sign.png',
    );
  });

  it('sends correct params: filename, url, deleteExisting: false', async () => {
    stubGmSuccess('sign.png');
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await storeMediaFile('sign.png', 'https://karimen-honmen.com/img/sign.png');

    const body = JSON.parse(gmSpy.mock.calls[0][0].data);
    expect(body.action).toBe('storeMediaFile');
    expect(body.params).toEqual({
      filename: 'sign.png',
      url: 'https://karimen-honmen.com/img/sign.png',
      deleteExisting: false,
    });
  });

  it('rejects on AnkiConnect error', async () => {
    stubGmError('file write error');
    await expect(
      storeMediaFile('sign.png', 'https://karimen-honmen.com/img/sign.png'),
    ).rejects.toThrow('file write error');
  });

  it('rejects on network failure', async () => {
    stubGmNetworkError();
    await expect(
      storeMediaFile('sign.png', 'https://karimen-honmen.com/img/sign.png'),
    ).rejects.toThrow('Network failure');
  });
});

// ---------------------------------------------------------------------------
// storeMediaFileData
// ---------------------------------------------------------------------------

describe('storeMediaFileData', () => {
  it('resolves with the stored filename on success', async () => {
    stubGmSuccess('sign.png');
    await expect(storeMediaFileData('sign.png', 'AQID')).resolves.toBe('sign.png');
  });

  it('sends correct params: filename, data (base64), deleteExisting: false', async () => {
    stubGmSuccess('sign.png');
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await storeMediaFileData('sign.png', 'AQID');

    const body = JSON.parse(gmSpy.mock.calls[0][0].data as string);
    expect(body.action).toBe('storeMediaFile');
    expect(body.params).toEqual({
      filename: 'sign.png',
      data: 'AQID',
      deleteExisting: false,
    });
  });

  it('does NOT include a url key in params', async () => {
    stubGmSuccess('sign.png');
    const gmSpy = vi.mocked(GM_xmlhttpRequest);
    await storeMediaFileData('sign.png', 'AQID');

    const body = JSON.parse(gmSpy.mock.calls[0][0].data as string);
    expect(body.params).not.toHaveProperty('url');
  });

  it('rejects on AnkiConnect error', async () => {
    stubGmError('file write error');
    await expect(storeMediaFileData('sign.png', 'AQID')).rejects.toThrow('file write error');
  });

  it('rejects on network failure', async () => {
    stubGmNetworkError();
    await expect(storeMediaFileData('sign.png', 'AQID')).rejects.toThrow('Network failure');
  });
});

// ---------------------------------------------------------------------------
// fetchImageAsBase64
// ---------------------------------------------------------------------------

/** Stubs GM_xmlhttpRequest to call onload with an arraybuffer response. */
function stubGmArrayBuffer(status: number, contentType: string, buffer: ArrayBuffer): void {
  vi.stubGlobal(
    'GM_xmlhttpRequest',
    vi.fn(({ onload }: { onload: (r: unknown) => void }) => {
      onload({
        status,
        responseHeaders: `content-type: ${contentType}\r\n`,
        response: buffer,
        responseText: '',
      });
    }),
  );
}

describe('fetchImageAsBase64', () => {
  it('resolves with base64-encoded image data on 200 response', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    stubGmArrayBuffer(200, 'image/png', bytes.buffer);

    const result = await fetchImageAsBase64('https://example.com/img/test.png');
    // btoa(String.fromCharCode(1, 2, 3)) === 'AQID'
    expect(result).toBe('AQID');
  });

  it('sends a GET request with responseType "arraybuffer"', async () => {
    stubGmArrayBuffer(200, 'image/png', new Uint8Array([1]).buffer);
    const gmSpy = vi.mocked(GM_xmlhttpRequest);

    await fetchImageAsBase64('https://karimen-honmen.com/img/sign.png');

    const call = gmSpy.mock.calls[0][0];
    expect(call.url).toBe('https://karimen-honmen.com/img/sign.png');
    expect(call.method).toBe('GET');
    expect(call.responseType).toBe('arraybuffer');
  });

  it('rejects on non-2xx HTTP status', async () => {
    stubGmArrayBuffer(403, 'image/png', new Uint8Array([]).buffer);
    await expect(fetchImageAsBase64('https://example.com/img.png')).rejects.toThrow('403');
  });

  it('rejects on non-image Content-Type', async () => {
    stubGmArrayBuffer(200, 'text/html', new Uint8Array([1, 2, 3]).buffer);
    await expect(fetchImageAsBase64('https://example.com/img.png')).rejects.toThrow('text/html');
  });

  it('rejects on network error (onerror callback)', async () => {
    stubGmNetworkError();
    await expect(fetchImageAsBase64('https://example.com/img.png')).rejects.toThrow(
      'Network failure',
    );
  });

  it('handles image/jpeg content-type', async () => {
    const bytes = new Uint8Array([255, 216, 255]);
    stubGmArrayBuffer(200, 'image/jpeg', bytes.buffer);

    const result = await fetchImageAsBase64('https://example.com/photo.jpg');
    expect(result).toBe(btoa(String.fromCharCode(255, 216, 255)));
  });

  it('handles content-type with additional parameters (e.g. charset)', async () => {
    stubGmArrayBuffer(200, 'image/png; charset=utf-8', new Uint8Array([1]).buffer);
    // Should not reject — content-type starts with "image/"
    await expect(fetchImageAsBase64('https://example.com/img.png')).resolves.toBeDefined();
  });
});
