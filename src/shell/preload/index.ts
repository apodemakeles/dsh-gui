/**
 * Preload bridge for the dsh-gui shell. Scaffold stub.
 * Design stage: this becomes the IPC fetch carrier surface between the
 * renderer and the dsh host — only doFetch is swapped, the client contract
 * stays unchanged (see .scratch/dsh-gui-scaffold/research/dsh-plugin-standards.md §A2).
 */
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('dshGui', {
  stage: 'scaffold',
})
