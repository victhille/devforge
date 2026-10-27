import type { SetupStep } from '../types'
import { AUTH_RULES } from '../data/authContract'
import { AUTH_ANVIL, AUTH_CSS } from './nextAuthTemplate'

/**
 * v3.4 lot 4: authentication of a Laravel project. Fortify serves the pages
 * (/login, /register, /logout) with Blade views in DevForge's look, and the
 * shared contract's API (/api/auth/…) runs on Sanctum's personal tokens.
 * Laravel answers api/* in JSON on its own: 422 { message, errors } for
 * validation, 401 { message } without a token.
 */

const TEXT = {
  fr: {
    name: 'Nom', email: 'E-mail', password: 'Mot de passe', confirm: 'Confirmer le mot de passe', home: 'Accueil',
    loginTitle: 'Se connecter', loginLead: 'Content de vous revoir.', noAccount: 'Pas encore de compte ?', toRegister: 'Créer un compte',
    registerTitle: 'Créer un compte', registerLead: 'Quelques secondes, et vous y êtes.', registerSubmit: 'Créer mon compte', hasAccount: 'Déjà un compte ?',
    hello: 'Bonjour', signedIn: 'Vous êtes connecté.', logout: 'Se déconnecter', apiTitle: 'Votre API',
    apiLead: 'Ces routes suivent le contrat DevForge (jetons Sanctum) : un front React ou Vue créé par DevForge s\'y branche tel quel.',
    invalid: 'E-mail ou mot de passe incorrect.'
  },
  en: {
    name: 'Name', email: 'Email', password: 'Password', confirm: 'Confirm the password', home: 'Home',
    loginTitle: 'Sign in', loginLead: 'Good to see you again.', noAccount: 'No account yet?', toRegister: 'Create an account',
    registerTitle: 'Create an account', registerLead: 'A few seconds, and you are in.', registerSubmit: 'Create my account', hasAccount: 'Already have an account?',
    hello: 'Hello', signedIn: 'You are signed in.', logout: 'Sign out', apiTitle: 'Your API',
    apiLead: 'These routes follow the DevForge contract (Sanctum tokens): a React or Vue front made by DevForge plugs in as is.',
    invalid: 'Wrong email or password.'
  }
}

/** Blade escapes nothing in a literal: the texts are plain, with no {{ }} nor @ */
const layout = (name: string, lang: 'fr' | 'en', t: typeof TEXT.fr) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>@yield('title') · ${name}</title>
<style>${AUTH_CSS}</style>
</head>
<body style="margin:0">
<div class="df-auth">
  <header class="df-bar">
    <a href="/" class="df-brand">${AUTH_ANVIL}${name}</a>
    <a href="/">${t.home}</a>
  </header>
  <main class="df-center">
    @yield('content')
  </main>
</div>
</body>
</html>
`

const field = (label: string, input: string, name: string) => `  <label class="df-field">${label}
    ${input}
    @error('${name}')<span class="df-err">{{ $message }}</span>@enderror
  </label>`

const loginView = (t: typeof TEXT.fr) => `@extends('layouts.devforge')
@section('title', '${t.loginTitle}')
@section('content')
<form class="df-box" method="POST" action="{{ route('login') }}" novalidate>
  @csrf
  <h1>${t.loginTitle}</h1>
  <p class="df-lead">${t.loginLead}</p>
${field(t.email, '<input name="email" type="email" value="{{ old(\'email\') }}" autocomplete="email" required autofocus>', 'email')}
${field(t.password, '<input name="password" type="password" autocomplete="current-password" required>', 'password')}
  <button class="df-submit" type="submit">${t.loginTitle}</button>
  <p class="df-small">${t.noAccount} <a href="{{ route('register') }}">${t.toRegister}</a></p>
</form>
@endsection
`

const registerView = (t: typeof TEXT.fr) => `@extends('layouts.devforge')
@section('title', '${t.registerTitle}')
@section('content')
<form class="df-box" method="POST" action="{{ route('register') }}" novalidate>
  @csrf
  <h1>${t.registerTitle}</h1>
  <p class="df-lead">${t.registerLead}</p>
${field(t.name, '<input name="name" value="{{ old(\'name\') }}" autocomplete="name" required autofocus>', 'name')}
${field(t.email, '<input name="email" type="email" value="{{ old(\'email\') }}" autocomplete="email" required>', 'email')}
${field(t.password, '<input name="password" type="password" autocomplete="new-password" required>', 'password')}
  <label class="df-field">${t.confirm}
    <input name="password_confirmation" type="password" autocomplete="new-password" required>
  </label>
  <button class="df-submit" type="submit">${t.registerSubmit}</button>
  <p class="df-small">${t.hasAccount} <a href="{{ route('login') }}">${t.loginTitle}</a></p>
</form>
@endsection
`

const dashboardView = (t: typeof TEXT.fr) => `@extends('layouts.devforge')
@section('title', '${t.hello}')
@section('content')
<div class="df-wide">
  <section class="df-box" style="max-width:none">
    <h1>${t.hello} {{ auth()->user()->name }}</h1>
    <p class="df-lead">${t.signedIn} {{ auth()->user()->email }}</p>
    <form method="POST" action="{{ route('logout') }}">
      @csrf
      <button type="submit" class="df-ghost">${t.logout}</button>
    </form>
  </section>
  <section class="df-box" style="max-width:none">
    <h1 style="font-size:16px">${t.apiTitle}</h1>
    <p class="df-lead" style="margin:0">${t.apiLead}</p>
    <ul class="df-routes">
      <li><b>POST</b>/api/auth/register</li>
      <li><b>POST</b>/api/auth/login</li>
      <li><b>POST</b>/api/auth/logout</li>
      <li><b>GET</b>/api/auth/me</li>
    </ul>
  </section>
</div>
@endsection
`

const controller = (t: typeof TEXT.fr) => `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\User;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\Response;
use Illuminate\\Support\\Facades\\Hash;
use Laravel\\Sanctum\\PersonalAccessToken;

/**
 * The DevForge authentication contract (/api/auth/…), on Sanctum's personal tokens.
 * Laravel answers api/* in JSON: 422 { message, errors } on validation, 401 without a token.
 */
class AuthController extends Controller
{
    /** POST /api/auth/register { name, email, password } → 201 { user } */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:${AUTH_RULES.nameMax}'],
            'email' => ['required', 'string', 'email', 'max:${AUTH_RULES.emailMax}', 'unique:users,email'],
            'password' => ['required', 'string', 'min:${AUTH_RULES.passwordMin}'],
        ]);
        // The model hashes it (the 'password' => 'hashed' cast)
        $user = User::create(['name' => $data['name'], 'email' => strtolower($data['email']), 'password' => $data['password']]);

        return response()->json(['user' => $this->publicUser($user)], 201);
    }

    /** POST /api/auth/login { email, password } → 200 { user, token } */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);
        $user = User::where('email', strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => ${JSON.stringify(t.invalid)}], 401);
        }

        return response()->json(['user' => $this->publicUser($user), 'token' => $user->createToken('api')->plainTextToken]);
    }

    /** POST /api/auth/logout → 204, the token is revoked */
    public function logout(Request $request): Response
    {
        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->noContent();
    }

    /** GET /api/auth/me → 200 { user } */
    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->publicUser($request->user())]);
    }

    /** What the API shows of a user: never the password */
    private function publicUser(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }
}
`

/** Added to routes/api.php (which install:api writes; Laravel prefixes it with /api) */
export const LARAVEL_API_ROUTES = `
// DevForge authentication contract
Route::prefix('auth')->group(function () {
    Route::post('register', [\\App\\Http\\Controllers\\Api\\AuthController::class, 'register']);
    Route::post('login', [\\App\\Http\\Controllers\\Api\\AuthController::class, 'login']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [\\App\\Http\\Controllers\\Api\\AuthController::class, 'logout']);
        Route::get('me', [\\App\\Http\\Controllers\\Api\\AuthController::class, 'me']);
    });
});
`

/** Added to routes/web.php: the page Fortify sends a signed-in user to */
export const LARAVEL_WEB_ROUTES = `
Route::view('/dashboard', 'dashboard')->middleware('auth')->name('dashboard');
`

/** The Blade views and the API controller */
export function laravelAuthFiles(name: string, lang: 'fr' | 'en'): { path: string; content: string }[] {
  const t = TEXT[lang]
  return [
    { path: 'resources/views/layouts/devforge.blade.php', content: layout(name, lang, t) },
    { path: 'resources/views/auth/login.blade.php', content: loginView(t) },
    { path: 'resources/views/auth/register.blade.php', content: registerView(t) },
    { path: 'resources/views/dashboard.blade.php', content: dashboardView(t) },
    { path: 'app/Http/Controllers/Api/AuthController.php', content: controller(t) }
  ]
}

/** Fortify's views, its home after sign-in, and the routes of the pages and of the API */
export function laravelAuthPatches(label: { views: string; home: string; routes: string }): SetupStep[] {
  return [
    {
      kind: 'patch', label: label.views, file: 'app/Providers/FortifyServiceProvider.php',
      find: 'Fortify::createUsersUsing\\(CreateNewUser::class\\);', mode: 'after', unless: 'Fortify::loginView',
      text: "\n        Fortify::loginView(fn () => view('auth.login'));\n        Fortify::registerView(fn () => view('auth.register'));"
    },
    { kind: 'patch', label: label.home, file: 'config/fortify.php', find: "'home'\\s*=>\\s*'[^']*'", mode: 'replace', unless: "'home' => '/dashboard'", text: "'home' => '/dashboard'" },
    { kind: 'append', label: label.routes, file: 'routes/web.php', text: LARAVEL_WEB_ROUTES, unless: "'/dashboard'" },
    { kind: 'append', label: label.routes, file: 'routes/api.php', text: LARAVEL_API_ROUTES, unless: 'AuthController' }
  ]
}
