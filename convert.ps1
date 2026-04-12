$bytes = [IO.File]::ReadAllBytes("icons\LOGO V PUNTO VERTICAL.png")
$b64 = [Convert]::ToBase64String($bytes)

# Standard Icon (no padding, for browser tabs and standard display)
$svgAny = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><image href="data:image/png;base64,' + $b64 + '" width="100%" height="100%"/></svg>'

# Maskable Icon (20% padding total, 10% each side = 80% center)
# Required for Android/Chrome/iOS to prevent cutting off the logo when applying masks.
$svgMask = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><image href="data:image/png;base64,' + $b64 + '" x="100" y="100" width="800" height="800"/></svg>'

[IO.File]::WriteAllText("icons\icon.svg", $svgAny)
[IO.File]::WriteAllText("icons\icont.svg", $svgAny)
[IO.File]::WriteAllText("icons\maskable-icon.svg", $svgMask)

Write-Output "Double SVG icons generated (any + maskable)."


