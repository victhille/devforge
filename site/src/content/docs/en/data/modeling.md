---
title: Modeling
description: Design your database and your app before coding — MCD (Merise), MLD, MPD and SQL tied to the real database, and UML diagrams, flowcharts and architecture, saved in the project.
---

The **Modeling** page (*Data & API* menu) is for designing before coding. Models are kept **per project**: they are files of the project's `conception/` folder (`shop.mcd.json`…), so versioned with Git like the rest of the code.

## The page

- **The project picker**, top right: the active project by default.
- **The project's chain**: MCD → MLD → MPD → SQL → linked database, with the state of each (*Up to date*, *▲ To update*, *Not written yet*). A click opens the step. The linked database tells how many differences part it from the MPD.
- **The project's models**: a preview, the kind, the date, the file. A click opens the model; rename and delete on hover. Renaming an MCD renames its MPD and its script too.
- **Create a model**: an **MCD**, an **MPD** (its window asks for a connection: **None** for a blank MPD, drawn table by table, or a database to read, see below), or a **diagram** (use cases, classes, sequence, flowchart, architecture); the MPD is made from the MCD.

At the top of the editor, the **MCD · MLD · MPD · SQL** tabs go from one step of the same model to the next. On the left, the breadcrumb says where you are: **Project › Modeling › the model** when you opened it from a project's Modeling tab (a click on the project leads back there), else **Modeling › the model**. The arrow goes back to the first one.

## The MCD editor

An MCD describes the data the Merise way: **entities** (CUSTOMER, ORDER…) with their attributes, **associations** between them (PLACE, CONTAIN…) and the **cardinality** of each entity in each association.

| Action | How |
|---|---|
| Add an entity | drag **Entity** from the bar at the bottom onto the canvas (or click it), or double-click the background |
| Add an association | drag **Association** from the bar at the bottom (or click it) |
| Link | hover a part: four points show up; pull one onto another part. Entity → association: a leg; entity → entity: an association between them, with both legs; let go on empty space: a new linked entity there (Esc cancels) |
| Change a cardinality | click it: 0,1 → 1,1 → 0,n → 1,n |
| Pick several parts | the **Select** cursor (V): dragging on the background draws a zone, everything it touches is picked; **Shift+click** adds or removes a part; **Ctrl+A** picks all; **Esc** clears the selection; a click (no drag) on one of the picked parts keeps it alone |
| Move | drag a part; dragging one of the picked parts moves them together |
| Move the view | the **Hand** cursor (H), or **Space** held, or the wheel button: drag the background |
| Zoom | the wheel, or − / +; **Fit** shows everything |
| Delete | **Delete** on the chosen part, or on the whole selection |
| Copy, paste, duplicate | **Ctrl+C** then **Ctrl+V**: the copy lands a step aside (in the middle of the screen when the original is not on it), in another MCD too; **Ctrl+X** cuts; **Ctrl+D** or **Duplicate** duplicates. The legs between the copied parts come along, a name already taken is numbered (CLIENT_2) |
| Align, distribute | several parts picked: the right panel lines them up (left, center, right, top, middle, bottom) or spreads them with equal gaps (three at least) |
| Undo, redo | **Ctrl+Z**, **Ctrl+Y** |

The right panel edits the chosen part: the name, the **attributes** (name, type, length of a short text) and those forming the **identifier** (underlined). An association can carry attributes (a quantity, a date…).

Every change is **saved on its own** in the project's file.

An association pulled between two entities lands at the free spot nearest their middle: never on an entity nor on another association.

### Check

**Check** lists what would stop the next step (the MLD) or is worth a look: an entity without an identifier, a part without a name, two parts with the same name, an attribute without a type, an association linked to fewer than two entities, an entity linked to nothing, two parts on top of each other. A click on a line picks the part.

**Suggest a tidy MCD**, under the list, shows what the MCD would become, without changing anything yet:

- each part moved where nothing hides it: the entities in columns, each association at the free spot nearest its entities, those linked to nothing in a row below;
- one name per part: two associations with the same name take the role of their foreign key when the MPD knows it (`requester_id` → ACCESS_REQUEST_REQUESTER), else a number;
- an entity linked to nothing whose attribute is another one's key (`user_id` → USER) gets linked to it, with an identifier of its own;
- the tables a framework creates for itself (`doctrine_migration_versions`, `migrations`…) are left out.

The **Suggested** and **Current** tabs compare both, with the list of changes and the number of points to check before and after. The preview handles like the editor: the wheel zooms, a drag moves it, **−**, **+** and **Fit** at the bottom right. **Keep the current version** changes nothing; **Take the new version** puts it in the editor, and **Ctrl+Z** goes back.

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

**Table**, in the bar at the bottom, adds a table with its key `id` (a click puts it in the middle, a drag where it is let go): an MPD can be drawn entirely by hand, with no MCD nor database. **Delete** removes the chosen table (or the selection) and the foreign keys pointing at it. Copy, paste, duplicate, align and distribute work as in the MCD; a foreign key to a table copied with it points at the copy.

**Work out the MCD** (in the banner of an MPD with no linked MCD) writes the MCD of these tables next to the MPD, then opens it: a link table (a key made of foreign keys) becomes an association, any other foreign key a 1,1 (0,1 when it can be empty) — 0,n association. The MPD is then tied to that MCD, its tables keeping their place, indexes and unique columns.

A click on a table touches it up on the right: its name, each column (name, type, length, decimals, *Primary key*, *Empty*, *Unique*), its **indexes**; **Column** adds one, a column's bin removes it, **Remove the table** at the bottom. A column changed by hand is marked ✎; ↺ brings it back to what the MCD gives. A foreign key takes the type of the key it points at. To add one, pull a table's point (left or right) onto the table it points at: the column (`categorie_id`…) is added, and kept when the MPD is updated.

When the MCD changes, the MPD says so: **Update** makes the tables again from the MCD, keeping the hand changes, the indexes and where each table is. **Rearrange** places the tables again; zoom, Fit, the minimap, undo / redo and the PNG / SVG export work as in the MCD.

**Check** lists what the engine would refuse: a table without a primary key, two tables or two columns with the same name, a foreign key of another type than its target, a unique long text on MySQL.

## The SQL

The **SQL** tab shows the MPD's `CREATE TABLE` script for its engine: the tables pointed at first, the primary keys (numbered by the database when a lone integer), the foreign keys, the indexes; a cycle of keys ends with `ALTER TABLE`. A reserved name (`user`, `order`…) is quoted. Another engine rewrites the types.

**Write shop.sql** saves it in `conception/` next to the model; the page tells when the written file is older than the MPD. **Copy** takes it to paste elsewhere.

## The linked database

Below the MPD, **Linked database** picks a connection of the same engine from the [Database](/devforge/en/data/database/) page; when the project's `.env` describes a database already saved, DevForge offers **Link to …**. The link is kept in the MPD.

DevForge then reads the database and lists what differs: `+` what the database is missing (a table, a column, a foreign key), `−` what is only in the database (in red: catching up deletes data), `~` what differs (a type, *empty* or not, the primary key). A table missing from the database is marked on the drawing. The Modeling page's chain shows *▲ 3 difference(s)* or *Up to date* too. **Read the database again** after a change made elsewhere.

### See the script

**See the script** shows what brings the database to the MPD: the `CREATE TABLE` first, then the columns added, the types and *empty* changed, the foreign keys, and last, in red, the `DROP`. What an engine cannot do alone stays as a comment (SQLite does not change a type; a different primary key is to do by hand).

- **Back up first** exports as SQL (structure and rows) each table a drop touches;
- **Apply** is possible once the *Understood* box is ticked when data would be lost; the whole script runs or nothing (PostgreSQL, SQLite) — MySQL commits each structure change at once;
- in a **Symfony project**, **Make a Doctrine migration** writes `migrations/VersionYYYYMMDDHHMMSS.php` with these statements instead: versioned, and run everywhere by `doctrine:migrations:migrate`.

### Take the database into the MPD

The other way: the MPD takes the database's tables, columns, types and keys. What matches by name keeps its tie to the MCD and its place; what the database changes is marked as changed by hand, so kept when the MPD is updated from the MCD.

## Import from a database

**Create a model → Physical model**, then a connection in the list, reads that database and makes two files: its **MPD** (linked to the connection) and the **MCD** worked out from it:

- a table whose key is made of foreign keys to two tables or more becomes an **association** again, its other columns its attributes;
- any other foreign key becomes an association between its two tables, **1,1** (or **0,1** when it can be empty) on the side of the table holding it, **0,n** on the other; it is named after the key's role when it says one (`reviewer_id` → ACCESS_REQUEST_REVIEWER);
- a framework's tables (`doctrine_migration_versions`, `migrations`, `_prisma_migrations`…) are left out, and never proposed for removal;
- an `id` primary key becomes the identifier `id_<table>`; the MPD's naming is guessed (`client_id` or `id_client`, `snake_case`…).

The imported MPD is the database as it is: no difference to begin with.

During the import, a progress bar shows each step: connecting to the database, tables read, MCD worked out, MPD, writing to `conception/`. If a step fails, nothing half-made is left in the folder.

## On a project's page

The **Modeling** tab of a [project's page](/devforge/en/dev/projects/) shows its models, with the same thumbnails as the Modeling page:

- **New model**: an MCD or a diagram, created by hand;
- **Create from the database**: shown when a database is linked to the project (Database tab). One click creates the MCD and the linked MPD, with the progress bar; **Open the MCD** or **Open the MPD** then leads there. With several linked databases, a list picks one;
- **Ask Forgy**: describe your application, then **Send to Forgy**. Forgy suggests an MCD (entities, attributes, associations, cardinalities) on a card, and writes it only after your click; **Forgy, from the database** asks it to start from the project's database. See [its actions](/devforge/en/forgy/actions/).

## The diagrams

Five other kinds of models are drawn on the same canvas, each with its parts in the bar at the bottom:

| Diagram | Parts | Links |
|---|---|---|
| **Use cases** | actor, use case, system | association, «include», «extend», generalization |
| **Classes** | class, interface, enumeration | association, inheritance, implementation, composition, aggregation, dependency |
| **Sequence** | actor, participant | message, return |
| **Flowchart** | start, step, decision, input / output, end | arrow (labelled *yes*, *no*…) |
| **Architecture** | client, gateway, service, database, queue, external | link (labelled *HTTPS*, *SQL*…) |

A part of the bar at the bottom is dragged onto the canvas, where it is let go (a click puts it in the middle of the screen). A link is pulled from one of the points that show up when hovering a part, onto another; it takes the **type of new links** chosen in the palette. Let go on empty space, it makes a linked part there (a step after a step, a use case after an actor, a service…). In a sequence, the message lands on the lifeline it points at, at the height where it is let go. A link is picked by its dot: the panel changes its type, its label, its direction. A **note** can go anywhere. Zone selection, copy, paste, duplicate, align and distribute work as in the MCD (in a sequence, the participants stay in their row).

- **Classes**: the panel takes the attributes and the methods, one per line (`- id : int`, `+ total() : float`); an enumeration, its values.
- **Sequence**: participants stand side by side, each message goes below the previous one; dragging its dot up or down changes its order.
- **Use cases**: a system holds use cases (moving it takes them along, its corner resizes it); a use case's panel tells its actor, what it includes, what extends it, and holds its **scenario**, one step per line.

As for the MCD: saved as it changes in `conception/` (`customer-journey.usecase.json`…), undo / redo, zoom, Fit, PNG and SVG export; a preview in the models list.

### Make the tasks in Notes

In a use case diagram, **Make the tasks in Notes** adds one task per use case to the project's [Notes](/devforge/en/dev/projects/) tab (*Use case “Place an order” (Customer)*). A task already there is not added twice.
