; repkg-gui NSIS 安装钩子
; 用于 Tauri v2 NSIS 打包器的自定义钩子脚本
; 通过 tauri.conf.json 的 installerHooks 配置引用

; ============================================================
; 安装前钩子 - 在复制文件之前执行
; ============================================================
!macro NSIS_HOOK_PREINSTALL
    ; 停止运行中的应用程序，避免文件被占用导致安装失败
    nsExec::ExecToLog 'taskkill /F /IM "repkg-gui.exe"'

    ; 等待进程完全退出
    Sleep 1000

    ; 直接覆盖安装：清理旧版本文件，无需先卸载
    ; 删除旧版本的可执行文件和 bin 目录
    Delete "$INSTDIR\repkg-gui.exe"
    RMDir /r "$INSTDIR\bin"
!macroend

; ============================================================
; 安装后钩子 - 在所有文件复制完成后执行
; ============================================================
!macro NSIS_HOOK_POSTINSTALL
    ; 写入额外的注册表信息（安装大小估算）
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
                  "EstimatedSize" "$0"
!macroend

; ============================================================
; 卸载前钩子 - 在删除文件之前执行
; ============================================================
!macro NSIS_HOOK_PREUNINSTALL
    ; 停止运行中的应用程序
    nsExec::ExecToLog 'taskkill /F /IM "repkg-gui.exe"'

    ; 等待进程完全退出
    Sleep 1000
!macroend

; ============================================================
; 卸载后钩子 - 在删除文件之后执行
; ============================================================
!macro NSIS_HOOK_POSTUNINSTALL
    ; 清理应用数据目录（可选，询问用户）
    MessageBox MB_YESNO "是否删除应用程序配置数据？" IDNO SkipCleanup
        RMDir /r "$LOCALAPPDATA\com.naihe.repkg-gui"
    SkipCleanup:
!macroend
