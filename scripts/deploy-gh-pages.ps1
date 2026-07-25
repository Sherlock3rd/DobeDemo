param(
  [string]$Message = 'deploy: publish current build'
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = [IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot '..')
)
$distPath = [IO.Path]::GetFullPath(
  (Join-Path $workspaceRoot 'dist')
)
if (
  -not $distPath.StartsWith(
    $workspaceRoot + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
  )
) {
  throw 'dist is outside workspace'
}
if (-not (Test-Path -LiteralPath (Join-Path $distPath 'index.html'))) {
  throw 'dist/index.html is missing; run npm run build first'
}

$indexName = '.tmp-index-gh-pages-' + [guid]::NewGuid().ToString('N')
$indexPath = [IO.Path]::GetFullPath(
  (Join-Path $workspaceRoot $indexName)
)
if (
  -not $indexPath.StartsWith(
    $workspaceRoot + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
  )
) {
  throw 'temporary index is outside workspace'
}

$expectedFiles = @(
  Get-ChildItem -LiteralPath $distPath -Recurse -File |
    ForEach-Object {
      $_.FullName.Substring($distPath.Length + 1).Replace('\', '/')
    } |
    Sort-Object
)
if ($expectedFiles.Count -lt 3) {
  throw "dist contains too few files: $($expectedFiles.Count)"
}

$previousGitDir = $env:GIT_DIR
$previousWorkTree = $env:GIT_WORK_TREE
$previousIndex = $env:GIT_INDEX_FILE

try {
  Push-Location -LiteralPath $distPath
  $env:GIT_DIR = '..\.git'
  $env:GIT_WORK_TREE = '.'
  $env:GIT_INDEX_FILE = '..\' + $indexName

  git read-tree --empty
  if ($LASTEXITCODE -ne 0) {
    throw 'git read-tree failed'
  }
  git add -f -A -- .
  if ($LASTEXITCODE -ne 0) {
    throw 'git add failed'
  }

  $tree = (git write-tree).Trim()
  $parent = (git rev-parse origin/gh-pages).Trim()
  $env:GIT_AUTHOR_NAME = 'Sherlock3rd'
  $env:GIT_AUTHOR_EMAIL =
    '64402141+Sherlock3rd@users.noreply.github.com'
  $env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
  $env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL
  $commit = (
    git commit-tree $tree -p $parent -m $Message
  ).Trim()

  $publishedFiles = @(
    git ls-tree -r --name-only $commit | Sort-Object
  )
  if (
    $publishedFiles.Count -ne $expectedFiles.Count -or
    (Compare-Object $expectedFiles $publishedFiles).Count -ne 0
  ) {
    throw 'published tree does not exactly match dist'
  }
  if ($publishedFiles -notcontains 'index.html') {
    throw 'published tree is missing index.html'
  }
  if (
    -not (
      $publishedFiles |
        Where-Object { $_ -match '^assets/index-.+\.js$' }
    )
  ) {
    throw 'published tree is missing the current JS asset'
  }
  if (
    -not (
      $publishedFiles |
        Where-Object { $_ -match '^assets/index-.+\.css$' }
    )
  ) {
    throw 'published tree is missing the current CSS asset'
  }

  git push origin "${commit}:refs/heads/gh-pages"
  if ($LASTEXITCODE -ne 0) {
    throw 'gh-pages push failed'
  }

  Write-Output "GH_PAGES_COMMIT=$commit"
  Write-Output "GH_PAGES_TREE=$tree"
  Write-Output ($publishedFiles -join "`n")
}
finally {
  Pop-Location -ErrorAction SilentlyContinue
  if ($null -eq $previousGitDir) {
    Remove-Item Env:GIT_DIR -ErrorAction SilentlyContinue
  }
  else {
    $env:GIT_DIR = $previousGitDir
  }
  if ($null -eq $previousWorkTree) {
    Remove-Item Env:GIT_WORK_TREE -ErrorAction SilentlyContinue
  }
  else {
    $env:GIT_WORK_TREE = $previousWorkTree
  }
  if ($null -eq $previousIndex) {
    Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
  }
  else {
    $env:GIT_INDEX_FILE = $previousIndex
  }

  if (Test-Path -LiteralPath $indexPath) {
    Remove-Item -LiteralPath $indexPath -Force
  }
  $lockPath = $indexPath + '.lock'
  if (Test-Path -LiteralPath $lockPath) {
    Remove-Item -LiteralPath $lockPath -Force
  }
}
