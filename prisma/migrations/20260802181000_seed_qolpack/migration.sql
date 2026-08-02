-- Carries the single hardcoded pack that used to live in src/lib/modpack.ts
-- into the table that replaced it.
--
-- Without this the modpacks page would simply go empty on deploy: the files are
-- already on disk and already linked from Discord, they just had no rows. The
-- filenames below are the ones nginx is serving right now, and they are exactly
-- what storedFilename('qolpack', kind, '26.1.2') produces, so a later
-- re-upload of the same version overwrites in place rather than orphaning them.
--
-- Timestamps are written as UTC explicitly. Plain NOW() would return the
-- database server's local time into a `timestamp without time zone` column,
-- while Prisma writes UTC into the same column — on a non-UTC server that gap
-- puts this row in the future and lets a pack created later sort ahead of it.
--
-- Guarded so re-running is harmless.

INSERT INTO "Modpack" ("id", "slug", "name", "summary", "minecraft", "loader", "version", "isPublished", "sortOrder", "createdAt", "updatedAt")
SELECT 'qolpack', 'qolpack', 'QOLPack', 'Everything we actually run, in one install — vetted, versioned, and kept current.', '26.1.2', 'Fabric 0.19.3', '26.1.2', true, 0, (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
WHERE NOT EXISTS (SELECT 1 FROM "Modpack" WHERE "slug" = 'qolpack');

INSERT INTO "ModpackFile" ("id", "modpackId", "kind", "filename", "bytes", "uploadedAt")
SELECT 'qolpack-mrpack', 'qolpack', 'MRPACK', 'qolpack-26-1-2.mrpack', 12561416, (NOW() AT TIME ZONE 'UTC')
WHERE EXISTS (SELECT 1 FROM "Modpack" WHERE "id" = 'qolpack')
  AND NOT EXISTS (SELECT 1 FROM "ModpackFile" WHERE "modpackId" = 'qolpack' AND "kind" = 'MRPACK');

INSERT INTO "ModpackFile" ("id", "modpackId", "kind", "filename", "bytes", "uploadedAt")
SELECT 'qolpack-zip', 'qolpack', 'ZIP', 'qolpack-26-1-2.zip', 91327161, (NOW() AT TIME ZONE 'UTC')
WHERE EXISTS (SELECT 1 FROM "Modpack" WHERE "id" = 'qolpack')
  AND NOT EXISTS (SELECT 1 FROM "ModpackFile" WHERE "modpackId" = 'qolpack' AND "kind" = 'ZIP');

-- The 25 mods with their curated groups, which no manifest could reproduce.
INSERT INTO "ModpackMod" ("id", "modpackId", "name", "version", "modrinth", "bundledOnly", "group", "sortOrder")
SELECT * FROM (VALUES
  ('qolpack-mod-0', 'qolpack', 'SkyHanni', '7.29.0', 'byNkmv5G', false, 'skyblock', 0),
  ('qolpack-mod-1', 'qolpack', 'SkyOcean', '1.17.2', 'dIczrQAR', false, 'skyblock', 1),
  ('qolpack-mod-2', 'qolpack', 'SkyBlockPv', '1.8.8', '8yqXwFLl', false, 'skyblock', 2),
  ('qolpack-mod-3', 'qolpack', 'SBO', '0.4.3', '9lBqVbQF', false, 'skyblock', 3),
  ('qolpack-mod-4', 'qolpack', 'NoFrills', '0.4.11', 'qpZgAErQ', false, 'skyblock', 4),
  ('qolpack-mod-5', 'qolpack', 'SecretRoutes', '1.0.0-beta4', 'l1qibtk8', false, 'skyblock', 5),
  ('qolpack-mod-6', 'qolpack', 'Odin', '0.2.3', 'jJJLywXp', false, 'skyblock', 6),
  ('qolpack-mod-7', 'qolpack', 'NoammAddons', '1.2.3', NULL, true, 'risky', 7),
  ('qolpack-mod-8', 'qolpack', 'Odin Client', '0.2.3-r1', NULL, true, 'risky', 8),
  ('qolpack-mod-9', 'qolpack', 'Sodium', '0.9.1-beta.3', 'AANobbMI', false, 'performance', 9),
  ('qolpack-mod-10', 'qolpack', 'Sodium Extra', '0.9.1', 'PtjYWJkn', false, 'performance', 10),
  ('qolpack-mod-11', 'qolpack', 'Lithium', '0.24.6', 'gvQqBUqZ', false, 'performance', 11),
  ('qolpack-mod-12', 'qolpack', 'FerriteCore', '9.0.0', 'uXXizFIs', false, 'performance', 12),
  ('qolpack-mod-13', 'qolpack', 'EntityCulling', '1.10.5', 'NNAgCjsB', false, 'performance', 13),
  ('qolpack-mod-14', 'qolpack', 'ImmediatelyFast', '1.15.3', '5ZwdcRci', false, 'performance', 14),
  ('qolpack-mod-15', 'qolpack', 'Inventory Buttons', '1.2.2', 'D5cgMv16', false, 'interface', 15),
  ('qolpack-mod-16', 'qolpack', 'Longer Chat History', '1.8', 'f4P7fNKN', false, 'interface', 16),
  ('qolpack-mod-17', 'qolpack', 'Fabric API', '0.154.0', 'P7dR8mSH', false, 'libraries', 17),
  ('qolpack-mod-18', 'qolpack', 'Fabric Loader', '0.19.3', 'OoMgWV72', false, 'libraries', 18),
  ('qolpack-mod-19', 'qolpack', 'Fabric Language Kotlin', '1.13.12', 'Ha28R6CL', false, 'libraries', 19),
  ('qolpack-mod-20', 'qolpack', 'Architectury', '20.0.7', 'lhGA9TYQ', false, 'libraries', 20),
  ('qolpack-mod-21', 'qolpack', 'Cloth Config', '26.1.154', '9s6osm5g', false, 'libraries', 21),
  ('qolpack-mod-22', 'qolpack', 'owo-lib', '0.13.0', 'ccKDOlHs', false, 'libraries', 22),
  ('qolpack-mod-23', 'qolpack', 'YetAnotherConfigLib', '3.9.5', '1eAoo2KR', false, 'libraries', 23),
  ('qolpack-mod-24', 'qolpack', 'Hypixel Mod API', '1.0.2', '1A2mKfBx', false, 'libraries', 24)
) AS v("id", "modpackId", "name", "version", "modrinth", "bundledOnly", "group", "sortOrder")
WHERE NOT EXISTS (SELECT 1 FROM "ModpackMod" WHERE "modpackId" = 'qolpack');
