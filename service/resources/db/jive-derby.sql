DROP TABLE IF EXISTS jderby_results;
DROP SEQUENCE IF EXISTS jderby_results_id_seq;
DROP TABLE IF EXISTS jderby_racers;
DROP TABLE IF EXISTS jderby_measurements;
DROP SEQUENCE IF EXISTS jderby_measurement_id_seq;
DROP TABLE IF EXISTS jderby_races;
DROP SEQUENCE IF EXISTS jderby_races_name_seq;
DROP TABLE IF EXISTS jderby_result_echo;
DROP TABLE IF EXISTS jderby_derbies;

-- TODO: NEED TO ADD NON-NULL CONSTRAINTS AND VALIDATIONS TO SCHEMA (as needed)

-- ##################################################
CREATE TABLE jderby_racers (
  id INTEGER PRIMARY KEY,
  username VARCHAR(255),
  name VARCHAR(255),
  title VARCHAR(255),
  company VARCHAR(255),
  avatarURL VARCHAR(255),
  profileURL VARCHAR(255),
  uri VARCHAR(255),
  track VARCHAR(255),
  region VARCHAR(255),
  joinDate DATE
);

-- ##################################################
CREATE TABLE jderby_derbies (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255),
  jiveTenantID VARCHAR(255),
  jivePlaceURI VARCHAR(255),
  jivePlaceURL VARCHAR(255),
  jiveDocumentURI VARCHAR(255),
  jiveDocumentURL VARCHAR(255),
  isPublic BOOLEAN DEFAULT true,
  isActive BOOLEAN DEFAULT true
);

-- ##################################################
CREATE SEQUENCE jderby_races_name_seq;
CREATE TABLE jderby_races (
  derbyID VARCHAR(32) REFERENCES jderby_derbies (id),
  --TODO: THEORETICALLY THIS INVALIDATES THE PRIMARY KEY CONCEPT, BUT REALISTICALLY NO...
  id BIGINT UNIQUE,
  name VARCHAR(128) default 'Race '|| nextval('jderby_races_name_seq'),
  photoURL VARCHAR(255),
  split1 NUMERIC,
  split2 NUMERIC,
  split3 NUMERIC,
  split4 NUMERIC,
  timestamp timestamp default current_timestamp,
  jiveURI VARCHAR(255),
  jiveURL VARCHAR(255),
  PRIMARY KEY(derbyID,id)
);
ALTER SEQUENCE jderby_races_name_seq OWNED BY jderby_races.name;
CREATE INDEX ON jderby_races (derbyID);

-- ##################################################
CREATE SEQUENCE jderby_results_id_seq;
CREATE TABLE jderby_results (
  resultID INTEGER PRIMARY KEY DEFAULT nextval('jderby_results_id_seq'),
  lane INTEGER,
  rank SMALLINT,
  racerID INTEGER REFERENCES jderby_racers (id),
  raceID BIGINT REFERENCES jderby_races (id),
  totalTimeSec NUMERIC,
  speed NUMERIC,
  isPrimary BOOLEAN DEFAULT false,
  isActive BOOLEAN
);
ALTER SEQUENCE jderby_results_id_seq OWNED BY jderby_results.resultID;
CREATE INDEX ON jderby_results ((racerID));
CREATE INDEX ON jderby_results ((raceID));
CREATE INDEX ON jderby_results ((lane));
CREATE INDEX ON jderby_results ((rank));
CREATE INDEX ON jderby_results ((isPrimary));
CREATE INDEX ON jderby_results ((isActive));

-- ##################################################
CREATE TABLE jderby_result_echo (
  derbyID VARCHAR(32) REFERENCES jderby_derbies (id),
  echoURL VARCHAR(255),
  httpVerb VARCHAR(16),
  securityHeader VARCHAR(255),
  securityToken VARCHAR(255),
  onlyLive BOOLEAN default true,
  failCount INTEGER default 0,
  lastFailTimestamp timestamp,
  active BOOLEAN default true,
  PRIMARY KEY(derbyID,echoURL)
);

-- ##################################################
CREATE SEQUENCE jderby_measurement_id_seq;
CREATE TABLE jderby_measurements (
  ID INTEGER PRIMARY KEY DEFAULT nextval('jderby_measurement_id_seq'),
  raceID BIGINT REFERENCES jderby_races (id),
  timestamp timestamp default current_timestamp,
  type VARCHAR(16),
  value NUMERIC,
  unit VARCHAR(16),
  UNIQUE (raceID,type)
);
ALTER SEQUENCE jderby_measurement_id_seq OWNED BY jderby_measurements.ID;
CREATE INDEX ON jderby_measurements ((raceID));
CREATE INDEX ON jderby_measurements ((type));
