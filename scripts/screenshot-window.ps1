param(
  [string]$ProcessName = "electron",
  [string]$OutPath = "D:\tmp\electron-window.png"
)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinCap {
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
[WinCap]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$proc = Get-Process $ProcessName -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) { throw "No window found for process $ProcessName" }
$hwnd = $proc.MainWindowHandle
$rect = New-Object WinCap+RECT
[WinCap]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Output "physical rect: $($rect.Left),$($rect.Top) ${w}x${h}"
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [WinCap]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
Write-Output "PrintWindow ok=$ok"
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved: $OutPath"
