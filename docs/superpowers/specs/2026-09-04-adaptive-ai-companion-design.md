# Adaptive AI Companion Design

**Goal:** Connect the existing AI Companion interface to the existing server API using DeepSeek, while adapting answer language and reading style to user-selected preferences.

## Scope

- Keep the existing `POST /api/ask` endpoint and `TASKS` task registry.
- Replace the Anthropic-specific request in `runTask()` with a DeepSeek-compatible request while keeping task prompts on the server.
- Accept optional `language` and `style` preferences in the request body.
- Support Australian English, Simplified Chinese, and Traditional Chinese.
- Support simple, standard, and expressive output styles.
- Connect quick questions, free-form Ask AI, Daily Suggestion, and Safety Tip in `script.js`.
- Keep the app runnable without an API key; show a clear friendly error when API access is unavailable.

## Architecture

The server remains the trust boundary. The browser sends a named task, user input, and non-sensitive presentation preferences. `server.js` validates those fields, builds a bounded style instruction, combines it with `BASE_SYSTEM` and the task-specific prompt, and calls DeepSeek through its OpenAI-compatible chat completions endpoint. The provider and model are configured through environment variables so the task registry remains provider-independent.

## Safety and language rules

Safety rules always have priority over style preferences. The server must continue to reject unknown tasks and empty input, preserve prompt-injection protection for pasted messages, and preserve the existing medical, legal, financial, password, and scam-link restrictions. Language and style may change wording only, never safety boundaries.

Defaults are `en-AU` and `simple`. The user may select `en-AU`, `zh-CN`, or `zh-TW`, and `simple`, `standard`, or `expressive`. The expressive style may use gentle imagery, but remains concise, concrete, and suitable for older readers.

## API contract

Request:

```json
{
  "task": "ask",
  "input": "What can I do today?",
  "language": "en-AU",
  "style": "simple"
}
```

Response remains `{ task, text, suggestions? }` on success and `{ error }` on failure. The browser renders the returned text as text content, not HTML.

## Failure behavior

- Missing `DEEPSEEK_API_KEY`: return HTTP 503 with setup guidance.
- Invalid task, input, language, or style: return HTTP 400.
- DeepSeek rate limit or server failure: return HTTP 503 with a retry message.
- Other provider failure: return HTTP 502 with a generic message.
- Frontend request failure: keep the page usable and show the error in the answer area.

## Verification

- Unit-test exported pure server helpers for preference validation and prompt construction.
- Test the `/api/ask` validation path without making a real provider request.
- Run JavaScript syntax checks and the existing test command, if present.
- Manually verify the AI page with no API key and with a configured key in a local environment.
