use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

// 引入 RePKG 模块
mod repkg;
use repkg::{extract_pkg, get_file_info, info_pkg};

// 引入壁纸编辑器模块
mod wallpaper_editor;
use wallpaper_editor::{import_to_wallpaper_editor, get_steamapps_paths, find_workshop_path_from_extract_path, check_wallpaper_exists_in_editor, remove_wallpaper_from_editor};

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
async fn file_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("无法读取文件: {}", e))
}

#[tauri::command]
async fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("无法写入文件: {}", e))
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
async fn create_directory(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    fs::create_dir_all(path).map_err(|e| format!("无法创建目录 {}: {}", path.display(), e))
}

#[tauri::command]
async fn cleanup_directory_before_extract(
    path: String,
) -> Result<(), String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Ok(()); // 如果目录不存在，无需清理
    }
    
    // 只删除根目录下的文件，不删除子目录中的文件
    // 这样可以确保在为每个壁纸单独生成文件夹时，不会影响其他壁纸文件夹
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    
    for entry in entries.flatten() {
        let file_path = entry.path();
        // 只处理根目录下的文件，不处理子目录
        if file_path.is_file() && file_path.parent() == Some(path) {
            match fs::remove_file(&file_path) {
                Ok(_) => {},
                Err(e) => {
                    eprintln!("警告：无法删除文件 {}: {}", file_path.display(), e);
                }
            }
        }
    }
    
    Ok(())
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

#[tauri::command]
async fn flatten_media_files(
    path: String,
    allowed_extensions: Vec<String>,
    overwrite: bool,
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

    // 收集所有需要移动的文件
    let mut files_to_move = Vec::new();
    
    fn collect_media_files(
        dir_path: &Path,
        allowed: &[String],
        files: &mut Vec<std::path::PathBuf>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = format!(".{}", ext.to_string_lossy().to_lowercase());
                    if allowed.contains(&ext_str) {
                        files.push(path);
                    }
                }
            } else if path.is_dir() {
                // 递归收集子目录中的文件
                collect_media_files(&path, allowed, files)?;
            }
        }

        Ok(())
    }

    collect_media_files(path, &allowed_extensions, &mut files_to_move)?;

    // 移动所有文件到根目录
    let mut successfully_moved = 0;
    let mut failed_moves = 0;
    
    for file_path in files_to_move {
        if let Some(file_name) = file_path.file_name() {
            let target_path = path.join(file_name);
            
            // 如果目标路径已存在，根据overwrite参数决定是否覆盖
            let final_target_path = if target_path.exists() {
                if overwrite {
                    // 如果启用覆盖，先删除现有文件
                    fs::remove_file(&target_path)
                        .map_err(|e| format!("无法删除现有文件 {}: {}", target_path.display(), e))?;
                    target_path
                } else {
                    // 如果未启用覆盖，添加数字后缀
                    let stem = file_path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("file");
                    let extension = file_path.extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("");
                    
                    let mut counter = 1;
                    loop {
                        let new_name = if extension.is_empty() {
                            format!("{}_{}", stem, counter)
                        } else {
                            format!("{}_{}.{}", stem, counter, extension)
                        };
                        let new_path = path.join(new_name);
                        if !new_path.exists() {
                            break new_path;
                        }
                        counter += 1;
                    }
                }
            } else {
                target_path
            };
            
            // 尝试移动文件
            match fs::rename(&file_path, &final_target_path) {
                Ok(_) => {
                    // 验证文件是否成功移动
                    if final_target_path.exists() {
                        successfully_moved += 1;
                    } else {
                        failed_moves += 1;
                        eprintln!("警告：文件移动后验证失败: {}", file_path.display());
                    }
                }
                Err(e) => {
                    failed_moves += 1;
                    eprintln!("警告：无法移动文件 {}: {}", file_path.display(), e);
                }
            }
        }
    }
    
    // 如果有文件移动失败，记录警告
    if failed_moves > 0 {
        eprintln!("警告：共移动 {} 个文件，其中 {} 个失败", successfully_moved, failed_moves);
    }

    // 删除所有子目录
    fn remove_all_subdirs(dir_path: &Path) -> Result<(), String> {
        let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
        let mut removed_dirs = 0;
        let mut failed_dirs = 0;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 尝试删除子目录及其所有内容
                match fs::remove_dir_all(&path) {
                    Ok(_) => {
                        removed_dirs += 1;
                    }
                    Err(e) => {
                        failed_dirs += 1;
                        eprintln!("警告：无法删除目录 {}: {}", path.display(), e);
                    }
                }
            }
        }
        
        if failed_dirs > 0 {
            eprintln!("警告：共尝试删除 {} 个目录，其中 {} 个失败", removed_dirs + failed_dirs, failed_dirs);
        }

        Ok(())
    }
    
    // 检查子目录中是否有残留文件
    fn check_remaining_files(dir_path: &Path) -> Result<bool, String> {
        let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
        
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 检查子目录中是否还有文件
                let sub_entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
                for sub_entry in sub_entries.flatten() {
                    let sub_path = sub_entry.path();
                    if sub_path.is_file() {
                        return Ok(true); // 在子目录中找到残留文件
                    }
                }
                // 递归检查更深层的子目录
                if check_remaining_files(&path)? {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }
    
    // 在删除子目录之前，检查是否还有文件残留在子目录中
    if check_remaining_files(path)? {
        eprintln!("警告：子目录中仍有残留文件，但将继续尝试删除子目录");
    }
    
    // 删除所有子目录，确保目录结构被完全扁平化
    remove_all_subdirs(path)?;
    
    // 再次检查是否还有残留文件，如果有则记录更详细的警告
    if check_remaining_files(path)? {
        eprintln!("警告：删除子目录后仍有残留文件存在，这可能影响下次提取");
    }
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
            file_exists,
            read_text_file,
            write_text_file,
            open_folder,
            minimize_window,
            maximize_window,
            unmaximize_window,
            close_window,
            is_window_maximized,
            create_directory,
            extract_pkg,
            info_pkg,
            cleanup_directory_before_extract,
            cleanup_non_media_files,
            flatten_media_files,
            get_file_info,
            import_to_wallpaper_editor,
            get_steamapps_paths,
            find_workshop_path_from_extract_path,
            check_wallpaper_exists_in_editor,
            remove_wallpaper_from_editor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
