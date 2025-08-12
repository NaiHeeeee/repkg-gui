use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

// 引入 RePKG 模块
mod repkg;
use repkg::{extract_pkg, get_file_info, info_pkg};

// 使用Tauri v2的dialog插件
use tauri_plugin_dialog::DialogExt;

// 从 repkg 模块导入 FileInfo 结构体
use repkg::FileInfo;

#[derive(Serialize, Deserialize)]
struct WallpaperData {
    id: String,
    name: String,
    image: String,
    path: String,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_home_dir() -> Result<String, String> {
    let home_dir = dirs::home_dir()
        .ok_or("无法获取用户主目录")?
        .to_string_lossy()
        .to_string();
    Ok(home_dir)
}

#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app.dialog().file().blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
async fn read_workshop_directory(path: String) -> Result<Vec<FileInfo>, String> {
    let mut folders = Vec::new();

    match fs::read_dir(&path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                if metadata.is_dir() {
                    let file_info = fs::metadata(&entry.path()).map_err(|e| e.to_string())?;
                    let modified = file_info.modified().map_err(|e| e.to_string())?;
                    let modified = chrono::DateTime::<chrono::Utc>::from(modified);

                    folders.push(FileInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        is_dir: true,
                        size: file_info.len(),
                        modified,
                    });
                }
            }
            Ok(folders)
        }
        Err(e) => Err(format!("无法读取目录: {}", e)),
    }
}

#[tauri::command]
async fn read_json_file(path: String) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("无法读取文件: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("JSON解析错误: {}", e))
}

#[tauri::command]
async fn check_file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
async fn read_directory_files(path: String) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();

    match fs::read_dir(&path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                let file_info = fs::metadata(&entry.path()).map_err(|e| e.to_string())?;
                let modified = file_info.modified().map_err(|e| e.to_string())?;
                let modified = chrono::DateTime::<chrono::Utc>::from(modified);

                files.push(FileInfo {
                    name: entry.file_name().to_string_lossy().to_string(),
                    is_dir: metadata.is_dir(),
                    size: file_info.len(),
                    modified,
                });
            }
            Ok(files)
        }
        Err(e) => Err(format!("无法读取目录: {}", e)),
    }
}

#[tauri::command]
async fn read_image_as_base64(path: String) -> Result<String, String> {
    use base64::Engine;

    let image_data = fs::read(&path).map_err(|e| format!("无法读取图片文件: {}", e))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(image_data))
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 确保路径存在
        if !Path::new(&path).exists() {
            return Err(format!("路径不存在: {}", path));
        }

        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn maximize_window(window: tauri::Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn unmaximize_window(window: tauri::Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_window_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
async fn cleanup_non_media_files(
    path: String,
    allowed_extensions: Vec<String>,
) -> Result<(), String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("路径不存在".to_string());
    }

    let allowed_extensions: Vec<String> = allowed_extensions
        .iter()
        .map(|ext| {
            let mut ext = ext.clone();
            if !ext.starts_with('.') {
                ext.insert(0, '.');
            }
            ext.to_lowercase()
        })
        .collect();

    fn cleanup_dir(dir_path: &Path, allowed: &[String]) -> Result<(), String> {
        let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = format!(".{}", ext.to_string_lossy().to_lowercase());
                    if !allowed.contains(&ext_str) {
                        fs::remove_file(&path).map_err(|e| e.to_string())?;
                    }
                } else {
                    // 没有扩展名的文件也删除
                    fs::remove_file(&path).map_err(|e| e.to_string())?;
                }
            } else if path.is_dir() {
                // 递归处理子目录
                cleanup_dir(&path, allowed)?;

                // 如果目录为空，删除目录
                if fs::read_dir(&path).map_err(|e| e.to_string())?.count() == 0 {
                    fs::remove_dir(&path).map_err(|e| e.to_string())?;
                }
            }
        }

        Ok(())
    }

    cleanup_dir(path, &allowed_extensions)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_home_dir,
            select_folder,
            read_workshop_directory,
            read_json_file,
            check_file_exists,
            read_directory_files,
            read_image_as_base64,
            open_folder,
            minimize_window,
            maximize_window,
            unmaximize_window,
            close_window,
            is_window_maximized,
            extract_pkg,
            info_pkg,
            cleanup_non_media_files,
            get_file_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
