// File: src-tauri/src/voice_service.rs
//
// Tauri commands for voice service integration (Faster-Whisper + Piper).
// Provides backend communication with Python voice service.

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::path::PathBuf;

/// Voice service configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceServiceConfig {
    pub host: String,
    pub port: u16,
    pub model_size: String,
    pub device: String,
    pub compute_type: String,
}

impl Default for VoiceServiceConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8765,
            model_size: "base".to_string(),
            device: "cpu".to_string(),
            compute_type: "int8".to_string(),
        }
    }
}

/// Transcription request
#[derive(Debug, Serialize, Deserialize)]
pub struct TranscribeRequest {
    pub audio: String, // Base64 encoded audio
    pub language: Option<String>,
    pub model_size: Option<String>,
    pub device: Option<String>,
    pub compute_type: Option<String>,
}

/// Transcription response
#[derive(Debug, Serialize, Deserialize)]
pub struct TranscribeResponse {
    pub success: bool,
    pub text: Option<String>,
    pub language: Option<String>,
    pub language_probability: Option<f64>,
    pub segments: Option<Vec<TranscriptionSegment>>,
    pub error: Option<String>,
}

/// Transcription segment
#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub confidence: f64,
}

/// Synthesis request
#[derive(Debug, Serialize, Deserialize)]
pub struct SynthesizeRequest {
    pub text: String,
    pub voice: Option<String>,
    pub speed: Option<f64>,
}

/// Synthesis response
#[derive(Debug, Serialize, Deserialize)]
pub struct SynthesizeResponse {
    pub success: bool,
    pub audio: Option<String>, // Base64 encoded audio
    pub format: Option<String>,
    pub error: Option<String>,
}

/// Health check response
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub whisper_available: bool,
    pub piper_available: bool,
    pub service: String,
    pub error: Option<String>,
}

/// Tauri command: Transcribe audio using Faster-Whisper
#[tauri::command]
pub async fn transcribe_audio(
    audio_base64: String,
    language: Option<String>,
    service_url: Option<String>,
) -> Result<TranscribeResponse, String> {
    let url = service_url.unwrap_or_else(|| "http://127.0.0.1:8765".to_string());
    
    let request = TranscribeRequest {
        audio: audio_base64,
        language,
        model_size: None,
        device: None,
        compute_type: None,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/transcribe", url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to voice service: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Ok(TranscribeResponse {
            success: false,
            text: None,
            language: None,
            language_probability: None,
            segments: None,
            error: Some(error_text),
        });
    }

    let result: TranscribeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(result)
}

/// Tauri command: Synthesize text to speech using Piper
#[tauri::command]
pub async fn synthesize_speech(
    text: String,
    voice: Option<String>,
    speed: Option<f64>,
    service_url: Option<String>,
) -> Result<SynthesizeResponse, String> {
    let url = service_url.unwrap_or_else(|| "http://127.0.0.1:8765".to_string());
    
    let request = SynthesizeRequest {
        text,
        voice: voice.or_else(|| Some("en_US-lessac-medium".to_string())),
        speed: speed.or(Some(1.0)),
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/synthesize", url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to voice service: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Ok(SynthesizeResponse {
            success: false,
            audio: None,
            format: None,
            error: Some(error_text),
        });
    }

    let result: SynthesizeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(result)
}

/// Tauri command: Check voice service health
#[tauri::command]
pub async fn check_voice_service_health(
    service_url: Option<String>,
) -> Result<HealthResponse, String> {
    let url = service_url.unwrap_or_else(|| "http://127.0.0.1:8765".to_string());
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client
        .get(&format!("{}/health", url))
        .send()
        .await
        .map_err(|e| {
            // Provide more helpful error messages
            if e.is_timeout() {
                "Health check timed out. Service may still be starting or loading models.".to_string()
            } else if e.is_connect() {
                "Cannot connect to voice service. Make sure it's running on the configured port.".to_string()
            } else {
                format!("Failed to connect to voice service: {}", e)
            }
        })?;

    if !response.status().is_success() {
        return Ok(HealthResponse {
            status: "unhealthy".to_string(),
            whisper_available: false,
            piper_available: false,
            service: "voice-service".to_string(),
            error: Some(format!("HTTP Error: {}", response.status())),
        });
    }



    let mut result: HealthResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    result.error = None; // clear any error if successful parsing
    Ok(result)
}

/// Tauri command: Start voice service process
#[tauri::command]
pub async fn start_voice_service(
    config: Option<VoiceServiceConfig>,
) -> Result<String, String> {
    let config = config.unwrap_or_default();
    
    // Find Python executable
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    // Find voice_service.py
    let service_path = find_voice_service_script()
        .ok_or_else(|| "Could not find voice_service.py".to_string())?;

    // Verify Python is available
    let python_check = Command::new(python_cmd)
        .arg("--version")
        .output();
    
    if python_check.is_err() {
        return Err(format!(
            "Python not found. Please install Python 3 and ensure '{}' is in your PATH.",
            python_cmd
        ));
    }

    // Verify script exists and is readable
    if !service_path.exists() {
        return Err(format!(
            "Voice service script not found at: {}. Please ensure voice-service/voice_service.py exists.",
            service_path.display()
        ));
    }

    // Build command
    let mut cmd = Command::new(python_cmd);
    cmd.arg(&service_path)
        .arg("--host")
        .arg(&config.host)
        .arg("--port")
        .arg(config.port.to_string())
        .arg("--model-size")
        .arg(&config.model_size)
        .arg("--device")
        .arg(&config.device)
        .arg("--compute-type")
        .arg(&config.compute_type);

    // Suppress output (redirect to null)
    cmd.stdout(Stdio::null()).stderr(Stdio::null());

    // Start process in background
    let process = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start voice service: {}\n\nTroubleshooting:\n1. Ensure Python 3 is installed: {} --version\n2. Install dependencies: pip3 install -r voice-service/requirements.txt\n3. Verify script exists: {}\n4. Check Python path: which {}",
            e,
            python_cmd,
            service_path.display(),
            python_cmd
        )
    })?;

    let pid = process.id();
    
    // Don't wait for the process - let it run in background
    // The process will continue running even after this function returns
    
    Ok(format!("Voice service started (PID: {})", pid))
}

/// Tauri command: Check if voice service dependencies are available
#[tauri::command]
pub async fn check_voice_service_dependencies() -> Result<serde_json::Value, String> {
    let mut result = serde_json::json!({
        "python_available": false,
        "python_version": None::<String>,
        "script_found": false,
        "script_path": None::<String>,
        "faster_whisper_available": false,
    });

    // Check Python
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    if let Ok(output) = Command::new(python_cmd).arg("--version").output() {
        if output.status.success() {
            result["python_available"] = serde_json::json!(true);
            if let Ok(version) = String::from_utf8(output.stdout) {
                result["python_version"] = serde_json::json!(version.trim().to_string());
            }
        }
    }

    // Check script
    if let Some(script_path) = find_voice_service_script() {
        result["script_found"] = serde_json::json!(true);
        result["script_path"] = serde_json::json!(script_path.to_string_lossy().to_string());
        
        // Try to check if faster-whisper is installed
        if let Ok(output) = Command::new(python_cmd)
            .arg("-c")
            .arg("import faster_whisper; print('OK')")
            .output()
        {
            if output.status.success() {
                result["faster_whisper_available"] = serde_json::json!(true);
            }
        }
    }

    Ok(result)
}

/// Find voice_service.py script
fn find_voice_service_script() -> Option<PathBuf> {
    // Try multiple locations
    
    // 1. Try relative path from app directory (development)
    if let Ok(mut path) = std::env::current_exe() {
        path.pop(); // Remove executable name
        // In development: target/debug or target/release
        // In production: might be in app bundle
        if path.ends_with("debug") || path.ends_with("release") {
            path.pop(); // Remove target/debug or target/release
        }
        path.pop(); // Remove src-tauri
        path.push("voice-service");
        path.push("voice_service.py");
        
        if path.exists() {
            return Some(path);
        }
    }

    // 2. Try current working directory
    if let Ok(mut path) = std::env::current_dir() {
        path.push("voice-service");
        path.push("voice_service.py");
        
        if path.exists() {
            return Some(path);
        }
    }

    // 3. Try parent directory (if running from src-tauri)
    if let Ok(mut path) = std::env::current_dir() {
        path.pop();
        path.push("voice-service");
        path.push("voice_service.py");
        
        if path.exists() {
            return Some(path);
        }
    }

    // 4. Try from executable's parent directory
    if let Ok(mut path) = std::env::current_exe() {
        path.pop(); // Remove executable
        path.push("voice-service");
        path.push("voice_service.py");
        
        if path.exists() {
            return Some(path);
        }
    }

    // 5. Try user's home directory
    if let Some(home) = std::env::var_os("HOME") {
        let mut path = PathBuf::from(home);
        path.push("voice-service");
        path.push("voice_service.py");
        
        if path.exists() {
            return Some(path);
        }
    }

    None
}
