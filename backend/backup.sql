--
-- PostgreSQL database dump
--

\restrict SOdJDTanGHHPGe32RuDTdBhDGa8n0hqhtGscOnd9SHiEVNysxCVPRyQzOyBbUwY

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _heroku; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _heroku;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: create_ext(); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.create_ext() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

  schemaname TEXT;
  databaseowner TEXT;

  r RECORD;

BEGIN
  IF tg_tag OPERATOR(pg_catalog.=) 'CREATE EXTENSION' THEN
    PERFORM _heroku.validate_search_path();

    FOR r IN SELECT * FROM pg_catalog.pg_event_trigger_ddl_commands()
    LOOP
        CONTINUE WHEN r.command_tag != 'CREATE EXTENSION' OR r.object_type != 'extension';

        schemaname := (
            SELECT n.nspname
            FROM pg_catalog.pg_extension AS e
            INNER JOIN pg_catalog.pg_namespace AS n
            ON e.extnamespace = n.oid
            WHERE e.oid = r.objid
        );

        databaseowner := (
            SELECT pg_catalog.pg_get_userbyid(d.datdba)
            FROM pg_catalog.pg_database d
            WHERE d.datname = pg_catalog.current_database()
        );
        --RAISE NOTICE 'Record for event trigger %, objid: %,tag: %, current_user: %, schema: %, database_owenr: %', r.object_identity, r.objid, tg_tag, current_user, schemaname, databaseowner;
        IF r.object_identity = 'address_standardizer_data_us' THEN
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT, UPDATE, INSERT, DELETE', databaseowner, 'us_gaz');
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT, UPDATE, INSERT, DELETE', databaseowner, 'us_lex');
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT, UPDATE, INSERT, DELETE', databaseowner, 'us_rules');
        ELSIF r.object_identity = 'amcheck' THEN
            -- Grant execute permissions on amcheck functions (bt_*, gin_*, and verify_*)
            PERFORM _heroku.grant_function_execute_for_extension(r.objid, schemaname, databaseowner, ARRAY['bt_%', 'gin_%', 'verify_%'], NULL);
        ELSIF r.object_identity = 'dblink' THEN
            -- Grant execute permissions on dblink functions, excluding dblink_connect_u()
            -- which allows unauthenticated connections and should remain superuser-only
            PERFORM _heroku.grant_function_execute_for_extension(r.objid, schemaname, databaseowner, ARRAY['dblink%'], 'dblink_connect_u%');
            -- Explicitly revoke permissions on dblink_connect_u functions as a safety measure
            -- in case they were granted by default or in a previous version
            BEGIN
                EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %I.dblink_connect_u(text) FROM %I;', schemaname, databaseowner);
            EXCEPTION WHEN OTHERS THEN
                -- Function might not exist, continue
                NULL;
            END;
            BEGIN
                EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %I.dblink_connect_u(text, text) FROM %I;', schemaname, databaseowner);
            EXCEPTION WHEN OTHERS THEN
                -- Function might not exist, continue
                NULL;
            END;
        ELSIF r.object_identity = 'dict_int' THEN
            EXECUTE pg_catalog.format('ALTER TEXT SEARCH DICTIONARY %I.intdict OWNER TO %I;', schemaname, databaseowner);
        ELSIF r.object_identity = 'pg_prewarm' THEN
            -- Grant execute permissions on pg_prewarm and autoprewarm functions
            PERFORM _heroku.grant_function_execute_for_extension(
                r.objid, schemaname, databaseowner, ARRAY['pg_prewarm%', 'autoprewarm%'], NULL
            );
        ELSIF r.object_identity = 'pg_partman' THEN
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT, UPDATE, INSERT, DELETE', databaseowner, 'part_config');
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT, UPDATE, INSERT, DELETE', databaseowner, 'part_config_sub');
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT, UPDATE, INSERT, DELETE', databaseowner, 'custom_time_partitions');
        ELSIF r.object_identity = 'pg_stat_statements' THEN
            -- Grant execute permissions on pg_stat_statements functions
            PERFORM _heroku.grant_function_execute_for_extension(
                r.objid, schemaname, databaseowner, ARRAY['pg_stat_statements%'], NULL
            );
        ELSIF r.object_identity = 'postgres_fdw' THEN
            -- Grant USAGE on the foreign data wrapper (required for creating foreign servers and user mappings)
            EXECUTE pg_catalog.format('GRANT USAGE ON FOREIGN DATA WRAPPER postgres_fdw TO %I;', databaseowner);
            -- Grant execute permissions on all postgres_fdw functions
            PERFORM _heroku.grant_function_execute_for_extension(r.objid, schemaname, databaseowner, ARRAY['postgres_fdw%'], NULL);
        ELSIF r.object_identity = 'postgis' THEN
            PERFORM _heroku.postgis_after_create();
        ELSIF r.object_identity = 'postgis_raster' THEN
            PERFORM _heroku.postgis_after_create();
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT', databaseowner, 'raster_columns');
            PERFORM _heroku.grant_table_if_exists(schemaname, 'SELECT', databaseowner, 'raster_overviews');
        ELSIF r.object_identity = 'postgis_topology' THEN
            PERFORM _heroku.postgis_after_create();
            EXECUTE pg_catalog.format('ALTER SCHEMA topology OWNER TO %I;', databaseowner);
            EXECUTE pg_catalog.format('GRANT USAGE ON SCHEMA topology TO %I;', databaseowner);
            EXECUTE pg_catalog.format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA topology TO %I;', databaseowner);
            PERFORM _heroku.grant_table_if_exists('topology', 'SELECT, UPDATE, INSERT, DELETE', databaseowner);
            EXECUTE pg_catalog.format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA topology TO %I;', databaseowner);
        ELSIF r.object_identity = 'postgis_tiger_geocoder' THEN
            PERFORM _heroku.postgis_after_create();
            EXECUTE pg_catalog.format('ALTER SCHEMA tiger OWNER TO %I;', databaseowner);
            EXECUTE pg_catalog.format('GRANT USAGE ON SCHEMA tiger TO %I;', databaseowner);
            EXECUTE pg_catalog.format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tiger TO %I;', databaseowner);
            PERFORM _heroku.grant_table_if_exists('tiger', 'SELECT, UPDATE, INSERT, DELETE', databaseowner);
            EXECUTE pg_catalog.format('ALTER SCHEMA tiger_data OWNER TO %I;', databaseowner);
            EXECUTE pg_catalog.format('GRANT USAGE ON SCHEMA tiger_data TO %I;', databaseowner);
            EXECUTE pg_catalog.format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tiger_data TO %I;', databaseowner);
            PERFORM _heroku.grant_table_if_exists('tiger_data', 'SELECT, UPDATE, INSERT, DELETE', databaseowner);
        END IF;
    END LOOP;
  END IF;
END;
$$;


--
-- Name: drop_ext(); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.drop_ext() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

  schemaname TEXT;
  databaseowner TEXT;

  r RECORD;

BEGIN
  IF tg_tag OPERATOR(pg_catalog.=) 'DROP EXTENSION' THEN
    PERFORM _heroku.validate_search_path();

    FOR r IN SELECT * FROM pg_catalog.pg_event_trigger_dropped_objects()
    LOOP
      CONTINUE WHEN r.object_type != 'extension';

      databaseowner := (
            SELECT pg_catalog.pg_get_userbyid(d.datdba)
            FROM pg_catalog.pg_database d
            WHERE d.datname = pg_catalog.current_database()
      );

      --RAISE NOTICE 'Record for event trigger %, objid: %,tag: %, current_user: %, database_owner: %, schemaname: %', r.object_identity, r.objid, tg_tag, current_user, databaseowner, r.schema_name;

      IF r.object_identity = 'postgis_topology' THEN
          EXECUTE pg_catalog.format('DROP SCHEMA IF EXISTS topology');
      END IF;
    END LOOP;

  END IF;
END;
$$;


--
-- Name: extension_before_drop(); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.extension_before_drop() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

  query TEXT;

BEGIN
  query := (SELECT pg_catalog.current_query());

  -- RAISE NOTICE 'executing extension_before_drop: tg_event: %, tg_tag: %, current_user: %, session_user: %, query: %', tg_event, tg_tag, current_user, session_user, query;
  -- skip this validation if executed by an rds_superuser
  IF tg_tag OPERATOR(pg_catalog.=) 'DROP EXTENSION' AND NOT pg_catalog.pg_has_role(session_user, 'rds_superuser', 'MEMBER') THEN
    PERFORM _heroku.validate_search_path();

    -- DROP EXTENSION [ IF EXISTS ] name [, ...] [ CASCADE | RESTRICT ]
    IF (pg_catalog.regexp_match(query, 'DROP\s+EXTENSION\s+(IF\s+EXISTS)?.*(plpgsql)', 'i') IS NOT NULL) THEN
      RAISE EXCEPTION 'The plpgsql extension is required for database management and cannot be dropped.';
    END IF;
  END IF;
END;
$$;


--
-- Name: grant_function_execute_for_extension(oid, text, text, text[], text); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.grant_function_execute_for_extension(extension_oid oid, schemaname text, databaseowner text, name_patterns text[] DEFAULT NULL::text[], exclude_pattern text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE
    func_rec RECORD;

BEGIN
    PERFORM _heroku.validate_search_path();

    -- Dynamically grant execute permissions on extension functions.
    -- Finds functions belonging to the extension via pg_depend and grants execute permissions.
    FOR func_rec IN
        SELECT p.oid::regprocedure::text as func_sig
        FROM pg_catalog.pg_depend d
        JOIN pg_catalog.pg_proc p ON d.objid = p.oid
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE d.refclassid = 'pg_catalog.pg_extension'::regclass
          AND d.refobjid = extension_oid
          AND d.deptype = 'e'
          AND n.nspname = schemaname
          AND (name_patterns IS NULL OR p.proname LIKE ANY(name_patterns))
          AND (exclude_pattern IS NULL OR p.proname NOT LIKE exclude_pattern)
    LOOP
        BEGIN
            EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %s TO %I;', func_rec.func_sig, databaseowner);
        EXCEPTION WHEN OTHERS THEN
            -- Function might not exist or already granted, continue
            NULL;
        END;
    END LOOP;
END;
$$;


--
-- Name: grant_table_if_exists(text, text, text, text); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.grant_table_if_exists(alias_schemaname text, grants text, databaseowner text, alias_tablename text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN
  PERFORM _heroku.validate_search_path();

  IF alias_tablename IS NULL THEN
    EXECUTE pg_catalog.format('GRANT %s ON ALL TABLES IN SCHEMA %I TO %I;', grants, alias_schemaname, databaseowner);
  ELSE
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE pg_tables.schemaname = alias_schemaname AND pg_tables.tablename = alias_tablename) THEN
      EXECUTE pg_catalog.format('GRANT %s ON TABLE %I.%I TO %I;', grants, alias_schemaname, alias_tablename, databaseowner);
    END IF;
  END IF;
END;
$$;


--
-- Name: postgis_after_create(); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.postgis_after_create() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    schemaname TEXT;
    databaseowner TEXT;
BEGIN
    PERFORM _heroku.validate_search_path();

    schemaname := (
        SELECT n.nspname
        FROM pg_catalog.pg_extension AS e
        INNER JOIN pg_catalog.pg_namespace AS n ON e.extnamespace = n.oid
        WHERE e.extname = 'postgis'
    );
    databaseowner := (
        SELECT pg_catalog.pg_get_userbyid(d.datdba)
        FROM pg_catalog.pg_database d
        WHERE d.datname = pg_catalog.current_database()
    );

    EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %I.st_tileenvelope TO %I;', schemaname, databaseowner);
    EXECUTE pg_catalog.format('GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE %I.spatial_ref_sys TO %I;', schemaname, databaseowner);
END;
$$;


--
-- Name: sanitize_search_path(text); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.sanitize_search_path(unsafe_search_path text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  search_path_parts TEXT[];
  safe_search_path TEXT;
BEGIN
  IF unsafe_search_path IS NULL THEN
    unsafe_search_path := pg_catalog.current_setting('search_path');
  END IF;

  search_path_parts := pg_catalog.string_to_array(unsafe_search_path, ',');
  search_path_parts := (
    SELECT pg_catalog.array_agg(TRIM(schema_name::text))
    FROM pg_catalog.unnest(search_path_parts) AS schema_name
    WHERE TRIM(schema_name::text) OPERATOR(pg_catalog.!~~) 'pg_temp%'
  );
  search_path_parts := (SELECT pg_catalog.array_remove(search_path_parts, 'pg_catalog'));
  search_path_parts := (SELECT pg_catalog.array_append(search_path_parts, 'pg_temp'));
  SELECT pg_catalog.array_to_string(search_path_parts, ',') INTO safe_search_path;
  RETURN safe_search_path;
END;
$$;


--
-- Name: validate_extension(); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.validate_extension() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

  schemaname TEXT;
  r RECORD;

BEGIN
  IF tg_tag OPERATOR(pg_catalog.=) 'CREATE EXTENSION' THEN
    PERFORM _heroku.validate_search_path();

    FOR r IN SELECT * FROM pg_catalog.pg_event_trigger_ddl_commands()
    LOOP
      CONTINUE WHEN r.command_tag != 'CREATE EXTENSION' OR r.object_type != 'extension';

      schemaname := (
        SELECT n.nspname
        FROM pg_catalog.pg_extension AS e
        INNER JOIN pg_catalog.pg_namespace AS n
        ON e.extnamespace = n.oid
        WHERE e.oid = r.objid
      );

      IF schemaname = '_heroku' THEN
        RAISE EXCEPTION 'Creating extensions in the _heroku schema is not allowed';
      END IF;
    END LOOP;
  END IF;
END;
$$;


--
-- Name: validate_search_path(); Type: FUNCTION; Schema: _heroku; Owner: -
--

CREATE FUNCTION _heroku.validate_search_path() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE

  current_search_path TEXT;
  safe_search_path TEXT;
  current_schemas TEXT[];
  pg_catalog_index INTEGER;

BEGIN

  current_search_path := pg_catalog.current_setting('search_path');
  current_schemas := (SELECT pg_catalog.current_schemas(true));
  safe_search_path := _heroku.sanitize_search_path(current_search_path);

  IF current_schemas[1] OPERATOR(pg_catalog.~~) 'pg_temp%' THEN
    RAISE EXCEPTION 'Unable to perform this operation with current schema configuration. Try: SET search_path TO %.', safe_search_path;
  END IF;

  IF ('pg_catalog' OPERATOR(pg_catalog.=) ANY(current_schemas)) THEN
    SELECT pg_catalog.array_position(current_schemas, 'pg_catalog') INTO pg_catalog_index;
    IF pg_catalog_index OPERATOR(pg_catalog.!=) 1 THEN
      RAISE EXCEPTION 'Unable to perform this operation with current schema configuration. Try: SET search_path TO %.', safe_search_path;
    END IF;
  END IF;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_group (
    id integer NOT NULL,
    name character varying(150) NOT NULL
);


--
-- Name: auth_group_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auth_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_group_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_group_permissions (
    id bigint NOT NULL,
    group_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auth_group_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_permission (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    content_type_id integer NOT NULL,
    codename character varying(100) NOT NULL
);


--
-- Name: auth_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auth_permission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_course (
    id bigint NOT NULL,
    zoom_link text,
    course_name text NOT NULL,
    course_description text,
    score_total integer NOT NULL
);


--
-- Name: core_course_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_course ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_course_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_coursetomodules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_coursetomodules (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    module_id bigint NOT NULL
);


--
-- Name: core_coursetomodules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_coursetomodules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_coursetomodules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_coursetostudents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_coursetostudents (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: core_coursetostudents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_coursetostudents ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_coursetostudents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_coursetoteachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_coursetoteachers (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: core_coursetoteachers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_coursetoteachers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_coursetoteachers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_module; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_module (
    id bigint NOT NULL,
    module_name text NOT NULL,
    module_description text,
    youtube_link text,
    module_order integer NOT NULL,
    score_total integer NOT NULL,
    is_posted boolean NOT NULL,
    course_id bigint NOT NULL,
    due_date timestamp with time zone
);


--
-- Name: core_module_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_module ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_module_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_moduletoquestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_moduletoquestions (
    id bigint NOT NULL,
    module_id bigint NOT NULL,
    question_id bigint NOT NULL
);


--
-- Name: core_moduletoquestions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_moduletoquestions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_moduletoquestions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_question (
    id bigint NOT NULL,
    question_type character varying(20) NOT NULL,
    question_text text NOT NULL,
    mcq_options jsonb,
    question_order integer NOT NULL,
    score_total integer NOT NULL,
    module_id bigint NOT NULL
);


--
-- Name: core_question_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_question ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_question_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_questiontocorrectanswers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_questiontocorrectanswers (
    id bigint NOT NULL,
    correct_answer text NOT NULL,
    question_id bigint NOT NULL
);


--
-- Name: core_questiontocorrectanswers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_questiontocorrectanswers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_questiontocorrectanswers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_submission (
    id bigint NOT NULL,
    submission_type character varying(20) NOT NULL,
    submission_response text NOT NULL,
    time_submitted timestamp with time zone NOT NULL,
    module_id bigint NOT NULL,
    question_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: core_submission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_submission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_submission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_user (
    id bigint NOT NULL,
    password character varying(128) NOT NULL,
    last_login timestamp with time zone,
    is_superuser boolean NOT NULL,
    username character varying(150) NOT NULL,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(254) NOT NULL,
    is_staff boolean NOT NULL,
    is_active boolean NOT NULL,
    date_joined timestamp with time zone NOT NULL,
    "isStudent" boolean NOT NULL
);


--
-- Name: core_user_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_user_groups (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    group_id integer NOT NULL
);


--
-- Name: core_user_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_user_groups ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_user_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_user ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_user_user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_user_user_permissions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: core_user_user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_user_user_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_user_user_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_usercoursegrade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_usercoursegrade (
    id bigint NOT NULL,
    score integer,
    total integer,
    course_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: core_usercoursegrade_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_usercoursegrade ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_usercoursegrade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_usermodulegrade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_usermodulegrade (
    id bigint NOT NULL,
    score integer,
    total integer,
    module_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: core_usermodulegrade_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_usermodulegrade ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_usermodulegrade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: core_userquestiongrade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.core_userquestiongrade (
    id bigint NOT NULL,
    score integer,
    total integer,
    is_overdue boolean NOT NULL,
    question_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: core_userquestiongrade_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.core_userquestiongrade ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.core_userquestiongrade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_admin_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.django_admin_log (
    id integer NOT NULL,
    action_time timestamp with time zone NOT NULL,
    object_id text,
    object_repr character varying(200) NOT NULL,
    action_flag smallint NOT NULL,
    change_message text NOT NULL,
    content_type_id integer,
    user_id bigint NOT NULL,
    CONSTRAINT django_admin_log_action_flag_check CHECK ((action_flag >= 0))
);


--
-- Name: django_admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.django_admin_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_content_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.django_content_type (
    id integer NOT NULL,
    app_label character varying(100) NOT NULL,
    model character varying(100) NOT NULL
);


--
-- Name: django_content_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.django_content_type ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_content_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.django_migrations (
    id bigint NOT NULL,
    app character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    applied timestamp with time zone NOT NULL
);


--
-- Name: django_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.django_migrations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.django_session (
    session_key character varying(40) NOT NULL,
    session_data text NOT NULL,
    expire_date timestamp with time zone NOT NULL
);


--
-- Data for Name: auth_group; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_group (id, name) FROM stdin;
\.


--
-- Data for Name: auth_group_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_group_permissions (id, group_id, permission_id) FROM stdin;
\.


--
-- Data for Name: auth_permission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_permission (id, name, content_type_id, codename) FROM stdin;
1	Can add log entry	1	add_logentry
2	Can change log entry	1	change_logentry
3	Can delete log entry	1	delete_logentry
4	Can view log entry	1	view_logentry
5	Can add permission	2	add_permission
6	Can change permission	2	change_permission
7	Can delete permission	2	delete_permission
8	Can view permission	2	view_permission
9	Can add group	3	add_group
10	Can change group	3	change_group
11	Can delete group	3	delete_group
12	Can view group	3	view_group
13	Can add content type	4	add_contenttype
14	Can change content type	4	change_contenttype
15	Can delete content type	4	delete_contenttype
16	Can view content type	4	view_contenttype
17	Can add session	5	add_session
18	Can change session	5	change_session
19	Can delete session	5	delete_session
20	Can view session	5	view_session
21	Can add user	6	add_user
22	Can change user	6	change_user
23	Can delete user	6	delete_user
24	Can view user	6	view_user
25	Can add course	7	add_course
26	Can change course	7	change_course
27	Can delete course	7	delete_course
28	Can view course	7	view_course
29	Can add course to students	8	add_coursetostudents
30	Can change course to students	8	change_coursetostudents
31	Can delete course to students	8	delete_coursetostudents
32	Can view course to students	8	view_coursetostudents
33	Can add course to teachers	9	add_coursetoteachers
34	Can change course to teachers	9	change_coursetoteachers
35	Can delete course to teachers	9	delete_coursetoteachers
36	Can view course to teachers	9	view_coursetoteachers
37	Can add module	10	add_module
38	Can change module	10	change_module
39	Can delete module	10	delete_module
40	Can view module	10	view_module
41	Can add course to modules	11	add_coursetomodules
42	Can change course to modules	11	change_coursetomodules
43	Can delete course to modules	11	delete_coursetomodules
44	Can view course to modules	11	view_coursetomodules
45	Can add question	12	add_question
46	Can change question	12	change_question
47	Can delete question	12	delete_question
48	Can view question	12	view_question
49	Can add module to questions	13	add_moduletoquestions
50	Can change module to questions	13	change_moduletoquestions
51	Can delete module to questions	13	delete_moduletoquestions
52	Can view module to questions	13	view_moduletoquestions
53	Can add question to correct answers	14	add_questiontocorrectanswers
54	Can change question to correct answers	14	change_questiontocorrectanswers
55	Can delete question to correct answers	14	delete_questiontocorrectanswers
56	Can view question to correct answers	14	view_questiontocorrectanswers
57	Can add submission	15	add_submission
58	Can change submission	15	change_submission
59	Can delete submission	15	delete_submission
60	Can view submission	15	view_submission
61	Can add user course grade	16	add_usercoursegrade
62	Can change user course grade	16	change_usercoursegrade
63	Can delete user course grade	16	delete_usercoursegrade
64	Can view user course grade	16	view_usercoursegrade
65	Can add user module grade	17	add_usermodulegrade
66	Can change user module grade	17	change_usermodulegrade
67	Can delete user module grade	17	delete_usermodulegrade
68	Can view user module grade	17	view_usermodulegrade
69	Can add user question grade	18	add_userquestiongrade
70	Can change user question grade	18	change_userquestiongrade
71	Can delete user question grade	18	delete_userquestiongrade
72	Can view user question grade	18	view_userquestiongrade
\.


--
-- Data for Name: core_course; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_course (id, zoom_link, course_name, course_description, score_total) FROM stdin;
\.


--
-- Data for Name: core_coursetomodules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_coursetomodules (id, course_id, module_id) FROM stdin;
\.


--
-- Data for Name: core_coursetostudents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_coursetostudents (id, course_id, user_id) FROM stdin;
\.


--
-- Data for Name: core_coursetoteachers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_coursetoteachers (id, course_id, user_id) FROM stdin;
\.


--
-- Data for Name: core_module; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_module (id, module_name, module_description, youtube_link, module_order, score_total, is_posted, course_id, due_date) FROM stdin;
\.


--
-- Data for Name: core_moduletoquestions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_moduletoquestions (id, module_id, question_id) FROM stdin;
\.


--
-- Data for Name: core_question; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_question (id, question_type, question_text, mcq_options, question_order, score_total, module_id) FROM stdin;
\.


--
-- Data for Name: core_questiontocorrectanswers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_questiontocorrectanswers (id, correct_answer, question_id) FROM stdin;
\.


--
-- Data for Name: core_submission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_submission (id, submission_type, submission_response, time_submitted, module_id, question_id, user_id) FROM stdin;
\.


--
-- Data for Name: core_user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_user (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, "isStudent") FROM stdin;
1	pbkdf2_sha256$1000000$WmXmEZ2JJe8e8CJCrpLbyl$xxIem2DoQXsrR7T/vrLNv/kGs7375zNxfoVmgsDqFZk=	\N	f	student@gmail.com	Khoi	Dinh	student@gmail.com	f	t	2025-12-03 18:10:58.806351+00	t
2	pbkdf2_sha256$1000000$74b4tYqYEZlewPXI8L4UoT$P30aeVQNM0epfKav8PNpDz4NaWWOQdR7WFRGulWrGrM=	\N	f	teacher@gmail.com	K	D	teacher@gmail.com	f	t	2025-12-03 18:13:49.843393+00	f
\.


--
-- Data for Name: core_user_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_user_groups (id, user_id, group_id) FROM stdin;
\.


--
-- Data for Name: core_user_user_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_user_user_permissions (id, user_id, permission_id) FROM stdin;
\.


--
-- Data for Name: core_usercoursegrade; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_usercoursegrade (id, score, total, course_id, user_id) FROM stdin;
\.


--
-- Data for Name: core_usermodulegrade; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_usermodulegrade (id, score, total, module_id, user_id) FROM stdin;
\.


--
-- Data for Name: core_userquestiongrade; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.core_userquestiongrade (id, score, total, is_overdue, question_id, user_id) FROM stdin;
\.


--
-- Data for Name: django_admin_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.django_admin_log (id, action_time, object_id, object_repr, action_flag, change_message, content_type_id, user_id) FROM stdin;
\.


--
-- Data for Name: django_content_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.django_content_type (id, app_label, model) FROM stdin;
1	admin	logentry
2	auth	permission
3	auth	group
4	contenttypes	contenttype
5	sessions	session
6	core	user
7	core	course
8	core	coursetostudents
9	core	coursetoteachers
10	core	module
11	core	coursetomodules
12	core	question
13	core	moduletoquestions
14	core	questiontocorrectanswers
15	core	submission
16	core	usercoursegrade
17	core	usermodulegrade
18	core	userquestiongrade
\.


--
-- Data for Name: django_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.django_migrations (id, app, name, applied) FROM stdin;
1	contenttypes	0001_initial	2025-12-03 18:07:30.405483+00
2	contenttypes	0002_remove_content_type_name	2025-12-03 18:07:30.460143+00
3	auth	0001_initial	2025-12-03 18:07:30.865948+00
4	auth	0002_alter_permission_name_max_length	2025-12-03 18:07:30.898521+00
5	auth	0003_alter_user_email_max_length	2025-12-03 18:07:30.919899+00
6	auth	0004_alter_user_username_opts	2025-12-03 18:07:30.950176+00
7	auth	0005_alter_user_last_login_null	2025-12-03 18:07:30.99505+00
8	auth	0006_require_contenttypes_0002	2025-12-03 18:07:31.034033+00
9	auth	0007_alter_validators_add_error_messages	2025-12-03 18:07:31.063012+00
10	auth	0008_alter_user_username_max_length	2025-12-03 18:07:31.093837+00
11	auth	0009_alter_user_last_name_max_length	2025-12-03 18:07:31.125636+00
12	auth	0010_alter_group_name_max_length	2025-12-03 18:07:31.181331+00
13	auth	0011_update_proxy_permissions	2025-12-03 18:07:31.207678+00
14	auth	0012_alter_user_first_name_max_length	2025-12-03 18:07:31.247477+00
15	core	0001_initial	2025-12-03 18:07:31.674226+00
16	admin	0001_initial	2025-12-03 18:07:31.853384+00
17	admin	0002_logentry_remove_auto_add	2025-12-03 18:07:31.873178+00
18	admin	0003_logentry_add_action_flag_choices	2025-12-03 18:07:31.914352+00
19	core	0002_course_user_isstudent_coursetostudents_and_more	2025-12-03 18:07:33.184644+00
20	core	0003_alter_course_options_alter_coursetomodules_options_and_more	2025-12-03 18:07:33.283059+00
21	sessions	0001_initial	2025-12-03 18:07:33.364931+00
\.


--
-- Data for Name: django_session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.django_session (session_key, session_data, expire_date) FROM stdin;
\.


--
-- Name: auth_group_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_group_id_seq', 1, false);


--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_group_permissions_id_seq', 1, false);


--
-- Name: auth_permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_permission_id_seq', 99, true);


--
-- Name: core_course_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_course_id_seq', 1, false);


--
-- Name: core_coursetomodules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_coursetomodules_id_seq', 1, false);


--
-- Name: core_coursetostudents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_coursetostudents_id_seq', 1, false);


--
-- Name: core_coursetoteachers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_coursetoteachers_id_seq', 1, false);


--
-- Name: core_module_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_module_id_seq', 1, false);


--
-- Name: core_moduletoquestions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_moduletoquestions_id_seq', 1, false);


--
-- Name: core_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_question_id_seq', 1, false);


--
-- Name: core_questiontocorrectanswers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_questiontocorrectanswers_id_seq', 1, false);


--
-- Name: core_submission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_submission_id_seq', 1, false);


--
-- Name: core_user_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_user_groups_id_seq', 1, false);


--
-- Name: core_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_user_id_seq', 33, true);


--
-- Name: core_user_user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_user_user_permissions_id_seq', 1, false);


--
-- Name: core_usercoursegrade_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_usercoursegrade_id_seq', 1, false);


--
-- Name: core_usermodulegrade_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_usermodulegrade_id_seq', 1, false);


--
-- Name: core_userquestiongrade_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.core_userquestiongrade_id_seq', 1, false);


--
-- Name: django_admin_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.django_admin_log_id_seq', 1, false);


--
-- Name: django_content_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.django_content_type_id_seq', 33, true);


--
-- Name: django_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.django_migrations_id_seq', 33, true);


--
-- Name: auth_group auth_group_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_name_key UNIQUE (name);


--
-- Name: auth_group_permissions auth_group_permissions_group_id_permission_id_0cd325b0_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id);


--
-- Name: auth_group_permissions auth_group_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_pkey PRIMARY KEY (id);


--
-- Name: auth_group auth_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_pkey PRIMARY KEY (id);


--
-- Name: auth_permission auth_permission_content_type_id_codename_01ab375a_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename);


--
-- Name: auth_permission auth_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_pkey PRIMARY KEY (id);


--
-- Name: core_course core_course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_course
    ADD CONSTRAINT core_course_pkey PRIMARY KEY (id);


--
-- Name: core_coursetomodules core_coursetomodules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetomodules
    ADD CONSTRAINT core_coursetomodules_pkey PRIMARY KEY (id);


--
-- Name: core_coursetostudents core_coursetostudents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetostudents
    ADD CONSTRAINT core_coursetostudents_pkey PRIMARY KEY (id);


--
-- Name: core_coursetoteachers core_coursetoteachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetoteachers
    ADD CONSTRAINT core_coursetoteachers_pkey PRIMARY KEY (id);


--
-- Name: core_module core_module_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_module
    ADD CONSTRAINT core_module_pkey PRIMARY KEY (id);


--
-- Name: core_moduletoquestions core_moduletoquestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_moduletoquestions
    ADD CONSTRAINT core_moduletoquestions_pkey PRIMARY KEY (id);


--
-- Name: core_question core_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_question
    ADD CONSTRAINT core_question_pkey PRIMARY KEY (id);


--
-- Name: core_questiontocorrectanswers core_questiontocorrectanswers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_questiontocorrectanswers
    ADD CONSTRAINT core_questiontocorrectanswers_pkey PRIMARY KEY (id);


--
-- Name: core_submission core_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_submission
    ADD CONSTRAINT core_submission_pkey PRIMARY KEY (id);


--
-- Name: core_user_groups core_user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_groups
    ADD CONSTRAINT core_user_groups_pkey PRIMARY KEY (id);


--
-- Name: core_user_groups core_user_groups_user_id_group_id_c82fcad1_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_groups
    ADD CONSTRAINT core_user_groups_user_id_group_id_c82fcad1_uniq UNIQUE (user_id, group_id);


--
-- Name: core_user core_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user
    ADD CONSTRAINT core_user_pkey PRIMARY KEY (id);


--
-- Name: core_user_user_permissions core_user_user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_user_permissions
    ADD CONSTRAINT core_user_user_permissions_pkey PRIMARY KEY (id);


--
-- Name: core_user_user_permissions core_user_user_permissions_user_id_permission_id_73ea0daa_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_user_permissions
    ADD CONSTRAINT core_user_user_permissions_user_id_permission_id_73ea0daa_uniq UNIQUE (user_id, permission_id);


--
-- Name: core_user core_user_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user
    ADD CONSTRAINT core_user_username_key UNIQUE (username);


--
-- Name: core_usercoursegrade core_usercoursegrade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_usercoursegrade
    ADD CONSTRAINT core_usercoursegrade_pkey PRIMARY KEY (id);


--
-- Name: core_usermodulegrade core_usermodulegrade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_usermodulegrade
    ADD CONSTRAINT core_usermodulegrade_pkey PRIMARY KEY (id);


--
-- Name: core_userquestiongrade core_userquestiongrade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_userquestiongrade
    ADD CONSTRAINT core_userquestiongrade_pkey PRIMARY KEY (id);


--
-- Name: django_admin_log django_admin_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_pkey PRIMARY KEY (id);


--
-- Name: django_content_type django_content_type_app_label_model_76bd3d3b_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model);


--
-- Name: django_content_type django_content_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_pkey PRIMARY KEY (id);


--
-- Name: django_migrations django_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_migrations
    ADD CONSTRAINT django_migrations_pkey PRIMARY KEY (id);


--
-- Name: django_session django_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_session
    ADD CONSTRAINT django_session_pkey PRIMARY KEY (session_key);


--
-- Name: auth_group_name_a6ea08ec_like; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_group_name_a6ea08ec_like ON public.auth_group USING btree (name varchar_pattern_ops);


--
-- Name: auth_group_permissions_group_id_b120cbf9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_group_permissions_group_id_b120cbf9 ON public.auth_group_permissions USING btree (group_id);


--
-- Name: auth_group_permissions_permission_id_84c5c92e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_group_permissions_permission_id_84c5c92e ON public.auth_group_permissions USING btree (permission_id);


--
-- Name: auth_permission_content_type_id_2f476e4b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_permission_content_type_id_2f476e4b ON public.auth_permission USING btree (content_type_id);


--
-- Name: core_coursetomodules_course_id_0360b9e5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_coursetomodules_course_id_0360b9e5 ON public.core_coursetomodules USING btree (course_id);


--
-- Name: core_coursetomodules_module_id_563a5cd8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_coursetomodules_module_id_563a5cd8 ON public.core_coursetomodules USING btree (module_id);


--
-- Name: core_coursetostudents_course_id_f12ab853; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_coursetostudents_course_id_f12ab853 ON public.core_coursetostudents USING btree (course_id);


--
-- Name: core_coursetostudents_user_id_d5e1f6fe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_coursetostudents_user_id_d5e1f6fe ON public.core_coursetostudents USING btree (user_id);


--
-- Name: core_coursetoteachers_course_id_d6abde6f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_coursetoteachers_course_id_d6abde6f ON public.core_coursetoteachers USING btree (course_id);


--
-- Name: core_coursetoteachers_user_id_509d636b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_coursetoteachers_user_id_509d636b ON public.core_coursetoteachers USING btree (user_id);


--
-- Name: core_module_course_id_2aa5c263; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_module_course_id_2aa5c263 ON public.core_module USING btree (course_id);


--
-- Name: core_moduletoquestions_module_id_56250a65; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_moduletoquestions_module_id_56250a65 ON public.core_moduletoquestions USING btree (module_id);


--
-- Name: core_moduletoquestions_question_id_0909624f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_moduletoquestions_question_id_0909624f ON public.core_moduletoquestions USING btree (question_id);


--
-- Name: core_question_module_id_b83d8387; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_question_module_id_b83d8387 ON public.core_question USING btree (module_id);


--
-- Name: core_questiontocorrectanswers_question_id_fecc76b3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_questiontocorrectanswers_question_id_fecc76b3 ON public.core_questiontocorrectanswers USING btree (question_id);


--
-- Name: core_submission_module_id_bf18d995; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_submission_module_id_bf18d995 ON public.core_submission USING btree (module_id);


--
-- Name: core_submission_question_id_015f02f3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_submission_question_id_015f02f3 ON public.core_submission USING btree (question_id);


--
-- Name: core_submission_user_id_b062d25d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_submission_user_id_b062d25d ON public.core_submission USING btree (user_id);


--
-- Name: core_user_groups_group_id_fe8c697f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_user_groups_group_id_fe8c697f ON public.core_user_groups USING btree (group_id);


--
-- Name: core_user_groups_user_id_70b4d9b8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_user_groups_user_id_70b4d9b8 ON public.core_user_groups USING btree (user_id);


--
-- Name: core_user_user_permissions_permission_id_35ccf601; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_user_user_permissions_permission_id_35ccf601 ON public.core_user_user_permissions USING btree (permission_id);


--
-- Name: core_user_user_permissions_user_id_085123d3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_user_user_permissions_user_id_085123d3 ON public.core_user_user_permissions USING btree (user_id);


--
-- Name: core_user_username_36e4f7f7_like; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_user_username_36e4f7f7_like ON public.core_user USING btree (username varchar_pattern_ops);


--
-- Name: core_usercoursegrade_course_id_ce876cc8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_usercoursegrade_course_id_ce876cc8 ON public.core_usercoursegrade USING btree (course_id);


--
-- Name: core_usercoursegrade_user_id_dbaa2777; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_usercoursegrade_user_id_dbaa2777 ON public.core_usercoursegrade USING btree (user_id);


--
-- Name: core_usermodulegrade_module_id_32b91e2f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_usermodulegrade_module_id_32b91e2f ON public.core_usermodulegrade USING btree (module_id);


--
-- Name: core_usermodulegrade_user_id_7affd70e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_usermodulegrade_user_id_7affd70e ON public.core_usermodulegrade USING btree (user_id);


--
-- Name: core_userquestiongrade_question_id_4377fff8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_userquestiongrade_question_id_4377fff8 ON public.core_userquestiongrade USING btree (question_id);


--
-- Name: core_userquestiongrade_user_id_eb8e5685; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX core_userquestiongrade_user_id_eb8e5685 ON public.core_userquestiongrade USING btree (user_id);


--
-- Name: django_admin_log_content_type_id_c4bce8eb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX django_admin_log_content_type_id_c4bce8eb ON public.django_admin_log USING btree (content_type_id);


--
-- Name: django_admin_log_user_id_c564eba6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX django_admin_log_user_id_c564eba6 ON public.django_admin_log USING btree (user_id);


--
-- Name: django_session_expire_date_a5c62663; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX django_session_expire_date_a5c62663 ON public.django_session USING btree (expire_date);


--
-- Name: django_session_session_key_c0390e0f_like; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX django_session_session_key_c0390e0f_like ON public.django_session USING btree (session_key varchar_pattern_ops);


--
-- Name: auth_group_permissions auth_group_permissio_permission_id_84c5c92e_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_group_permissions auth_group_permissions_group_id_b120cbf9_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_permission auth_permission_content_type_id_2f476e4b_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_coursetomodules core_coursetomodules_course_id_0360b9e5_fk_core_course_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetomodules
    ADD CONSTRAINT core_coursetomodules_course_id_0360b9e5_fk_core_course_id FOREIGN KEY (course_id) REFERENCES public.core_course(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_coursetomodules core_coursetomodules_module_id_563a5cd8_fk_core_module_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetomodules
    ADD CONSTRAINT core_coursetomodules_module_id_563a5cd8_fk_core_module_id FOREIGN KEY (module_id) REFERENCES public.core_module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_coursetostudents core_coursetostudents_course_id_f12ab853_fk_core_course_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetostudents
    ADD CONSTRAINT core_coursetostudents_course_id_f12ab853_fk_core_course_id FOREIGN KEY (course_id) REFERENCES public.core_course(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_coursetostudents core_coursetostudents_user_id_d5e1f6fe_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetostudents
    ADD CONSTRAINT core_coursetostudents_user_id_d5e1f6fe_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_coursetoteachers core_coursetoteachers_course_id_d6abde6f_fk_core_course_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetoteachers
    ADD CONSTRAINT core_coursetoteachers_course_id_d6abde6f_fk_core_course_id FOREIGN KEY (course_id) REFERENCES public.core_course(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_coursetoteachers core_coursetoteachers_user_id_509d636b_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_coursetoteachers
    ADD CONSTRAINT core_coursetoteachers_user_id_509d636b_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_module core_module_course_id_2aa5c263_fk_core_course_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_module
    ADD CONSTRAINT core_module_course_id_2aa5c263_fk_core_course_id FOREIGN KEY (course_id) REFERENCES public.core_course(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_moduletoquestions core_moduletoquestions_module_id_56250a65_fk_core_module_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_moduletoquestions
    ADD CONSTRAINT core_moduletoquestions_module_id_56250a65_fk_core_module_id FOREIGN KEY (module_id) REFERENCES public.core_module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_moduletoquestions core_moduletoquestions_question_id_0909624f_fk_core_question_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_moduletoquestions
    ADD CONSTRAINT core_moduletoquestions_question_id_0909624f_fk_core_question_id FOREIGN KEY (question_id) REFERENCES public.core_question(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_question core_question_module_id_b83d8387_fk_core_module_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_question
    ADD CONSTRAINT core_question_module_id_b83d8387_fk_core_module_id FOREIGN KEY (module_id) REFERENCES public.core_module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_questiontocorrectanswers core_questiontocorre_question_id_fecc76b3_fk_core_ques; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_questiontocorrectanswers
    ADD CONSTRAINT core_questiontocorre_question_id_fecc76b3_fk_core_ques FOREIGN KEY (question_id) REFERENCES public.core_question(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_submission core_submission_module_id_bf18d995_fk_core_module_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_submission
    ADD CONSTRAINT core_submission_module_id_bf18d995_fk_core_module_id FOREIGN KEY (module_id) REFERENCES public.core_module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_submission core_submission_question_id_015f02f3_fk_core_question_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_submission
    ADD CONSTRAINT core_submission_question_id_015f02f3_fk_core_question_id FOREIGN KEY (question_id) REFERENCES public.core_question(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_submission core_submission_user_id_b062d25d_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_submission
    ADD CONSTRAINT core_submission_user_id_b062d25d_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_user_groups core_user_groups_group_id_fe8c697f_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_groups
    ADD CONSTRAINT core_user_groups_group_id_fe8c697f_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_user_groups core_user_groups_user_id_70b4d9b8_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_groups
    ADD CONSTRAINT core_user_groups_user_id_70b4d9b8_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_user_user_permissions core_user_user_permi_permission_id_35ccf601_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_user_permissions
    ADD CONSTRAINT core_user_user_permi_permission_id_35ccf601_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_user_user_permissions core_user_user_permissions_user_id_085123d3_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_user_user_permissions
    ADD CONSTRAINT core_user_user_permissions_user_id_085123d3_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_usercoursegrade core_usercoursegrade_course_id_ce876cc8_fk_core_course_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_usercoursegrade
    ADD CONSTRAINT core_usercoursegrade_course_id_ce876cc8_fk_core_course_id FOREIGN KEY (course_id) REFERENCES public.core_course(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_usercoursegrade core_usercoursegrade_user_id_dbaa2777_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_usercoursegrade
    ADD CONSTRAINT core_usercoursegrade_user_id_dbaa2777_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_usermodulegrade core_usermodulegrade_module_id_32b91e2f_fk_core_module_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_usermodulegrade
    ADD CONSTRAINT core_usermodulegrade_module_id_32b91e2f_fk_core_module_id FOREIGN KEY (module_id) REFERENCES public.core_module(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_usermodulegrade core_usermodulegrade_user_id_7affd70e_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_usermodulegrade
    ADD CONSTRAINT core_usermodulegrade_user_id_7affd70e_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_userquestiongrade core_userquestiongrade_question_id_4377fff8_fk_core_question_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_userquestiongrade
    ADD CONSTRAINT core_userquestiongrade_question_id_4377fff8_fk_core_question_id FOREIGN KEY (question_id) REFERENCES public.core_question(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: core_userquestiongrade core_userquestiongrade_user_id_eb8e5685_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.core_userquestiongrade
    ADD CONSTRAINT core_userquestiongrade_user_id_eb8e5685_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: django_admin_log django_admin_log_content_type_id_c4bce8eb_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: django_admin_log django_admin_log_user_id_c564eba6_fk_core_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_user_id_c564eba6_fk_core_user_id FOREIGN KEY (user_id) REFERENCES public.core_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: extension_before_drop; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER extension_before_drop ON ddl_command_start
   EXECUTE FUNCTION _heroku.extension_before_drop();


--
-- Name: log_create_ext; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER log_create_ext ON ddl_command_end
   EXECUTE FUNCTION _heroku.create_ext();


--
-- Name: log_drop_ext; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER log_drop_ext ON sql_drop
   EXECUTE FUNCTION _heroku.drop_ext();


--
-- Name: validate_extension; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER validate_extension ON ddl_command_end
   EXECUTE FUNCTION _heroku.validate_extension();


--
-- PostgreSQL database dump complete
--

\unrestrict SOdJDTanGHHPGe32RuDTdBhDGa8n0hqhtGscOnd9SHiEVNysxCVPRyQzOyBbUwY

