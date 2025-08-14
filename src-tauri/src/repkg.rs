use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Serialize, Deserialize)]
pub struct ExtractOptions {
    pub output: Option<String>,
    pub ignore_exts: Option<String>,
    pub only_exts: Option<String>,
    pub debug_info: bool,
    pub tex: bool,
    pub single_dir: bool,
    pub recursive: bool,
    pub copy_project: bool,
    pub use_name: bool,
    pub no_tex_convert: bool,
    pub overwrite: bool,
}

#[derive(Serialize, Deserialize)]
pub struct InfoOptions {
    pub sort: bool,
    pub sort_by: Option<String>,
    pub tex: bool,
    pub project_info: Option<String>,
    pub print_entries: bool,
    pub title_filter: Option<String>,
}

#[tauri::command]
pub async fn extract_pkg(input: String, options: ExtractOptions) -> Result<String, String> {
    let repkg_path = get_repkg_path();

    let mut args = vec!["extract"];

    if let Some(output) = &options.output {
        args.push("-o");
        args.push(output);
    }

    if let Some(ignore_exts) = &options.ignore_exts {
        args.push("-i");
        args.push(ignore_exts);
    }

    if let Some(only_exts) = &options.only_exts {
        args.push("-e");
        args.push(only_exts);
    }

    if options.debug_info {
        args.push("-d");
    }

    if options.tex {
        args.push("-t");
    }

    if options.single_dir {
        args.push("-s");
    }

    if options.recursive {
        args.push("-r");
    }

    if options.copy_project {
        args.push("-c");
    }

    if options.use_name {
        args.push("-n");
    }

    if options.no_tex_convert {
        args.push("--no-tex-convert");
    }

    if options.overwrite {
        args.push("--overwrite");
    }

    args.push(&input);

    // 添加调试日志
    println!("RePKG 路径: {}", repkg_path);
    println!("输入路径: {}", input);
    println!("输出路径: {:?}", options.output);
    println!("命令参数: {:?}", args);

    run_repkg_command(&repkg_path, &args).await
}

#[tauri::command]
pub async fn info_pkg(input: String, options: InfoOptions) -> Result<String, String> {
    let repkg_path = get_repkg_path();

    let mut args = vec!["info"];

    if options.sort {
        args.push("-s");
    }

    if let Some(sort_by) = &options.sort_by {
        args.push("-b");
        args.push(sort_by);
    }

    if options.tex {
        args.push("-t");
    }

    if let Some(project_info) = &options.project_info {
        args.push("-p");
        args.push(project_info);
    }

    if options.print_entries {
        args.push("-e");
    }

    if let Some(title_filter) = &options.title_filter {
        args.push("--title-filter");
        args.push(title_filter);
    }

    args.push(&input);

    run_repkg_command(&repkg_path, &args).await
}

fn get_repkg_path() -> String {
    // 根据操作系统选择正确的 RePKG 可执行文件
    let exe_name = if cfg!(target_os = "windows") {
        "RePKG.exe"
    } else {
        "RePKG"
    };

    // 在开发环境中，RePKG.exe 位于项目的 bin 目录中
    let mut dev_path = std::env::current_dir().unwrap_or_default();
    dev_path.push("bin");
    dev_path.push(exe_name);

    // 如果在开发环境中找到，则使用该路径
    if dev_path.exists() {
        return dev_path.to_string_lossy().to_string();
    }

    // 在生产环境中，我们假设 RePKG.exe 与应用程序位于同一目录
    // 或者在资源目录中
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let mut prod_path = parent.to_path_buf();
            prod_path.push(exe_name);

            // 如果在可执行文件同目录找到，则使用该路径
            if prod_path.exists() {
                return prod_path.to_string_lossy().to_string();
            }
        }
    }

    // 如果都没有找到，返回默认路径
    dev_path.to_string_lossy().to_string()
}

#[derive(Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: DateTime<Utc>,
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let metadata = fs::metadata(&path).map_err(|e| format!("无法获取文件信息: {}", e))?;
    let modified = metadata
        .modified()
        .map_err(|e| format!("无法获取修改时间: {}", e))?;
    let modified = DateTime::<Utc>::from(modified);
    let path_buf = std::path::PathBuf::from(&path);
    let name = path_buf
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    Ok(FileInfo {
        name,
        is_dir: metadata.is_dir(),
        size: metadata.len(),
        modified,
    })
}

async fn run_repkg_command(repkg_path: &str, args: &[&str]) -> Result<String, String> {
    // 检查 RePKG 可执行文件是否存在
    if !Path::new(repkg_path).exists() {
        return Err(format!("RePKG Not Found: {}", repkg_path));
    }

    // 执行命令
    let mut command = Command::new(repkg_path);
    command.args(args);
    
    // 在 Windows 上隐藏终端窗口
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = command
        .output()
        .map_err(|e| format!("执行 RePKG 命令失败: {}", e))?;

    // 添加调试信息
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    println!("RePKG stdout: {}", stdout);
    println!("RePKG stderr: {}", stderr);
    println!("RePKG exit code: {:?}", output.status.code());

    // 检查执行结果
    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Err(format!("RePKG 命令执行失败: {}", stderr))
    }
}
