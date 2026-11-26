import { svg } from 'lit'
import type { IconName } from 'config/main.ts'


// Line icons on a 24 by 24 grid, drawn with the text colour.
const PATHS = {
    document: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
    window: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18',
    user: 'M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21c0-4 3.6-6 8-6s8 2 8 6',
    tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
    folder: 'M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    signOut: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
    collapse: 'M15 6l-6 6 6 6',
} as const

export type AppIcon = IconName | 'settings' | 'signOut' | 'collapse'

export const icon = (name: AppIcon, size = 22): unknown =>
    svg`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${PATHS[name]}></path></svg>`
