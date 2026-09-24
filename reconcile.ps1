$ErrorActionPreference = 'SilentlyContinue'
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

function Get-Pids([string]$html) {
  $s = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($m in [regex]::Matches($html, '[?&]productId=([^"&)+ ]+')) {
    $v = $m.Groups[1].Value
    [void]$s.Add($v)
  }
  return $s
}

function Get-Prov([string[]]$pids) {
  $h = @{}
  foreach ($p in $pids) {
    $k = ($p -split '(-|:)')[0]
    $h[$k] = 1 + $h[$k]
  }
  return $h
}

$cats = @(
  @{name='iPhone 15 Pro Max'; path='/en/categories/phones';   q='iphone+15+pro+max'},
  @{name='Samsung Galaxy S24'; path='/en/categories/phones';  q='samsung+galaxy+s24'},
  @{name='MacBook Air M3';     path='/en/categories/laptops'; q='macbook+air+m3'},
  @{name='HONOR 10 Lite';      path='/en/categories/phones';  q='honor+10+lite'},
  @{name='AirPods Pro';        path='/en/categories/audio';   q='airpods+pro'}
)

foreach ($c in $cats) {
  $catPids = @()
  $catHtml = ''
  $seaHtml = ''
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 -Uri ("https://zorino.org" + $c.path)
    $catHtml = $r.Content
    $catPids = Get-Pids $catHtml
  } catch {}

  $seaPids = @()
  $seaQ = @()
  try {
    $r2 = Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 -Uri ("https://zorino.org/en/search?q=" + $c.q)
    $seaHtml = $r2.Content
    $seaPids = Get-Pids $seaHtml
    $seaQ = @($seaHtml -split '[?&]productId=')
  } catch {}

  $catProv = Get-Prov @($catPids)
  $seaProv = Get-Prov @($seaPids)
  $overlap = @($catPids | Where-Object { $seaPids.Contains($_) })

  $out = "=== " + $c.name + " ==="
  $out += "`n  categories(" + $c.path + "): n=" + $catPids.Count + "  providers: " + (($catProv.GetEnumerator() | ForEach-Object { "$($_.Key):$($_.Value)" }) -join ' ')
  $out += "`n  search(q=" + $c.q + "): n=" + $seaPids.Count + "  providers: " + (($seaProv.GetEnumerator() | ForEach-Object { "$($_.Key):$($_.Value)" }) -join ' ')
  $out += "`n  exact-pid overlap (same provider+pid in both surfaces): " + $overlap.Count
  foreach ($o in ($overlap | Select-Object -First 4)) { $out += "`n    - " + $o }
  Write-Output $out
  Write-Output ""
}
