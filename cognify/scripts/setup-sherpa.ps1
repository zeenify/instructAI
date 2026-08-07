# setup-sherpa.ps1
# Restores the sherpa-onnx Java API sources and native libraries required by the
# Cognify TTS feature. These are gitignored (see .gitignore: com/k2fsa, jniLibs)
# and are downloaded from the official k2-fsa/sherpa-onnx GitHub releases.
#
# Usage:  powershell -ExecutionPolicy Bypass -File cognify\scripts\setup-sherpa.ps1
#         [-Version v1.13.4] [-Force]

param(
    [string]$Version = "v1.13.4",
    [switch]$Force,
    [string]$DestRoot = ""
)

$ErrorActionPreference = "Stop"

if (-not $DestRoot) {
    $DestRoot = Split-Path -Parent $PSScriptRoot
}
$jniLibsDir = Join-Path $DestRoot "app\src\main\jniLibs"
$javaTarget  = Join-Path $DestRoot "app\src\main\java\com\k2fsa"
$work = Join-Path $env:TEMP "sherpa-onnx-setup"

$srcTarball = "https://github.com/k2-fsa/sherpa-onnx/archive/refs/tags/$Version.tar.gz"
$androidArchive = "https://github.com/k2-fsa/sherpa-onnx/releases/download/$Version/sherpa-onnx-$Version-android.tar.bz2"

function Test-Installed {
    $jniOk = Test-Path (Join-Path $jniLibsDir "arm64-v8a\libsherpa-onnx-jni.so")
    $javaOk = Test-Path (Join-Path $javaTarget "sherpa\onnx\OfflineTts.java")
    return ($jniOk -and $javaOk)
}

if ((Test-Installed) -and -not $Force) {
    Write-Host "sherpa-onnx $Version already installed. Use -Force to reinstall."
    exit 0
}

Write-Host "Downloading sherpa-onnx $Version ..."
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $work | Out-Null

function Download-File {
    param([string]$Uri, [string]$OutFile)
    for ($i = 1; $i -le 5; $i++) {
        try {
            Invoke-WebRequest -Uri $Uri -OutFile $OutFile
            if ((Get-Item $OutFile).Length -eq 0) { throw "empty file" }
            return
        } catch {
            Write-Host "  download attempt $i/5 failed: $($_.Exception.Message)"
            Remove-Item -Force $OutFile -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
        }
    }
    throw "Failed to download $Uri after 5 attempts"
}

try {
    $srcArchive = Join-Path $work "sherpa-onnx-$Version.tar.gz"
    $androidArchivePath = Join-Path $work "sherpa-onnx-$Version-android.tar.bz2"

    Write-Host "  $srcTarball"
    Download-File -Uri $srcTarball -OutFile $srcArchive
    Write-Host "  $androidArchive"
    Download-File -Uri $androidArchive -OutFile $androidArchivePath

    # 1. Java API sources (com/k2fsa/sherpa/onnx/*.java)
    Write-Host "Extracting Java API sources ..."
    $srcExtract = Join-Path $work "src"
    New-Item -ItemType Directory -Force -Path $srcExtract | Out-Null
    tar -xzf $srcArchive -C $srcExtract 2>$null
    $loader = Get-ChildItem -Path $srcExtract -Recurse -Filter "LibraryLoader.java" | Select-Object -First 1
    if (-not $loader) { throw "LibraryLoader.java not found in $srcTarball" }
    $comRoot = Split-Path (Split-Path (Split-Path $loader.FullName -Parent) -Parent) -Parent
    Remove-Item -Recurse -Force $javaTarget -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path (Split-Path $javaTarget -Parent) | Out-Null
    Copy-Item -Recurse $comRoot $javaTarget
    if (-not (Test-Path (Join-Path $javaTarget "sherpa\onnx\OfflineTts.java"))) {
        throw "Java API copy failed: OfflineTts.java missing in $javaTarget"
    }
    Write-Host "  -> $javaTarget"

    # 2. Native libraries (libsherpa-onnx-jni.so + libonnxruntime.so per ABI)
    Write-Host "Extracting native libraries ..."
    $libExtract = Join-Path $work "libs"
    New-Item -ItemType Directory -Force -Path $libExtract | Out-Null
    tar -xjf $androidArchivePath -C $libExtract 2>$null
    $jniSos = Get-ChildItem -Path $libExtract -Recurse -Filter "libsherpa-onnx-jni.so"
    if (-not $jniSos) { throw "libsherpa-onnx-jni.so not found in $androidArchive" }
    foreach ($jni in $jniSos) {
        $abi = Split-Path $jni.DirectoryName -Leaf
        $abiDir = Join-Path $jniLibsDir $abi
        New-Item -ItemType Directory -Force -Path $abiDir | Out-Null
        Copy-Item -Force (Join-Path $jni.DirectoryName "*.so") $abiDir
        Write-Host "  -> $abiDir"
    }

    Write-Host "Done. sherpa-onnx $Version installed. Build the app with: gradlew assembleDebug"
}
finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
