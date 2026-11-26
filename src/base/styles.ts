import { css } from 'lit'


// Inputs, buttons and links, drawn with the theme tokens. Components that show them add
// these to their own styles, so one look is kept in one place.
export const controlStyles = css`
    input:not([type='checkbox']), textarea, select {
        box-sizing: border-box;
        min-block-size: 3rem;
        padding: 0 0.875rem;
        font: inherit;
        color: var(--monkey-color);
        background: var(--monkey-background-color);
        border: 1px solid var(--monkey-control-border-color);
        border-radius: var(--monkey-radius);
    }

    textarea {
        padding-block: 0.75rem;
        resize: vertical;
    }

    input[type='checkbox'] {
        inline-size: 1.375rem;
        block-size: 1.375rem;
        margin: 0;
        accent-color: var(--monkey-accent-color);
    }

    input[aria-invalid='true'], textarea[aria-invalid='true'], select[aria-invalid='true'] {
        border: 2px solid var(--monkey-error-color);
    }

    :is(input, textarea, select, button, a):focus-visible {
        outline: 3px solid var(--monkey-link-color);
        outline-offset: 2px;
    }
`

export const buttonStyles = css`
    button, a.button {
        display: inline-grid;
        place-items: center;
        box-sizing: border-box;
        min-block-size: 3rem;
        padding: 0 1.25rem;
        font: inherit;
        font-weight: 600;
        text-decoration: none;
        color: var(--monkey-color);
        background: transparent;
        border: 1px solid var(--monkey-control-border-color);
        border-radius: 999px;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    button[type='submit'], .primary {
        color: var(--monkey-accent-contrast-color);
        background: var(--monkey-accent-color);
        border-color: transparent;
    }

    .danger {
        color: var(--monkey-error-color);
    }
`

export const linkStyles = css`
    a {
        color: var(--monkey-link-color);
    }
`

// A boxed error message for a whole page or form. The text keeps the normal colour, and the
// box has the colour of the error, so the message does not rely on a red text alone.
export const alertStyles = css`
    [role='alert'] {
        margin: 0;
        padding: 0.75rem 1rem;
        color: var(--monkey-color);
        background: color-mix(in oklab, var(--monkey-error-color) 10%, var(--monkey-surface-color));
        border: 1px solid var(--monkey-error-color);
        border-radius: var(--monkey-radius);
    }
`
