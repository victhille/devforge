---
title: Modeling
description: Design your database and your app before coding — an MCD (Merise) drawn in DevForge, its MLD, its MPD and the SQL script, saved in the project and versioned with Git.
---

The **Modeling** page (*Data & API* menu) is for designing before coding. Models are kept **per project**: they are files of the project's `conception/` folder (`shop.mcd.json`…), so versioned with Git like the rest of the code.

## The page

- **The project picker**, top right: the active project by default.
- **The project's chain**: MCD → MLD → MPD → SQL → linked database, with the state of each (*Up to date*, *▲ To update*, *Not written yet*). A click opens the step. The linked database comes with the next version.
- **The project's models**: a preview, the kind, the date, the file. A click opens the model; rename and delete on hover. Renaming an MCD renames its MPD and its script too.
- **Create a model**: an **MCD** for now; the MPD is made from the MCD (UML diagrams and the import from a database follow).

At the top of the editor, the **MCD · MLD · MPD · SQL** tabs go from one step of the same model to the next.

## The MCD editor

An MCD describes the data the Merise way: **entities** (CUSTOMER, ORDER…) with their attributes, **associations** between them (PLACE, CONTAIN…) and the **cardinality** of each entity in each association.

| Action | How |
|---|---|
| Add an entity | **Entity** in the palette, or double-click the background |
| Add an association | **Association** in the palette |
| Link | **Link**, then an entity and an association (Esc to stop) |
| Change a cardinality | click it: 0,1 → 1,1 → 0,n → 1,n |
| Move | drag a part; dragging the background moves the view |
| Zoom | the wheel, or − / +; **Fit** shows everything |
| Delete | **Delete** on the chosen part |
| Undo, redo | **Ctrl+Z**, **Ctrl+Y** |

The right panel edits the chosen part: the name, the **attributes** (name, type, length of a short text) and those forming the **identifier** (underlined). An association can carry attributes (a quantity, a date…).

Every change is **saved on its own** in the project's file.

### Check

**Check** lists what would stop the next step (the MLD) or is worth a look: an entity without an identifier, a part without a name, two parts with the same name, an attribute without a type, an association linked to fewer than two entities, an entity linked to nothing. A click on a line picks the part.

### Export

**PNG** or **SVG** saves the MCD as an image.

## The MLD

The **MLD** tab shows the relational schema, worked out again at every change of the MCD: `COMMANDE (id_commande, passee_le, #id_client)`, the primary key underlined, foreign keys after a `#`. **Copy the text** takes it as it is (the primary key between `_`).

Below the schema, **the rules applied**, one per line:

| Case | What happens |
|---|---|
| An entity | it becomes a relation; its identifier is the primary key (without one, an `id_…` is added) |
| An association with an x,1 side (`0,n — 1,1`) | the other entity's key goes down into this one; the carried attributes follow it |
| x,1 on both sides (`0,1 — 1,1`) | the key goes to the 1,1 side, unique |
| Several on both sides, or more than two entities | the association becomes a relation, keyed by its foreign keys |
| An association linked to fewer than two entities | left aside |

On the right, **the naming for the MPD**: tables in `snake_case`, `UPPER CASE` or `PascalCase`; primary keys as `id` or as in the MCD; foreign keys as `client_id` or `id_client`; association tables after their tables (`commande_produit`) or after the association (`contenir`).

**Make the MPD** writes it next to the MCD (`shop.mpd.json`) and opens it.

## The MPD

The MLD's tables with their types for the chosen **engine** (PostgreSQL, MySQL or SQLite), drawn like a [database schema](/devforge/en/data/database/): primary keys 🔑, foreign keys in colour with their arrow, `!` for a column that cannot be empty. The starting engine is the project's (its `.env`, its compose file), PostgreSQL otherwise.

A click on a table touches it up on the right: its name, each column (name, type, length, decimals, *Empty*, *Unique*) and its **indexes**. A column changed by hand is marked ✎; ↺ brings it back to what the MCD gives. A foreign key takes the type of the key it points at.

When the MCD changes, the MPD says so: **Update** makes the tables again from the MCD, keeping the hand changes, the indexes and where each table is. **Rearrange** places the tables again; zoom, Fit, the minimap, undo / redo and the PNG / SVG export work as in the MCD.

**Check** lists what the engine would refuse: a table without a primary key, two tables or two columns with the same name, a foreign key of another type than its target, a unique long text on MySQL.

## The SQL

The **SQL** tab shows the MPD's `CREATE TABLE` script for its engine: the tables pointed at first, the primary keys (numbered by the database when a lone integer), the foreign keys, the indexes; a cycle of keys ends with `ALTER TABLE`. A reserved name (`user`, `order`…) is quoted. Another engine rewrites the types.

**Write shop.sql** saves it in `conception/` next to the model; the page tells when the written file is older than the MPD. **Copy** takes it to paste elsewhere.
