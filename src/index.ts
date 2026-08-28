/**
 * Host half of dsh-gui: the surface plugin that boots the Electron shell.
 * Scaffold stage — apply() is a stub. Design stage (see
 * .scratch/dsh-gui-scaffold/, tickets 03/05): launch the shell built into
 * out/, wire its lifecycle to the profile session, and register feature
 * modules from src/features/ here (single apply(), one-stop delivery).
 */

/** Diagnostic plugin name. */
export const name = 'dsh-gui'

/** Minimal structural context — the real one is provided by the dsh host at activation. */
interface Ctx {
  [key: string]: unknown
}

export function apply(_ctx: Ctx): void {
  // TODO(design): start the Electron shell (src/shell, built to out/) and
  // expose its lifecycle; requires the web-client assembly design.
}
