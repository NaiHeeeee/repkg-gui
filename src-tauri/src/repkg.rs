use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Deserialize)]
pub struct ExtractOptions {
    pub output: String,
    pub folder_name: Option<String>,
    pub only_images: bool,
    pub single_dir: bool,
    pub no_tex_convert: bool,
    pub overwrite: bool,
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "mp4", "webm", "bmp", "tif", "tiff", "webp", "avi", "mov", "mkv",
];

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
    tauri::async_runtime::spawn_blocking(move || extract_package(&repkg_path, &input, &options))
        .await
        .map_err(|error| error.to_string())?
}

fn extract_package(
    repkg_path: &str,
    input: &str,
    options: &ExtractOptions,
) -> Result<String, String> {
    let input_path = Path::new(input);
    if !input_path.is_file() {
        return Err(format!("无法读取待提取文件: {input}"));
    }
    if options.output.trim().is_empty() {
        return Err("提取路径为空".into());
    }
    if let Some(name) = &options.folder_name {
        let mut parts = Path::new(name).components();
        if !matches!(parts.next(), Some(Component::Normal(part)) if part == name.as_str())
            || parts.next().is_some()
        {
            return Err(format!("无效的输出文件夹名称: {name}"));
        }
    }

    let output = std::path::absolute(&options.output).map_err(|error| error.to_string())?;
    fs::create_dir_all(&output).map_err(|error| output_error(&output, error))?;
    let staging = tempfile::Builder::new()
        .prefix(".repkg-")
        .tempdir_in(&output)
        .map_err(|error| output_error(&output, error))?;

    let staging_output = staging.path().to_string_lossy();
    let mut args = vec!["extract", "-o", &staging_output];
    let media_inputs;
    if options.only_images {
        // TEX is an input for converted images, even when raw TEX is omitted from the output.
        media_inputs = format!("{},tex", MEDIA_EXTENSIONS.join(","));
        args.extend(["-e", &media_inputs]);
    }
    if options.no_tex_convert {
        args.push("--no-tex-convert");
    }
    args.push(input);

    let result = run_repkg_command(repkg_path, &args)?;
    if result.lines().next() == Some("Input file not found") {
        return Err(format!("无法读取待提取文件: {input}"));
    }

    let destination = match &options.folder_name {
        Some(name) => reserve_output_folder(&output, name, options.overwrite)?,
        None => output,
    };
    publish_files(staging.path(), &destination, options, &mut HashSet::new())?;
    Ok(destination.to_string_lossy().into_owned())
}

fn reserve_output_folder(output: &Path, name: &str, overwrite: bool) -> Result<PathBuf, String> {
    let mut destination = output.join(name);
    let mut suffix = 1;
    loop {
        match fs::create_dir(&destination) {
            Ok(()) => return Ok(destination),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists && !overwrite => {
                destination = output.join(format!("{name}_{suffix}"));
                suffix += 1;
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                return fs::symlink_metadata(&destination)
                    .and_then(|metadata| {
                        if metadata.is_dir() {
                            Ok(destination.clone())
                        } else {
                            Err(error)
                        }
                    })
                    .map_err(|error| output_error(&destination, error));
            }
            Err(error) => return Err(output_error(&destination, error)),
        }
    }
}

fn publish_files(
    source: &Path,
    destination: &Path,
    options: &ExtractOptions,
    published_names: &mut HashSet<String>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(source)
        .and_then(|entries| entries.collect::<io::Result<Vec<_>>>())
        .map_err(|error| output_error(source, error))?;
    entries.sort_by_key(|entry| entry.file_name());

    for entry in entries {
        let path = entry.path();
        let target = destination.join(entry.file_name());
        let kind = entry
            .file_type()
            .map_err(|error| output_error(&path, error))?;
        if kind.is_dir() {
            if options.single_dir {
                publish_files(&path, destination, options, published_names)?;
            } else {
                reserve_output_folder(destination, &entry.file_name().to_string_lossy(), true)?;
                publish_files(&path, &target, options, published_names)?;
            }
        } else if kind.is_file() {
            let extension = path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            if !options.only_images
                || MEDIA_EXTENSIONS.contains(&extension.as_str())
                || (options.no_tex_convert && extension == "tex")
            {
                publish_file(path, target, options, published_names)?;
            }
        }
    }
    Ok(())
}

fn publish_file(
    source: PathBuf,
    target: PathBuf,
    options: &ExtractOptions,
    published_names: &mut HashSet<String>,
) -> Result<(), String> {
    let mut source = tempfile::TempPath::from_path(source);
    let mut candidate = target.clone();
    let mut suffix = 1;
    loop {
        let name = candidate
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();
        // In a flattened output, keep distinct entries from this package even in overwrite mode.
        if !published_names.contains(&name) {
            let result = if options.overwrite {
                source.persist(&candidate)
            } else {
                source.persist_noclobber(&candidate)
            };
            match result {
                Ok(()) => {
                    if options.single_dir {
                        published_names.insert(name);
                    }
                    return Ok(());
                }
                Err(error)
                    if !options.overwrite && error.error.kind() == io::ErrorKind::AlreadyExists =>
                {
                    if !options.single_dir {
                        return Ok(());
                    }
                    source = error.path;
                }
                Err(error) => return Err(output_error(&candidate, error.error)),
            }
        }

        let mut name = target.file_stem().unwrap_or_default().to_os_string();
        name.push(format!("_{suffix}"));
        if let Some(extension) = target.extension() {
            name.push(".");
            name.push(extension);
        }
        candidate.set_file_name(name);
        suffix += 1;
    }
}

fn output_error(path: &Path, error: io::Error) -> String {
    format!("无法写入提取路径 {}: {error}", path.display())
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

    run_repkg_command(&repkg_path, &args)
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

            let bundled_path = parent.join("bin").join(exe_name);
            if bundled_path.exists() {
                return bundled_path.to_string_lossy().to_string();
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

fn run_repkg_command(repkg_path: &str, args: &[&str]) -> Result<String, String> {
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::io::Write;

    const REPKG: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/bin/RePKG.exe");

    fn write_package(path: &Path) {
        let entries: &[(&str, &[u8])] = &[
            ("a/poster.png", b"first"),
            ("b/poster.png", b"second"),
            ("b/surface.tex", b"raw texture"),
            ("b/scene.json", b"package metadata"),
        ];
        let mut package = fs::File::create(path).unwrap();
        let magic = b"PKGV0001";
        package
            .write_all(&(magic.len() as i32).to_le_bytes())
            .unwrap();
        package.write_all(magic).unwrap();
        package
            .write_all(&(entries.len() as i32).to_le_bytes())
            .unwrap();
        let mut offset = 0i32;
        for (name, content) in entries {
            package
                .write_all(&(name.len() as i32).to_le_bytes())
                .unwrap();
            package.write_all(name.as_bytes()).unwrap();
            package.write_all(&offset.to_le_bytes()).unwrap();
            package
                .write_all(&(content.len() as i32).to_le_bytes())
                .unwrap();
            offset += content.len() as i32;
        }
        for (_, content) in entries {
            package.write_all(content).unwrap();
        }
    }

    fn options(output: &Path) -> ExtractOptions {
        ExtractOptions {
            output: output.to_string_lossy().into_owned(),
            folder_name: None,
            only_images: true,
            single_dir: false,
            no_tex_convert: true,
            overwrite: false,
        }
    }

    #[test]
    fn media_only_preserves_structure_and_existing_files() {
        let root = tempfile::tempdir().unwrap();
        let input = root.path().join("scene.pkg");
        write_package(&input);
        let output = root.path().join("output");
        fs::create_dir_all(output.join("a")).unwrap();
        fs::write(output.join("keep.txt"), b"root document").unwrap();
        fs::write(output.join("a/keep.pdf"), b"nested document").unwrap();
        fs::write(output.join("a/poster.png"), b"existing image").unwrap();
        let mut options = options(&output);

        extract_package(REPKG, input.to_str().unwrap(), &options).unwrap();
        assert_eq!(
            fs::read(output.join("a/poster.png")).unwrap(),
            b"existing image"
        );
        assert_eq!(fs::read(output.join("b/poster.png")).unwrap(), b"second");
        assert_eq!(
            fs::read(output.join("b/surface.tex")).unwrap(),
            b"raw texture"
        );
        assert!(!output.join("b/scene.json").exists());

        options.overwrite = true;
        extract_package(REPKG, input.to_str().unwrap(), &options).unwrap();
        assert_eq!(fs::read(output.join("a/poster.png")).unwrap(), b"first");
        assert_eq!(fs::read(output.join("keep.txt")).unwrap(), b"root document");
        assert_eq!(
            fs::read(output.join("a/keep.pdf")).unwrap(),
            b"nested document"
        );
    }

    #[test]
    fn flattened_extraction_handles_conflicts_without_removing_existing_content() {
        let root = tempfile::tempdir().unwrap();
        let input = root.path().join("scene.pkg");
        write_package(&input);
        let output = root.path().join("output");
        fs::create_dir_all(output.join("poster.png")).unwrap();
        fs::write(output.join("poster.png/keep.txt"), b"existing document").unwrap();
        let mut options = options(&output);
        options.single_dir = true;
        options.overwrite = true;

        assert!(extract_package(REPKG, input.to_str().unwrap(), &options).is_err());

        options.overwrite = false;
        extract_package(REPKG, input.to_str().unwrap(), &options).unwrap();
        assert_eq!(
            fs::read(output.join("poster.png/keep.txt")).unwrap(),
            b"existing document"
        );
        assert_eq!(fs::read(output.join("poster_1.png")).unwrap(), b"first");
        assert_eq!(fs::read(output.join("poster_2.png")).unwrap(), b"second");
        assert_eq!(
            fs::read(output.join("surface.tex")).unwrap(),
            b"raw texture"
        );
        assert!(!output.join("a").exists());

        let overwrite_output = root.path().join("overwrite");
        fs::create_dir(&overwrite_output).unwrap();
        fs::write(overwrite_output.join("poster.png"), b"old image").unwrap();
        options.output = overwrite_output.to_string_lossy().into_owned();
        options.overwrite = true;

        extract_package(REPKG, input.to_str().unwrap(), &options).unwrap();
        assert_eq!(
            fs::read(overwrite_output.join("poster.png")).unwrap(),
            b"first"
        );
        assert_eq!(
            fs::read(overwrite_output.join("poster_1.png")).unwrap(),
            b"second"
        );
    }

    #[test]
    fn separate_folders_get_unique_paths_without_overwrite() {
        let root = tempfile::tempdir().unwrap();
        let input = root.path().join("scene.pkg");
        write_package(&input);
        let output = root.path().join("output");
        let mut options = options(&output);
        options.folder_name = Some("scene".into());
        options.only_images = false;

        let first = extract_package(REPKG, input.to_str().unwrap(), &options).unwrap();
        let second = extract_package(REPKG, input.to_str().unwrap(), &options).unwrap();
        assert_eq!(Path::new(&first), output.join("scene"));
        assert_eq!(Path::new(&second), output.join("scene_1"));
        assert_eq!(
            fs::read(Path::new(&second).join("b/scene.json")).unwrap(),
            b"package metadata"
        );

        assert!(extract_package(REPKG, "missing.pkg", &options).is_err());
        assert!(!output.join("scene_2").exists());
    }
}
