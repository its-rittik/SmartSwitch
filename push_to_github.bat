@echo off
echo Initializing Git repository and pushing to GitHub...
echo.

echo Step 1: Initializing Git repository...
git init

echo Step 2: Adding all files...
git add .

echo Step 3: Creating initial commit...
git commit -m "Initial commit: Smart Switch Dashboard with MQTT control, timers, and persistence"

echo Step 4: Setting main branch...
git branch -M main

echo Step 5: Adding remote origin...
git remote add origin https://github.com/its-rittik/SmartSwitch.git

echo Step 6: Pushing to GitHub...
git push -u origin main

echo.
echo ✅ Successfully pushed to GitHub!
echo 🌐 Repository: https://github.com/its-rittik/SmartSwitch
echo.
pause