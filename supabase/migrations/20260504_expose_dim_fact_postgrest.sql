alter role authenticator set pgrst.db_schemas = 'public, graphql_public, sourcecrm, dim, fact';

notify pgrst, 'reload config';
