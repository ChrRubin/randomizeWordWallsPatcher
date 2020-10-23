if (Test-Path -Path ".\dist") {
    Remove-Item -Path ".\dist" -Recurse
}

Copy-Item -Path ".\partials" -Recurse -Destination ".\dist\randomizeWordWallsPatcher\partials"
Copy-Item -Path ".\index.js", ".\module.json", ".\rwwSettings.json", ".\LICENSE" -Destination ".\dist\randomizeWordWallsPatcher"

Compress-Archive -Path ".\dist\randomizeWordWallsPatcher" -DestinationPath ".\dist\randomizeWordWallsPatcher.zip"
