use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path};
use std::process::Command;

#[derive(Serialize, Deserialize)]
pub struct ImportToEditorOptions {
    pub workshop_id: String,
    pub steamapps_path: String,
    pub scene_pkg_path: String,
    pub overwrite: bool,
}

#[derive(Serialize, Deserialize)]
pub struct SteamappsPaths {
    pub wallpaper_engine_path: String,
    pub projects_path: String,
    pub myprojects_path: String,
}

#[tauri::command]
pub async fn import_to_wallpaper_editor(options: ImportToEditorOptions) -> Result<String, String> {
    // 获取原始壁纸文件夹路径（scene.pkg的父目录）
    let original_folder = Path::new(&options.scene_pkg_path)
        .parent()
        .ok_or("无法获取原始文件夹路径")?;
    
    // 读取project.json获取title字段
    let original_project_json = original_folder.join("project.json");
    let mut folder_name = options.workshop_id.clone(); // 默认使用workshop_id
    
    if original_project_json.exists() {
        let project_content = fs::read_to_string(&original_project_json)
            .map_err(|e| format!("无法读取project.json: {}", e))?;
        
        let project_data: serde_json::Value = serde_json::from_str(&project_content)
            .map_err(|e| format!("project.json格式错误: {}", e))?;
        
        // 获取title字段作为文件夹名
        if let Some(title) = project_data.get("title").and_then(|t| t.as_str()) {
            // 清理文件夹名，移除非法字符
            let safe_title = title
                .replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_', "_")
                .trim()
                .to_string();
            
            if !safe_title.is_empty() {
                folder_name = safe_title;
            }
        }
    }
    
    // 构建目标路径
    let myprojects_path = Path::new(&options.steamapps_path)
        .join("common")
        .join("wallpaper_engine")
        .join("projects")
        .join("myprojects");
    
    let target_folder = myprojects_path.join(&folder_name);
    
    // 如果目标文件夹不存在则创建
    if !target_folder.exists() {
        fs::create_dir_all(&target_folder)
            .map_err(|e| format!("无法创建目标文件夹: {}", e))?;
    }
    
    // 构建目标scene.pkg路径
    let target_scene_pkg = target_folder.join("scene.pkg");
    
    // 检查是否已存在且不允许覆盖
    if target_scene_pkg.exists() && !options.overwrite {
        return Err("目标文件已存在，请启用覆盖选项".to_string());
    }
    
    // 复制scene.pkg文件
    fs::copy(&options.scene_pkg_path, &target_scene_pkg)
        .map_err(|e| format!("无法复制scene.pkg: {}", e))?;
    
    // 提取scene.pkg到目标文件夹
    extract_pkg_to_folder(&options.scene_pkg_path, &target_folder.to_string_lossy().to_string())
        .map_err(|e| format!("无法解压scene.pkg: {}", e))?;
    
    // 复制project.json文件
    let target_project_json = target_folder.join("project.json");
    
    if original_project_json.exists() {
        fs::copy(&original_project_json, &target_project_json)
            .map_err(|e| format!("无法复制project.json: {}", e))?;
        
        // 读取并修改project.json，删除指定字段
        let project_content = fs::read_to_string(&target_project_json)
            .map_err(|e| format!("无法读取project.json: {}", e))?;
        
        let mut project_data: serde_json::Value = serde_json::from_str(&project_content)
            .map_err(|e| format!("project.json格式错误: {}", e))?;
        
        // 删除指定的字段
        if let Some(obj) = project_data.as_object_mut() {
            obj.remove("version");
            obj.remove("workshopid");
            obj.remove("workshopurl");
        }
        
        // 保存修改后的project.json
        let updated_content = serde_json::to_string_pretty(&project_data)
            .map_err(|e| format!("无法保存project.json: {}", e))?;
        
        fs::write(&target_project_json, updated_content)
            .map_err(|e| format!("无法写入project.json: {}", e))?;
    }
    
    // 复制preview文件（包括各种可能的预览文件格式）
    let preview_extensions = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm"];
    let preview_names = ["preview", "Preview", "PREVIEW"];
    
    for name in &preview_names {
        for ext in &preview_extensions {
            let original_preview = original_folder.join(format!("{}.{}", name, ext));
            if original_preview.exists() {
                let target_preview = target_folder.join(format!("{}.{}", name, ext));
                fs::copy(&original_preview, &target_preview)
                    .map_err(|e| format!("无法复制预览文件: {}", e))?;
                break;
            }
        }
    }
    
    Ok(format!(
        "{}",
        target_folder.to_string_lossy()
    ))
}

#[tauri::command]
pub async fn check_wallpaper_exists_in_editor(options: ImportToEditorOptions) -> Result<bool, String> {
    let original_folder = Path::new(&options.scene_pkg_path)
        .parent()
        .ok_or("无法获取原始文件夹路径")?;
    
    // 读取project.json获取title字段
    let original_project_json = original_folder.join("project.json");
    let mut folder_name = options.workshop_id.clone(); // 默认使用workshop_id
    
    if original_project_json.exists() {
        let project_content = fs::read_to_string(&original_project_json)
            .map_err(|e| format!("无法读取project.json: {}", e))?;
        
        let project_data: serde_json::Value = serde_json::from_str(&project_content)
            .map_err(|e| format!("project.json格式错误: {}", e))?;
        
        // 获取title字段作为文件夹名
        if let Some(title) = project_data.get("title").and_then(|t| t.as_str()) {
            // 清理文件夹名，移除非法字符
            let safe_title = title
                .replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_', "_")
                .trim()
                .to_string();
            
            if !safe_title.is_empty() {
                folder_name = safe_title;
            }
        }
    }

    let myprojects_path = Path::new(&options.steamapps_path)
        .join("common")
        .join("wallpaper_engine")
        .join("projects")
        .join("myprojects");

    let target_folder = myprojects_path.join(&folder_name);
    Ok(target_folder.exists() && target_folder.join("scene.pkg").exists())
}

#[tauri::command]
pub async fn remove_wallpaper_from_editor(options: ImportToEditorOptions) -> Result<String, String> {
    let original_folder = Path::new(&options.scene_pkg_path)
        .parent()
        .ok_or("无法获取原始文件夹路径")?;
    
    // 读取project.json获取title字段
    let original_project_json = original_folder.join("project.json");
    let mut folder_name = options.workshop_id.clone(); // 默认使用workshop_id
    
    if original_project_json.exists() {
        let project_content = fs::read_to_string(&original_project_json)
            .map_err(|e| format!("无法读取project.json: {}", e))?;
        
        let project_data: serde_json::Value = serde_json::from_str(&project_content)
            .map_err(|e| format!("project.json格式错误: {}", e))?;
        
        // 获取title字段作为文件夹名
        if let Some(title) = project_data.get("title").and_then(|t| t.as_str()) {
            // 清理文件夹名，移除非法字符
            let safe_title = title
                .replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_', "_")
                .trim()
                .to_string();
            
            if !safe_title.is_empty() {
                folder_name = safe_title;
            }
        }
    }

    let myprojects_path = Path::new(&options.steamapps_path)
        .join("common")
        .join("wallpaper_engine")
        .join("projects")
        .join("myprojects");

    let target_folder = myprojects_path.join(&folder_name);
    if !target_folder.exists() {
        return Err("壁纸不存在于编辑器中".to_string());
    }

    fs::remove_dir_all(&target_folder)
        .map_err(|e| format!("无法删除壁纸文件夹: {}", e))?;

    Ok(format!("已从壁纸编辑器中删除: {}", target_folder.to_string_lossy()))
}

#[tauri::command]
pub async fn get_steamapps_paths() -> Result<SteamappsPaths, String> {
    // 尝试从常见的Steam安装位置查找
    let steam_paths = vec![
        "C:\\Program Files (x86)\\Steam",
        "C:\\Program Files\\Steam",
        "D:\\Steam",
        "E:\\Steam",
    ];
    
    for steam_path in steam_paths {
        let wallpaper_engine_path = Path::new(steam_path)
            .join("steamapps")
            .join("common")
            .join("wallpaper_engine");
            
        if wallpaper_engine_path.exists() {
            let projects_path = wallpaper_engine_path.join("projects");
            let myprojects_path = projects_path.join("myprojects");
            
            // 确保myprojects目录存在
            if !myprojects_path.exists() {
                fs::create_dir_all(&myprojects_path)
                    .map_err(|e| format!("无法创建myprojects目录: {}", e))?;
            }
            
            return Ok(SteamappsPaths {
                wallpaper_engine_path: wallpaper_engine_path.to_string_lossy().to_string(),
                projects_path: projects_path.to_string_lossy().to_string(),
                myprojects_path: myprojects_path.to_string_lossy().to_string(),
            });
        }
    }
    
    Err("未检测到Steam或Wallpaper Engine，请确认已正确安装".to_string())
}

#[tauri::command]
pub async fn find_workshop_path_from_extract_path(extract_path: String) -> Result<String, String> {
    let extract_path = Path::new(&extract_path);
    
    // 向上查找，找到steamapps目录
    let mut current_path = extract_path;
    while let Some(parent) = current_path.parent() {
        if parent.ends_with("steamapps") {
            return Ok(parent.to_string_lossy().to_string());
        }
        current_path = parent;
    }
    
    // 如果没有找到，返回默认的Steam路径
    get_steamapps_paths().await.map(|paths| paths.myprojects_path)
}

fn extract_pkg_to_folder(pkg_path: &str, output_path: &str) -> Result<(), String> {
    let repkg_path = get_repkg_path();
    
    let mut args = vec!["extract", "-o", output_path, "--overwrite"];
    args.push(pkg_path);
    
    let mut command = Command::new(&repkg_path);
    command.args(&args);
    
    // 在 Windows 上隐藏终端窗口
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = command
        .output()
        .map_err(|e| format!("无法启动RePKG: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("RePKG提取失败: {}", stderr));
    }
    
    Ok(())
}

fn get_repkg_path() -> String {
    let exe_name = if cfg!(target_os = "windows") {
        "RePKG.exe"
    } else {
        "RePKG"
    };

    let mut dev_path = std::env::current_dir().unwrap_or_default();
    dev_path.push("bin");
    dev_path.push(exe_name);

    if dev_path.exists() {
        return dev_path.to_string_lossy().to_string();
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let mut prod_path = parent.to_path_buf();
            prod_path.push(exe_name);

            if prod_path.exists() {
                return prod_path.to_string_lossy().to_string();
            }
        }
    }

    dev_path.to_string_lossy().to_string()
}