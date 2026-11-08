/**
 * 3.4.1: the look of every page DevForge writes into a project (welcome,
 * sign-in, sign-up, dashboard), as one stylesheet the project keeps beside
 * its views: devforge.css. DevForge's « Forge » look: warm graphite, Forgy's orange.
 * Both page kinds cover the whole window, so the template's own styles
 * (Vite's #root, body…) cannot get in their way.
 */

const MONO = '"JetBrains Mono Variable", "JetBrains Mono", "Cascadia Code", Consolas, monospace'
const DISPLAY = '"Bricolage Grotesque Variable", "Bricolage Grotesque", "Segoe UI", system-ui, -apple-system, sans-serif'

export const DEVFORGE_CSS = `/* DevForge pages: welcome (.df-welcome) and account (.df-auth). Edit freely. */

body:has(.df-welcome, .df-auth) { margin: 0; }

.df-welcome,
.df-auth {
  position: fixed;
  inset: 0;
  overflow: auto;
  z-index: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  text-align: left;
  background: #121110;
  color: #F2EEE9;
  font: 14px/1.6 "Inter Variable", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.df-welcome *, .df-auth * { box-sizing: border-box; }
.df-welcome a { color: #F2EEE9; text-decoration: none; }
.df-auth a { color: #FF7A33; text-decoration: none; }
.df-auth a:hover { text-decoration: underline; }

/* Top bar */
.df-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 28px; border-bottom: 1px solid #25221F; background: #151311; }
.df-brand { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: #F2EEE9; }
.df-auth .df-brand { color: #F2EEE9; }
.df-brand span { font: 500 12px ${MONO}; color: #8C847B; }
.df-nav { display: flex; align-items: center; gap: 8px; }
.df-nav form { margin: 0; }

/* Buttons */
.df-btn { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 9px; border: 1px solid #2E2A26; background: #221F1C; color: #F2EEE9; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: box-shadow .15s; }
.df-btn:hover { box-shadow: inset 0 0 0 100px rgba(255, 255, 255, .07); }
.df-welcome .df-primary, .df-primary { background: #FF7A33; border-color: #FF7A33; color: #1A0A02; font-weight: 600; }

/* Welcome page */
.df-body { flex: 1; display: flex; flex-wrap: wrap; }
.df-side { flex: 1 1 260px; max-width: 320px; min-width: 0; padding: 28px; border-right: 1px solid #25221F; background: #151311; display: flex; flex-direction: column; gap: 16px; }
.df-icon { width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; background: #2B1A10; border: 1px solid #5C3016; color: #FF7A33; font: 600 20px ${MONO}; }
.df-welcome h1 { margin: 0; font: 700 28px/1.2 ${DISPLAY}; letter-spacing: -.025em; }
.df-sub { margin: 0; font: 500 12.5px ${MONO}; color: #B5ADA4; }
.df-pill { align-self: flex-start; font: 500 11px ${MONO}; color: #4ACB8A; background: #13281D; padding: 4px 10px; border-radius: 999px; }
.df-info { display: flex; flex-direction: column; gap: 8px; font: 500 12px ${MONO}; color: #B5ADA4; }
.df-info div { display: flex; justify-content: space-between; gap: 12px; }
.df-info b { font-weight: 500; color: #D9D2C9; }
.df-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.df-tags span { font: 500 11px ${MONO}; color: #B5ADA4; background: #221F1C; border: 1px solid #2E2A26; padding: 2px 8px; border-radius: 6px; }
.df-main { flex: 999 1 560px; min-width: 0; max-width: 1040px; padding: 28px; display: flex; flex-direction: column; gap: 16px; }
.df-card { padding: 20px; border-radius: 14px; background: #1A1816; border: 1px solid #2E2A26; display: flex; flex-direction: column; gap: 12px; }
.df-welcome h2 { margin: 0; font: 500 11px ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: #B5ADA4; }
.df-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; font-size: 13px; }
.df-tiles div { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; background: #221F1C; }
.df-tiles div::before { content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; background: #4ACB8A; }
.df-row { display: flex; flex-wrap: wrap; gap: 8px; }
.df-foot { margin: 0; font-size: 12.5px; color: #B5ADA4; line-height: 1.5; }
.df-foot code { font: 500 12px ${MONO}; color: #D9D2C9; background: #221F1C; border-radius: 5px; padding: 1px 6px; }
@media (max-width: 720px) {
  .df-side { max-width: none; border-right: 0; border-bottom: 1px solid #25221F; }
}

/* Account pages: sign-in, sign-up, dashboard */
.df-center { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 16px; }
.df-box { width: 100%; max-width: 400px; padding: 28px; border-radius: 14px; background: #1A1816; border: 1px solid #2E2A26; display: flex; flex-direction: column; gap: 16px; }
.df-box h1 { margin: 0; font: 700 24px/1.2 ${DISPLAY}; letter-spacing: -.025em; }
.df-lead { margin: -10px 0 0; color: #B5ADA4; }
.df-field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: #B5ADA4; }
.df-field input { height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid #3A342E; background: #121110; color: #F2EEE9; font-family: inherit; font-size: 14px; outline: 0; }
.df-field input:focus { border-color: #FF7A33; }
.df-err { color: #FF7A6E; font-size: 12.5px; }
.df-alert { padding: 10px 12px; border-radius: 9px; background: #2D1714; border: 1px solid #4F2520; color: #FF7A6E; font-size: 13px; }
.df-submit { height: 40px; border: 0; border-radius: 9px; background: #FF7A33; color: #1A0A02; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.df-submit:disabled { opacity: .6; cursor: default; }
.df-ghost { height: 36px; padding: 0 14px; border-radius: 9px; border: 1px solid #2E2A26; background: #221F1C; color: #F2EEE9; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.df-small { margin: 0; text-align: center; font-size: 13px; color: #B5ADA4; }
.df-wide { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 16px; }
.df-wide .df-box { max-width: none; }
.df-box h2 { margin: 0; font-size: 16px; font-weight: 600; }
.df-note { margin: 0; color: #B5ADA4; }
.df-auth a.df-ghost { display: inline-flex; align-items: center; color: #F2EEE9; text-decoration: none; }
.df-routes { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font: 500 12.5px ${MONO}; }
.df-routes li { display: flex; gap: 10px; padding: 8px 10px; border-radius: 8px; background: #221F1C; }
.df-routes b { min-width: 44px; color: #FF7A33; font-weight: 500; }
`

/** DevForge's anvil, the app's own logo, in its icon's colours (src/renderer/src/assets/icon.svg) */
export const ANVIL = '<svg width="26" height="26" viewBox="0 0 256 256" aria-hidden="true"><rect width="256" height="256" rx="56" fill="#0F1117"></rect><g fill="#F97316"><polygon points="41,87 200,87 200,118 77,118"></polygon><rect x="108" y="118" width="61" height="31"></rect><rect x="82" y="148" width="113" height="26"></rect></g></svg>'
