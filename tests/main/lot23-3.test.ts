import { describe, expect, it } from 'vitest'
import * as rv from '../../src/main/services/nextjs/prismaRevert'

/** v2.3 lot 3: undoing a Prisma migration */
describe('v2.3 lot 3: Prisma going back', () => {
  it('a shadow database next to the real one, created then dropped by name', () => {
    expect(rv.shadowUrl('postgresql://app:pw@localhost:5450/site?schema=public', 'postgresql')).toBe('postgresql://app:pw@localhost:5450/site_devforge_shadow?schema=public')
    expect(rv.shadowUrl('mysql://root:pw@127.0.0.1:3307/boutique', 'mysql')).toBe('mysql://root:pw@127.0.0.1:3307/boutique_devforge_shadow')
    expect(rv.shadowUrl('file:./dev.db', 'sqlite')).toBe('file:./devforge-shadow.db')
    expect(rv.shadowUrl('pas une url', 'postgresql')).toBeNull()
    expect(rv.databaseName('postgresql://a:b@h:1/site_devforge_shadow?schema=public')).toBe('site_devforge_shadow')
    expect(rv.databaseName('postgresql://a:b@h:1/x";drop')).toBeNull()
    expect(rv.createDatabaseSql('s', 'postgresql')).toBe('CREATE DATABASE "s";\n')
    expect(rv.dropDatabaseSql('s', 'mysql')).toBe('DROP DATABASE IF EXISTS `s`;\n')
  })

  it('a config next to the project\'s, with the shadow database', () => {
    expect(rv.findConfig(['package.json', 'prisma7.config.ts', 'next.config.ts'])).toBe('prisma7.config.ts')
    expect(rv.findConfig(['next.config.ts'])).toBeNull()
    const cfg = rv.revertConfig('prisma.config.ts')
    expect(cfg).toContain("import base from './prisma.config'")
    expect(cfg).toContain('shadowDatabaseUrl: process.env.DEVFORGE_SHADOW_URL')
  })

  it('the reverse migration: its folder, its SQL without Prisma\'s lines', () => {
    expect(rv.revertFolder('20261025181601_catalogue', '20261026093000')).toBe('20261026093000_revert_catalogue')
    expect(rv.prismaStamp(new Date(2026, 9, 26, 9, 3, 7))).toBe('20261026090307')
    expect(rv.cleanDiff('Loaded Prisma config from prisma7.config.ts.\n\n-- DropTable\nDROP TABLE "public"."Produit";\n')).toBe('-- DropTable\nDROP TABLE "public"."Produit";')
    expect(rv.cleanDiff('Loaded Prisma config from x.\n-- This is an empty migration.\n')).toBe('')
    expect(rv.revertMigration('20261025181601_catalogue', 'DROP TABLE "x";')).toContain('-- Written by DevForge: undoes 20261025181601_catalogue.')
  })
})
