// File: src-tauri/src/sql_service.rs

use serde::{Deserialize, Serialize};
use tiberius::{AuthMethod, Client, Config};
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
pub struct MssqlTestResponse {
    pub success: bool,
    pub message: String,
    pub server_version: Option<String>,
}

#[tauri::command]
pub async fn test_mssql_connection(
    params: MssqlConnectionParams
) -> Result<MssqlTestResponse, String> {
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
            _ => return Ok(MssqlTestResponse {
                success: false,
                message: "Username and password required for SQL Server authentication".to_string(),
                server_version: None
            })
        }
    } else if params.authentication == "windows" {
        // Tiberius supports SSPI on Windows, but cross-platform might vary.
        // For now, we assume this is running where it can use it, or fallback.
        // On non-windows, this might fail or need Kerberos.
        // We'll try integrated.
        #[cfg(windows)]
        {
            config.authentication(AuthMethod::Integrated);
        }
        #[cfg(not(windows))]
        {
             return Ok(MssqlTestResponse {
                success: false,
                message: "Windows authentication is only supported on Windows host currently".to_string(),
                server_version: None
            })
        }
    }

    if params.trust_server_certificate.unwrap_or(false) {
        config.trust_cert();
    } else {
        // Default in many dev envs is to need this, but we respect the flag.
        // If user didn't set, strict by default in Tiberius unless we trust all?
        // Usually safe to trust for dev tools if requested.
    }
    // Tiberius defaults to encrypt=true, trust=false.

    let tcp = TcpStream::connect(format!("{}:{}", params.server, params.port.unwrap_or(1433))).await
        .map_err(|e| format!("Failed to connect to TCP: {}", e))?;
    
    // We need to disable Nagle's algorithm usually for DBs, but Tiberius handles stream
    tcp.set_nodelay(true).map_err(|e| format!("Failed to set nodelay: {}", e))?;

    let mut client = Client::connect(config, tcp.compat_write()).await
        .map_err(|e| format!("Login failed: {}", e))?;

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
