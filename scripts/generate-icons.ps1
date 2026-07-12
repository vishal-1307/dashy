Add-Type -AssemblyName System.Drawing

function New-DashyIcon {
    param(
        [int]$Size,
        [string]$Path,
        [double]$CornerRatio = 0.22
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
        [System.Drawing.Color]::FromArgb(255, 139, 92, 246),
        45
    )

    $radius = [int]($Size * $CornerRatio)
    if ($radius -lt 1) {
        $g.FillRectangle($brush, $rect)
    } else {
        $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path2.AddArc(0, 0, $d, $d, 180, 90)
        $path2.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $path2.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $path2.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $path2.CloseFigure()
        $g.FillPath($brush, $path2)
    }

    $fontSize = $Size * 0.52
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("D", $font, $textBrush, [System.Drawing.RectangleF]::new(0, 0, $Size, $Size * 1.02), $format)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function New-DashyMaskableIcon {
    param([int]$Size, [string]$Path)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
        [System.Drawing.Color]::FromArgb(255, 139, 92, 246),
        45
    )
    $g.FillRectangle($brush, $rect)

    # Keep the glyph inside the ~80% "safe zone" circle maskable icons require.
    $fontSize = $Size * 0.4
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("D", $font, $textBrush, [System.Drawing.RectangleF]::new(0, 0, $Size, $Size * 1.02), $format)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "public/icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

New-DashyIcon -Size 192 -Path (Join-Path $iconsDir "icon-192.png")
New-DashyIcon -Size 512 -Path (Join-Path $iconsDir "icon-512.png")
New-DashyIcon -Size 180 -Path (Join-Path $iconsDir "apple-touch-icon.png") -CornerRatio 0.0
New-DashyIcon -Size 32 -Path (Join-Path $root "public/favicon-32.png") -CornerRatio 0.18
New-DashyIcon -Size 16 -Path (Join-Path $root "public/favicon-16.png") -CornerRatio 0.18
New-DashyMaskableIcon -Size 512 -Path (Join-Path $iconsDir "icon-maskable-512.png")

Write-Host "Icons generated in $iconsDir"
