/** Shape of the AnkiConnect JSON response envelope. */
interface AnkiResponse<T> {
  result: T;
  error: string | null;
}

/** Parameters for GM_xmlhttpRequest. */
interface GmRequestDetails {
  url: string;
  method: string;
  data: string;
  headers?: Record<string, string>;
  onload: (response: { responseText: string }) => void;
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
