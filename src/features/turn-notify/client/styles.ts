// Scoped stylesheet (prefix tn-) for the turn-notify settings card, injected
// once into document.head; follows the shell's dark marker like token-usage.

export const STYLE_ID = 'dsh-turn-notify-styles'

export const STYLE_TEXT = [
  ':root {',
  '  --tn-border: rgba(0, 0, 0, 0.1); --tn-text: #1f2430; --tn-muted: #71788a;',
  '  --tn-switch-off: rgba(120, 120, 128, 0.32); --tn-switch-on: #34c759;',
  '}',
  'body[data-ds-dark-theme] {',
  '  --tn-border: rgba(255, 255, 255, 0.14); --tn-text: #e7e9ee; --tn-muted: #8b93a5;',
  '  --tn-switch-off: rgba(120, 120, 128, 0.4); --tn-switch-on: #30d158;',
  '}',
  '.tn-card { display: flex; align-items: center; gap: 12px; text-align: left; }',
  '.tn-card .tn-copy { flex: 1; min-width: 0; }',
  '.tn-card .tn-title { font-weight: 600; color: var(--tn-text); }',
  '.tn-card .tn-desc { margin-top: 2px; font-size: 12px; color: var(--tn-muted); }',
  '.tn-card .tn-state { margin-top: 2px; font-size: 12px; color: var(--tn-muted); }',
  '.tn-switch { position: relative; width: 40px; height: 24px; border-radius: 12px;',
  '  border: 1px solid var(--tn-border); background: var(--tn-switch-off); cursor: pointer;',
  '  padding: 0; flex: none; transition: background 0.15s ease; }',
  '.tn-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;',
  '  border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);',
  '  transition: left 0.15s ease; }',
  '.tn-switch[data-on="true"] { background: var(--tn-switch-on); }',
  '.tn-switch[data-on="true"]::after { left: 18px; }',
  '.tn-switch:disabled { opacity: 0.5; cursor: default; }',
].join('\n')

/** Mount the stylesheet; returns its disposer. */
export function injectStyles(): () => void {
  if (document.getElementById(STYLE_ID) !== null) return () => undefined
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = STYLE_TEXT
  document.head.appendChild(element)
  return () => {
    document.getElementById(STYLE_ID)?.remove()
  }
}
