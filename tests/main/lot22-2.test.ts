import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { SfEntity } from '../../src/shared/types'
import { checkDraft, extendEntity, newEntityFile, plural, relationCode, singular } from '../../src/main/services/symfony/sfEntityWriter'
import { migrationSql, parseInspect, parseRoutes, toEntities, toMigrations } from '../../src/main/services/symfony/sfInspect'
import { apiPath, applyPlatform, handEditedResource, jsonController, stripPlatform } from '../../src/main/services/symfony/sfApi'
import { appFixtures, creationOrder, fakerFor, tuneFactory } from '../../src/main/services/symfony/sfFixtures'
import { sfCommandLine } from '../../src/shared/lib/symfonyCommands'
import { writeEntity } from '../../src/main/services/symfony/symfonyService'
import { saveProjects, tempDir } from '../helpers'

const entity = (name: string, over: Partial<SfEntity> = {}): SfEntity => ({ name, table: name.toLowerCase(), file: `src/Entity/${name}.php`, fields: [], relations: [], apiResource: false, ...over })

describe('v2.2 lot 2: writing entities', () => {
  it('singular and plural', () => {
    expect(singular('factures')).toBe('facture')
    expect(singular('categories')).toBe('category')
    expect(plural('category')).toBe('categories')
    expect(plural('produit')).toBe('produits')
  })

  it('a new entity: fields with their Doctrine types, repository, reserved table names quoted', () => {
    const php = newEntityFile({ name: 'Order', existing: false, relations: [], fields: [
      { name: 'numero', type: 'string', nullable: false, unique: true, length: 30 },
      { name: 'montant', type: 'decimal', nullable: false, unique: false, precision: 10, scale: 2 },
      { name: 'payee', type: 'boolean', nullable: false, unique: false },
      { name: 'emiseLe', type: 'date', nullable: true, unique: false },
      { name: 'notes', type: 'json', nullable: false, unique: false }
    ] })
    expect(php).toContain("#[ORM\\Table(name: '`order`')]")
    expect(php).toContain('#[ORM\\Column(length: 30, unique: true)]\n    private ?string $numero = null;')
    expect(php).toContain('#[ORM\\Column(type: Types::DECIMAL, precision: 10, scale: 2)]')
    expect(php).toContain('public function isPayee(): ?bool')
    expect(php).toContain('public function setEmiseLe(?\\DateTimeImmutable $emiseLe): static')
    expect(php).toContain('private array $notes = [];')
    expect(php).toContain('use Doctrine\\DBAL\\Types\\Types;')
    expect(php).not.toContain('Collection')
  })

  it('both sides of a ManyToOne', () => {
    const owning = relationCode({ name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false }, true)
    expect(owning.property).toBe("    #[ORM\\ManyToOne(inversedBy: 'produits')]\n    #[ORM\\JoinColumn(nullable: false)]\n    private ?Categorie $categorie = null;\n")
    const inverse = relationCode({ name: 'produits', kind: 'OneToMany', target: 'Produit', inverse: 'categorie', nullable: false }, false)
    expect(inverse.property).toContain("#[ORM\\OneToMany(targetEntity: Produit::class, mappedBy: 'categorie')]")
    expect(inverse.methods).toContain('$produit->setCategorie($this);')
    expect(inverse.methods).toContain('if ($produit->getCategorie() === $this)')
    expect(inverse.init).toBe('        $this->produits = new ArrayCollection();')
  })

  it('ManyToMany: the other side keeps both in step', () => {
    const inv = relationCode({ name: 'tags', kind: 'ManyToMany', target: 'Tag', inverse: 'produits', nullable: true }, false)
    expect(inv.property).toContain("mappedBy: 'produits'")
    expect(inv.methods).toContain('$tag->addProduit($this);')
    expect(inv.methods).toContain('$tag->removeProduit($this);')
  })

  it('adds to an existing entity: properties before the methods, collection in the constructor, methods at the end', () => {
    const src = `<?php\r\n\r\nnamespace App\\Entity;\r\n\r\nuse Doctrine\\ORM\\Mapping as ORM;\r\n\r\n#[ORM\\Entity]\r\nclass User\r\n{\r\n    #[ORM\\Id]\r\n    #[ORM\\Column]\r\n    private ?int $id = null;\r\n\r\n    /**\r\n     * @return string\r\n     */\r\n    public function getId(): ?int\r\n    {\r\n        return $this->id;\r\n    }\r\n}\r\n`
    const out = extendEntity(src, [{ name: 'age', type: 'integer', nullable: true, unique: false }],
      [{ name: 'factures', kind: 'OneToMany', target: 'Facture', inverse: 'client', nullable: false }], [false])
    expect(out.indexOf('private ?int $age')).toBeLessThan(out.indexOf('/**\r\n     * @return string'))
    expect(out).toContain('use Doctrine\\Common\\Collections\\ArrayCollection;')
    expect(out).toMatch(/public function __construct\(\)\n {4}\{\n {8}\$this->factures = new ArrayCollection\(\);/)
    expect(out.trimEnd().endsWith('}')).toBe(true)
    expect(out.lastIndexOf('public function removeFacture')).toBeGreaterThan(out.indexOf('public function getId'))
    expect(() => extendEntity(out, [{ name: 'age', type: 'integer', nullable: true, unique: false }], [], [])).toThrow('EXISTS:age')
  })

  it('checks a draft before writing', () => {
    const ok = { name: 'Facture', existing: false, fields: [{ name: 'numero', type: 'string' as const, nullable: false, unique: false }], relations: [] }
    expect(checkDraft(ok, ['User'])).toBeNull()
    expect(checkDraft({ ...ok, name: 'facture' }, [])).toBe('BAD_ENTITY_NAME')
    expect(checkDraft(ok, ['Facture'])).toBe('ENTITY_EXISTS')
    expect(checkDraft({ ...ok, fields: [{ ...ok.fields[0], name: 'id' }] }, [])).toBe('BAD_PROPERTY')
    expect(checkDraft({ ...ok, relations: [{ name: 'client', kind: 'ManyToOne', target: 'Client', inverse: null, nullable: true }] }, ['User'])).toBe('NO_TARGET')
    expect(checkDraft({ ...ok, relations: [{ name: 'lignes', kind: 'OneToMany', target: 'User', inverse: null, nullable: true }] }, ['User'])).toBe('NEEDS_INVERSE')
  })

  it('writes the entity, its repository and the other side, inside a saved project only', () => {
    const dir = tempDir('sf')
    mkdirSync(join(dir, 'src', 'Entity'), { recursive: true })
    writeFileSync(join(dir, 'src', 'Entity', 'User.php'), '<?php\n\nnamespace App\\Entity;\n\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity]\nclass User\n{\n    private ?int $id = null;\n\n    public function getId(): ?int\n    {\n        return $this->id;\n    }\n}\n')
    const draft = { name: 'Facture', existing: false, fields: [{ name: 'numero', type: 'string' as const, nullable: false, unique: true }], relations: [{ name: 'client', kind: 'ManyToOne' as const, target: 'User', inverse: 'factures', nullable: false }] }
    expect(() => writeEntity(dir, draft)).toThrow('NOT_A_PROJECT')
    saveProjects([{ name: 'boutique', path: dir }])
    expect(writeEntity(dir, draft)).toEqual({ created: ['src/Entity/Facture.php', 'src/Repository/FactureRepository.php'], changed: ['src/Entity/User.php'], removed: [] })
    expect(readFileSync(join(dir, 'src', 'Entity', 'User.php'), 'utf-8')).toContain("#[ORM\\OneToMany(targetEntity: Facture::class, mappedBy: 'client')]")
    expect(() => writeEntity(dir, draft)).toThrow('ENTITY_EXISTS')
  })
})

describe('v2.2 lot 2: reading the project', () => {
  it('JSON after notices, entities with paths relative to the project', () => {
    const raw = parseInspect(`Deprecated: something\n@@DEVFORGE@@${JSON.stringify({
      booted: true, error: null, version: '7.3.0', db: null, executed: [],
      entities: [{ name: 'Produit', table: 'produit', file: 'C:\\p\\boutique\\src\\Entity\\Produit.php', apiResource: false,
        fields: [{ name: 'prix', type: 'decimal', nullable: false, unique: false, length: null, precision: 10, scale: 2 }, { name: 'ajouteLe', type: 'date_immutable', nullable: false, unique: false, length: null, precision: null, scale: null }],
        relations: [{ name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false }] }]
    })}@@DEVFORGE@@\n`)!
    const [e] = toEntities(raw, 'C:\\p\\boutique')
    expect(e.file).toBe('src/Entity/Produit.php')
    expect(e.fields).toEqual([{ name: 'prix', type: 'decimal', nullable: false, unique: false, precision: 10, scale: 2 }, { name: 'ajouteLe', type: 'date', nullable: false, unique: false }])
    expect(parseInspect('PHP Fatal error')).toBeNull()
  })

  it('migrations: SQL of up(), applied or pending, dangerous ones', () => {
    const php = (sql: string) => `<?php\nfinal class X extends AbstractMigration\n{\n    public function getDescription(): string\n    {\n        return 'Ajout d\\'une table';\n    }\n\n    public function up(Schema $schema): void\n    {\n        $this->addSql('${sql}');\n    }\n\n    public function down(Schema $schema): void\n    {\n        $this->addSql('DROP TABLE x');\n    }\n}\n`
    expect(migrationSql(php("CREATE TABLE x (nom VARCHAR(10) DEFAULT \\'a\\')"))).toEqual(["CREATE TABLE x (nom VARCHAR(10) DEFAULT 'a')"])
    const list = toMigrations(
      [{ name: 'Version20261025100000.php', php: php('CREATE TABLE x (id INT)') }, { name: 'Version20261026100000.php', php: php('ALTER TABLE x DROP nom') }],
      [{ version: 'DoctrineMigrations\\Version20261025100000', at: '2026-10-25 10:00:00' }]
    )
    expect(list.map(m => [m.version.slice(-14), m.executed, m.dangerous, m.description])).toEqual([
      ['20261026100000', false, true, "Ajout d'une table"], ['20261025100000', true, false, "Ajout d'une table"]
    ])
  })

  it('routes: tool routes hidden, API Platform kept, .{_format} dropped', () => {
    const json = JSON.stringify({
      _profiler: { path: '/_profiler/{token}', method: 'ANY' },
      '_api_/produits{._format}_get_collection': { path: '/api/produits.{_format}', method: 'GET', defaults: { _controller: 'api_platform.action.placeholder' } },
      app_home: { path: '/', method: 'GET|HEAD', defaults: { _controller: 'App\\Controller\\HomeController::index' } }
    })
    expect(parseRoutes(`notice\n${json}`)).toEqual([
      { name: 'app_home', path: '/', methods: ['GET'], controller: 'App\\Controller\\HomeController::index' },
      { name: '_api_/produits{._format}_get_collection', path: '/api/produits', methods: ['GET'], controller: 'api_platform.action.placeholder' }
    ])
  })
})

describe('v2.2 lot 2: API', () => {
  const src = '<?php\n\nnamespace App\\Entity;\n\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity]\nclass Produit\n{\n    #[ORM\\Column]\n    private ?int $stock = null;\n}\n'

  it('paths like API Platform', () => {
    expect(apiPath('LigneCommande')).toBe('/api/ligne_commandes')
    expect(apiPath('Category')).toBe('/api/categories')
  })

  it('API Platform: attributes added, then removed without leftovers', () => {
    const on = applyPlatform(src, ['list', 'show'], ['stock'])
    expect(on).toContain('#[ApiResource(operations: [new GetCollection(), new Get()])]\n#[ORM\\Entity]')
    expect(on).toContain('    #[ORM\\Column]\n    #[ApiProperty(readable: false, writable: false)]\n    private ?int $stock')
    expect(on).toContain('use ApiPlatform\\Metadata\\GetCollection;')
    expect(on).not.toContain('use ApiPlatform\\Metadata\\Delete;')
    expect(applyPlatform(on, ['list', 'show'], ['stock'])).toBe(on)
    expect(stripPlatform(on)).toBe(src)
    expect(handEditedResource('#[ApiResource(\n    operations: []\n)]')).toBe(true)
  })

  it('JSON controller: only the chosen operations and fields', () => {
    const php = jsonController(entity('Produit', { fields: [{ name: 'nom', type: 'string', nullable: false, unique: false }, { name: 'stock', type: 'integer', nullable: false, unique: false }] }), ['list', 'create'], ['stock'])
    expect(php).toContain("#[Route('/api/produits', name: 'api_produit_')]")
    expect(php).toContain("private const OUTPUT = ['id', 'nom'];")
    expect(php).toContain("private const INPUT = ['nom'];")
    expect(php).toContain('public function create(')
    expect(php).not.toContain('public function delete(')
    expect(php).not.toContain('EntityManagerInterface $em): JsonResponse\n    {\n        $em->remove')
  })
})

describe('v2.2 lot 2: fake data', () => {
  const categorie = entity('Categorie', { fields: [{ name: 'nom', type: 'string', nullable: false, unique: true, length: 80 }] })
  const produit = entity('Produit', {
    fields: [{ name: 'prix', type: 'decimal', nullable: false, unique: false, precision: 10, scale: 2 }, { name: 'stock', type: 'integer', nullable: false, unique: false }],
    relations: [{ name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false }]
  })
  const user = entity('User', { fields: [{ name: 'email', type: 'string', nullable: false, unique: true, length: 180 }, { name: 'password', type: 'string', nullable: false, unique: false }] })

  it('parents first, children on random parents', () => {
    expect(creationOrder([produit, categorie, user], { Produit: 30, Categorie: 5 }).map(e => e.name)).toEqual(['Categorie', 'Produit'])
    const php = appFixtures([produit, categorie], { Produit: 30, Categorie: 5 })
    expect(php).toContain("        CategorieFactory::createMany(5);\n        ProduitFactory::createMany(30, fn () => ['categorie' => CategorieFactory::random()]);")
  })

  it('realistic values that fit the columns', () => {
    expect(fakerFor(produit.fields[0])).toBe('(string) self::faker()->randomFloat(2, 1, 500)')
    expect(fakerFor(user.fields[0])).toBe('self::faker()->unique()->safeEmail()')
    expect(fakerFor(user.fields[1])).toBeNull()
    expect(fakerFor(categorie.fields[0])).toBe('ucfirst(self::faker()->unique()->words(3, true))')
    const factory = "        return [\r\n            'categorie' => CategorieFactory::new(),\r\n            'prix' => self::faker()->randomFloat(),\r\n            'stock' => self::faker()->randomNumber(),\r\n        ];\r\n"
    expect(tuneFactory(factory, produit)).toBe("        return [\r\n            'categorie' => CategorieFactory::new(),\r\n            'prix' => (string) self::faker()->randomFloat(2, 1, 500),\r\n            'stock' => self::faker()->numberBetween(0, 100),\r\n        ];\r\n")
  })
})

describe('v2.2 lot 2: commands behind the buttons', () => {
  it('exact command lines, names checked', () => {
    expect(sfCommandLine('migrations:migrate')).toBe('php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration')
    expect(sfCommandLine('make:controller', 'Accueil')).toBe('php bin/console make:controller AccueilController --no-interaction')
    expect(sfCommandLine('make:crud', 'Produit & del')).toBe('')
  })
})
