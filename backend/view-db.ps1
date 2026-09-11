<#
    view-db.ps1 - look inside the PortDefense database without any GUI tool.

    Run it from the backend folder:

        .\view-db.ps1                          # every table + how many rows it holds
        .\view-db.ps1 ALERTS                   # newest 20 rows of a table
        .\view-db.ps1 THREATS -Limit 50        # newest 50 rows
        .\view-db.ps1 -Sql "SELECT SOURCE, COUNT(*) FROM ALERTS GROUP BY SOURCE"
        .\view-db.ps1 ALERTS -Csv alerts.csv   # save the rows to a file instead

    It talks to the same H2 file the backend uses
    (backend/data/portdefense.mv.db) through the H2 jar Maven already
    downloaded, so there is nothing to install and no connection form to fill
    in. Leave the backend running while you use it: AUTO_SERVER=TRUE lets this
    script and the app read the database at the same time.
#>
param(
    # Table to dump, e.g. ALERTS. Ignored when -Sql is given.
    [Parameter(Position = 0)]
    [string]$Table,

    # Any SQL you like, run as-is.
    [string]$Sql,

    # How many rows to show when dumping a table.
    [int]$Limit = 20,

    # Write the result to this file instead of the screen.
    [string]$Csv
)

$ErrorActionPreference = 'Stop'

# The H2 jar Maven fetched for the backend — newest version wins.
$repo = Join-Path $env:USERPROFILE '.m2\repository\com\h2database\h2'
$jar = Get-ChildItem -Path $repo -Filter 'h2-*.jar' -Recurse -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $jar) {
    Write-Error "No H2 driver found under $repo. Run .\mvnw.cmd compile once, then retry."
    exit 1
}

# H2 wants forward slashes, even on Windows.
$dbFile = Join-Path $PSScriptRoot 'data\portdefense'
if (-not (Test-Path "$dbFile.mv.db")) {
    Write-Error "No database at $dbFile.mv.db. Start the backend once to create it."
    exit 1
}
$url = 'jdbc:h2:file:' + ($dbFile -replace '\\', '/') + ';AUTO_SERVER=TRUE'

if ($Sql) {
    $query = $Sql
}
elseif ($Table) {
    # Most tables carry a timestamp; sort by it when present so "newest first"
    # works without the caller having to know the column name.
    $timeColumn = @{
        'ALERTS'        = 'TIMESTAMP'
        'THREATS'       = 'TIMESTAMP'
        'LOG_EVENTS'    = 'TIMESTAMP'
        'TARGET_CHECKS' = 'CHECKED_AT'
        'REPORTS'       = 'GENERATED_AT'
    }[$Table.ToUpper()]

    if ($timeColumn) {
        $query = "SELECT * FROM $Table ORDER BY $timeColumn DESC LIMIT $Limit"
    }
    else {
        $query = "SELECT * FROM $Table LIMIT $Limit"
    }
}
else {
    $query = @"
SELECT TABLE_NAME, ROW_COUNT_ESTIMATE AS ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'PUBLIC'
ORDER BY ROW_COUNT_ESTIMATE DESC
"@
}

if ($Csv) {
    # H2's CSVWRITE does the export server-side, so big tables stream fine.
    $target = if ([System.IO.Path]::IsPathRooted($Csv)) { $Csv } else { Join-Path (Get-Location) $Csv }
    $escaped = $query -replace "'", "''"
    $query = "CALL CSVWRITE('$($target -replace '\\', '/')', '$escaped')"
}

Write-Host "database: $dbFile.mv.db" -ForegroundColor DarkGray
Write-Host "query   : $($query -replace '\s+', ' ')" -ForegroundColor DarkGray
Write-Host ''

# The account has no password. '""' rather than '' is deliberate: PowerShell
# silently drops a genuinely empty argument when calling a native command, and
# H2's Shell then reads the next flag as the password and prints its usage.
& java -cp $jar.FullName org.h2.tools.Shell -url $url -user sa -password '""' -sql $query

if ($Csv -and $LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host "written to $target - open it in Excel." -ForegroundColor Green
}
