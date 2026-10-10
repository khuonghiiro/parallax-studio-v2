'use strict';

class SocialError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SocialError';
    Object.assign(this, details);
  }
}

class AuthError extends SocialError {
  constructor(provider, envVar, envPaths = []) {
    super(
      `${provider}: missing or invalid credential. Set env var "${envVar}". Checked: ${envPaths.join(', ') || '(no .env files loaded)'}`,
      { provider, envVar, envPaths, code: 'AUTH_ERROR' },
    );
    this.name = 'AuthError';
  }
}

class RateLimitError extends SocialError {
  constructor(provider, endpoint, retryAfterMs) {
    super(
      `${provider}: rate-limited on ${endpoint}. Retry after ${Math.round(retryAfterMs / 1000)}s.`,
      { provider, endpoint, retryAfterMs, code: 'RATE_LIMIT' },
    );
    this.name = 'RateLimitError';
  }
}

class ChannelUnsupportedError extends SocialError {
  constructor(channel, providers = []) {
    super(
      `No configured provider supports channel "${channel}". Configured: ${providers.length ? providers.join(', ') : '(none)'}`,
      { channel, providers, code: 'CHANNEL_UNSUPPORTED' },
    );
    this.name = 'ChannelUnsupportedError';
  }
}

class ProviderError extends SocialError {
  constructor(provider, endpoint, status, body) {
    const summary = typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body || {}).slice(0, 200);
    super(
      `${provider}: ${endpoint} returned ${status}. ${summary}`,
      { provider, endpoint, status, body, code: 'PROVIDER_ERROR' },
    );
    this.name = 'ProviderError';
  }
}

class ConfigError extends SocialError {
  constructor(message, filePath) {
    super(`${message}${filePath ? ` (file: ${filePath})` : ''}`, {
      filePath,
      code: 'CONFIG_ERROR',
    });
    this.name = 'ConfigError';
  }
}

module.exports = {
  SocialError,
  AuthError,
  RateLimitError,
  ChannelUnsupportedError,
  ProviderError,
  ConfigError,
};
