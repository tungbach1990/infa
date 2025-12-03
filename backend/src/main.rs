use axum::extract::Path;
use axum::http::StatusCode;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::fs;
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

const DASHBOARDS_DIR: &str = "./data/dashboards";

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Dashboard {
    id: String,
    name: String,
    data: serde_json::Value,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateDashboardRequest {
    name: String,
    data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct UpdateDashboardRequest {
    name: Option<String>,
    data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct DashboardListItem {
    id: String,
    name: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

async fn ensure_dashboards_dir() -> std::io::Result<()> {
    fs::create_dir_all(DASHBOARDS_DIR).await
}

fn get_dashboard_path(id: &str) -> PathBuf {
    PathBuf::from(DASHBOARDS_DIR).join(format!("{}.json", id))
}

fn get_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let secs = duration.as_secs();
    let millis = duration.subsec_millis();
    
    // Simple ISO 8601 format
    let total_days = secs / 86400;
    let remaining = secs % 86400;
    let hours = remaining / 3600;
    let minutes = (remaining % 3600) / 60;
    let seconds = remaining % 60;
    
    // Approximate year/month/day calculation
    let mut year = 1970u64;
    let mut days_left = total_days;
    
    loop {
        let days_in_year = if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) { 366 } else { 365 };
        if days_left < days_in_year {
            break;
        }
        days_left -= days_in_year;
        year += 1;
    }
    
    let is_leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_months: [u64; 12] = [31, if is_leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    let mut month = 1u64;
    for days in days_in_months.iter() {
        if days_left < *days {
            break;
        }
        days_left -= days;
        month += 1;
    }
    let day = days_left + 1;
    
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z", 
            year, month, day, hours, minutes, seconds, millis)
}

async fn list_dashboards() -> Result<Json<Vec<DashboardListItem>>, (StatusCode, String)> {
    ensure_dashboards_dir().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directory: {}", e))
    })?;

    let mut entries = fs::read_dir(DASHBOARDS_DIR).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read directory: {}", e))
    })?;

    let mut dashboards = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read entry: {}", e))
    })? {
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(content) = fs::read_to_string(&path).await {
                if let Ok(dashboard) = serde_json::from_str::<Dashboard>(&content) {
                    dashboards.push(DashboardListItem {
                        id: dashboard.id,
                        name: dashboard.name,
                        created_at: dashboard.created_at,
                        updated_at: dashboard.updated_at,
                    });
                }
            }
        }
    }

    dashboards.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(Json(dashboards))
}

async fn get_dashboard(Path(id): Path<String>) -> Result<Json<Dashboard>, (StatusCode, String)> {
    let path = get_dashboard_path(&id);
    let content = fs::read_to_string(&path).await.map_err(|_| {
        (StatusCode::NOT_FOUND, format!("Dashboard {} not found", id))
    })?;

    let dashboard: Dashboard = serde_json::from_str(&content).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse dashboard: {}", e))
    })?;

    Ok(Json(dashboard))
}

async fn create_dashboard(
    Json(req): Json<CreateDashboardRequest>,
) -> Result<Json<Dashboard>, (StatusCode, String)> {
    ensure_dashboards_dir().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directory: {}", e))
    })?;

    let id = format!("dash-{}", Uuid::new_v4());
    let now = get_now_iso();
    
    let dashboard = Dashboard {
        id: id.clone(),
        name: req.name,
        data: req.data.unwrap_or(serde_json::json!({
            "nodes": [],
            "edges": [],
            "nodeTypes": [],
            "groups": [],
            "vms": [],
            "domains": []
        })),
        created_at: now.clone(),
        updated_at: Some(now),
    };

    let path = get_dashboard_path(&id);
    let content = serde_json::to_string_pretty(&dashboard).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to serialize: {}", e))
    })?;

    fs::write(&path, content).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write file: {}", e))
    })?;

    Ok(Json(dashboard))
}

async fn update_dashboard(
    Path(id): Path<String>,
    Json(req): Json<UpdateDashboardRequest>,
) -> Result<Json<Dashboard>, (StatusCode, String)> {
    let path = get_dashboard_path(&id);
    let content = fs::read_to_string(&path).await.map_err(|_| {
        (StatusCode::NOT_FOUND, format!("Dashboard {} not found", id))
    })?;

    let mut dashboard: Dashboard = serde_json::from_str(&content).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse: {}", e))
    })?;

    if let Some(name) = req.name {
        dashboard.name = name;
    }
    if let Some(data) = req.data {
        dashboard.data = data;
    }
    dashboard.updated_at = Some(get_now_iso());

    let new_content = serde_json::to_string_pretty(&dashboard).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to serialize: {}", e))
    })?;

    fs::write(&path, new_content).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write: {}", e))
    })?;

    Ok(Json(dashboard))
}

async fn delete_dashboard(Path(id): Path<String>) -> Result<StatusCode, (StatusCode, String)> {
    let path = get_dashboard_path(&id);
    fs::remove_file(&path).await.map_err(|_| {
        (StatusCode::NOT_FOUND, format!("Dashboard {} not found", id))
    })?;
    Ok(StatusCode::NO_CONTENT)
}

async fn import_dashboard(
    Json(dashboard): Json<Dashboard>,
) -> Result<Json<Dashboard>, (StatusCode, String)> {
    ensure_dashboards_dir().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directory: {}", e))
    })?;

    let id = format!("dash-{}", Uuid::new_v4());
    let now = get_now_iso();
    
    let mut data = dashboard.data;
    if !data.is_object() && dashboard.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, String::from("Invalid dashboard payload")));
    }
    if !data.is_object() {
        data = serde_json::json!({
            "nodes": [],
            "edges": [],
            "nodeTypes": [],
            "groups": [],
            "vms": [],
            "domains": []
        });
    } else if let Some(obj) = data.as_object_mut() {
        obj.entry("nodes").or_insert(serde_json::json!([]));
        obj.entry("edges").or_insert(serde_json::json!([]));
        obj.entry("nodeTypes").or_insert(serde_json::json!([]));
        obj.entry("groups").or_insert(serde_json::json!([]));
        obj.entry("vms").or_insert(serde_json::json!([]));
        obj.entry("domains").or_insert(serde_json::json!([]));
    }

    let name = if dashboard.name.trim().is_empty() { String::from("Imported Dashboard") } else { dashboard.name };

    let new_dashboard = Dashboard {
        id: id.clone(),
        name: format!("{} (imported)", name),
        data: data,
        created_at: now.clone(),
        updated_at: Some(now),
    };

    let path = get_dashboard_path(&id);
    let content = serde_json::to_string_pretty(&new_dashboard).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to serialize: {}", e))
    })?;

    fs::write(&path, content).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write: {}", e))
    })?;

    Ok(Json(new_dashboard))
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let app = Router::new()
        .route("/health", get(health))
        // Dashboard API
        .route("/api/dashboards", get(list_dashboards))
        .route("/api/dashboards", post(create_dashboard))
        .route("/api/dashboards/import", post(import_dashboard))
        .route("/api/dashboards/:id", get(get_dashboard))
        .route("/api/dashboards/:id", put(update_dashboard))
        .route("/api/dashboards/:id", delete(delete_dashboard))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    tracing::info!("Server running on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::Json;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn import_valid_dashboard() {
        let d = Dashboard {
            id: String::from("d1"),
            name: String::from("Test"),
            data: serde_json::json!({"nodes": [], "edges": [], "nodeTypes": [], "groups": [], "vms": [], "domains": []}),
            created_at: get_now_iso(),
            updated_at: None,
        };
        let res = import_dashboard(Json(d)).await;
        assert!(res.is_ok());
    }

    #[tokio::test]
    async fn import_invalid_payload() {
        let d = Dashboard {
            id: String::from("d2"),
            name: String::from(""),
            data: serde_json::json!("x"),
            created_at: get_now_iso(),
            updated_at: None,
        };
        let res = import_dashboard(Json(d)).await;
        assert!(res.is_err());
        let err = res.err().unwrap();
        assert_eq!(err.0, StatusCode::BAD_REQUEST);
    }
}
