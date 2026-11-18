-- EdilMen 2027 · livello SaaS: abbonamenti, gestionale impresa, statistiche, prezzi community

ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'nessuno';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_until date;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_until date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role text NOT NULL DEFAULT 'titolare';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS payments (
  id            serial PRIMARY KEY,
  company_id    integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan          text NOT NULL,
  amount        numeric NOT NULL,
  months        integer NOT NULL DEFAULT 1,
  method        text NOT NULL DEFAULT 'bonifico',
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  note          text,
  created_by    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_clients (
  id          serial PRIMARY KEY,
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  phone       text,
  address     text,
  comune      text,
  vat         text,
  stage       text NOT NULL DEFAULT 'contatto' CHECK (stage IN ('contatto','sopralluogo','preventivo','cliente','perso')),
  source      text,
  request_id  integer REFERENCES requests(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_clients_company ON crm_clients (company_id);

CREATE TABLE IF NOT EXISTS crm_quotes (
  id           serial PRIMARY KEY,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id    integer REFERENCES crm_clients(id) ON DELETE SET NULL,
  number       integer NOT NULL,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'bozza' CHECK (status IN ('bozza','inviato','accettato','rifiutato','scaduto')),
  items        jsonb NOT NULL DEFAULT '[]',
  discount     numeric NOT NULL DEFAULT 0,
  vat_rate     numeric NOT NULL DEFAULT 0.1,
  notes        text,
  conditions   text,
  valid_until  date,
  share_token  text UNIQUE,
  total        numeric NOT NULL DEFAULT 0,
  sent_at      timestamptz,
  answered_at  timestamptz,
  answer_note  text,
  created_by   integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);

CREATE TABLE IF NOT EXISTS crm_jobs (
  id          serial PRIMARY KEY,
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id   integer REFERENCES crm_clients(id) ON DELETE SET NULL,
  quote_id    integer REFERENCES crm_quotes(id) ON DELETE SET NULL,
  contract_id integer REFERENCES contracts(id) ON DELETE SET NULL,
  title       text NOT NULL,
  address     text,
  status      text NOT NULL DEFAULT 'pianificato' CHECK (status IN ('pianificato','in_corso','sospeso','concluso')),
  start_date  date,
  end_date    date,
  value       numeric,
  progress    integer NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_job_logs (
  id        serial PRIMARY KEY,
  job_id    integer NOT NULL REFERENCES crm_jobs(id) ON DELETE CASCADE,
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   integer,
  text      text,
  hours     numeric,
  photos    integer[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS crm_deadlines (
  id          serial PRIMARY KEY,
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id      integer REFERENCES crm_jobs(id) ON DELETE CASCADE,
  title       text NOT NULL,
  kind        text NOT NULL DEFAULT 'attivita',
  due         date NOT NULL,
  amount      numeric,
  done        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_stats (
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  day         date NOT NULL DEFAULT current_date,
  views       integer NOT NULL DEFAULT 0,
  in_quotes   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, day)
);

CREATE TABLE IF NOT EXISTS price_reports (
  id          serial PRIMARY KEY,
  pkg         text NOT NULL,
  level       smallint,
  comune      text,
  provincia   text,
  amount      numeric NOT NULL,
  qty         numeric NOT NULL,
  year        integer NOT NULL,
  description text,
  email       text,
  file_id     integer REFERENCES files(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'da_controllare' CHECK (status IN ('da_controllare','approvata','rifiutata')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
