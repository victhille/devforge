import { AUTH_RULES } from '../data/authContract'
import { ANVIL, DEVFORGE_CSS } from './devforgeStyle'

/**
 * v3.4 lot 5: authentication of a Symfony project, on the shared contract.
 * Pages: form_login on /login, /register (signs in once created), /dashboard
 * (ROLE_USER). API: /api/auth/… on a stateless firewall whose access_token
 * authenticator reads an HS256 token signed with APP_SECRET (no JWT bundle, no
 * key pair). The User entity is written here rather than by make:user, which
 * has no name field.
 */

export const SYMFONY_AUTH_PACKAGES: [string, string][] = [
  ['symfony/twig-bundle', 'vendor/symfony/twig-bundle'],
  ['symfony/security-csrf', 'vendor/symfony/security-csrf']
]

const TEXT = {
  fr: {
    name: 'Nom', email: 'E-mail', password: 'Mot de passe', home: 'Accueil',
    loginTitle: 'Se connecter', loginLead: 'Content de vous revoir.', noAccount: 'Pas encore de compte ?', toRegister: 'Créer un compte',
    registerTitle: 'Créer un compte', registerLead: 'Quelques secondes, et vous y êtes.', registerSubmit: 'Créer mon compte', hasAccount: 'Déjà un compte ?',
    hello: 'Bonjour', signedIn: 'Vous êtes connecté.', logout: 'Se déconnecter', apiTitle: 'Votre API',
    apiLead: 'Ces routes suivent le contrat DevForge : un front React ou Vue créé par DevForge s\'y branche tel quel.',
    errName: 'Indiquez un nom.', errEmail: 'Indiquez une adresse e-mail valide.', errPassword: `Au moins ${AUTH_RULES.passwordMin} caractères.`,
    errTaken: 'Cette adresse a déjà un compte.', errInvalid: 'E-mail ou mot de passe incorrect.', errAuth: 'Connectez-vous d\'abord.', errForm: 'Le formulaire a expiré, réessayez.'
  },
  en: {
    name: 'Name', email: 'Email', password: 'Password', home: 'Home',
    loginTitle: 'Sign in', loginLead: 'Good to see you again.', noAccount: 'No account yet?', toRegister: 'Create an account',
    registerTitle: 'Create an account', registerLead: 'A few seconds, and you are in.', registerSubmit: 'Create my account', hasAccount: 'Already have an account?',
    hello: 'Hello', signedIn: 'You are signed in.', logout: 'Sign out', apiTitle: 'Your API',
    apiLead: 'These routes follow the DevForge contract: a React or Vue front made by DevForge plugs in as is.',
    errName: 'Enter a name.', errEmail: 'Enter a valid email address.', errPassword: `At least ${AUTH_RULES.passwordMin} characters.`,
    errTaken: 'This address already has an account.', errInvalid: 'Wrong email or password.', errAuth: 'Sign in first.', errForm: 'The form expired, try again.'
  }
}
type T = typeof TEXT.fr

/** PHP string literal, single-quoted */
const php = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const SECURITY_YAML = String.raw`# DevForge: pages on the "main" firewall (form_login), the contract's API on a stateless one
security:
    password_hashers:
        Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface: 'auto'

    providers:
        app_user_provider:
            entity:
                class: App\Entity\User
                property: email

    firewalls:
        dev:
            pattern: ^/(_(profiler|wdt)|css|images|js)/
            security: false
        api:
            pattern: ^/api/auth/(logout|me)$
            stateless: true
            provider: app_user_provider
            access_token:
                token_handler: App\Security\AccessTokenHandler
        main:
            lazy: true
            provider: app_user_provider
            form_login:
                login_path: app_login
                check_path: app_login
                default_target_path: app_dashboard
                enable_csrf: true
            logout:
                path: app_logout
                target: /

    access_control:
        - { path: ^/dashboard, roles: ROLE_USER }
        - { path: ^/api/auth/(logout|me)$, roles: ROLE_USER }

when@test:
    security:
        password_hashers:
            Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface:
                algorithm: auto
                cost: 4
                time_cost: 3
                memory_cost: 10
`

const USER_ENTITY = String.raw`<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '` + '`user`' + String.raw`')]
#[ORM\UniqueConstraint(name: 'UNIQ_IDENTIFIER_EMAIL', fields: ['email'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $name = '';

    #[ORM\Column(length: 180)]
    private string $email = '';

    /** @var list<string> */
    #[ORM\Column]
    private array $roles = [];

    #[ORM\Column]
    private string $password = '';

    public function getId(): ?int { return $this->id; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getEmail(): string { return $this->email; }
    public function setEmail(string $email): static { $this->email = $email; return $this; }

    public function getUserIdentifier(): string { return $this->email; }

    /** @return list<string> */
    public function getRoles(): array { return array_values(array_unique([...$this->roles, 'ROLE_USER'])); }

    public function getPassword(): string { return $this->password; }
    public function setPassword(string $password): static { $this->password = $password; return $this; }

    public function eraseCredentials(): void {}

    /** What the API shows of a user: never the password */
    public function toPublic(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'email' => $this->email];
    }
}
`

const USER_REPOSITORY = String.raw`<?php

namespace App\Repository;

use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<User> */
class UserRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }
}
`

const TOKEN_SERVICE = String.raw`<?php

namespace App\Security;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** HS256 tokens signed with APP_SECRET: the subject is the user's email, valid 7 days */
final class TokenService
{
    public function __construct(#[Autowire('%kernel.secret%')] private readonly string $secret)
    {
    }

    public function sign(string $subject, int $ttl = 604800): string
    {
        $head = self::encode(['alg' => 'HS256', 'typ' => 'JWT']);
        $body = self::encode(['sub' => $subject, 'iat' => time(), 'exp' => time() + $ttl]);

        return $head.'.'.$body.'.'.$this->signature($head.'.'.$body);
    }

    /** The subject of a valid token, null when it is forged, malformed or expired */
    public function verify(string $token): ?string
    {
        $parts = explode('.', $token);
        if (3 !== count($parts) || !hash_equals($this->signature($parts[0].'.'.$parts[1]), $parts[2])) {
            return null;
        }
        $payload = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/')), true);

        return is_array($payload) && is_string($payload['sub'] ?? null) && ($payload['exp'] ?? 0) > time() ? $payload['sub'] : null;
    }

    private function signature(string $data): string
    {
        return rtrim(strtr(base64_encode(hash_hmac('sha256', $data, $this->secret, true)), '+/', '-_'), '=');
    }

    private static function encode(array $data): string
    {
        return rtrim(strtr(base64_encode((string) json_encode($data)), '+/', '-_'), '=');
    }
}
`

const ACCESS_TOKEN_HANDLER = String.raw`<?php

namespace App\Security;

use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

/** Authorization: Bearer <token> on the API firewall */
final class AccessTokenHandler implements AccessTokenHandlerInterface
{
    public function __construct(private readonly TokenService $tokens)
    {
    }

    public function getUserBadgeFrom(#[\SensitiveParameter] string $accessToken): UserBadge
    {
        $email = $this->tokens->verify($accessToken);
        if (null === $email) {
            throw new BadCredentialsException('Invalid token.');
        }

        return new UserBadge($email);
    }
}
`

const authRules = (t: T) => String.raw`<?php

namespace App\Security;

/** The DevForge contract's rules, the same for the pages and the API */
final class AuthRules
{
    public const MESSAGES = [
        'name' => ` + php(t.errName) + String.raw`,
        'email' => ` + php(t.errEmail) + String.raw`,
        'password' => ` + php(t.errPassword) + String.raw`,
        'taken' => ` + php(t.errTaken) + String.raw`,
        'invalid' => ` + php(t.errInvalid) + String.raw`,
        'unauthenticated' => ` + php(t.errAuth) + String.raw`,
        'form' => ` + php(t.errForm) + String.raw`,
    ];

    /** Trimmed values: name, email in lower case, password as typed */
    public static function clean(array $data): array
    {
        return [
            'name' => trim((string) ($data['name'] ?? '')),
            'email' => strtolower(trim((string) ($data['email'] ?? ''))),
            'password' => (string) ($data['password'] ?? ''),
        ];
    }

    /** @return array<string, list<string>> one message per field in error */
    public static function check(array $data, bool $withName): array
    {
        $errors = [];
        if ($withName && ('' === $data['name'] || mb_strlen($data['name']) > ` + AUTH_RULES.nameMax + String.raw`)) {
            $errors['name'] = [self::MESSAGES['name']];
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL) || mb_strlen($data['email']) > ` + AUTH_RULES.emailMax + String.raw`) {
            $errors['email'] = [self::MESSAGES['email']];
        }
        if (mb_strlen($data['password']) < ` + AUTH_RULES.passwordMin + String.raw`) {
            $errors['password'] = [self::MESSAGES['password']];
        }

        return $errors;
    }
}
`

const API_CONTROLLER = String.raw`<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Security\AuthRules;
use App\Security\TokenService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

/** The DevForge authentication contract: /api/auth/register, login, logout, me */
#[Route('/api/auth')]
final class AuthController extends AbstractController
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly UserPasswordHasherInterface $hasher,
        private readonly TokenService $tokens,
    ) {
    }

    /** POST { name, email, password } → 201 { user } */
    #[Route('/register', methods: ['POST'])]
    public function register(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = AuthRules::clean(self::body($request));
        $errors = AuthRules::check($data, true);
        if (!isset($errors['email']) && $this->users->findOneBy(['email' => $data['email']])) {
            $errors['email'] = [AuthRules::MESSAGES['taken']];
        }
        if ($errors) {
            return $this->json(['errors' => $errors], 422);
        }
        $user = (new User())->setName($data['name'])->setEmail($data['email']);
        $user->setPassword($this->hasher->hashPassword($user, $data['password']));
        $em->persist($user);
        $em->flush();

        return $this->json(['user' => $user->toPublic()], 201);
    }

    /** POST { email, password } → 200 { user, token } */
    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $data = AuthRules::clean(self::body($request));
        $errors = AuthRules::check($data, false);
        if ($errors) {
            return $this->json(['errors' => $errors], 422);
        }
        $user = $this->users->findOneBy(['email' => $data['email']]);
        if (!$user || !$this->hasher->isPasswordValid($user, $data['password'])) {
            return $this->json(['message' => AuthRules::MESSAGES['invalid']], 401);
        }

        return $this->json(['user' => $user->toPublic(), 'token' => $this->tokens->sign($user->getEmail())]);
    }

    /** POST → 204: the token is stateless, it stays valid until it expires (the client forgets it) */
    #[Route('/logout', methods: ['POST'])]
    public function logout(): Response
    {
        return new Response(null, 204);
    }

    /** GET → 200 { user } (the API firewall answers 401 without a valid token) */
    #[Route('/me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->getUser();

        return $user instanceof User
            ? $this->json(['user' => $user->toPublic()])
            : $this->json(['message' => AuthRules::MESSAGES['unauthenticated']], 401);
    }

    private static function body(Request $request): array
    {
        $data = json_decode($request->getContent(), true);

        return is_array($data) ? $data : [];
    }
}
`

const SECURITY_CONTROLLER = String.raw`<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Security\AuthRules;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

/** The pages: sign in (form_login), sign up, the dashboard; sign-out is the firewall's */
final class SecurityController extends AbstractController
{
    #[Route('/login', name: 'app_login')]
    public function login(AuthenticationUtils $utils): Response
    {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_dashboard');
        }

        return $this->render('security/login.html.twig', [
            'last_username' => $utils->getLastUsername(),
            'error' => $utils->getLastAuthenticationError() ? AuthRules::MESSAGES['invalid'] : null,
        ]);
    }

    #[Route('/register', name: 'app_register', methods: ['GET', 'POST'])]
    public function register(Request $request, UserRepository $users, UserPasswordHasherInterface $hasher, EntityManagerInterface $em, Security $security): Response
    {
        $errors = [];
        $data = ['name' => '', 'email' => ''];
        if ($request->isMethod('POST')) {
            $data = AuthRules::clean($request->request->all());
            $errors = $this->isCsrfTokenValid('register', (string) $request->request->get('_csrf_token'))
                ? AuthRules::check($data, true)
                : ['form' => [AuthRules::MESSAGES['form']]];
            if (!$errors && $users->findOneBy(['email' => $data['email']])) {
                $errors['email'] = [AuthRules::MESSAGES['taken']];
            }
            if (!$errors) {
                $user = (new User())->setName($data['name'])->setEmail($data['email']);
                $user->setPassword($hasher->hashPassword($user, $data['password']));
                $em->persist($user);
                $em->flush();
                $security->login($user, 'form_login', 'main');

                return $this->redirectToRoute('app_dashboard');
            }
        }

        return $this->render('security/register.html.twig', ['errors' => $errors, 'old' => $data]);
    }

    #[Route('/dashboard', name: 'app_dashboard')]
    public function dashboard(): Response
    {
        return $this->render('security/dashboard.html.twig');
    }

    #[Route('/logout', name: 'app_logout')]
    public function logout(): never
    {
        throw new \LogicException('The firewall signs the user out.');
    }
}
`

/** Twig reads {{ and {% only: the CSS braces are plain text */
const layout = (name: string, lang: 'fr' | 'en', t: T) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{% block title %}{% endblock %} · ${name}</title>
<link rel="stylesheet" href="/devforge.css">
</head>
<body>
<div class="df-auth">
  <header class="df-bar">
    <a href="/" class="df-brand">${ANVIL}${name}</a>
    <a href="/">${t.home}</a>
  </header>
  <main class="df-center">
    {% block body %}{% endblock %}
  </main>
</div>
</body>
</html>
`

const err = (field: string) => `{% if errors.${field} is defined %}<span class="df-err">{{ errors.${field}|first }}</span>{% endif %}`

const loginView = (t: T) => `{% extends 'security/layout.html.twig' %}
{% block title %}${t.loginTitle}{% endblock %}
{% block body %}
<form class="df-box" method="post" action="{{ path('app_login') }}" novalidate>
  <h1>${t.loginTitle}</h1>
  <p class="df-lead">${t.loginLead}</p>
  {% if error %}<p class="df-alert" role="alert">{{ error }}</p>{% endif %}
  <label class="df-field">${t.email}
    <input name="_username" type="email" value="{{ last_username }}" autocomplete="email" required autofocus>
  </label>
  <label class="df-field">${t.password}
    <input name="_password" type="password" autocomplete="current-password" required>
  </label>
  <input type="hidden" name="_csrf_token" value="{{ csrf_token('authenticate') }}">
  <button class="df-submit" type="submit">${t.loginTitle}</button>
  <p class="df-small">${t.noAccount} <a href="{{ path('app_register') }}">${t.toRegister}</a></p>
</form>
{% endblock %}
`

const registerView = (t: T) => `{% extends 'security/layout.html.twig' %}
{% block title %}${t.registerTitle}{% endblock %}
{% block body %}
<form class="df-box" method="post" action="{{ path('app_register') }}" novalidate>
  <h1>${t.registerTitle}</h1>
  <p class="df-lead">${t.registerLead}</p>
  {% if errors.form is defined %}<p class="df-alert" role="alert">{{ errors.form|first }}</p>{% endif %}
  <label class="df-field">${t.name}
    <input name="name" value="{{ old.name }}" autocomplete="name" required autofocus>
    ${err('name')}
  </label>
  <label class="df-field">${t.email}
    <input name="email" type="email" value="{{ old.email }}" autocomplete="email" required>
    ${err('email')}
  </label>
  <label class="df-field">${t.password}
    <input name="password" type="password" autocomplete="new-password" required>
    ${err('password')}
  </label>
  <input type="hidden" name="_csrf_token" value="{{ csrf_token('register') }}">
  <button class="df-submit" type="submit">${t.registerSubmit}</button>
  <p class="df-small">${t.hasAccount} <a href="{{ path('app_login') }}">${t.loginTitle}</a></p>
</form>
{% endblock %}
`

const dashboardView = (t: T) => `{% extends 'security/layout.html.twig' %}
{% block title %}${t.hello}{% endblock %}
{% block body %}
<div class="df-wide">
  <section class="df-box">
    <h1>${t.hello} {{ app.user.name }}</h1>
    <p class="df-lead">${t.signedIn} {{ app.user.email }}</p>
    <div><a class="df-ghost" href="{{ path('app_logout') }}">${t.logout}</a></div>
  </section>
  <section class="df-box">
    <h2>${t.apiTitle}</h2>
    <p class="df-note">${t.apiLead}</p>
    <ul class="df-routes">
      <li><b>POST</b>/api/auth/register</li>
      <li><b>POST</b>/api/auth/login</li>
      <li><b>POST</b>/api/auth/logout</li>
      <li><b>GET</b>/api/auth/me</li>
    </ul>
  </section>
</div>
{% endblock %}
`

/** Every file of the Symfony authentication (security.yaml replaced as a whole) */
export function symfonyAuthFiles(name: string, lang: 'fr' | 'en'): { path: string; content: string }[] {
  const t = TEXT[lang]
  return [
    { path: 'config/packages/security.yaml', content: SECURITY_YAML },
    { path: 'src/Entity/User.php', content: USER_ENTITY },
    { path: 'src/Repository/UserRepository.php', content: USER_REPOSITORY },
    { path: 'src/Security/TokenService.php', content: TOKEN_SERVICE },
    { path: 'src/Security/AccessTokenHandler.php', content: ACCESS_TOKEN_HANDLER },
    { path: 'src/Security/AuthRules.php', content: authRules(t) },
    { path: 'src/Controller/Api/AuthController.php', content: API_CONTROLLER },
    { path: 'src/Controller/SecurityController.php', content: SECURITY_CONTROLLER },
    { path: 'templates/security/layout.html.twig', content: layout(name, lang, t) },
    { path: 'public/devforge.css', content: DEVFORGE_CSS },
    { path: 'templates/security/login.html.twig', content: loginView(t) },
    { path: 'templates/security/register.html.twig', content: registerView(t) },
    { path: 'templates/security/dashboard.html.twig', content: dashboardView(t) }
  ]
}
