use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri_plugin_opener::OpenerExt;

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackgroundFileInfo {
    file_path: String,
    file_name: String,
    file_size: u64,
}

const LEGACY_BACKGROUND_STEM_LEN: usize = 160;

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
    Path::new(&path).try_exists().map_err(|e| format!("无法检查文件: {e}"))
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("无法读取文件: {}", e))
}

#[tauri::command]
async fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let path = std::path::absolute(&path).map_err(|e| format!("无法解析文件路径: {e}"))?;
    let directory = path.parent().ok_or("文件路径没有父目录")?;
    let mut temporary = tempfile::NamedTempFile::new_in(directory)
        .map_err(|e| format!("无法创建临时文件: {e}"))?;
    temporary
        .write_all(contents.as_bytes())
        .and_then(|()| temporary.as_file().sync_all())
        .map_err(|e| format!("无法写入文件: {e}"))?;
    temporary
        .persist(&path)
        .map_err(|e| format!("无法替换文件: {}", e.error))?;
    Ok(())
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let path = path.replace('/', "\\");
        // 确保路径存在
        if !Path::new(&path).is_dir() {
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
async fn open_shell(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_url(&path, None::<&str>)
        .map_err(|e| format!("无法打开链接: {}", e))
}

#[tauri::command]
async fn get_latest_release_tag() -> Result<String, String> {
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("RePKG-GUI")
        .build()
        .map_err(|error| error.to_string())?
        .head("https://github.com/naiheeeee/repkg-gui/releases/latest")
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| error.to_string())?;

    // GitHub redirects its latest-release permalink to the published tag page.
    let url = response.url();
    if let Some((path, tag)) = url.path().rsplit_once('/') {
        if url.scheme() == "https"
            && url.host_str() == Some("github.com")
            && path.eq_ignore_ascii_case("/naiheeeee/repkg-gui/releases/tag")
            && !tag.is_empty()
        {
            return Ok(tag.to_owned());
        }
    }
    Err("GitHub did not redirect to a RePKG-GUI release tag".into())
}

#[tauri::command]
async fn is_window_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_background_dir() -> Result<String, String> {
    let background_dir = dirs::data_dir()
        .ok_or("无法获取数据目录")?
        .join("repkg-gui")
        .join("backgrounds");
    
    // 确保目录存在
    std::fs::create_dir_all(&background_dir).map_err(|e| format!("无法创建背景目录: {}", e))?;
    
    Ok(background_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn copy_background_file(source_path: String) -> Result<BackgroundFileInfo, String> {
    let background_dir = PathBuf::from(get_background_dir().await?);
    tauri::async_runtime::spawn_blocking(move || {
        cache_background_file(Path::new(&source_path), &background_dir)
            .map_err(|error| format!("无法复制背景文件: {error}"))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn background_file_stem(path: &Path) -> String {
    path.file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn cache_background_file(source: &Path, directory: &Path) -> io::Result<BackgroundFileInfo> {
    let name = source.file_name().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "背景文件缺少文件名")
    })?;
    let extension = source
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    let mut input = fs::File::open(source)?;
    let mut temporary = tempfile::NamedTempFile::new_in(directory)?;
    let mut hash = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024];
    let mut file_size = 0;
    loop {
        let count = input.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        temporary.write_all(&buffer[..count])?;
        hash.update(&buffer[..count]);
        file_size += count as u64;
    }

    let target_path = directory.join(format!("{:x}.{extension}", hash.finalize()));
    let already_cached = || is_background_copy(&target_path, file_size);
    if !already_cached() {
        temporary.as_file().sync_all()?;
        if let Err(error) = temporary.persist_noclobber(&target_path) {
            if error.error.kind() != io::ErrorKind::AlreadyExists || !already_cached() {
                return Err(error.error);
            }
        }
    }

    Ok(BackgroundFileInfo {
        file_path: target_path.to_string_lossy().into_owned(),
        file_name: name.to_string_lossy().into_owned(),
        file_size,
    })
}

fn is_background_copy(path: &Path, file_size: u64) -> bool {
    fs::symlink_metadata(path)
        .is_ok_and(|metadata| metadata.is_file() && metadata.len() == file_size)
}

fn background_digest(path: &Path) -> Option<&str> {
    path.file_stem()?
        .to_str()?
        .rsplit('_')
        .next()
        .filter(|digest| digest.len() == 64 && digest.bytes().all(|b| b.is_ascii_hexdigit()))
}

#[tauri::command]
async fn resolve_background_file(
    file_path: String,
    file_name: String,
    file_size: Option<u64>,
) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    if path.is_file() {
        return Ok(Some(file_path));
    }
    let Some(file_size) = file_size else {
        return Ok(None);
    };

    let background_dir = dirs::data_dir()
        .ok_or("无法获取数据目录")?
        .join("repkg-gui")
        .join("backgrounds");
    find_cached_background(&background_dir, path, Path::new(&file_name), file_size)
        .map(|path| path.map(|path| path.to_string_lossy().into_owned()))
        .map_err(|error| format!("无法查找背景文件: {error}"))
}

fn find_cached_background(
    directory: &Path,
    previous_path: &Path,
    original_name: &Path,
    file_size: u64,
) -> io::Result<Option<PathBuf>> {
    let Some(extension) = original_name.extension().and_then(|ext| ext.to_str()) else {
        return Ok(None);
    };
    let stem = background_file_stem(original_name);
    let short_stem = &stem[..stem.len().min(LEGACY_BACKGROUND_STEM_LEN)];
    let previous_digest = background_digest(previous_path);
    if let Some(digest) = previous_digest {
        let cached = directory.join(format!("{digest}.{}", extension.to_ascii_lowercase()));
        if is_background_copy(&cached, file_size) {
            return Ok(Some(cached));
        }
    }
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let mut found = None;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if !path.extension().and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case(extension))
        {
            continue;
        }
        let matches_name = if let Some(digest) = previous_digest {
            background_digest(&path) == Some(digest)
        } else {
            let filename = path.file_stem().unwrap_or_default().to_string_lossy();
            filename.rsplit_once('_').is_some_and(|(prefix, suffix)| {
                if background_digest(&path).is_some() {
                    prefix == short_stem
                } else {
                    prefix == stem && suffix.len() == 13 && suffix.bytes().all(|b| b.is_ascii_digit())
                }
            })
        };
        if matches_name && is_background_copy(&path, file_size) {
            if previous_digest.is_some() {
                return Ok(Some(path));
            }
            if found.is_some() {
                return Ok(None);
            }
            found = Some(path);
        }
    }
    Ok(found)
}

#[tauri::command]
async fn write_background_chunk(
    file_path: String,
    chunk_data: Vec<u8>,
    chunk_index: usize,
    is_last_chunk: bool
) -> Result<(), String> {
    use std::fs;
    use std::io::Write;
    
    let path = std::path::Path::new(&file_path);
    
    // 如果是第一个块，创建新文件；否则追加到现有文件
    let mut file = if chunk_index == 0 {
        fs::File::create(path).map_err(|e| format!("无法创建文件: {}", e))?
    } else {
        fs::OpenOptions::new()
            .append(true)
            .open(path)
            .map_err(|e| format!("无法打开文件进行追加: {}", e))?
    };
    
    // 写入数据块
    file.write_all(&chunk_data).map_err(|e| format!("无法写入文件块: {}", e))?;
    
    // 如果是最后一个块，确保文件被正确关闭
    if is_last_chunk {
        file.sync_all().map_err(|e| format!("无法同步文件: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
async fn get_background_file_path(file_name: String) -> Result<String, String> {
    
    // 构建背景文件路径
    let background_dir = dirs::data_dir()
        .ok_or("无法获取数据目录")?
        .join("repkg-gui")
        .join("backgrounds");
    
    let file_path = background_dir.join(&file_name);
    
    // 检查文件是否存在
    if !file_path.exists() {
        return Err("背景文件不存在".to_string());
    }
    
    // 返回文件路径
    Ok(file_path.to_string_lossy().to_string())
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
            open_shell,
            get_latest_release_tag,
            minimize_window,
            maximize_window,
            unmaximize_window,
            close_window,
            is_window_maximized,
            extract_pkg,
            info_pkg,
            get_file_info,
            import_to_wallpaper_editor,
            get_steamapps_paths,
            find_workshop_path_from_extract_path,
            check_wallpaper_exists_in_editor,
            remove_wallpaper_from_editor,
            get_background_dir,
            copy_background_file,
            resolve_background_file,
            write_background_chunk,
            get_background_file_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod settings_tests {
    use super::*;

    #[test]
    fn settings_file_can_be_replaced_without_leaving_temporary_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");
        let contents = r#"{"overwrite-files":true}"#;
        fs::write(&path, r#"{"overwrite-files":false,"only-images":false}"#).unwrap();

        tauri::async_runtime::block_on(write_text_file(
            path.to_string_lossy().into_owned(),
            contents.into(),
        ))
        .unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), contents);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn missing_legacy_background_recovers_only_a_unique_matching_copy() {
        let temporary = tempfile::tempdir().unwrap();
        let directory = temporary.path();
        let previous = directory.join("__-5K_1795238025744.mp4");
        let original_name = Path::new("春日-5K.mp4");
        let matching = directory.join("__-5K_1795242946300.mp4");
        fs::write(&matching, b"media").unwrap();
        fs::write(directory.join("__-5K_1795252946300.mp4"), b"wrong size").unwrap();
        fs::write(directory.join("unrelated_1795262946300.mp4"), b"media").unwrap();
        fs::write(directory.join("__-5K_1795242946300.webm"), b"media").unwrap();

        assert_eq!(
            find_cached_background(directory, &previous, original_name, 5).unwrap(),
            Some(matching)
        );

        fs::write(directory.join("__-5K_1795272946300.mp4"), b"other").unwrap();
        assert!(find_cached_background(directory, &previous, original_name, 5).unwrap().is_none());
    }

    #[test]
    fn caching_reuses_identical_files_and_keeps_previous_versions() {
        let temporary = tempfile::tempdir().unwrap();
        let source = temporary.path().join("春日-5K.mp4");
        let directory = temporary.path().join("backgrounds");
        fs::create_dir(&directory).unwrap();
        fs::write(&source, b"first").unwrap();
        let first = cache_background_file(&source, &directory).unwrap();
        let renamed = temporary.path().join("renamed.MP4");
        fs::copy(&source, &renamed).unwrap();
        let repeated = cache_background_file(&renamed, &directory).unwrap();
        assert_eq!(first.file_path, repeated.file_path);
        assert_eq!(repeated.file_name, "renamed.MP4");
        let filename = Path::new(&first.file_path).file_name().unwrap().to_str().unwrap();
        assert_eq!(filename, format!("{:x}.mp4", Sha256::digest(b"first")));

        fs::write(&source, b"other").unwrap();
        let edited = cache_background_file(&source, &directory).unwrap();
        assert_ne!(first.file_path, edited.file_path);
        assert_eq!(fs::read(&first.file_path).unwrap(), b"first");
        assert_eq!(fs::read(&edited.file_path).unwrap(), b"other");
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 2);

        let missing = temporary.path().join(format!("__-5K_{filename}"));
        assert_eq!(
            find_cached_background(&directory, &missing, &source, 5).unwrap(),
            Some(PathBuf::from(first.file_path))
        );
    }
}
