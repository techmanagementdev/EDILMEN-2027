-- EdilMen 2027 · schema iniziale

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  integer
);

CREATE TABLE IF NOT EXISTS catalog_versions (
  id          serial PRIMARY KEY,
  version     text NOT NULL,
  data        jsonb NOT NULL,
  note        text,
  active      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  integer
);

CREATE TABLE IF NOT EXISTS agencies (
  id          serial PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('agenzia','investitore')),
  name        text NOT NULL,
  vat         text,
  comune      text,
  provincia   text,
  phone       text,
  email       text,
  logo_file   integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id                 serial PRIMARY KEY,
  slug               text UNIQUE NOT NULL,
  name               text NOT NULL,
  vat                text,
  legal_form         text,
  ateco              text,
  address            text,
  comune             text,
  provincia          text,
  regione            text,
  lat                double precision,
  lon                double precision,
  website            text,
  description        text,
  categories         text[] NOT NULL DEFAULT '{}',
  provinces_served   text[] NOT NULL DEFAULT '{}',
  radius_km          integer NOT NULL DEFAULT 50,
  min_job            numeric,
  max_job            numeric,
  availability       text,
  employees          integer,
  years_active       integer,
  certs_declared     text[] NOT NULL DEFAULT '{}',
  status             text NOT NULL DEFAULT 'catalogo' CHECK (status IN ('catalogo','da_verificare','attiva','sospesa')),
  network            boolean NOT NULL DEFAULT false,
  convention_signed_at timestamptz,
  plan               text NOT NULL DEFAULT 'free',
  fee_rules          jsonb,
  publish_prices     boolean NOT NULL DEFAULT false,
  contact_name       text,
  contact_email      text,
  contact_phone      text,
  contact_kind       text NOT NULL DEFAULT 'corporate' CHECK (contact_kind IN ('corporate','personal')),
  receive_requests   boolean NOT NULL DEFAULT false,
  source             text,
  source_url         text,
  checked_at         timestamptz,
  claimed_at         timestamptz,
  logo_file          integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companies_prov ON companies (provincia);
CREATE INDEX IF NOT EXISTS companies_status ON companies (status, network);
CREATE UNIQUE INDEX IF NOT EXISTS companies_vat ON companies (vat) WHERE vat IS NOT NULL AND vat <> '';

CREATE TABLE IF NOT EXISTS users (
  id             serial PRIMARY KEY,
  email          text UNIQUE NOT NULL,
  password_hash  text NOT NULL,
  name           text,
  phone          text,
  role           text NOT NULL CHECK (role IN ('admin','operatore','cliente','agenzia','investitore','impresa')),
  company_id     integer REFERENCES companies(id) ON DELETE SET NULL,
  agency_id      integer REFERENCES agencies(id) ON DELETE SET NULL,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

CREATE TABLE IF NOT EXISTS files (
  id          serial PRIMARY KEY,
  owner_user  integer,
  kind        text,
  mime        text,
  name        text,
  size        integer,
  data        bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_docs (
  id           serial PRIMARY KEY,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('visura','durc','rc','patente','soa','iso')),
  valid_until  date,
  status       text NOT NULL DEFAULT 'caricato' CHECK (status IN ('caricato','verificato','rifiutato')),
  verified_at  timestamptz,
  verified_by  integer,
  note         text,
  file_id      integer REFERENCES files(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_prices (
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pkg         text NOT NULL,
  level       smallint NOT NULL CHECK (level BETWEEN 0 AND 2),
  price       numeric NOT NULL,
  ref_price   numeric,
  status      text NOT NULL DEFAULT 'da_controllare' CHECK (status IN ('da_controllare','approvato','rifiutato')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, pkg, level)
);

CREATE TABLE IF NOT EXISTS claims (
  id          serial PRIMARY KEY,
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  code_hash   text NOT NULL,
  code_plain  text,
  domain_match boolean NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  user_id     integer,
  status      text NOT NULL DEFAULT 'in_attesa' CHECK (status IN ('in_attesa','confermato','da_approvare','approvato','rifiutato')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id          serial PRIMARY KEY,
  agency_id   integer REFERENCES agencies(id) ON DELETE CASCADE,
  created_by  integer REFERENCES users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  address     text,
  comune      text,
  provincia   text,
  tipo        text,
  mq          numeric,
  piani       integer,
  units       integer NOT NULL DEFAULT 1,
  price_ask   numeric,
  value_after numeric,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id              serial PRIMARY KEY,
  code            text UNIQUE,
  kind            text NOT NULL DEFAULT 'casa' CHECK (kind IN ('casa','computo','vocale')),
  source          text NOT NULL DEFAULT 'sito',
  status          text NOT NULL DEFAULT 'nuova' CHECK (status IN ('nuova','contattata','sopralluogo','offerte','aggiudicata','in_cantiere','conclusa','persa')),
  user_id         integer REFERENCES users(id) ON DELETE SET NULL,
  agency_id       integer REFERENCES agencies(id) ON DELETE SET NULL,
  property_id     integer REFERENCES properties(id) ON DELETE SET NULL,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  contact_channel text,
  title           text,
  description     text,
  answers         jsonb NOT NULL DEFAULT '{}',
  spec            jsonb NOT NULL DEFAULT '{}',
  quote           jsonb,
  items           jsonb,
  total_ref       numeric,
  comune          text,
  provincia       text,
  regione         text,
  lat             double precision,
  lon             double precision,
  consents        jsonb NOT NULL DEFAULT '{}',
  appointment     jsonb,
  notes           text,
  assigned_to     integer REFERENCES users(id) ON DELETE SET NULL,
  voice_file      integer REFERENCES files(id) ON DELETE SET NULL,
  share_token     text UNIQUE,
  deadline        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS requests_status ON requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS request_events (
  id          serial PRIMARY KEY,
  request_id  integer NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  user_id     integer,
  type        text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS offers (
  id           serial PRIMARY KEY,
  request_id   integer NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source       text NOT NULL CHECK (source IN ('listino','invito','manuale')),
  status       text NOT NULL DEFAULT 'invitata' CHECK (status IN ('invitata','inviata','rifiutata','scelta','scartata')),
  amount       numeric,
  quote        jsonb,
  start_days   integer,
  note         text,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (request_id, company_id)
);

CREATE TABLE IF NOT EXISTS contracts (
  id            serial PRIMARY KEY,
  request_id    integer NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  offer_id      integer REFERENCES offers(id) ON DELETE SET NULL,
  company_id    integer NOT NULL REFERENCES companies(id),
  client_user   integer REFERENCES users(id) ON DELETE SET NULL,
  value         numeric NOT NULL,
  fee_rules     jsonb NOT NULL,
  fee_total     numeric NOT NULL,
  payment_mode  text NOT NULL DEFAULT 'diretto' CHECK (payment_mode IN ('diretto','escrow')),
  status        text NOT NULL DEFAULT 'attivo' CHECK (status IN ('attivo','concluso','annullato')),
  signed_at     date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sal (
  id            serial PRIMARY KEY,
  contract_id   integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  n             integer NOT NULL,
  name          text NOT NULL,
  document      text,
  share         numeric NOT NULL,
  amount        numeric NOT NULL,
  fee           numeric NOT NULL,
  status        text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','richiesto','approvato','pagato','contestato')),
  note          text,
  photos        integer[] NOT NULL DEFAULT '{}',
  requested_at  timestamptz,
  approved_at   timestamptz,
  paid_at       timestamptz,
  fee_invoiced_at timestamptz,
  fee_paid_at   timestamptz
);

CREATE TABLE IF NOT EXISTS reviews (
  id           serial PRIMARY KEY,
  contract_id  integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      integer REFERENCES users(id) ON DELETE SET NULL,
  scores       jsonb NOT NULL,
  text         text,
  status       text NOT NULL DEFAULT 'da_verificare' CHECK (status IN ('da_verificare','pubblicata','rifiutata')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id)
);

CREATE TABLE IF NOT EXISTS artisans (
  id            serial PRIMARY KEY,
  name          text,
  company_name  text,
  trade         text,
  phone         text,
  email         text,
  zone          text,
  vat           text,
  status        text NOT NULL DEFAULT 'da_chiamare',
  outcome       text,
  notes         text,
  last_contact  timestamptz,
  company_id    integer REFERENCES companies(id) ON DELETE SET NULL,
  source        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id          serial PRIMARY KEY,
  company_id  integer REFERENCES companies(id) ON DELETE CASCADE,
  email       text,
  text        text NOT NULL,
  status      text NOT NULL DEFAULT 'aperta',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit (
  id         serial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  user_id    integer,
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  data       jsonb
);
