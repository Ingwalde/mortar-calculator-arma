param(
  [Parameter(Mandatory=$true)][int]$X,
  [Parameter(Mandatory=$true)][int]$Y,
  [string]$ProcessName = "electron"
)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ClickApi {
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
# DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4 : make THIS process see real physical pixels,
# matching GetDpiForWindow/PrintWindow's bitmap space (avoids Windows' automatic rect virtualization).
[ClickApi]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null

$proc = Get-Process $ProcessName -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
$hwnd = $proc.MainWindowHandle
[ClickApi]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 200
$rect = New-Object ClickApi+RECT
[ClickApi]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
Write-Output "window rect (physical): $($rect.Left),$($rect.Top) - $($rect.Right),$($rect.Bottom)"
$absX = $rect.Left + $X
$absY = $rect.Top + $Y
[ClickApi]::SetCursorPos($absX, $absY) | Out-Null
Start-Sleep -Milliseconds 100
[ClickApi]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 50
[ClickApi]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 300
Write-Output "clicked at screen ($absX,$absY) [window-relative ($X,$Y)]"
