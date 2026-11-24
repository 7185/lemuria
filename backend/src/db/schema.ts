import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'

export const world = sqliteTable('world', {
  id: integer('id').primaryKey({autoIncrement: true}),
  name: text('name').notNull(),
  data: text('data')
})

export const user = sqliteTable('user', {
  id: integer('id').primaryKey({autoIncrement: true}),
  name: text('name').notNull(),
  password: text('password').notNull(),
  email: text('email'),
  enabled: integer('enabled', {mode: 'boolean'}).notNull().default(true)
})

export const prop = sqliteTable(
  'prop',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    wid: integer('wid')
      .notNull()
      .references(() => world.id, {onDelete: 'restrict', onUpdate: 'cascade'}),
    uid: integer('uid')
      .notNull()
      .references(() => user.id, {onDelete: 'restrict', onUpdate: 'cascade'}),
    date: integer('date').notNull(),
    name: text('name').notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    z: integer('z').notNull(),
    pi: integer('pi').notNull(),
    ya: integer('ya').notNull(),
    ro: integer('ro').notNull(),
    desc: text('desc'),
    act: text('act')
  },
  (table) => [index('prop_x_idx').on(table.x), index('prop_z_idx').on(table.z)]
)

export const elev = sqliteTable(
  'elev',
  {
    wid: integer('wid')
      .notNull()
      .references(() => world.id, {onDelete: 'restrict', onUpdate: 'cascade'}),
    page_x: integer('page_x').notNull(),
    page_z: integer('page_z').notNull(),
    node_x: integer('node_x').notNull(),
    node_z: integer('node_z').notNull(),
    radius: integer('radius').notNull(),
    textures: text('textures'),
    heights: text('heights')
  },
  (table) => [
    primaryKey({
      columns: [
        table.wid,
        table.page_x,
        table.page_z,
        table.node_x,
        table.node_z
      ]
    })
  ]
)
