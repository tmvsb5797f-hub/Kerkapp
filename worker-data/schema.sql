-- D1-schema voor Liturgie Assistent (liederen + bijbel_hsv cache).
CREATE TABLE IF NOT EXISTS liederen (
  id TEXT PRIMARY KEY,
  tekst TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bijbel_hsv (
  id TEXT PRIMARY KEY,
  tekst TEXT NOT NULL
);
