-- D1-schema voor Liturgie Assistent (liederen + bijbel_hsv cache + actieve diensten per kerk).
CREATE TABLE IF NOT EXISTS liederen (
  id TEXT PRIMARY KEY,
  tekst TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bijbel_hsv (
  id TEXT PRIMARY KEY,
  tekst TEXT NOT NULL
);

-- Multi-Church actieve diensten (gesynchroniseerd vanuit Email Ingestion Worker)
CREATE TABLE IF NOT EXISTS actieve_diensten (
  kerk_id TEXT PRIMARY KEY,
  gemeente_naam TEXT,
  voorganger TEXT,
  datum TEXT,
  onderwerp TEXT,
  slides_json TEXT NOT NULL,
  ontbrekende_liederen TEXT,
  bron_afzender TEXT,
  bijgewerkt_op DATETIME DEFAULT CURRENT_TIMESTAMP
);
