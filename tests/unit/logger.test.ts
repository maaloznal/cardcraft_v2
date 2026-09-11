/**
 * Unit tests for Logger (src/lib/logger.ts).
 *
 * Tests:
 *   - Leveled output (debug/info/warn/error)
 *   - Level filtering (production: warn+error only)
 *   - Scoped loggers
 *   - setLevel override
 *   - Context object serialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, setLevel, logger } from '@/lib/logger';

describe('Logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    // Reset to debug level for tests
    setLevel('debug');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debug logs when level is debug', () => {
    const log = createLogger('Test');
    log.debug('debug message');
    expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('[Test] debug message'));
  });

  it('info logs when level is debug', () => {
    const log = createLogger('Test');
    log.info('info message');
    expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[Test] info message'));
  });

  it('warn logs when level is debug', () => {
    const log = createLogger('Test');
    log.warn('warn message');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[Test] warn message'));
  });

  it('error logs when level is debug', () => {
    const log = createLogger('Test');
    log.error('error message');
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[Test] error message'));
  });

  it('debug does NOT log when level is warn', () => {
    setLevel('warn');
    const log = createLogger('Test');
    log.debug('debug message');
    log.info('info message');
    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
  });

  it('warn + error still log when level is warn', () => {
    setLevel('warn');
    const log = createLogger('Test');
    log.warn('warn message');
    log.error('error message');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('nothing logs when level is silent', () => {
    setLevel('silent');
    const log = createLogger('Test');
    log.debug('debug');
    log.info('info');
    log.warn('warn');
    log.error('error');
    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it('scoped logger includes scope in output', () => {
    const log = createLogger('MyScope');
    log.info('test');
    expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[MyScope]'));
  });

  it('context object is serialized as JSON', () => {
    const log = createLogger('Test');
    log.info('message', { key: 'value', num: 42 });
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('"key":"value"'),
    );
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('"num":42'),
    );
  });

  it('timestamp is ISO 8601 format', () => {
    const log = createLogger('Test');
    log.info('test');
    const callArg = consoleSpy.info.mock.calls[0][0] as string;
    // Should contain a timestamp like [2025-09-11T...]
    expect(callArg).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('setLevel changes filtering at runtime', () => {
    const log = createLogger('Test');
    setLevel('error');
    log.warn('should not log');
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    log.error('should log');
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    setLevel('debug');
    log.warn('now should log');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
  });

  it('default logger has scope "Cardcraft"', () => {
    logger.info('test');
    expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[Cardcraft]'));
  });
});
