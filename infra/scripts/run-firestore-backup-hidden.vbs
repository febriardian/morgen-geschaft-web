Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""C:\Users\Axioo\Desktop\Morgen Geschaft Project\infra\scripts\run-firestore-backup.ps1""", 0, True
