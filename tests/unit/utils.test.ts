/**
 * Unit tests for src/core/utils.ts — pure functions, no side effects.
 */
import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeAttr,
  sanitizeCardId,
  isValidHexColor,
  clampFontSize,
  isValidTheme,
  isValidFormat,
  containsWholeWord,
  deepClone,
  generateId,
  splitOnce,
  isWordChar,
} from '@/core/utils';

describe('escapeHtml', () => {
  it('escapes &', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });
  it('escapes <', () => {
    expect(escapeHtml('a<b')).toBe('a&lt;b');
  });
  it('escapes >', () => {
    expect(escapeHtml('a>b')).toBe('a&gt;b');
  });
  it('escapes "', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b');
  });
  it("escapes '", () => {
    expect(escapeHtml("a'b")).toBe('a&#039;b');
  });
  it('escapes a full XSS payload', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });
  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
  it('returns empty string for null/undefined via `(str || "")` coercion', () => {
    // The implementation uses `(str || '')` so any falsy value becomes ''
    // @ts-expect-error testing runtime coercion
    expect(escapeHtml(null)).toBe('');
    // @ts-expect-error testing runtime coercion
    expect(escapeHtml(undefined)).toBe('');
  });
  it('throws for truthy non-string input (e.g. number) — no full coercion', () => {
    // The implementation only guards falsy; a truthy number passes through
    // unchanged and then `.replace` is missing → TypeError. Documenting
    // actual behavior so a future "fix" doesn't silently change semantics.
    // @ts-expect-error testing runtime coercion
    expect(() => escapeHtml(123)).toThrow(TypeError);
  });
  it('does not double-escape already-escaped ampersand (single-pass)', () => {
    // The function is single-pass replace — `&amp;` would have its `&` escaped again to `&amp;amp;`
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('escapeAttr', () => {
  it('escapes the same special chars as escapeHtml', () => {
    expect(escapeAttr('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
  });
  it('escapes single quote', () => {
    expect(escapeAttr("a'b")).toBe('a&#039;b');
  });
  it('strips null bytes (\\x00)', () => {
    expect(escapeAttr('a\x00b')).toBe('ab');
  });
  it('escapes newline (\\x0A) to &#10;', () => {
    expect(escapeAttr('a\nb')).toBe('a&#10;b');
  });
  it('escapes carriage return (\\x0D) to &#13;', () => {
    expect(escapeAttr('a\rb')).toBe('a&#13;b');
  });
  it('handles empty string', () => {
    expect(escapeAttr('')).toBe('');
  });
  it('handles null/undefined via falsy coercion', () => {
    // @ts-expect-error testing runtime coercion
    expect(escapeAttr(null)).toBe('');
    // @ts-expect-error testing runtime coercion
    expect(escapeAttr(undefined)).toBe('');
  });
  it('strips null bytes AND escapes newlines in the same input', () => {
    expect(escapeAttr('a\x00b\nc\rd')).toBe('ab&#10;c&#13;d');
  });
  it('does NOT escape backticks (limitation noted in audit)', () => {
    expect(escapeAttr('a`b')).toBe('a`b');
  });
});

describe('sanitizeCardId', () => {
  it('returns the same id for a valid alphanumeric id', () => {
    expect(sanitizeCardId('abc123')).toBe('abc123');
  });
  it('accepts underscore and hyphen', () => {
    expect(sanitizeCardId('card_1-2')).toBe('card_1-2');
  });
  it('accepts a 64-char id (boundary)', () => {
    const id = 'a'.repeat(64);
    expect(sanitizeCardId(id)).toBe(id);
  });
  it('rejects id with special chars and returns a UUID-shaped replacement', () => {
    const result = sanitizeCardId('"><script>alert(1)</script>');
    expect(result).not.toBe('"><script>alert(1)</script>');
    // Replacement matches the valid format regex
    expect(/^[a-zA-Z0-9_-]{1,64}$/.test(result)).toBe(true);
  });
  it('rejects non-string input and returns a valid id', () => {
    // @ts-expect-error testing runtime coercion
    const result = sanitizeCardId(null);
    expect(/^[a-zA-Z0-9_-]{1,64}$/.test(result)).toBe(true);
    // @ts-expect-error testing runtime coercion
    expect(/^[a-zA-Z0-9_-]{1,64}$/.test(sanitizeCardId(undefined))).toBe(true);
    // @ts-expect-error testing runtime coercion
    expect(/^[a-zA-Z0-9_-]{1,64}$/.test(sanitizeCardId(42))).toBe(true);
  });
  it('rejects id longer than 64 chars', () => {
    const tooLong = 'a'.repeat(65);
    const result = sanitizeCardId(tooLong);
    expect(result).not.toBe(tooLong);
    expect(/^[a-zA-Z0-9_-]{1,64}$/.test(result)).toBe(true);
  });
  it('rejects empty string id', () => {
    const result = sanitizeCardId('');
    expect(/^[a-zA-Z0-9_-]{1,64}$/.test(result)).toBe(true);
    expect(result).not.toBe('');
  });
  it('generates different ids on subsequent invalid calls (entropy sanity)', () => {
    const a = sanitizeCardId('<bad>');
    const b = sanitizeCardId('<bad>');
    // randomUUID should be unique; fall-back path also has Math.random
    expect(a).not.toBe(b);
  });
});

describe('isValidHexColor', () => {
  it('accepts 3-digit hex', () => {
    expect(isValidHexColor('#fff')).toBe(true);
  });
  it('accepts 4-digit hex (with alpha)', () => {
    expect(isValidHexColor('#fff8')).toBe(true);
  });
  it('accepts 6-digit hex', () => {
    expect(isValidHexColor('#ffffff')).toBe(true);
  });
  it('accepts 8-digit hex (with alpha)', () => {
    expect(isValidHexColor('#ffffffff')).toBe(true);
  });
  it('accepts uppercase hex', () => {
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#ABC')).toBe(true);
  });
  it('rejects string without leading #', () => {
    expect(isValidHexColor('ffffff')).toBe(false);
  });
  it('rejects 5-digit hex (invalid length)', () => {
    expect(isValidHexColor('#fffff')).toBe(false);
  });
  it('rejects 7-digit hex (invalid length)', () => {
    expect(isValidHexColor('#ffffffa')).toBe(false);
  });
  it('rejects non-hex chars', () => {
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(isValidHexColor('#xyz')).toBe(false);
  });
  it('rejects non-string input', () => {
    // @ts-expect-error testing runtime coercion
    expect(isValidHexColor(null)).toBe(false);
    // @ts-expect-error testing runtime coercion
    expect(isValidHexColor(undefined)).toBe(false);
    // @ts-expect-error testing runtime coercion
    expect(isValidHexColor(123)).toBe(false);
    // @ts-expect-error testing runtime coercion
    expect(isValidHexColor({})).toBe(false);
  });
  it('acts as a TypeScript type guard (narrows to string)', () => {
    const c: unknown = '#abc';
    if (isValidHexColor(c)) {
      // c is narrowed to string here
      expect(c.length).toBe(4);
    }
  });
});

describe('clampFontSize', () => {
  it('returns the size as-is when within [8, 96]', () => {
    expect(clampFontSize(16)).toBe(16);
    expect(clampFontSize(8)).toBe(8);
    expect(clampFontSize(96)).toBe(96);
    expect(clampFontSize(50)).toBe(50);
  });
  it('clamps values below 8 up to 8', () => {
    expect(clampFontSize(0)).toBe(8);
    expect(clampFontSize(-5)).toBe(8);
    expect(clampFontSize(7.99)).toBe(8);
  });
  it('clamps values above 96 down to 96', () => {
    expect(clampFontSize(97)).toBe(96);
    expect(clampFontSize(200)).toBe(96);
    expect(clampFontSize(1000)).toBe(96);
  });
  it('returns 16 for NaN', () => {
    expect(clampFontSize(NaN)).toBe(16);
  });
  it('returns 16 for Infinity', () => {
    expect(clampFontSize(Infinity)).toBe(16);
    expect(clampFontSize(-Infinity)).toBe(16);
  });
  it('returns 16 for non-number input', () => {
    // @ts-expect-error testing runtime coercion
    expect(clampFontSize('16')).toBe(16);
    // @ts-expect-error testing runtime coercion
    expect(clampFontSize(null)).toBe(16);
    // @ts-expect-error testing runtime coercion
    expect(clampFontSize(undefined)).toBe(16);
    // @ts-expect-error testing runtime coercion
    expect(clampFontSize({})).toBe(16);
  });
  it('clamps floats inside range', () => {
    expect(clampFontSize(22.5)).toBe(22.5);
  });
});

describe('isValidTheme', () => {
  const allowed = ['default', 'ocean', 'forest'] as const;
  it('returns true for a theme in the whitelist', () => {
    expect(isValidTheme('ocean', allowed)).toBe(true);
    expect(isValidTheme('default', allowed)).toBe(true);
  });
  it('returns false for a theme not in the whitelist', () => {
    expect(isValidTheme('evil-theme', allowed)).toBe(false);
    expect(isValidTheme('', allowed)).toBe(false);
  });
  it('returns false for non-string input', () => {
    // @ts-expect-error testing runtime coercion
    expect(isValidTheme(null, allowed)).toBe(false);
    // @ts-expect-error testing runtime coercion
    expect(isValidTheme(undefined, allowed)).toBe(false);
    // @ts-expect-error testing runtime coercion
    expect(isValidTheme(42, allowed)).toBe(false);
  });
  it('returns false for case-mismatched theme (whitelist is case-sensitive)', () => {
    expect(isValidTheme('OCEAN', allowed)).toBe(false);
  });
});

describe('isValidFormat', () => {
  const allowed = ['auto', 'telegram', 'whatsapp'] as const;
  it('returns true for a valid format', () => {
    expect(isValidFormat('auto', allowed)).toBe(true);
    expect(isValidFormat('telegram', allowed)).toBe(true);
  });
  it('returns false for an invalid format', () => {
    expect(isValidFormat('evil-format', allowed)).toBe(false);
  });
  it('returns false for non-string input', () => {
    // @ts-expect-error testing runtime coercion
    expect(isValidFormat(null, allowed)).toBe(false);
    // @ts-expect-error testing runtime coercion
    expect(isValidFormat(undefined, allowed)).toBe(false);
  });
});

describe('containsWholeWord', () => {
  it('matches a whole word in the middle of text', () => {
    expect(containsWholeWord('the quick brown fox', 'fox')).toBe(true);
  });
  it('matches a word at the start of text', () => {
    expect(containsWholeWord('fox is here', 'fox')).toBe(true);
  });
  it('matches a word at the end of text', () => {
    expect(containsWholeWord('here is the fox', 'fox')).toBe(true);
  });
  it('does NOT match a substring inside another word', () => {
    expect(containsWholeWord('foxy lady', 'fox')).toBe(false);
    expect(containsWholeWord('unfoxy', 'fox')).toBe(false);
  });
  it('matches a word surrounded by punctuation (non-word chars)', () => {
    expect(containsWholeWord('(fox)', 'fox')).toBe(true);
    expect(containsWholeWord('fox, fox.', 'fox')).toBe(true);
  });
  it('matches a word surrounded by whitespace', () => {
    expect(containsWholeWord('a fox b', 'fox')).toBe(true);
  });
  it('returns false for empty word', () => {
    expect(containsWholeWord('some text', '')).toBe(false);
  });
  it('returns false when word is not in text at all', () => {
    expect(containsWholeWord('hello world', 'fox')).toBe(false);
  });
  it('matches the word when text IS the word', () => {
    expect(containsWholeWord('fox', 'fox')).toBe(true);
  });
  it('treats underscore as a word char (does not match across underscore boundary)', () => {
    expect(containsWholeWord('foo_bar', 'foo')).toBe(false);
    expect(containsWholeWord('foo_bar', 'bar')).toBe(false);
  });
  it('treats digits as word chars', () => {
    expect(containsWholeWord('abc123', 'abc')).toBe(false);
    expect(containsWholeWord('abc 123', 'abc')).toBe(true);
  });
});

describe('deepClone', () => {
  it('clones a plain object', () => {
    const src = { a: 1, b: 'x' };
    const copy = deepClone(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
  });
  it('deep-clones nested objects', () => {
    const src = { a: { b: { c: 1 } } };
    const copy = deepClone(src);
    expect(copy).toEqual(src);
    expect(copy.a).not.toBe(src.a);
    expect(copy.a.b).not.toBe(src.a.b);
  });
  it('clones arrays', () => {
    const src = [1, 2, { x: 'y' }];
    const copy = deepClone(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
    expect(copy[2]).not.toBe(src[2]);
  });
  it('mutating the clone does NOT affect the original', () => {
    const src = { a: { b: 1 } };
    const copy = deepClone(src);
    copy.a.b = 999;
    expect(src.a.b).toBe(1);
  });
  it('mutating a cloned array does NOT affect the original', () => {
    const src = [1, 2, 3];
    const copy = deepClone(src);
    copy.push(4);
    expect(src).toEqual([1, 2, 3]);
  });
  it('drops functions and undefined (JSON semantics)', () => {
    const src = { a: 1, fn: () => 'x', u: undefined };
    const copy = deepClone(src);
    expect(copy).toEqual({ a: 1 });
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
  it('generates unique ids on subsequent calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId());
    expect(ids.size).toBe(100);
  });
  it('in jsdom, crypto.randomUUID is available and produces UUID-shaped ids', () => {
    const id = generateId();
    // crypto.randomUUID → "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('splitOnce', () => {
  it('splits on first occurrence of separator', () => {
    expect(splitOnce('a.b.c', '.')).toEqual(['a', 'b.c']);
  });
  it('returns [s, ""] when separator not found', () => {
    expect(splitOnce('abc', '.')).toEqual(['abc', '']);
  });
  it('returns ["", rest] when string starts with separator', () => {
    expect(splitOnce('.abc', '.')).toEqual(['', 'abc']);
  });
  it('returns [s, ""] when string is empty', () => {
    expect(splitOnce('', '.')).toEqual(['', '']);
  });
  it('handles multi-char separator', () => {
    expect(splitOnce('a::b::c', '::')).toEqual(['a', 'b::c']);
  });
  it('handles empty separator (returns ["", rest] — indexOf("") === 0)', () => {
    expect(splitOnce('abc', '')).toEqual(['', 'abc']);
  });
});

describe('isWordChar', () => {
  it('returns true for ASCII letters', () => {
    expect(isWordChar('a')).toBe(true);
    expect(isWordChar('Z')).toBe(true);
  });
  it('returns true for digits', () => {
    expect(isWordChar('0')).toBe(true);
    expect(isWordChar('9')).toBe(true);
  });
  it('returns true for underscore', () => {
    expect(isWordChar('_')).toBe(true);
  });
  it('returns false for whitespace', () => {
    expect(isWordChar(' ')).toBe(false);
    expect(isWordChar('\t')).toBe(false);
    expect(isWordChar('\n')).toBe(false);
  });
  it('returns false for punctuation', () => {
    expect(isWordChar('.')).toBe(false);
    expect(isWordChar(',')).toBe(false);
    expect(isWordChar('!')).toBe(false);
    expect(isWordChar('(')).toBe(false);
    expect(isWordChar('-')).toBe(false);
  });
  it('returns true for Unicode letters (Cyrillic, etc.)', () => {
    expect(isWordChar('п')).toBe(true); // Russian letter
    expect(isWordChar('中')).toBe(true); // Chinese character
  });
  it('handles empty string by returning false (regex.test with empty input)', () => {
    expect(isWordChar('')).toBe(false);
  });
});
