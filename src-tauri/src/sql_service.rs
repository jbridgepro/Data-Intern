// File: src-tauri/src/sql_service.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tiberius::{AuthMethod, Client, Config, QueryItem};
use futures::StreamExt;
use sqlx::{mysql::MySqlPoolOptions, postgres::PgPoolOptions, sqlite::SqlitePoolOptions, Row};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MssqlConnectionParams {
    pub server: String,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub authentication: String,
    pub trust_server_certificate: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaConnectionParams {
    pub server_type: String,
    pub server: String,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub authentication: Option<String>,
    pub trust_server_certificate: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MssqlTestResponse {
    pub success: bool,
    pub message: String,
    pub server_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaColumn {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaTable {
    pub name: String,
    pub schema: String,
    pub columns: Vec<SchemaColumn>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaResponse {
    pub tables: Vec<SchemaTable>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NlToSqlRequest {
    pub text: String,
    pub dialect: String,
    pub tables_in_scope: Vec<String>,
    pub available_tables: Vec<String>,
    pub available_columns: Vec<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinBlock {
    pub id: String,
    pub r#type: String,
    pub table: String,
    pub on: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhereBlock {
    pub id: String,
    pub field: String,
    pub operator: String,
    pub value: String,
    pub logic: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderBlock {
    pub id: String,
    pub field: String,
    pub direction: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMapItem {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryBlocks {
    pub distinct: bool,
    pub select: Vec<String>,
    pub from: String,
    pub joins: Vec<JoinBlock>,
    pub r#where: Vec<WhereBlock>,
    pub group_by: Vec<String>,
    pub having: String,
    pub order_by: Vec<OrderBlock>,
    pub limit: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NlToSqlResponse {
    pub confidence: f32,
    pub trace: Vec<String>,
    pub warnings: Vec<String>,
    pub source_map: Vec<SourceMapItem>,
    pub blocks: QueryBlocks,
}

async fn connect_mssql(
    params: &MssqlConnectionParams
) -> Result<Client<tokio_util::compat::Compat<TcpStream>>, String> {
    let mut config = Config::new();

    config.host(&params.server);
    config.port(params.port.unwrap_or(1433));

    if let Some(db) = &params.database {
        config.database(db);
    }

    if params.authentication == "sql-server" {
        match (&params.username, &params.password) {
            (Some(u), Some(p)) => {
                config.authentication(AuthMethod::sql_server(u, p));
            },
            _ => return Err("Username and password required for SQL Server authentication".to_string())
        }
    } else if params.authentication == "windows" {
        #[cfg(windows)]
        {
            config.authentication(AuthMethod::Integrated);
        }
        #[cfg(not(windows))]
        {
             return Err("Windows authentication is only supported on Windows host currently".to_string())
        }
    }

    if params.trust_server_certificate.unwrap_or(false) {
        config.trust_cert();
    }

    let tcp = TcpStream::connect(format!("{}:{}", params.server, params.port.unwrap_or(1433))).await
        .map_err(|e| format!("Failed to connect to TCP: {}", e))?;

    tcp.set_nodelay(true).map_err(|e| format!("Failed to set nodelay: {}", e))?;

    let client = Client::connect(config, tcp.compat_write()).await
        .map_err(|e| format!("Login failed: {}", e))?;

    Ok(client)
}

#[tauri::command]
pub async fn test_mssql_connection(
    params: MssqlConnectionParams
) -> Result<MssqlTestResponse, String> {
    let mut client = connect_mssql(&params).await
        .map_err(|e| e.to_string())?;

    // If we got here, connection is successful.
    // Let's try a simple query to get version.
    let stream = client.simple_query("SELECT @@VERSION").await
        .map_err(|e| format!("Query failed: {}", e))?;

    let row = stream.into_row().await
        .map_err(|e| format!("Failed to get row: {}", e))?
        .ok_or("No version returned")?;

    let version: &str = row.get(0).ok_or("Failed to get column")?;

    Ok(MssqlTestResponse {
        success: true,
        message: "Connection successful!".to_string(),
        server_version: Some(version.to_string()),
    })
}

#[tauri::command]
pub async fn get_mssql_schema(
    params: MssqlConnectionParams
) -> Result<SchemaResponse, String> {
    let mut client = connect_mssql(&params).await?;

    let query = r#"
        SELECT
            c.TABLE_SCHEMA,
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t
          ON c.TABLE_SCHEMA = t.TABLE_SCHEMA
         AND c.TABLE_NAME = t.TABLE_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    "#;

    let mut stream = client.simple_query(query).await
        .map_err(|e| format!("Schema query failed: {}", e))?;

    let mut tables_map: HashMap<(String, String), SchemaTable> = HashMap::new();

    while let Some(item) = stream.next().await {
        let item = item.map_err(|e| format!("Schema query failed: {}", e))?;
        if let QueryItem::Row(row) = item {
            let schema: &str = row.get(0).unwrap_or("");
            let table: &str = row.get(1).unwrap_or("");
            let column: &str = row.get(2).unwrap_or("");
            let data_type: &str = row.get(3).unwrap_or("");
            let nullable: &str = row.get(4).unwrap_or("YES");

            let key = (schema.to_string(), table.to_string());
            let entry = tables_map.entry(key).or_insert_with(|| SchemaTable {
                name: table.to_string(),
                schema: schema.to_string(),
                columns: Vec::new(),
            });

            entry.columns.push(SchemaColumn {
                name: column.to_string(),
                data_type: data_type.to_string(),
                is_nullable: nullable.eq_ignore_ascii_case("YES"),
            });
        }
    }

    let mut tables: Vec<SchemaTable> = tables_map.into_values().collect();
    tables.sort_by(|a, b| {
        a.schema
            .cmp(&b.schema)
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(SchemaResponse { tables })
}

#[tauri::command]
pub async fn get_database_schema(
    params: SchemaConnectionParams
) -> Result<SchemaResponse, String> {
    match params.server_type.as_str() {
        "mssql" | "azure-sql" => {
            let mssql_params = MssqlConnectionParams {
                server: params.server,
                port: params.port,
                database: params.database,
                username: params.username,
                password: params.password,
                authentication: params.authentication.unwrap_or_else(|| "sql-server".to_string()),
                trust_server_certificate: params.trust_server_certificate,
            };
            get_mssql_schema(mssql_params).await
        }
        "mysql" => get_mysql_schema(params).await,
        "postgresql" => get_postgres_schema(params).await,
        "sqlite" => get_sqlite_schema(params).await,
        _ => Err("Unsupported database type for schema discovery.".to_string()),
    }
}

async fn get_mysql_schema(params: SchemaConnectionParams) -> Result<SchemaResponse, String> {
    let database = params.database.unwrap_or_else(|| "information_schema".to_string());
    let user = params.username.unwrap_or_default();
    let password = params.password.unwrap_or_default();
    let host = params.server;
    let port = params.port.unwrap_or(3306);

    let url = format!("mysql://{}:{}@{}:{}/{}", user, password, host, port, database);
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| format!("MySQL connection failed: {}", e))?;

    let rows = sqlx::query(
        r#"
        SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        "#,
    )
    .bind(&database)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("MySQL schema query failed: {}", e))?;
    let mut tables_map: HashMap<(String, String), SchemaTable> = HashMap::new();

    for row in rows {
        let schema: String = row.try_get(0).unwrap_or_default();
        let table: String = row.try_get(1).unwrap_or_default();
        let column: String = row.try_get(2).unwrap_or_default();
        let data_type: String = row.try_get(3).unwrap_or_default();
        let nullable: String = row.try_get(4).unwrap_or_else(|_| "YES".to_string());

        let key = (schema.clone(), table.clone());
        let entry = tables_map.entry(key).or_insert_with(|| SchemaTable {
            name: table.clone(),
            schema: schema.clone(),
            columns: Vec::new(),
        });

        entry.columns.push(SchemaColumn {
            name: column,
            data_type,
            is_nullable: nullable.eq_ignore_ascii_case("YES") || nullable == "1",
        });
    }

    let mut tables: Vec<SchemaTable> = tables_map.into_values().collect();
    tables.sort_by(|a, b| {
        a.schema
            .cmp(&b.schema)
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(SchemaResponse { tables })
}

async fn get_postgres_schema(params: SchemaConnectionParams) -> Result<SchemaResponse, String> {
    let database = params.database.unwrap_or_else(|| "postgres".to_string());
    let user = params.username.unwrap_or_default();
    let password = params.password.unwrap_or_default();
    let host = params.server;
    let port = params.port.unwrap_or(5432);

    let url = format!("postgres://{}:{}@{}:{}/{}", user, password, host, port, database);
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| format!("PostgreSQL connection failed: {}", e))?;

    let rows = sqlx::query(
        r#"
        SELECT table_schema, table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name, ordinal_position
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("PostgreSQL schema query failed: {}", e))?;
    let mut tables_map: HashMap<(String, String), SchemaTable> = HashMap::new();

    for row in rows {
        let schema: String = row.try_get(0).unwrap_or_default();
        let table: String = row.try_get(1).unwrap_or_default();
        let column: String = row.try_get(2).unwrap_or_default();
        let data_type: String = row.try_get(3).unwrap_or_default();
        let nullable: String = row.try_get(4).unwrap_or_else(|_| "YES".to_string());

        let key = (schema.clone(), table.clone());
        let entry = tables_map.entry(key).or_insert_with(|| SchemaTable {
            name: table.clone(),
            schema: schema.clone(),
            columns: Vec::new(),
        });

        entry.columns.push(SchemaColumn {
            name: column,
            data_type,
            is_nullable: nullable.eq_ignore_ascii_case("YES") || nullable == "1",
        });
    }

    let mut tables: Vec<SchemaTable> = tables_map.into_values().collect();
    tables.sort_by(|a, b| {
        a.schema
            .cmp(&b.schema)
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(SchemaResponse { tables })
}

async fn get_sqlite_schema(params: SchemaConnectionParams) -> Result<SchemaResponse, String> {
    let path = params.server;
    let url = if path.starts_with("file:") || path.starts_with("sqlite:") {
        path
    } else {
        format!("sqlite://{}", path)
    };

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&url)
        .await
        .map_err(|e| format!("SQLite connection failed: {}", e))?;

    let table_rows = sqlx::query(
        r#"
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("SQLite schema query failed: {}", e))?;

    let mut tables: Vec<SchemaTable> = Vec::new();

    for row in table_rows {
        let table_name: String = row.try_get(0).unwrap_or_default();
        let pragma_query = format!("PRAGMA table_info('{}')", table_name);
        let columns = sqlx::query(&pragma_query)
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("SQLite table info failed: {}", e))?;

        let mut column_defs: Vec<SchemaColumn> = Vec::new();
        for col in columns {
            let name: String = col.try_get("name").unwrap_or_default();
            let data_type: String = col.try_get("type").unwrap_or_default();
            let not_null: i64 = col.try_get("notnull").unwrap_or(0);
            column_defs.push(SchemaColumn {
                name,
                data_type,
                is_nullable: not_null == 0,
            });
        }

        tables.push(SchemaTable {
            name: table_name,
            schema: "main".to_string(),
            columns: column_defs,
        });
    }

    Ok(SchemaResponse { tables })
}

 

#[tauri::command]
pub async fn nl_to_sql(
    params: NlToSqlRequest
) -> Result<NlToSqlResponse, String> {
    let text = params.text.to_lowercase();
    let mut trace: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut source_map: Vec<SourceMapItem> = Vec::new();

    let mut confidence: f32 = 0.55;
    let tables_in_scope = if !params.tables_in_scope.is_empty() {
        trace.push("Using tables in scope from user input.".to_string());
        params.tables_in_scope
    } else {
        trace.push("No tables explicitly scoped; falling back to available tables.".to_string());
        params.available_tables.clone()
    };

    let table = tables_in_scope.first().cloned().unwrap_or_else(|| {
        warnings.push("No table found. Please specify a table to query.".to_string());
        "your_table".to_string()
    });

    if let Some(base_url) = params.base_url.clone() {
        let model = params.model.clone().unwrap_or_else(|| "llama3.2:3b".to_string());
        let system_prompt = r#"
You are an expert SQL query planner. Return JSON only, no markdown.
Return fields: confidence (0-1), trace (array of steps), warnings (array),
sourceMap (array of {source,target}), blocks (structured query blocks).
Blocks: distinct, select[], from, joins[{id,type,table,on}], where[{id,field,operator,value,logic}],
groupBy[], having, orderBy[{id,field,direction}], limit.
"#;

        let user_prompt = format!(
            "Dialect: {}\nTables in scope: {:?}\nAvailable tables: {:?}\nAvailable columns: {:?}\nRequest: {}",
            params.dialect, tables_in_scope, params.available_tables, params.available_columns, params.text
        );

        let client = reqwest::Client::new();
        let payload = serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt.trim() },
                { "role": "user", "content": user_prompt }
            ],
            "stream": false,
            "format": "json"
        });

        let resp = client
            .post(format!("{}/api/chat", base_url))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("AI request failed: {}", e))?;

        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("AI response parse failed: {}", e))?;

        if !status.is_success() {
            return Err(format!("AI request failed with status {}", status));
        }

        if let Some(content) = body
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
        {
            let parsed: serde_json::Value = serde_json::from_str(content)
                .map_err(|e| format!("AI JSON parse failed: {}", e))?;
            let response: NlToSqlResponse = serde_json::from_value(parsed)
                .map_err(|e| format!("AI response mapping failed: {}", e))?;
            return Ok(response);
        }
    }

    if table == "your_table" {
        confidence = 0.3;
    }

    let is_count = text.contains("count");
    let is_distinct = text.contains("distinct");

    let mut select: Vec<String> = Vec::new();
    if is_count {
        trace.push("Detected count intent.".to_string());
        source_map.push(SourceMapItem {
            source: "count".to_string(),
            target: "select: COUNT(*)".to_string(),
        });
        select.push("COUNT(*) AS count".to_string());
        confidence += 0.15;
    } else {
        let mut candidate_columns: Vec<String> = params.available_columns.clone();
        candidate_columns.retain(|col| col.to_lowercase().contains(&table.to_lowercase()) || col.contains('.'));
        if candidate_columns.is_empty() {
            candidate_columns = params.available_columns.clone();
        }
        if candidate_columns.is_empty() {
            select.push("*".to_string());
            warnings.push("No columns available; defaulting to *.".to_string());
            confidence -= 0.1;
        } else {
            select.extend(candidate_columns.into_iter().take(5));
            trace.push("Selected top columns from schema.".to_string());
            source_map.push(SourceMapItem {
                source: "schema columns".to_string(),
                target: "select: columns".to_string(),
            });
            confidence += 0.1;
        }
    }

    let mut limit = String::new();
    if let Some(limit_idx) = text.find("limit") {
        let slice = &text[limit_idx..];
        let digits: String = slice.chars().skip_while(|c| !c.is_ascii_digit()).take_while(|c| c.is_ascii_digit()).collect();
        if !digits.is_empty() {
            limit = digits;
            trace.push("Detected limit in request.".to_string());
            source_map.push(SourceMapItem {
                source: "limit".to_string(),
                target: format!("limit: {}", limit),
            });
            confidence += 0.05;
        }
    }

    source_map.push(SourceMapItem {
        source: "tables in scope".to_string(),
        target: format!("from: {}", table),
    });

    let blocks = QueryBlocks {
        distinct: is_distinct,
        select,
        from: table.clone(),
        joins: Vec::new(),
        r#where: Vec::new(),
        group_by: Vec::new(),
        having: String::new(),
        order_by: Vec::new(),
        limit,
    };

    trace.push(format!("Dialect target: {}.", params.dialect));

    Ok(NlToSqlResponse {
        confidence: confidence.clamp(0.0, 0.95),
        trace,
        warnings,
        source_map,
        blocks,
    })
}
