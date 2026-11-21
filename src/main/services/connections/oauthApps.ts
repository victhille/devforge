import { app } from 'electron'

/**
 * The apps DevForge signs in with, registered by its author with each service. A client ID is public
 * (it is in every sign-in address): no secret is kept, GitHub's device flow and Vercel's PKCE need none.
 * An empty ID leaves the « Se connecter » button out, and the token can still be pasted.
 */

/** GitHub › Settings › Developer settings › OAuth Apps, with « Enable Device Flow » */
const GITHUB_CLIENT_ID = 'Ov23liyKtuS7d6u7palb'
/** Repositories (private ones too), pull requests, Actions and releases; the organizations' list */
export const GITHUB_SCOPES = 'repo read:org'

/** Vercel › team Settings › Apps, authentication « none », callback http://127.0.0.1:47823/callback. Empty: its
 * API permissions (projects, deployments) are a private beta, a token with OpenID scopes only reads nothing */
const VERCEL_CLIENT_ID = ''
/** The access token lasts an hour: offline_access gives the refresh token that renews it */
export const VERCEL_SCOPES = 'openid offline_access'
export const VERCEL_AUTHORIZE_URL = 'https://vercel.com/oauth/authorize'

// Tests give their own IDs and point at local fakes (never in the installed app)
const test = (name: string) => (!app.isPackaged && process.env[name]) || ''

export const githubClientId = () => test('DEVFORGE_TEST_GITHUB_CLIENT_ID') || GITHUB_CLIENT_ID
export const vercelClientId = () => test('DEVFORGE_TEST_VERCEL_CLIENT_ID') || VERCEL_CLIENT_ID

const githubLogin = () => test('DEVFORGE_TEST_GITHUB_LOGIN') || 'https://github.com'
export const githubDeviceCodeUrl = () => `${githubLogin()}/login/device/code`
export const githubTokenUrl = () => `${githubLogin()}/login/oauth/access_token`
export const vercelTokenUrl = () => `${test('DEVFORGE_TEST_VERCEL_API') || 'https://api.vercel.com'}/login/oauth/token`
