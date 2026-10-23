/** Shape of the AnkiConnect JSON response envelope. */
interface AnkiResponse<T> {
  result: T;
  error: string | null;
}

/** Shape of an onload response from GM_xmlhttpRequest. */
interface GmResponse {
  /** Populated for text/JSON requests. */
  responseText: string;
  /** Populated when responseType is "arraybuffer". */
  response?: ArrayBuffer;
  /** HTTP status code (e.g. 200, 403). */
  status?: number;
  /** Raw response headers string (CRLF-separated). */
  responseHeaders?: string;
}

/** Parameters for GM_xmlhttpRequest. */
interface GmRequestDetails {
  url: string;
  method: string;
  data?: string;
  responseType?: string;
  headers?: Record<string, string>;
  onload: (response: GmResponse) => void;
  onerror: (error: unknown) => void;
}

declare function GM_xmlhttpRequest(details: GmRequestDetails): void;

/**
 * Base AnkiConnect call. Posts `{ action, version: 6, params }` to
 * http://localhost:8765 via GM_xmlhttpRequest and returns the `result`
 * field, or rejects if the response carries a non-null `error`.
 */
export function ankiConnect<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const body = JSON.stringify({ action, version: 6, params });

    GM_xmlhttpRequest({
      url: 'http://localhost:8765',
      method: 'POST',
      data: body,
      headers: { 'Content-Type': 'application/json' },
      onload(response) {
        let parsed: AnkiResponse<T>;
        try {
          parsed = JSON.parse(response.responseText) as AnkiResponse<T>;
        } catch {
          reject(new Error('AnkiConnect returned invalid JSON'));
          return;
        }
        if (parsed.error !== null && parsed.error !== undefined) {
          reject(new Error(parsed.error));
        } else {
          resolve(parsed.result);
        }
      },
      onerror(error) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error('AnkiConnect request failed (network error)'));
        }
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Typed wrappers
// ---------------------------------------------------------------------------

export interface CardTemplate {
  Name: string;
  Front: string;
  Back: string;
}

export interface ModelSpec {
  modelName: string;
  inOrderFields: string[];
  css: string;
  cardTemplates: CardTemplate[];
}

/** Creates an Anki note type. Returns the model ID, or null if it already exists. */
export function createModel(spec: ModelSpec): Promise<number | null> {
  return ankiConnect<number | null>('createModel', spec as unknown as Record<string, unknown>);
}

/** Creates (or retrieves) an Anki deck by full path string. Returns the deck ID. */
export function createDeck(name: string): Promise<number> {
  return ankiConnect<number>('createDeck', { deck: name });
}

/** Searches Anki for notes matching `query`. Returns an array of note IDs. */
export function findNotes(query: string): Promise<number[]> {
  return ankiConnect<number[]>('findNotes', { query });
}

export interface NotePayload {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
}

/** Adds a new note to Anki. Returns the new note ID. */
export function addNote(note: NotePayload): Promise<number> {
  return ankiConnect<number>('addNote', { note });
}

/**
 * Appends tags to existing notes.
 * `tags` is a space-separated string per AnkiConnect spec.
 * Returns null on success.
 */
export function addTags(noteIds: number[], tags: string): Promise<null> {
  return ankiConnect<null>('addTags', { notes: noteIds, tags });
}

/**
 * Stores a media file in Anki's collection by having Anki download it from
 * `url`. Uses `deleteExisting: false` so repeated exports do not error.
 * Returns the filename as stored by Anki (typically the same as `filename`).
 */
export function storeMediaFile(filename: string, url: string): Promise<string> {
  return ankiConnect<string>('storeMediaFile', { filename, url, deleteExisting: false });
}

/**
 * Stores a media file in Anki's collection using base64-encoded data.
 * Uses `deleteExisting: false` so repeated exports do not error.
 * Returns the filename as stored by Anki.
 */
export function storeMediaFileData(filename: string, data: string): Promise<string> {
  return ankiConnect<string>('storeMediaFile', { filename, data, deleteExisting: false });
}

/**
 * Fetches an image via GM_xmlhttpRequest (which runs in the browser context
 * with full cookies/User-Agent) and returns a base64-encoded string of the
 * image data. Rejects on non-2xx status, non-image Content-Type, or network
 * error.
 */
export function fetchImageAsBase64(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    GM_xmlhttpRequest({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      onload(response) {
        const status = response.status ?? 0;
        if (status < 200 || status >= 300) {
          reject(new Error(`Image fetch failed with HTTP ${status}: ${url}`));
          return;
        }

        const rawHeaders = response.responseHeaders ?? '';
        const ctHeader = rawHeaders
          .split('\r\n')
          .find(h => h.toLowerCase().startsWith('content-type:'));
        const contentType = ctHeader ? ctHeader.slice(ctHeader.indexOf(':') + 1).trim() : '';
        if (!contentType.startsWith('image/')) {
          reject(
            new Error(`Expected image content-type but got "${contentType}": ${url}`),
          );
          return;
        }

        const buffer = response.response;
        if (!buffer) {
          reject(new Error(`No arraybuffer response for: ${url}`));
          return;
        }

        const uint8 = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        resolve(btoa(binary));
      },
      onerror(error) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(`Network error fetching image: ${url}`));
        }
      },
    });
  });
}
